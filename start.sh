#!/bin/bash

# Iniciar serviços
echo "Iniciando serviços..."
docker-compose -f docker/docker-compose.yml up -d

# Aguardar serviços estarem prontos
echo "Aguardando serviços estarem prontos..."
sleep 10

# Verificar status
docker-compose -f docker/docker-compose.yml ps

# Iniciar aplicação
echo "Iniciando aplicação..."
mvn spring-boot:run
