#!/usr/bin/env bash
# Validates that all Docker images in compose files have pinned versions.
# Outdated version detection is handled by Renovate (see renovate.json).
set -euo pipefail

COMPOSE_FILE="${1:-compose/docker-compose.yml}"

echo "[compose-check] Validating image tags in $COMPOSE_FILE"

# Extract all images from compose file
IMAGES=$(grep -E '^\s+image:' "$COMPOSE_FILE" | awk '{print $2}' | sort -u)

ERRORS=0

for IMAGE in $IMAGES; do
  # Skip if image uses 'latest' tag
  if [[ "$IMAGE" =~ :latest$ ]]; then
    echo "✗ $IMAGE - uses 'latest' tag instead of pinned version" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Check if image has a tag at all
  if [[ ! "$IMAGE" =~ : ]]; then
    echo "✗ $IMAGE - no tag specified" >&2
    ERRORS=$((ERRORS + 1))
    continue
  fi

  echo "✓ $IMAGE"
done

echo ""

if [[ $ERRORS -gt 0 ]]; then
  echo "Found $ERRORS unpinned or 'latest' tagged images" >&2
  exit 1
fi

echo "All images are pinned (Renovate handles version updates)"
