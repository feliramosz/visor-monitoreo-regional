#!/bin/bash
set -e # El script se detendrá si un comando falla

echo "--- Iniciando despliegue para la rama: $DEPLOY_BRANCH ---"

# Rutas de las carpetas en tu servidor
PROD_DIR="/home/linuxuser/visor-monitoreo-regional"
STAGING_DIR="/home/linuxuser/visor-monitoreo-regional-staging" # <-- VERIFICA ESTE NOMBRE

# Lógica para decidir qué carpeta y rama actualizar
if [ "$DEPLOY_BRANCH" == "main" ]; then
  echo ">>> Desplegando en PRODUCCIÓN..."
  TARGET_DIR=$PROD_DIR
  TARGET_BRANCH="main"
elif [ "$DEPLOY_BRANCH" == "develop" ]; then
  echo ">>> Desplegando en STAGING..."
  TARGET_DIR=$STAGING_DIR
  TARGET_BRANCH="develop"
else
  echo "!!! Rama '$DEPLOY_BRANCH' no configurada para despliegue. Abortando."
  exit 1
fi

# Actualiza el código en la carpeta correcta
echo "Navegando a $TARGET_DIR"
cd $TARGET_DIR

echo "Actualizando la rama '$TARGET_BRANCH' desde el origen..."
git fetch origin
git reset --hard origin/$TARGET_BRANCH

echo ">>> Código actualizado. Reiniciando servicios..."

# Usa la variable de entorno para pasar la contraseña a sudo
echo "$SUDO_PASSWORD" | sudo -S systemctl restart senapred-monitor.service
echo "$SUDO_PASSWORD" | sudo -S systemctl restart nginx

echo "--- Despliegue para '$DEPLOY_BRANCH' finalizado exitosamente ---"