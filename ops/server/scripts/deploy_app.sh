#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/server/.deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ "$(id -un)" == "root" ]]; then
  echo "Run as deploy user, not root."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" || -z "${DIRECT_DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL or DIRECT_DATABASE_URL in $ENV_FILE"
  exit 1
fi

if [[ "${ALLOW_LOCAL_DB_IN_PROD:-false}" != "true" ]]; then
  if [[ "$DATABASE_URL" == *"localhost"* || "$DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo "Refusing deploy: DATABASE_URL looks like local/dev database."
    exit 1
  fi
  if [[ "$DIRECT_DATABASE_URL" == *"localhost"* || "$DIRECT_DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo "Refusing deploy: DIRECT_DATABASE_URL looks like local/dev database."
    exit 1
  fi
fi

mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git pull origin "$BRANCH"

if [[ "${CLEAN_UNTRACKED:-true}" == "true" ]]; then
  git clean -fd \
    -e .env \
    -e .env.bak* \
    -e ops/server/.deploy.env \
    -e ops/server/.deploy.env.bak*
fi

if [[ "${SKIP_RELEASE_DOC_CHECK:-false}" != "true" ]]; then
  bash ops/server/scripts/verify_release_docs.sh HEAD
else
  echo "WARNING: SKIP_RELEASE_DOC_CHECK=true (release doc gate bypassed)"
fi

cat > .env <<EOF
NODE_ENV=production
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
DATABASE_URL=$DATABASE_URL
DIRECT_DATABASE_URL=$DIRECT_DATABASE_URL
SESSION_COOKIE_NAME=${SESSION_COOKIE_NAME:-redgarlic_session}
SHARED_FILE_STORAGE_DRIVER=${SHARED_FILE_STORAGE_DRIVER:-local}
SHARED_FILE_S3_BUCKET=${SHARED_FILE_S3_BUCKET:-}
SHARED_FILE_S3_REGION=${SHARED_FILE_S3_REGION:-ap-singapore}
SHARED_FILE_S3_ENDPOINT=${SHARED_FILE_S3_ENDPOINT:-}
SHARED_FILE_S3_FORCE_PATH_STYLE=${SHARED_FILE_S3_FORCE_PATH_STYLE:-false}
SHARED_FILE_S3_ACCESS_KEY_ID=${SHARED_FILE_S3_ACCESS_KEY_ID:-}
SHARED_FILE_S3_SECRET_ACCESS_KEY=${SHARED_FILE_S3_SECRET_ACCESS_KEY:-}
EOF

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start npm --name "$APP_NAME" -- start -- -p "$APP_PORT"
pm2 save

echo "Deploy done: $APP_NAME on port $APP_PORT"
