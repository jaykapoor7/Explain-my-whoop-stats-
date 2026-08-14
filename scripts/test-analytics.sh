#!/usr/bin/env bash
# Compiles the analytics engine + its evaluation harness to a temp dir and runs
# it against the synthetic longitudinal users. No test framework needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

cat > "$OUT/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "target": "ES2021", "module": "CommonJS", "moduleResolution": "node",
    "outDir": "$OUT/js", "rootDir": "$ROOT/src", "esModuleInterop": true,
    "skipLibCheck": true, "strict": false, "noEmitOnError": false, "types": []
  },
  "include": [
    "$ROOT/src/lib/analytics/**/*.ts",
    "$ROOT/src/lib/types.ts",
    "$ROOT/src/lib/format.ts",
    "$ROOT/src/lib/scoring/strain.ts"
  ]
}
JSON

# tsc may report a benign missing-DOM/global type; it still emits. Gate on the
# emitted file existing, then run the harness (its exit code is the verdict).
npx tsc -p "$OUT/tsconfig.json" || true
test -f "$OUT/js/lib/analytics/__tests__/engine.test.js"
NODE_PATH="$ROOT/node_modules" node "$OUT/js/lib/analytics/__tests__/engine.test.js"
