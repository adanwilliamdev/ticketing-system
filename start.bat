@echo off
cd /d "%~dp0"

where docker >nul 2>nul || (echo Docker nao encontrado. & exit /b 1)
if not exist node_modules call npm install

echo Subindo Postgres e Redis...
call npm run infra:up || exit /b 1

echo Iniciando a aplicacao em http://localhost:3000 (as migracoes rodam na subida)
call npm run dev
