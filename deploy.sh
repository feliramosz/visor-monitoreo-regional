#!/bin/bash
set -e 

echo "--- Iniciando despliegue para la rama: $DEPLOY_BRANCH ---"

PROD_DIR="/home/linuxuser/visor-monitoreo-regional"
STAGING_DIR="/home/linuxuser/senapred-monitor-staging"

if [ "$DEPLOY_BRANCH" == "main" ]; then
  echo ">>> Desplegando en PRODUCCIÓN..."
  TARGET_DIR=$PROD_DIR
  TARGET_BRANCH="main"
elif [ "$DEPLOY_BRANCH" == "develop" ]; then
  echo ">>> Desplegando en STAGING..."
  TARGET_DIR=$STAGING_DIR
  TARGET_BRANCH="develop"
else
  echo "!!! Rama '$DEPLOY_BRANCH' no configurada. Abortando."
  exit 1
fi

echo "Navegando a $TARGET_DIR"
cd $TARGET_DIR

echo "Actualizando la rama '$TARGET_BRANCH' desde el origen..."
git fetch origin
git reset --hard origin/$TARGET_BRANCH

echo ">>> Código actualizado. Reiniciando servicios..."
echo "$SUDO_PASSWORD" | sudo -S systemctl restart senapred-monitor.service
echo "$SUDO_PASSWORD" | sudo -S systemctl restart nginx
echo "--- Despliegue para '$DEPLOY_BRANCH' finalizado exitosamente ---"