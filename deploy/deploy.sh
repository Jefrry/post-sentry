#!/bin/sh
set -eu

: "${IMAGE_REF:?IMAGE_REF is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"

case "$IMAGE_REF" in
  ghcr.io/*@sha256:*) ;;
  *)
    echo 'IMAGE_REF must be an immutable ghcr.io digest.' >&2
    exit 1
    ;;
esac

case "$RELEASE_SHA" in
  *[!0-9a-f]*|'')
    echo 'RELEASE_SHA must be a lowercase hexadecimal commit SHA.' >&2
    exit 1
    ;;
esac

if [ "${#RELEASE_SHA}" -ne 40 ]; then
  echo 'RELEASE_SHA must contain 40 characters.' >&2
  exit 1
fi

DEPLOY_DIR=$(pwd)
NEXT_COMPOSE="$DEPLOY_DIR/compose.yaml.next"
CURRENT_COMPOSE="$DEPLOY_DIR/compose.yaml"
PREVIOUS_COMPOSE="$DEPLOY_DIR/compose.yaml.previous"
NEXT_RELEASE="$DEPLOY_DIR/.release.env.next"
CURRENT_RELEASE="$DEPLOY_DIR/.release.env"
PREVIOUS_RELEASE="$DEPLOY_DIR/.release.env.previous"
BACKUP_ROOT="$DEPLOY_DIR/backups"
BACKUP_NAME="$(date -u +%Y%m%d%H%M%S)-$RELEASE_SHA"
BACKUP_DIR="$BACKUP_ROOT/$BACKUP_NAME"
VOLUME_NAME=post-sentry-data

if [ ! -s "$DEPLOY_DIR/.env" ]; then
  echo "Missing or empty runtime environment file: $DEPLOY_DIR/.env" >&2
  exit 1
fi

if [ ! -s "$NEXT_COMPOSE" ]; then
  echo "Missing staged Compose file: $NEXT_COMPOSE" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || {
  echo 'Docker is not installed.' >&2
  exit 1
}
docker compose version >/dev/null

printf 'IMAGE_REF=%s\n' "$IMAGE_REF" > "$NEXT_RELEASE"
chmod 600 "$NEXT_RELEASE"

echo "Pulling $IMAGE_REF"
docker compose --env-file "$NEXT_RELEASE" -f "$NEXT_COMPOSE" pull app

mkdir -p "$BACKUP_DIR"
BACKUP_TAKEN=0
PROMOTED=0
ROLLBACK_REQUIRED=0

if [ -f "$CURRENT_COMPOSE" ]; then
  cp "$CURRENT_COMPOSE" "$PREVIOUS_COMPOSE"
else
  rm -f "$PREVIOUS_COMPOSE"
fi

if [ -f "$CURRENT_RELEASE" ]; then
  cp "$CURRENT_RELEASE" "$PREVIOUS_RELEASE"
else
  rm -f "$PREVIOUS_RELEASE"
fi

rollback() {
  echo 'New release failed; starting automatic rollback.' >&2

  if [ "$PROMOTED" -eq 1 ]; then
    docker compose --env-file "$CURRENT_RELEASE" -f "$CURRENT_COMPOSE" logs --no-color --tail=200 app >&2 || true
    docker compose --env-file "$CURRENT_RELEASE" -f "$CURRENT_COMPOSE" stop app >/dev/null 2>&1 || true
  else
    docker compose --env-file "$NEXT_RELEASE" -f "$NEXT_COMPOSE" stop app >/dev/null 2>&1 || true
  fi

  if [ "$BACKUP_TAKEN" -eq 1 ]; then
    if ! docker run --rm \
      --user 0:0 \
      --entrypoint /bin/sh \
      --mount "type=volume,src=$VOLUME_NAME,dst=/data" \
      --mount "type=bind,src=$BACKUP_DIR,dst=/backup,readonly" \
      "$IMAGE_REF" \
      -c 'find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && cp -a /backup/. /data/ && chown -R 1000:1000 /data'; then
      echo 'Could not restore the SQLite volume; the previous application was not started.' >&2
      return 1
    fi
  fi

  if [ -s "$PREVIOUS_COMPOSE" ] && [ -s "$PREVIOUS_RELEASE" ]; then
    cp "$PREVIOUS_COMPOSE" "$CURRENT_COMPOSE"
    cp "$PREVIOUS_RELEASE" "$CURRENT_RELEASE"
    docker compose --env-file "$CURRENT_RELEASE" -f "$CURRENT_COMPOSE" up -d --remove-orphans
    echo 'Previous release has been restored.' >&2
  else
    echo 'No previous managed release exists; the failed application remains stopped.' >&2
  fi
}

on_exit() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$status" -ne 0 ] && [ "$ROLLBACK_REQUIRED" -eq 1 ]; then
    rollback || echo 'Automatic rollback also failed; manual recovery is required.' >&2
  fi
  exit "$status"
}

trap on_exit EXIT
trap 'exit 1' HUP INT TERM

ROLLBACK_REQUIRED=1
echo 'Stopping the current application before backing up SQLite.'
docker compose --env-file "$NEXT_RELEASE" -f "$NEXT_COMPOSE" stop app >/dev/null 2>&1 || true

if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  docker run --rm \
    --user 0:0 \
    --entrypoint /bin/sh \
    --mount "type=volume,src=$VOLUME_NAME,dst=/data,readonly" \
    --mount "type=bind,src=$BACKUP_DIR,dst=/backup" \
    "$IMAGE_REF" \
    -c 'cp -a /data/. /backup/'
  BACKUP_TAKEN=1
fi

mv "$NEXT_COMPOSE" "$CURRENT_COMPOSE"
mv "$NEXT_RELEASE" "$CURRENT_RELEASE"
PROMOTED=1

echo "Starting release $RELEASE_SHA"
docker compose --env-file "$CURRENT_RELEASE" -f "$CURRENT_COMPOSE" up -d --remove-orphans

CONTAINER_ID=$(docker compose --env-file "$CURRENT_RELEASE" -f "$CURRENT_COMPOSE" ps -q app)
if [ -z "$CONTAINER_ID" ]; then
  exit 1
fi

check=1
while [ "$check" -le 6 ]; do
  sleep 5
  state=$(docker inspect --format '{{.State.Status}} {{.RestartCount}}' "$CONTAINER_ID" 2>/dev/null || true)
  if [ "$state" != 'running 0' ]; then
    echo "Container did not remain stable: ${state:-missing}." >&2
    exit 1
  fi
  check=$((check + 1))
done

ROLLBACK_REQUIRED=0
mv "$DEPLOY_DIR/deploy.sh.next" "$DEPLOY_DIR/deploy.sh" || \
  echo 'Warning: could not promote the deployment script.' >&2

# Backups created by this script have a timestamp and a 40-character SHA.
ls -1 "$BACKUP_ROOT" 2>/dev/null \
  | grep -E '^[0-9]{14}-[0-9a-f]{40}$' \
  | sort -r \
  | sed -n '11,$p' \
  | while IFS= read -r old_backup; do
      rm -rf -- "$BACKUP_ROOT/$old_backup"
    done || echo 'Warning: could not prune old backups.' >&2

echo "Release $RELEASE_SHA is running from $IMAGE_REF"
