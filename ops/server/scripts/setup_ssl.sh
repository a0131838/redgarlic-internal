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
  echo "Run as root: sudo bash ops/server/scripts/setup_ssl.sh"
  exit 1
fi

certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect
systemctl reload nginx

echo "SSL ready for $DOMAIN"
