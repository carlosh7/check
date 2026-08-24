#!/usr/bin/env bash
# deploy-portainer.sh — Redeploy del stack 'check' vía API de Portainer + healthcheck
#
# Uso:
#   PORTAINER_URL=https://192.168.2.17:9443 \
#   PORTAINER_USER=admin PORTAINER_PASS='****' \
#   ./scripts/deploy-portainer.sh
#
# Opcional:
#   STACK_NAME=check   APP_URL=http://192.168.2.17:3000   EP_ID=<id entorno>
#
# Modo webhook alternativo (sin credenciales):
#   ./scripts/deploy-portainer.sh --webhook https://192.168.2.17:9443/api/webhooks/<token>
set -euo pipefail

PORTAINER_URL="${PORTAINER_URL:-https://localhost:9443}"
STACK_NAME="${STACK_NAME:-check}"
APP_URL="${APP_URL:-http://192.168.2.17:3000}"
CURL="curl -sk"

if [[ "${1:-}" == "--webhook" && -n "${2:-}" ]]; then
    echo "▶ Redeploy vía webhook…"
    $CURL -XPOST "$2" >/dev/null
else
    : "${PORTAINER_USER:?Define PORTAINER_USER}"
    : "${PORTAINER_PASS:?Define PORTAINER_PASS}"

    echo "▶ Autenticando en $PORTAINER_URL…"
    JWT=$($CURL -XPOST "$PORTAINER_URL/api/auth" \
        -H 'Content-Type: application/json' \
        -d "{\"Username\":\"$PORTAINER_USER\",\"Password\":\"$PORTAINER_PASS\"}" | sed -n 's/.*"jwt":"\([^"]*\)".*/\1/p')
    [[ -n "$JWT" ]] || { echo "✗ Login fallido"; exit 1; }
    AUTH="Authorization: Bearer $JWT"

    echo "▶ Localizando stack '$STACK_NAME'…"
    STACKS_JSON=$($CURL "$PORTAINER_URL/api/stacks" -H "$AUTH")
    STACK_INFO=$(echo "$STACKS_JSON" | python3 -c "
import sys, json
for s in json.load(sys.stdin):
    if s.get('Name') == '$STACK_NAME':
        print(s['Id'], s.get('EndpointId', 1)); break")
    [[ -n "$STACK_INFO" ]] || { echo "✗ Stack no encontrado"; exit 1; }
    read -r ID EP <<<"$STACK_INFO"
    echo "  stack id=$ID endpoint=$EP"

    echo "▶ Redeploy desde Git…"
    HTTP=$($CURL -o /dev/null -w '%{http_code}' -XPOST \
        "$PORTAINER_URL/api/stacks/$ID/git/redeploy?endpointId=$EP" -H "$AUTH" \
        -H 'Content-Type: application/json' -d '{}')
    [[ "$HTTP" == "200" ]] || { echo "✗ Redeploy HTTP $HTTP (¿stack no-git? usa PUT /api/stacks/$ID?endpointId=$EP)"; exit 1; }
fi

echo "▶ Esperando healthcheck en $APP_URL/api/health"
for i in $(seq 1 30); do
    sleep 5
    CODE=$($CURL -o /dev/null -w '%{http_code}' "$APP_URL/api/health" || true)
    if [[ "$CODE" == "200" ]]; then
        echo "✅ App desplegada y saludable tras $((i*5))s"
        echo "▶ Verificando versión expuesta:"
        $CURL "$APP_URL/" | grep -oE 'v=12\.[0-9]+\.[0-9]+' | head -1 || true
        exit 0
    fi
    echo "  intento $i → HTTP $CODE"
done
echo "✗ Timeout de healthcheck (revisar logs del contenedor en Portainer)"
exit 1
