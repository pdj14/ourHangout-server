#!/bin/sh
set -eu

TARGET_DIR="${TARGET_DIR:-/volume1/docker/ourHangout-server}"
REPO_URL="${REPO_URL:-https://github.com/pdj14/ourHangout-server.git}"
BRANCH="${BRANCH:-main}"
API_CONTAINER="${API_CONTAINER:-ourhangout-api}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ourhangout-postgres}"
MIGRATE_CONTAINER="${MIGRATE_CONTAINER:-ourhangout-migrate}"
VERIFY_URL="${VERIFY_URL:-http://127.0.0.1:3000}"

STAMP="$(date +%Y%m%d-%H%M%S)"
PARENT_DIR="$(dirname "$TARGET_DIR")"
BASE_NAME="$(basename "$TARGET_DIR")"
NEW_DIR="${TARGET_DIR}.git-new-${STAMP}"
BACKUP_DIR="${TARGET_DIR}.backup-${STAMP}"
DB_DUMP="${PARENT_DIR}/${BASE_NAME}-before-openclaw-removal-${STAMP}.sql"

SWAPPED=0
DEPLOY_STARTED=0
API_WAS_RUNNING=0

log() {
  printf '[main-bootstrap] %s\n' "$1"
}

fail() {
  printf '[main-bootstrap] ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required."
}

on_exit() {
  status=$?
  trap - EXIT HUP INT TERM

  if [ "$status" -ne 0 ]; then
    if [ "$SWAPPED" -eq 1 ] && [ "$DEPLOY_STARTED" -eq 0 ]; then
      log "Failure occurred before migration; restoring the original folder."

      if [ -d "$TARGET_DIR/storage" ] && [ ! -e "$BACKUP_DIR/storage" ]; then
        mv "$TARGET_DIR/storage" "$BACKUP_DIR/storage" || true
      fi
      if [ -d "$TARGET_DIR/logs" ] && [ ! -e "$BACKUP_DIR/logs" ]; then
        mv "$TARGET_DIR/logs" "$BACKUP_DIR/logs" || true
      fi
      if [ -d "$TARGET_DIR" ]; then
        mv "$TARGET_DIR" "${NEW_DIR}.failed" || true
      fi
      if [ -d "$BACKUP_DIR" ]; then
        mv "$BACKUP_DIR" "$TARGET_DIR" || true
      fi
      if [ "$API_WAS_RUNNING" -eq 1 ]; then
        docker start "$API_CONTAINER" >/dev/null 2>&1 || true
      fi
    elif [ "$DEPLOY_STARTED" -eq 1 ]; then
      log "Deployment failed after migration was allowed to start; automatic rollback was skipped."
      log "Database dump: $DB_DUMP"
      log "Original folder: $BACKUP_DIR"
    fi
  fi

  exit "$status"
}

trap on_exit EXIT
trap 'exit 130' HUP INT TERM

[ "$(id -u)" -eq 0 ] || fail "Run this script after sudo -i."

case "$TARGET_DIR" in
  /volume*/docker/*) ;;
  *) fail "TARGET_DIR must be a project directory under /volume*/docker/." ;;
esac

require_command docker
require_command git
require_command curl

[ -d "$TARGET_DIR" ] || fail "Target directory not found: $TARGET_DIR"
[ -f "$TARGET_DIR/.env" ] || fail ".env not found: $TARGET_DIR/.env"
[ ! -e "$NEW_DIR" ] || fail "Temporary clone path already exists: $NEW_DIR"
[ ! -e "$BACKUP_DIR" ] || fail "Backup path already exists: $BACKUP_DIR"

if git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Target is already a Git worktree; updating deployment scripts first."
  git -C "$TARGET_DIR" fetch origin "$BRANCH"
  git -C "$TARGET_DIR" checkout "$BRANCH"
  git -C "$TARGET_DIR" pull --ff-only origin "$BRANCH"
  log "Running the normal main deployment."
  cd "$TARGET_DIR"
  sh scripts/deploy-main.sh
  docker rm -f "$MIGRATE_CONTAINER" >/dev/null 2>&1 || true
  curl -fsS "$VERIFY_URL/health" >/dev/null
  curl -fsS "$VERIFY_URL/ready" >/dev/null
  log "Deployment finished: $VERIFY_URL"
  trap - EXIT HUP INT TERM
  exit 0
fi

docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || fail "PostgreSQL container not found: $POSTGRES_CONTAINER"

log "Cloning $REPO_URL ($BRANCH) into a temporary directory."
git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$NEW_DIR"

log "Creating PostgreSQL dump: $DB_DUMP"
docker exec "$POSTGRES_CONTAINER" sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DB_DUMP"
[ -s "$DB_DUMP" ] || fail "Database dump is empty: $DB_DUMP"

if [ "$(docker inspect -f '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null || printf false)" = "true" ]; then
  API_WAS_RUNNING=1
  log "Stopping API container: $API_CONTAINER"
  docker stop "$API_CONTAINER" >/dev/null
fi

log "Replacing the uploaded project folder with the Git clone."
cd "$PARENT_DIR"
mv "$TARGET_DIR" "$BACKUP_DIR"
mv "$NEW_DIR" "$TARGET_DIR"
SWAPPED=1

cp -p "$BACKUP_DIR/.env" "$TARGET_DIR/.env"

if [ -d "$BACKUP_DIR/storage" ]; then
  mv "$BACKUP_DIR/storage" "$TARGET_DIR/storage"
fi
if [ -d "$BACKUP_DIR/logs" ]; then
  mv "$BACKUP_DIR/logs" "$TARGET_DIR/logs"
fi

mkdir -p "$TARGET_DIR/logs" "$TARGET_DIR/storage/media" "$TARGET_DIR/storage/app-updates"

log "Starting the normal main deployment."
DEPLOY_STARTED=1
cd "$TARGET_DIR"
sh scripts/deploy-main.sh

docker rm -f "$MIGRATE_CONTAINER" >/dev/null 2>&1 || true

log "Verifying containers and health endpoints."
docker ps --filter "name=ourhangout"
curl -fsS "$VERIFY_URL/health"
printf '\n'
curl -fsS "$VERIFY_URL/ready"
printf '\n'

log "Deployment finished."
log "Database dump: $DB_DUMP"
log "Original folder: $BACKUP_DIR"
log "Keep both backups until application-level checks pass."

trap - EXIT HUP INT TERM
