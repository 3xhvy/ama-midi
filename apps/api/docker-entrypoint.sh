#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

echo "Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Starting API..."
exec node dist/main
