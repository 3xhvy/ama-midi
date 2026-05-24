#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

# Production: migrations run once in CI before `docker compose up -d`.
# Local docker-compose: defaults to true so `docker compose up` self-migrates.
if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "Running database migrations..."
  if ! prisma migrate deploy; then
    echo ""
    echo "ERROR: Migration failed — API will not start."
    echo "A failed migration blocks all future deploys until resolved (Prisma P3009)."
    echo ""
    echo "Fix on the VPS:"
    echo "  docker compose -f docker-compose.prod.yml run --rm --entrypoint sh api"
    echo "  prisma migrate status"
    echo "  prisma migrate resolve --rolled-back <failed_migration_name>"
    echo ""
    exit 1
  fi
fi

echo "Starting API..."
exec node dist/src/main
