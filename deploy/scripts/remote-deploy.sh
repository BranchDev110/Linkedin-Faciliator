#!/usr/bin/env bash
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
  docker compose "${COMPOSE_FILES[@]}" up -d --no-build --remove-orphans
else
  echo "Building locally for ${ENVIRONMENT} ..."
  docker compose "${COMPOSE_FILES[@]}" up -d --build --remove-orphans
fi

docker compose "${COMPOSE_FILES[@]}" ps

echo "Waiting for health check ..."
for _ in $(seq 1 30); do
  if docker compose "${COMPOSE_FILES[@]}" exec -T app curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo "Deploy complete (${ENVIRONMENT})."
    exit 0
  fi
  sleep 2
done

echo "App did not become healthy in time." >&2
docker compose "${COMPOSE_FILES[@]}" logs --tail=80 app
exit 1
