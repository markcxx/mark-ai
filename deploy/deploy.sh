#!/bin/sh

set -eu

readonly IMAGE="${1:?Usage: deploy.sh <image>}"
readonly APP_DIR="/opt/markai"
readonly COMPOSE_FILE="${APP_DIR}/compose.yaml"
readonly IMAGE_REPOSITORY="ghcr.io/markcxx/mark-ai"

compose() {
  image="$1"
  shift

  MARKAI_IMAGE="$image" docker compose \
    --project-name markai \
    --file "$COMPOSE_FILE" \
    "$@"
}

if [ ! -f "${APP_DIR}/.env.production" ]; then
  echo "Missing ${APP_DIR}/.env.production" >&2
  exit 1
fi

previous_image="$(docker inspect --format '{{.Config.Image}}' markai 2>/dev/null || true)"

echo "Pulling ${IMAGE}"
docker pull "$IMAGE"

echo "Deploying ${IMAGE}"
if ! compose "$IMAGE" up -d --wait --remove-orphans; then
  echo "Deployment failed." >&2

  if [ -n "$previous_image" ]; then
    echo "Rolling back to ${previous_image}" >&2
    compose "$previous_image" up -d --wait --remove-orphans
  fi

  exit 1
fi

echo "Removing old MarkAI image tags"
docker image ls "$IMAGE_REPOSITORY" --format '{{.Repository}}:{{.Tag}}' | while IFS= read -r old_image; do
  if [ -n "$old_image" ] && [ "$old_image" != "$IMAGE" ] && [ "$old_image" != "${IMAGE_REPOSITORY}:<none>" ]; then
    docker image rm "$old_image" || true
  fi
done

echo "MarkAI is healthy on 127.0.0.1:3001"
