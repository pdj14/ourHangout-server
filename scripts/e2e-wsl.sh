#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-mock}"
HTTP_BASE_URL="${2:-http://127.0.0.1:18888}"
WS_LOG_FILE=""
WS_PID=""
BACKUP_ENV_FILE=""
RESTORE_ENV=false

usage() {
  cat <<'EOF'
Usage:
  bash scripts/e2e-wsl.sh mock
  bash scripts/e2e-wsl.sh http-error [OPENCLAW_BASE_URL]

Examples:
  bash scripts/e2e-wsl.sh mock
  bash scripts/e2e-wsl.sh http-error http://127.0.0.1:18888
EOF
}

log() {
  printf '[e2e] %s\n' "$*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    exit 1
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

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

wait_for_http_200() {
  local url="$1"
  local name="$2"
  local timeout_sec="${3:-90}"
  local start
  start="$(date +%s)"

  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if (( "$(date +%s)" - start >= timeout_sec )); then
      echo "Timeout waiting for ${name} at ${url}" >&2
      return 1
    fi
    sleep 2
  done
}

start_ws_listener() {
  local token="$1"
  local log_file="$2"

  docker compose exec -T api node - "$token" >"$log_file" 2>&1 <<'NODE' &
const token = process.argv[2];
const WebSocket = require('ws');

const ws = new WebSocket(`ws://localhost:3000/v1/ws?token=${encodeURIComponent(token)}`);
const timeoutMs = 25000;
let seenMessage = false;
let seenAck = false;
let finished = false;

const finish = (code, marker) => {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (marker) console.log(marker);
  if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'done');
  process.exit(code);
};

const timer = setTimeout(() => finish(2, 'WS_TIMEOUT'), timeoutMs);

ws.on('open', () => {
  console.log('WS_OPEN');
});

ws.on('message', (raw) => {
  try {
    const payload = JSON.parse(raw.toString());
    console.log(JSON.stringify(payload));
    if (payload.type === 'chat.message') seenMessage = true;
    if (payload.type === 'chat.ack') seenAck = true;
    if (seenMessage && seenAck) finish(0, 'WS_SUCCESS');
  } catch (error) {
    console.log(`WS_PARSE_ERROR:${error.message}`);
  }
});

ws.on('error', (error) => {
  console.log(`WS_ERROR:${error.message}`);
  finish(3, 'WS_FAILED');
});

ws.on('close', () => {
  if (!finished && !(seenMessage && seenAck)) {
    finish(4, 'WS_CLOSED_EARLY');
  }
});
NODE
  WS_PID=$!
}

cleanup() {
  local exit_code=$?

  if [[ "$RESTORE_ENV" == "true" ]] && [[ -n "$BACKUP_ENV_FILE" ]] && [[ -f "$BACKUP_ENV_FILE" ]]; then
    cp "$BACKUP_ENV_FILE" "$ROOT_DIR/.env"
  fi

  if [[ -n "$BACKUP_ENV_FILE" ]] && [[ -f "$BACKUP_ENV_FILE" ]]; then
    rm -f "$BACKUP_ENV_FILE"
  fi

  if [[ -n "$WS_LOG_FILE" ]] && [[ -f "$WS_LOG_FILE" ]]; then
    rm -f "$WS_LOG_FILE"
  fi

  if [[ -n "${WS_PID:-}" ]]; then
    kill "$WS_PID" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

if [[ "$MODE" != "mock" && "$MODE" != "http-error" ]]; then
  usage
  exit 1
fi

require_cmd docker
require_cmd curl
require_cmd python3

cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  cp ".env.example" ".env"
  log "Created .env from .env.example"
fi

BACKUP_ENV_FILE="$(mktemp)"
cp ".env" "$BACKUP_ENV_FILE"
trap cleanup EXIT

if [[ "$MODE" == "mock" ]]; then
  log "Preparing mock-mode E2E"
  upsert_env "OPENCLAW_MODE" "mock" ".env"
  RESTORE_ENV=true

  docker compose up -d --build
  wait_for_http_200 "http://localhost:3000/health" "health"

  READY_JSON="$(curl -fsS http://localhost:3000/ready)"
  READY_SUCCESS="$(printf '%s' "$READY_JSON" | json_get "success")"
  if [[ "$READY_SUCCESS" != "True" && "$READY_SUCCESS" != "true" ]]; then
    echo "Ready check failed: $READY_JSON" >&2
    exit 1
  fi

  docker compose exec -T api node dist/scripts/seed.js >/dev/null

  PARENT_LOGIN="$(curl -fsS -X POST http://localhost:3000/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"parent@ourhangout.local","password":"Parent123!"}')"

  CHILD_LOGIN="$(curl -fsS -X POST http://localhost:3000/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"child@ourhangout.local","password":"Child123!"}')"

  PARENT_TOKEN="$(printf '%s' "$PARENT_LOGIN" | json_get "data.tokens.accessToken")"
  PARENT_ID="$(printf '%s' "$PARENT_LOGIN" | json_get "data.user.id")"
  CHILD_TOKEN="$(printf '%s' "$CHILD_LOGIN" | json_get "data.tokens.accessToken")"
  CHILD_ID="$(printf '%s' "$CHILD_LOGIN" | json_get "data.user.id")"

  CREATE_ROOM_RESP="$(curl -fsS -X POST http://localhost:3000/v1/chats/rooms/direct \
    -H "Authorization: Bearer ${PARENT_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"peerUserId\":\"${CHILD_ID}\"}")"
  ROOM_ID="$(printf '%s' "$CREATE_ROOM_RESP" | json_get "data.id")"

  WS_LOG_FILE="$(mktemp)"
  start_ws_listener "$CHILD_TOKEN" "$WS_LOG_FILE"

  for _ in $(seq 1 20); do
    if grep -q 'WS_OPEN' "$WS_LOG_FILE" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if ! grep -q 'WS_OPEN' "$WS_LOG_FILE" 2>/dev/null; then
    echo "WebSocket listener did not open in time." >&2
    cat "$WS_LOG_FILE" >&2 || true
    kill "$WS_PID" >/dev/null 2>&1 || true
    exit 1
  fi

  TEST_MESSAGE="e2e-$(date +%s)"
  curl -fsS -X POST "http://localhost:3000/v1/chats/rooms/${ROOM_ID}/messages" \
    -H "Authorization: Bearer ${PARENT_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"content\":\"${TEST_MESSAGE}\"}" >/dev/null

  if ! wait "$WS_PID"; then
    echo "WebSocket verification failed." >&2
    cat "$WS_LOG_FILE" >&2 || true
    exit 1
  fi

  MESSAGES_RESP="$(curl -fsS "http://localhost:3000/v1/chats/rooms/${ROOM_ID}/messages?limit=50" \
    -H "Authorization: Bearer ${PARENT_TOKEN}")"

  HAS_OUTBOUND="$(printf '%s' "$MESSAGES_RESP" | python3 -c 'import json,sys
