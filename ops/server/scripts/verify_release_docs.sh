#!/usr/bin/env bash
set -euo pipefail

TARGET_COMMIT="${1:-HEAD}"

if ! git rev-parse --verify "$TARGET_COMMIT" >/dev/null 2>&1; then
  echo "verify_release_docs: invalid commit: $TARGET_COMMIT"
  exit 1
fi

changed_files="$(git show --name-only --pretty=format: "$TARGET_COMMIT" | sed '/^$/d')"

has_changelog=false
has_release_board=false
has_task=false

if echo "$changed_files" | grep -q '^docs/CHANGELOG-LIVE.md$'; then
  has_changelog=true
fi

if echo "$changed_files" | grep -q '^docs/RELEASE-BOARD.md$'; then
  has_release_board=true
fi

if echo "$changed_files" | grep -Eq '^docs/tasks/TASK-.*\.md$'; then
  has_task=true
fi

if [[ "$has_changelog" != true || "$has_release_board" != true || "$has_task" != true ]]; then
  echo "Release doc gate failed on commit: $TARGET_COMMIT"
  echo "Required in the SAME commit:"
  echo "  - docs/CHANGELOG-LIVE.md"
  echo "  - docs/RELEASE-BOARD.md"
  echo "  - docs/tasks/TASK-*.md"
  echo
  echo "Changed files in commit:"
  echo "$changed_files" | sed 's/^/  - /'
  exit 1
fi

echo "Release doc gate passed for commit: $TARGET_COMMIT"
