#!/bin/bash
set -e

echo "--- Despliegue iniciado para la rama: $DEPLOY_BRANCH ---"

# --- Configuración de Entornos ---
PROD_DIR="/home/linuxuser/visor-monitoreo-regional"
PROD_SERVICE="senapred-prod.service" # <-- Nombre del servicio de producción

STAGING_DIR="/home/linuxuser/senapred-monitor-staging"
STAGING_SERVICE="senapred-staging.service" # <-- Nombre del servicio de staging

# --- Lógica de Despliegue ---
TARGET_DIR=""
TARGET_BRANCH=""
TARGET_SERVICE=""

if [ "$DEPLOY_BRANCH" = "main" ]; then
    echo ">>> Configurando para PRODUCCIÓN..."
    TARGET_DIR=$PROD_DIR
    TARGET_BRANCH="main"
    TARGET_SERVICE=$PROD_SERVICE
elif [ "$DEPLOY_BRANCH" = "develop" ]; then
    echo ">>> Configurando para STAGING..."
    TARGET_DIR=$STAGING_DIR
    TARGET_BRANCH="develop"
    TARGET_SERVICE=$STAGING_SERVICE
else
    echo "!!! Rama '$DEPLOY_BRANCH' no configurada. Abortando."
    exit 1
fi

echo "Directorio de destino: $TARGET_DIR"
echo "Servicio a reiniciar: $TARGET_SERVICE"

cd $TARGET_DIR
echo "Actualizando rama '$TARGET_BRANCH' desde GitHub..."
git fetch origin
git reset --hard origin/$TARGET_BRANCH

echo ">>> Reiniciando servicios específicos..."
echo "$SUDO_PASSWORD" | sudo -S systemctl restart $TARGET_SERVICE
echo "$SUDO_PASSWORD" | sudo -S systemctl restart nginx # Nginx se reinicia siempre

echo "--- Despliegue para '$DEPLOY_BRANCH' finalizado. ---"