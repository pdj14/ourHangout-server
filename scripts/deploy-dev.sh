#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec sh "$SCRIPT_DIR/deploy-compose.sh" dev feature/openclaw-connector docker-compose.dev.yml