target = sys.argv[1]
payload = json.load(sys.stdin)
items = payload.get("data", [])
print(any(msg.get("content") == target for msg in items))
' "$TEST_MESSAGE")"

  HAS_MOCK_REPLY="$(printf '%s' "$MESSAGES_RESP" | python3 -c 'import json,sys
payload = json.load(sys.stdin)
items = payload.get("data", [])
print(any(str(msg.get("content", "")).startswith("[mock-openclaw]") for msg in items))
')"

  if [[ "$HAS_OUTBOUND" != "True" ]]; then
    echo "Outbound message not found in message list." >&2
    exit 1
  fi

  if [[ "$HAS_MOCK_REPLY" != "True" ]]; then
    echo "Mock provider reply not found in message list." >&2
    exit 1
  fi

  log "Mock E2E passed"
  log "parentId=${PARENT_ID}, childId=${CHILD_ID}, roomId=${ROOM_ID}"
  exit 0
fi

if [[ "$MODE" == "http-error" ]]; then
  log "Preparing http-error check mode"
  upsert_env "OPENCLAW_MODE" "http" ".env"
  upsert_env "OPENCLAW_BASE_URL" "$HTTP_BASE_URL" ".env"
  RESTORE_ENV=true

  docker compose up -d --build
  wait_for_http_200 "http://localhost:3000/health" "health"

  docker compose exec -T api node dist/scripts/seed.js >/dev/null

  PARENT_LOGIN="$(curl -fsS -X POST http://localhost:3000/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"parent@ourhangout.local","password":"Parent123!"}')"
  PARENT_TOKEN="$(printf '%s' "$PARENT_LOGIN" | json_get "data.tokens.accessToken")"

  TMP_BODY="$(mktemp)"
  HTTP_STATUS="$(
    curl -sS -o "$TMP_BODY" -w '%{http_code}' -X POST http://localhost:3000/v1/openclaw/test-message \
      -H "Authorization: Bearer ${PARENT_TOKEN}" \
      -H 'Content-Type: application/json' \
      -d '{"content":"http provider error check"}' || true
  )"
  RESPONSE_BODY="$(cat "$TMP_BODY")"
  rm -f "$TMP_BODY"

  if [[ "$HTTP_STATUS" == "200" ]]; then
    echo "Expected non-200 from OpenClaw HTTP test, but got 200." >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  if ! printf '%s' "$RESPONSE_BODY" | grep -q 'OPENCLAW_'; then
    echo "Expected OpenClaw error code in response body." >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  READY_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ready || true)"
  log "ready status in http-error mode: ${READY_STATUS} (503 expected if OpenClaw unreachable)"
  log "Recent api logs:"
  docker compose logs --tail=80 api
  log "HTTP provider error-check passed"
  exit 0
fi
