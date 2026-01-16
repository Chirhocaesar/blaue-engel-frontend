#!/usr/bin/env bash
set -euo pipefail

cd /home/deploy/apps/platform/blaue-engel/frontend

git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.prod.yml up -d --build frontend

echo "✅ Frontend deployed"
