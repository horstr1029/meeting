#!/bin/bash
set -e

echo "==> Pulling latest code"
git pull origin main

echo "==> Building app image"
docker compose build app

echo "==> Starting services"
docker compose up -d

echo "==> Running database migrations"
docker compose exec app npx prisma migrate deploy

echo "==> Done. Services running:"
docker compose ps
