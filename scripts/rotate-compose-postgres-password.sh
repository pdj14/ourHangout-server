#!/bin/sh
set -eu

TARGET_DIR="${TARGET_DIR:-/volume1/docker/ourHangout-server}"
ENV_FILE="${ENV_FILE:-$TARGET_DIR/.env}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ourhangout-postgres}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.before-password-rotation-${STAMP}"
ENV_TEMP="${ENV_FILE}.tmp.$$"

log() {
  printf '[postgres-rotate] %s\n' "$1"
}

fail() {
  printf '[postgres-rotate] ERROR: %s\n' "$1" >&2
  exit 1
}

resolve_postgres_container() {
  if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    printf '%s' "$POSTGRES_CONTAINER"
    return 0
  fi

  candidates=$(docker ps -q \
    --filter 'label=com.docker.compose.service=postgres' \
    --filter "label=com.docker.compose.project.working_dir=$TARGET_DIR")
  if [ -z "$candidates" ]; then
    candidates=$(docker ps -aq \
      --filter 'label=com.docker.compose.service=postgres' \
      --filter "label=com.docker.compose.project.working_dir=$TARGET_DIR")
  fi
  if [ -z "$candidates" ]; then
    candidates=$(docker ps -q --filter "name=$POSTGRES_CONTAINER")
  fi
  if [ -z "$candidates" ]; then
    candidates=$(docker ps -aq --filter "name=$POSTGRES_CONTAINER")
  fi

  [ -n "$candidates" ] || return 1
  set -- $candidates
  printf '%s' "$1"
}

cleanup() {
  rm -f "$ENV_TEMP"
}

trap cleanup EXIT
trap 'exit 130' HUP INT TERM

[ "$(id -u)" -eq 0 ] || fail "Run this script after sudo -i."
command -v docker >/dev/null 2>&1 || fail "docker is required."
command -v openssl >/dev/null 2>&1 || fail "openssl is required."
command -v awk >/dev/null 2>&1 || fail "awk is required."
[ -f "$ENV_FILE" ] || fail ".env not found: $ENV_FILE"

resolved=$(resolve_postgres_container || true)
[ -n "$resolved" ] || fail "PostgreSQL container not found for target: $TARGET_DIR"
POSTGRES_CONTAINER="$resolved"

DB_USER=$(docker exec "$POSTGRES_CONTAINER" sh -c 'printf %s "$POSTGRES_USER"')
DB_NAME=$(docker exec "$POSTGRES_CONTAINER" sh -c 'printf %s "$POSTGRES_DB"')

case "$DB_USER" in
  ''|*[!A-Za-z0-9_]*) fail "Unexpected PostgreSQL role name: $DB_USER" ;;
esac
case "$DB_NAME" in
  ''|*[!A-Za-z0-9_]*) fail "Unexpected PostgreSQL database name: $DB_NAME" ;;
esac

NEW_PASSWORD=$(openssl rand -hex 24)
DATABASE_URL="postgresql://${DB_USER}:${NEW_PASSWORD}@postgres:5432/${DB_NAME}"

cp -p "$ENV_FILE" "$ENV_BACKUP"

awk \
  -v db_name="$DB_NAME" \
  -v db_user="$DB_USER" \
  -v db_password="$NEW_PASSWORD" \
  -v database_url="$DATABASE_URL" '
BEGIN { seen_db = 0; seen_user = 0; seen_password = 0; seen_url = 0 }
/^POSTGRES_DB=/ { print "POSTGRES_DB=" db_name; seen_db = 1; next }
/^POSTGRES_USER=/ { print "POSTGRES_USER=" db_user; seen_user = 1; next }
/^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" db_password; seen_password = 1; next }
/^DATABASE_URL=/ { print "DATABASE_URL=" database_url; seen_url = 1; next }
{ print }
END {
  if (!seen_db) print "POSTGRES_DB=" db_name
  if (!seen_user) print "POSTGRES_USER=" db_user
  if (!seen_password) print "POSTGRES_PASSWORD=" db_password
  if (!seen_url) print "DATABASE_URL=" database_url
}
' "$ENV_FILE" > "$ENV_TEMP"

[ -s "$ENV_TEMP" ] || fail "Failed to prepare the updated .env file."

log "Rotating password for PostgreSQL role $DB_USER in container $POSTGRES_CONTAINER."
docker exec "$POSTGRES_CONTAINER" psql \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE \"$DB_USER\" WITH PASSWORD '$NEW_PASSWORD';" >/dev/null

cat "$ENV_TEMP" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

log "Password rotation completed without printing the generated secret."
log "Updated env: $ENV_FILE"
log "Previous env backup: $ENV_BACKUP"
log "Run the deployment immediately so the API receives the new credentials."

trap - EXIT HUP INT TERM
rm -f "$ENV_TEMP"
