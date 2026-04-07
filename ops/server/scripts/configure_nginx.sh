#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/server/.deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash ops/server/scripts/configure_nginx.sh"
  exit 1
fi

TEMPLATE="ops/server/templates/nginx.redgarlic-internal.conf"
TARGET="/etc/nginx/sites-available/$APP_NAME"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE"
  exit 1
fi

sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__APP_PORT__/$APP_PORT/g" "$TEMPLATE" > "$TARGET"
ln -sf "$TARGET" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Nginx configured for $DOMAIN"
