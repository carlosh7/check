#!/usr/bin/env bash
# vps-redeploy.sh — Script de auto-deploy para el VPS Contabo (C6-14).
# Lo ejecuta el webhook firmado de GitHub (/api/deploy/webhook) cuando el
# contenedor tiene DEPLOY_SCRIPT_PATH=/opt/check/scripts/vps-redeploy.sh
# y el binario docker accesible desde el host donde corre el script.
#
# NOTA OPERADOR: para que el contenedor pueda ejecutar este script necesita
# acceso al host (p.ej. montar /var/run/docker.sock o un servicio host).
# Sin ese paso, el auto-deploy queda preparado pero inactivo (redeploy
# manual por SSH: rsync + docker compose build + up -d).
set -euo pipefail
cd /opt/check
sudo docker compose build check-app
sudo docker compose up -d check-app
