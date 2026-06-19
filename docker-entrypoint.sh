#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Health Journal API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Apply schema to DB
echo "[init] Pushing Prisma schema to database..."
cd /app/packages/prisma
npx prisma db push --accept-data-loss 2>&1
echo "[init] Database schema applied"

# Generate Prisma client
npx prisma generate
echo "[init] Prisma client generated"

# Start API server
echo "[init] Starting API server..."
cd /app/apps/api
exec npx tsx src/index.ts
