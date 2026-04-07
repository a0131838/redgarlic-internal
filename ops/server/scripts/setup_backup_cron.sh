#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/redgarlic-internal}"
LOG_DIR="${LOG_DIR:-/var/log}"
LOG_FILE="${LOG_FILE:-$LOG_DIR/redgarlic-internal_backup.log}"
CRON_TZ_VALUE="${CRON_TZ_VALUE:-Asia/Shanghai}"
CRON_EXPR="${CRON_EXPR:-0 3 * * *}"
ENV_FILE="${ENV_FILE:-$APP_DIR/ops/server/.deploy.env}"
RUN_CMD="${RUN_CMD:-/bin/bash $APP_DIR/ops/server/scripts/backup_postgres.sh $ENV_FILE}"

ENTRY="$CRON_EXPR $RUN_CMD >> $LOG_FILE 2>&1"
MARKER="backup:postgres-redgarlic"

{
  crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "^CRON_TZ=$CRON_TZ_VALUE$" || true
  echo "CRON_TZ=$CRON_TZ_VALUE"
  echo "$ENTRY # $MARKER"
} | awk '!seen[$0]++' | crontab -

echo "Backup cron installed:"
echo "CRON_TZ=$CRON_TZ_VALUE"
echo "$ENTRY"
