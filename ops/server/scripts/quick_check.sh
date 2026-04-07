#!/usr/bin/env bash
set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG_FILE="${1:-$SERVER_DIR/server-handoff.env}"

if [[ ! -f "$CFG_FILE" ]]; then
  echo "Missing config: $CFG_FILE"
  echo "Create it from: $SERVER_DIR/server-handoff.env.example"
  exit 1
fi

# shellcheck disable=SC1090
source "$CFG_FILE"

for key in SSH_HOST SSH_PORT SSH_USER SSH_KEY_PATH APP_DIR APP_NAME HEALTH_URL; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required config: $key"
    exit 1
  fi
done

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "SSH key not found: $SSH_KEY_PATH"
  exit 1
fi

SSH_CMD=(ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=accept-new -p "$SSH_PORT" "$SSH_USER@$SSH_HOST")

echo "== remote basic =="
"${SSH_CMD[@]}" "hostname && whoami && cd '$APP_DIR' && pwd"

echo
echo "== pm2 status =="
"${SSH_CMD[@]}" "pm2 status '$APP_NAME' || pm2 status"

echo
echo "== app build id =="
"${SSH_CMD[@]}" "cd '$APP_DIR' && (cat .next/BUILD_ID || echo 'NO_BUILD_ID')"

echo
echo "== http health =="
curl -sS -o /dev/null -w "code=%{http_code} url=%{url_effective}\n" "$HEALTH_URL"
