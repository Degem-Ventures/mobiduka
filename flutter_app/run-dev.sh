#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-mobiduka-flutter}"
CONTAINER_NAME="${CONTAINER_NAME:-mobiduka-flutter-dev}"
PORT="${PORT:-8080}"
HOST_PORT="${HOST_PORT:-$PORT}"

if command -v docker >/dev/null 2>&1; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

find_free_port() {
  local start_port="${1:-8080}"
  local candidate="$start_port"
  local max_port=$((start_port + 30))

  while (( candidate <= max_port )); do
    if ! ss -lnt | awk '{print $4}' | grep -Eq ":${candidate}$"; then
      echo "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
  done

  echo "$start_port" >&2
  return 1
}

if command -v ss >/dev/null 2>&1; then
  HOST_PORT="$(find_free_port "$HOST_PORT")"
else
  echo "warning: ss not available; assuming requested port is free" >&2
fi

echo "Starting MobiDuka Flutter app on http://localhost:${HOST_PORT}"

docker build -t "$IMAGE_NAME" "$PROJECT_DIR" >/dev/null

docker run --rm -it \
  --name "$CONTAINER_NAME" \
  -p "${HOST_PORT}:${PORT}" \
  -v "${PROJECT_DIR}:/app" \
  -w /app \
  "$IMAGE_NAME"
