const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Asegurar que no hay navigate duplicado al inicio
const firstOcc = content.indexOf('navigate(viewId) {');
if (firstOcc !== -1 && firstOcc < 2000) {
    const endOcc = content.indexOf('},', firstOcc) + 2;
    content = content.substring(0, firstOcc) + content.substring(endOcc);
}

// 2. Reparar navigate principal entre 'navigate(viewName' e 'initRouter()'
const startStr = 'navigate(viewName, params = {}, push = true) {';
const endStr = 'initRouter() {';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const cleanNavigate = `navigate(viewName, params = {}, push = true) {
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
    },

    `;
    content = content.substring(0, startIndex) + cleanNavigate + content.substring(endIndex);
}

// 3. Reparar showView
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
        if (['system', 'legal', 'account'].includes(viewName)) {
            targetViewId = "view-system";
        }

        const target = document.getElementById(targetViewId);
        if (target) {
            target.classList.remove('hidden');
        }

        // 3. Actualizar Sidebar
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let navBtnId = 'nav-btn-' + viewName;
        if (viewName === 'legal' || viewName === 'account') navBtnId = 'nav-btn-system';
        
        const activeBtn = document.getElementById(navBtnId);
        if (activeBtn) {
            activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');
        }

        window.scrollTo(0, 0);
    },`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Final fix applied to script.js');
