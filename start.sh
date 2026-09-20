#!/usr/bin/env bash
# Sobe Postgres + Redis e inicia o Next.js em modo desenvolvimento.
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Docker não encontrado."; exit 1; }
[ -d node_modules ] || npm install

echo "Subindo Postgres e Redis..."
npm run infra:up

echo "Iniciando a aplicação em http://localhost:3000 (as migrações rodam na subida)"
npm run dev
