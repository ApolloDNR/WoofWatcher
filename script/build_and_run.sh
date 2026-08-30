#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/artifacts/woofwatcher-mobile"

show_usage() {
  cat <<'USAGE'
usage: ./script/build_and_run.sh [mode]

Modes:
  start, run        Start the clean consumer preview
  --ios, ios        Start Expo and open iOS
  --android, android
                    Start Expo and open Android
  --web, web        Start Expo for web
  --dev-client, dev-client
                    Start Expo in development-client mode
  --internal, internal
                    Start Expo with owner and QA tooling visible
  --tunnel, tunnel  Start Expo using tunnel transport
  --export-web, export-web
                    Export the local web build
  --doctor, doctor  Run WoofWatcher's mobile release diagnostics
  --help, help      Show this help
USAGE
}

resolve_pnpm_cmd() {
  if command -v corepack >/dev/null 2>&1; then
    PNPM_CMD=(corepack pnpm)
  elif command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
  else
    echo "WoofWatcher requires pnpm. Install Corepack or pnpm, then try again." >&2
    exit 1
  fi
}

run_expo() {
  cd "$APP_DIR"
  exec "${PNPM_CMD[@]}" exec expo "$@"
}

run_consumer_expo() {
  export EXPO_PUBLIC_CONSUMER_PREVIEW=1
  run_expo "$@"
}

resolve_pnpm_cmd

case "$MODE" in
  start|run)
    run_consumer_expo start
    ;;
  --ios|ios)
    run_consumer_expo start --ios
    ;;
  --android|android)
    run_consumer_expo start --android
    ;;
  --web|web)
    run_consumer_expo start --web
    ;;
  --dev-client|dev-client)
    run_expo start --dev-client
    ;;
  --internal|internal)
    run_expo start
    ;;
  --tunnel|tunnel)
    run_expo start --tunnel
    ;;
  --export-web|export-web)
    run_expo export --platform web
    ;;
  --doctor|doctor)
    cd "$ROOT_DIR"
    exec "${PNPM_CMD[@]}" run doctor:mobile-beta
    ;;
  --help|help)
    show_usage
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac
