#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: sh scripts/deploy-compose.sh <env-name> <branch> <compose-file>" >&2
  exit 1
fi

ENV_NAME="$1"
BRANCH_NAME="$2"
COMPOSE_FILE_NAME="$3"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE_PATH="$REPO_DIR/$COMPOSE_FILE_NAME"

log() {
  printf '[%s] %s\n' "$ENV_NAME" "$1"
}

fail() {
  printf '[%s] ERROR: %s\n' "$ENV_NAME" "$1" >&2
  exit 1
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE_PATH" "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE_PATH" "$@"
    return
  fi

  fail "docker compose or docker-compose is required."
}

ensure_branch() {
  git fetch origin "$BRANCH_NAME"

  if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    git checkout "$BRANCH_NAME"
  else
    git checkout -b "$BRANCH_NAME" "origin/$BRANCH_NAME"
  fi

  git pull --ff-only origin "$BRANCH_NAME"
}

ensure_clean_worktree() {
  if [ "${ALLOW_DIRTY:-0}" = "1" ]; then
    log "ALLOW_DIRTY=1 set, skipping clean worktree check."
    return
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    fail "Working tree has uncommitted changes. Commit/stash them first or rerun with ALLOW_DIRTY=1."
  fi
}

mkdir -p "$REPO_DIR/logs" "$REPO_DIR/storage/media" "$REPO_DIR/storage/app-updates"

if [ ! -f "$REPO_DIR/.env" ]; then
  fail ".env is missing at $REPO_DIR/.env"
fi

if [ ! -f "$COMPOSE_FILE_PATH" ]; then
  fail "Compose file not found: $COMPOSE_FILE_PATH"
fi

cd "$REPO_DIR"

log "Checking git worktree."
ensure_clean_worktree

log "Switching to branch $BRANCH_NAME and pulling latest code."
ensure_branch

log "Ensuring bind-mount directories exist."
mkdir -p "$REPO_DIR/logs" "$REPO_DIR/storage/media" "$REPO_DIR/storage/app-updates"

log "Starting postgres and redis."
compose up -d postgres redis

log "Building migrate and api images."
compose build migrate api

log "Running migrations."
compose run --rm migrate

log "Recreating api container."
compose up -d --no-deps --force-recreate api

log "Current container status:"
compose ps

log "Deployment finished."
