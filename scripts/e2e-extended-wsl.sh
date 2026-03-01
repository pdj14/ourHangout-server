#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

json_get() {
  local path="$1"
  python3 -c 'import json,sys
path = [p for p in sys.argv[1].split(".") if p]
data = json.load(sys.stdin)
for key in path:
    data = data[int(key)] if key.isdigit() else data[key]
if isinstance(data, (dict, list)):
    print(json.dumps(data, ensure_ascii=False))
else:
    print(data)
' "$path"
}

api_post() {
  local url="$1"
  local body="$2"
  local token="${3:-}"
  if [[ -n "$token" ]]; then
    curl -fsS -X POST "$url" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d "$body"
  else
    curl -fsS -X POST "$url" \
      -H 'Content-Type: application/json' \
      -d "$body"
  fi
}

api_put() {
  local url="$1"
  local body="$2"
  local token="$3"
  curl -fsS -X PUT "$url" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "$body"
}

api_get() {
  local url="$1"
  local token="${2:-}"
  if [[ -n "$token" ]]; then
    curl -fsS "$url" -H "Authorization: Bearer ${token}"
  else
    curl -fsS "$url"
  fi
}

sha256_hex() {
  local value="$1"
  python3 -c 'import hashlib,sys; print(hashlib.sha256(sys.argv[1].encode()).hexdigest())' "$value"
}

wait_for_health() {
  local timeout_sec="${1:-90}"
  local start
  start="$(date +%s)"

  while true; do
    if curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
      return 0
    fi

    if (( "$(date +%s)" - start >= timeout_sec )); then
      echo "[e2e-extended] timeout waiting for health endpoint" >&2
      return 1
    fi

    sleep 2
  done
}

echo "[e2e-extended] starting"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  cp ".env.example" ".env"
fi

if grep -q '^OPENCLAW_MODE=' ".env"; then
  sed -i 's/^OPENCLAW_MODE=.*/OPENCLAW_MODE=mock/' ".env"
else
  echo 'OPENCLAW_MODE=mock' >>".env"
fi

docker compose up -d --build
docker compose exec -T api node dist/scripts/seed.js >/dev/null

wait_for_health

PARENT_LOGIN="$(api_post 'http://localhost:3000/v1/auth/login' '{"email":"parent@ourhangout.local","password":"Parent123!"}')"
CHILD_LOGIN="$(api_post 'http://localhost:3000/v1/auth/login' '{"email":"child@ourhangout.local","password":"Child123!"}')"

PARENT_TOKEN="$(printf '%s' "$PARENT_LOGIN" | json_get 'data.tokens.accessToken')"
CHILD_TOKEN="$(printf '%s' "$CHILD_LOGIN" | json_get 'data.tokens.accessToken')"
CHILD_REFRESH="$(printf '%s' "$CHILD_LOGIN" | json_get 'data.tokens.refreshToken')"

PAIR_CODE="$(api_post 'http://localhost:3000/v1/pairing/code' '{"ttlSeconds":300,"relationshipType":"parent_child"}' "$PARENT_TOKEN")"
CODE_VALUE="$(printf '%s' "$PAIR_CODE" | json_get 'data.code')"

PAIR_CONSUME="$(api_post 'http://localhost:3000/v1/pairing/consume' "{\"code\":\"${CODE_VALUE}\"}" "$CHILD_TOKEN")"
REL_TYPE="$(printf '%s' "$PAIR_CONSUME" | json_get 'data.relationshipType')"
if [[ "$REL_TYPE" != "parent_child" ]]; then
  echo "[e2e-extended] expected parent_child relationship type, got: $REL_TYPE" >&2
  exit 1
fi

api_put "http://localhost:3000/v1/auth/profile/phone" '{"phone":"+821012345678"}' "$PARENT_TOKEN" >/dev/null
PHONE_HASH="$(sha256_hex '+821012345678')"

api_post \
  'http://localhost:3000/v1/contacts/sync' \
  "{\"clearMissing\":true,\"contacts\":[{\"type\":\"phone\",\"hash\":\"${PHONE_HASH}\",\"label\":\"parent-phone\"}]}" \
  "$CHILD_TOKEN" >/dev/null

MATCHES="$(api_get 'http://localhost:3000/v1/contacts/matches?limit=10' "$CHILD_TOKEN")"
MATCH_BY="$(printf '%s' "$MATCHES" | json_get 'data.0.matchedBy')"
if [[ "$MATCH_BY" != "phone" ]]; then
  echo "[e2e-extended] expected first match by phone, got: $MATCH_BY" >&2
  exit 1
fi

api_post \
  'http://localhost:3000/v1/auth/change-password' \
  '{"currentPassword":"Child123!","newPassword":"Child456!"}' \
  "$CHILD_TOKEN" >/dev/null

set +e
REFRESH_STATUS="$(curl -sS -o /tmp/refresh_result.json -w '%{http_code}' -X POST 'http://localhost:3000/v1/auth/refresh' \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"${CHILD_REFRESH}\"}")"
set -e
if [[ "$REFRESH_STATUS" == "200" ]]; then
  echo "[e2e-extended] expected refresh token to be revoked after password change" >&2
  cat /tmp/refresh_result.json >&2 || true
  exit 1
fi

NEW_LOGIN="$(api_post 'http://localhost:3000/v1/auth/login' '{"email":"child@ourhangout.local","password":"Child456!"}')"
NEW_TOKEN="$(printf '%s' "$NEW_LOGIN" | json_get 'data.tokens.accessToken')"

# Restore seed password for repeatability.
api_post \
  'http://localhost:3000/v1/auth/change-password' \
  '{"currentPassword":"Child456!","newPassword":"Child123!"}' \
  "$NEW_TOKEN" >/dev/null

echo "[e2e-extended] passed"
