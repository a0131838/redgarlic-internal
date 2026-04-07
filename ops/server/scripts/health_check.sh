#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/server/.deploy.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

BASE_URL="${NEXT_PUBLIC_APP_URL%/}"

echo "Health check: $BASE_URL"

ok_code() {
  case "$1" in
    200|301|302|303|307|308) return 0 ;;
    *) return 1 ;;
  esac
}

FAIL=0

for path in "/" "/admin/login" "/api/health"; do
  url="$BASE_URL$path"
  code="000"
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    code="$(curl -k -sS -o /dev/null -w '%{http_code}' -m 10 -I "$url" || true)"
    if ok_code "$code"; then
      break
    fi
    sleep 1
  done
  echo "  $code  $url"
  if ! ok_code "$code"; then
    FAIL=1
  fi
done

if [[ "$FAIL" == "1" ]]; then
  echo "Health check FAILED."
  exit 2
fi

echo "Health check OK."
