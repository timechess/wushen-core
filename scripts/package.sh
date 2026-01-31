#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if ! command -v cargo >/dev/null 2>&1; then
  echo "error: cargo not found. Please install Rust toolchain first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm not found. Please install Node.js first."
  exit 1
fi

if ! cargo tauri --version >/dev/null 2>&1; then
  echo "error: tauri-cli not found. Run: cargo install tauri-cli"
  exit 1
fi

if [[ "${SKIP_NPM_INSTALL:-}" != "1" ]]; then
  if [[ -f "frontend/package-lock.json" ]]; then
    npm --prefix frontend ci
  else
    npm --prefix frontend install
  fi
fi

cd src-tauri && cargo tauri build

echo "Build complete. Bundles are in src-tauri/target/release/bundle"
