#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
OUT_DIR="$ROOT/diagnostics"
PATHS_DIR="$OUT_DIR/paths"
BUNDLE="$ROOT/diagnostics_bundle.tar.gz"

mkdir -p "$OUT_DIR" "$PATHS_DIR"

{
  echo "=== git rev-parse HEAD ==="
  git rev-parse HEAD
  echo
  echo "=== git status ==="
  git status
  echo
  echo "=== git log -n 20 ==="
  git log -n 20
} > "$OUT_DIR/frontend_git.txt"

{
  echo "=== src/app ==="
  if [ -d "$ROOT/src/app" ]; then
    find "$ROOT/src/app" -maxdepth 8 -print
  else
    echo "missing: src/app"
  fi
  echo
  echo "=== src/app/api ==="
  if [ -d "$ROOT/src/app/api" ]; then
    find "$ROOT/src/app/api" -maxdepth 8 -print
  else
    echo "missing: src/app/api"
  fi
} > "$OUT_DIR/frontend_routes.txt"

{
  echo "=== env var names referenced in code ==="
  rg -o "process\.env\.[A-Z0-9_]+" "$ROOT/src" "$ROOT" 2>/dev/null | sed "s/process\.env\.//" || true
  rg -o "NEXT_PUBLIC_[A-Z0-9_]+" "$ROOT/src" "$ROOT" 2>/dev/null || true
} | sort -u > "$OUT_DIR/frontend_env_hint.txt"

{
  echo "=== rg: monthly ==="
  rg -n "monthly" "$ROOT/src" || true
  echo
  echo "=== rg: Monats ==="
  rg -n "Monats" "$ROOT/src" || true
  echo
  echo "=== rg: kilometers ==="
  rg -n "kilometers" "$ROOT/src" || true
  echo
  echo "=== rg: DONE ==="
  rg -n "DONE" "$ROOT/src" || true
  echo
  echo "=== rg: km-entries ==="
  rg -n "km-entries" "$ROOT/src" || true
  echo
  echo "=== rg: /admin/ ==="
  rg -n "/admin/" "$ROOT/src" || true
  echo
  echo "=== rg: /me/ ==="
  rg -n "/me/" "$ROOT/src" || true
  echo
  echo "=== rg: force-dynamic ==="
  rg -n "force-dynamic" "$ROOT/src" || true
} > "$OUT_DIR/frontend_search_results.txt"

if [ -d "$ROOT/src/app/admin" ]; then
  cp -R "$ROOT/src/app/admin" "$PATHS_DIR/"
fi
if [ -d "$ROOT/src/app/me" ]; then
  cp -R "$ROOT/src/app/me" "$PATHS_DIR/"
fi
if [ -d "$ROOT/src/app/api" ]; then
  cp -R "$ROOT/src/app/api" "$PATHS_DIR/"
fi
if [ -d "$ROOT/src/lib" ]; then
  cp -R "$ROOT/src/lib" "$PATHS_DIR/"
fi

for cfg in "$ROOT"/next.config.*; do
  if [ -f "$cfg" ]; then
    cp "$cfg" "$PATHS_DIR/"
  fi
done

tar -czf "$BUNDLE" -C "$ROOT" diagnostics

echo "Wrote $BUNDLE"
