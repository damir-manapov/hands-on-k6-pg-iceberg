#!/usr/bin/env bash
set -euo pipefail

echo "[format]"
pnpm -s format

echo "[lint]"
pnpm -s lint

echo "[typecheck]"
pnpm -s typecheck

echo "[test]"
pnpm -s test

echo "All checks passed"
