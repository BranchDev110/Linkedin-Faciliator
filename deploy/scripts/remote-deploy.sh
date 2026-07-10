#!/usr/bin/env bash
# Pull (or build) the image and recreate the running stack.
# Nginx is NOT in the stack — it runs on the VPS host as a reverse proxy.
# See docs/DEPLOYMENT.md for the host-nginx setup.
set -euo pipefail

ENVIRONMENT="${1:-${ENVIRONMENT:-staging}}"
APP_IMAGE="${APP_IMAGE:-}"

if [[ "${ENVIRONMENT}" != "staging" && "${ENVIRONMENT}" != "production" ]]; then
  echo "Usage: $0 [staging|production]" >&2
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml -f "docker-compose.${ENVIRONMENT}.yml")

if [[ -n "${APP_IMAGE}" ]]; then
  export APP_IMAGE
  echo "Pulling ${APP_IMAGE} ..."
  docker compose "${COMPOSE_FILES[@]}" pull app
  docker compose "${COMPOSE_FILES[@]}" up -d --no-build --pull always --force-recreate --remove-orphans
else
  echo "Building locally for ${ENVIRONMENT} ..."
  docker compose "${COMPOSE_FILES[@]}" up -d --build --force-recreate --remove-orphans
fi

docker compose "${COMPOSE_FILES[@]}" ps

# HOST_PORT is the host port the app is bound on (default 3001).
# The container port is always 3001.
HOST_PORT="${HOST_PORT:-3001}"

echo "Waiting for health check on http://127.0.0.1:${HOST_PORT}/api/health ..."
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/api/health" >/dev/null 2>&1; then
    echo "Deploy complete (${ENVIRONMENT})."
    exit 0
  fi
  sleep 2
done

echo "App did not become healthy in time." >&2
docker compose "${COMPOSE_FILES[@]}" logs --tail=80 app
exit 1