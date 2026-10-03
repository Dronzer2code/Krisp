#!/usr/bin/env bash
# Fails if secret variable names or values appear in the production bundle.
# Run after `npm run build`. docs/TRD.md → SECURITY; docs/SETUP.md → SMOKE TESTS S7.
set -euo pipefail

DIST="${1:-dist}"

if [ ! -d "$DIST" ]; then
  echo "check-secrets: $DIST/ not found; run npm run build first" >&2
  exit 2
fi

status=0

if grep -rqE "ELEVENLABS_API_KEY|TIGER_DATABASE_URL|APP_PASSCODE" "$DIST"; then
  echo "check-secrets: FAIL secret variable name found in $DIST/:" >&2
  grep -rlE "ELEVENLABS_API_KEY|TIGER_DATABASE_URL|APP_PASSCODE" "$DIST" >&2
  status=1
fi

# Also check actual values from .env, if present (values are never printed).
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      ELEVENLABS_API_KEY|TIGER_DATABASE_URL|APP_PASSCODE) ;;
      *) continue ;;
    esac
    value="${value%\"}"; value="${value#\"}"
    [ ${#value} -lt 6 ] && continue
    if grep -rqF -- "$value" "$DIST"; then
      echo "check-secrets: FAIL value of $key found in $DIST/" >&2
      status=1
    fi
  done < .env
fi

[ $status -eq 0 ] && echo "check-secrets: OK (no secrets in $DIST/)"
exit $status
