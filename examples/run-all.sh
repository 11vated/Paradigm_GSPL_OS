#!/bin/bash
# Run all GSPL examples and output artifacts
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE="$DIR/.."
OUTPUT="$DIR/../output"

echo "=== GSPL Paradigm Engine — Running Examples ==="
echo ""

for file in "$DIR"/*.gspl; do
  name=$(basename "$file" .gspl)
  echo "▶ Running: $name"
  cd "$ENGINE" && node dist/runtime/cli.js run "$file" --output "$OUTPUT/$name" --verbose 2>&1 || echo "  ⚠ Completed with warnings"
  echo ""
done

echo "=== All examples complete ==="
echo "Artifacts written to: $OUTPUT"
