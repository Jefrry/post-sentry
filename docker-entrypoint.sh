#!/bin/sh
set -eu

/app/node_modules/.bin/prisma migrate deploy --schema=/app/prisma/schema.prisma

exec node /app/dist/index.js
