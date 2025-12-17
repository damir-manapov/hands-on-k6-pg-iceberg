#!/usr/bin/env bash
set -euo pipefail

./check.sh
./health.sh

echo "All checks + health passed"
