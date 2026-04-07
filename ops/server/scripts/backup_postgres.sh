#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/server/.deploy.env}"
if [[ ! -r "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

APP_NAME="${APP_NAME:-redgarlic-internal}"
BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/$APP_NAME}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="$BACKUP_DIR/${APP_NAME}_${STAMP}.dump"

pg_dump "$DIRECT_DATABASE_URL" -Fc -f "$TARGET"
find "$BACKUP_DIR" -type f -name "${APP_NAME}_*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $TARGET"
