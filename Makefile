.PHONY: help lint lint-fix test test-e2e test-ai check health install clean

# Check Pro — Makefile de desarrollo
# Uso: make <target>

help: ## Mostrar ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Instalar dependencias
	npm install

lint: ## Ejecutar ESLint en todo el proyecto
	npx eslint . --max-warnings 2600

lint-fix: ## Auto-corregir problemas de lint
	npx eslint . --fix

lint-stubs: ## Detectar stubs (TODO, FIXME, HACK, XXX)
	@echo "=== Stubs detectados ==="
	@grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.js" 2>/dev/null || echo "No se encontraron stubs"
	@echo ""
	@echo "=== Warnings no bloqueantes, pero revisar ==="

lint-patterns: ## Detectar anti-patrones en el código
	@echo "=== Anti-patrones: var en vez de const/let ==="
	@rg -c '\bvar\b' src/ --include='*.js' 2>/dev/null | head -20 || echo "Limpio"
	@echo ""
	@echo "=== Anti-patrones: console.log en producción ==="
	@rg -c 'console\.log\b' src/ --include='*.js' 2>/dev/null | head -20 || echo "Limpio"
	@echo ""
	@echo "=== Anti-patrones: eval() ==="
	@rg -c '\beval\(' src/ --include='*.js' 2>/dev/null || echo "Limpio"
	@echo ""
	@echo "=== Anti-patrones: innerHTML sin sanitizar ==="
	@rg -c '\.innerHTML\s*=' src/ --include='*.js' 2>/dev/null | head -10 || echo "Limpio"

lint-api: ## Lint del backend (ESLint)
	@echo "=== ESLint src/ ==="
	npx eslint src/ --max-warnings 30

test: ## Ejecutar tests unitarios
	DATA_PATH=/home/carlosh/Check/data npx jest --passWithNoTests --testPathIgnorePatterns='/tests/e2e.test.js|/tests/load.test.js'

test-e2e: ## Ejecutar tests end-to-end (requiere app corriendo)
	npx jest tests/e2e.test.js --passWithNoTests --forceExit --detectOpenHandles

test-ai: ## Ejecutar tests de AI
	npx jest tests/ai/ --passWithNoTests

test-all: ## Ejecutar todos los tests
	DATA_PATH=/home/carlosh/Check/data npx jest --passWithNoTests

check: ## Verificación completa (lint + tests + stubs + patterns)
	@echo "╔══════════════════════════════════════╗"
	@echo "║   CHECK PRO — Auditoría Completa    ║"
	@echo "╚══════════════════════════════════════╝"
	@echo ""
	@echo "━━━ 1/4 ESLint ━━━"
	npx eslint . --max-warnings 2600
	@echo ""
	@echo "━━━ 2/4 Tests ━━━"
	npx jest --passWithNoTests --testPathIgnorePatterns='/tests/e2e.test.js|/tests/load.test.js'
	@echo ""
	@echo "━━━ 3/4 Stubs ━━━"
	@echo "Stubs encontrados:"
	@grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.js" 2>/dev/null | wc -l
	@echo ""
	@echo "━━━ 4/4 Anti-patrones ━━━"
	@echo "var en src/:"
	@rg -c '\bvar\b' src/ --include='*.js' 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0 " ocurrencias"}'
	@echo ""
	@echo "╔══════════════════════════════════════╗"
	@echo "║        Auditoría completada          ║"
	@echo "╚══════════════════════════════════════╝"

health: ## Verificar estado de la app (requiere app corriendo)
	@echo "=== Health Check ==="
	@curl -sf http://localhost:3000/api/health && echo "" || echo "❌ App no responde en :3000"
	@curl -sf http://localhost:3000/api/health/full && echo "" || echo "❌ Health full no disponible"

version: ## Mostrar versión actual
	@node -e "console.log(require('./package.json').version)"

clean: ## Limpiar cache y temporales
	rm -rf node_modules/.cache
	rm -rf /tmp/check-*
	@echo "Cache limpiada"
