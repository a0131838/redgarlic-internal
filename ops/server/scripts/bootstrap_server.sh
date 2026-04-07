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
  echo "Run as root: sudo bash ops/server/scripts/bootstrap_server.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt update
apt upgrade -y
apt install -y git curl ufw nginx certbot python3-certbot-nginx ca-certificates gnupg postgresql-client

if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"

mkdir -p "$APP_DIR"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

npm i -g pm2

ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable

systemctl enable nginx
systemctl restart nginx

echo "Bootstrap done."
echo "Next: sudo -u $DEPLOY_USER bash ops/server/scripts/deploy_app.sh $ENV_FILE"
