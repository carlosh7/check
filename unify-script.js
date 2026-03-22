const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Eliminar la primera función navigate duplicada (está al principio de App)
// Buscamos la primera aparición de navigate(viewId) { ... }
const firstNavigateStart = content.indexOf('navigate(viewId) {');
if (firstNavigateStart !== -1) {
    // Buscamos el final de esa función (asumimos que termina en },)
    const firstNavigateEnd = content.indexOf('},', firstNavigateStart) + 2;
    if (firstNavigateEnd > firstNavigateStart && firstNavigateEnd < 1000) { // Seguro de que es la de arriba
        console.log('Eliminando navigate duplicada al inicio...');
        content = content.substring(0, firstNavigateStart) + content.substring(firstNavigateEnd);
    }
}

// 2. Corregir showView (aprox línea 2211)
content = content.replace(/showView\(viewName\) \{[\s\S]*?\},/m, `showView(viewName) {
        console.log('[VIEW] Mostrando:', viewName);
        
        // 1. Ocultar todas las vistas principales
        const views = [
            'view-my-events', 'view-admin', 'view-system', 
            'view-groups', 'view-smtp', 'view-pre-registrations', 'view-survey-manager'
        ];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // 2. Mapear rutas
        let targetViewId = "view-" + viewName;
        // Si es una subsección de sistema, mostramos el contenedor de sistema
        if (['system', 'legal', 'account'].includes(viewName)) {
            targetViewId = "view-system";
        }

        const target = document.getElementById(targetViewId);
        if (target) {
            target.classList.remove('hidden');
        } else {
            console.warn('[VIEW] No se encontró el elemento:', targetViewId);
        }

        // 3. Actualizar Sidebar (Visual)
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let navBtnId = 'nav-btn-' + viewName;
        // Si es legal o account, activamos el botón de sistema en el sidebar si no tienen el suyo propio
        if (viewName === 'legal' || viewName === 'account') navBtnId = 'nav-btn-system';
        
        const activeBtn = document.getElementById(navBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');
        }

        window.scrollTo(0, 0);
    },`);

// 3. Corregir el navigate principal (aprox línea 2241)
content = content.replace(/navigate\(viewName, params = \{\}, push = true\) \{[\s\S]*?\},/m, `navigate(viewName, params = {}, push = true) {
        console.log('[NAV] Navegando a:', viewName, params);
        
        if (push) {
            const url = viewName === 'my-events' ? '/' : \`/\${viewName}\`;
            history.pushState({ view: viewName, params }, '', url);
        }

        this.showView(viewName);
        
        // Lógica específica por vista
        if (viewName === 'my-events') this.loadEvents();
        if (viewName === 'system') window.switchSystemTab('users');
        if (viewName === 'legal') window.switchSystemTab('legal');
        if (viewName === 'account') window.switchSystemTab('account');
        
        if (viewName === 'admin') {
            if (params.id) {
                this.loadEventStats(params.id);
            } else if (this.state.event) {
                this.loadEventStats(this.state.event.id);
            } else {
                this.navigate('my-events');
            }
        }

        if (viewName === 'groups') this.loadGroups();
        if (viewName === 'pre-registrations') this.loadPreRegistrations();
        if (viewName === 'survey-manager') this.loadSurveyQuestions();
        
        if (viewName === 'smtp') {
            const section = params.section || 'config';
            this.navigateEmailSection(section);
        }
    },`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ script.js unificado y corregido.');
