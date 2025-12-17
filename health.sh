#!/usr/bin/env bash
set -euo pipefail

echo "[gitleaks] scanning repo"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git -v --redact || { echo "gitleaks found issues"; exit 1; }
else
  echo "gitleaks not installed; skipping secret scan" >&2
fi

echo "[dependency audit]"
pnpm audit --prod || { echo "vulnerabilities found"; exit 1; }

echo "[outdated dependencies check]"
OUTDATED_TABLE=$(pnpm outdated --long || true)
echo "$OUTDATED_TABLE"
# Heuristic: count data lines that look like table rows listing packages
DATA_ROWS=$(echo "$OUTDATED_TABLE" | awk '/^│/ {print}' | wc -l | tr -d ' ')
if [[ "$DATA_ROWS" =~ ^[0-9]+$ ]] && [[ "$DATA_ROWS" -gt 0 ]]; then
  echo "Outdated dependencies found ($DATA_ROWS)" >&2
  exit 1
fi

echo "Health checks finished"
