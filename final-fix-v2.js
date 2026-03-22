const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Globalizar LS y lazyLoad
if (!content.includes('window.LS = LS;')) {
    content = content.replace("// MASTER SCRIPT V12.2.3 - ARQUITECTURA ESM \uD83D\uDEE1\uFE0F\uD83D\uDE80\uD83D\uDC8E", 
    "// MASTER SCRIPT V12.2.3 - ARQUITECTURA ESM \uD83D\uDEE1\uFE0F\uD83D\uDE80\uD83D\uDC8E\nwindow.LS = LS;\nwindow.lazyLoad = lazyLoad;");
}

// 2. Reparar showView con IDs correctos
const showViewPattern = /showView\(viewName, clearSession = false\) \{[\s\S]*?\},/m;
const cleanShowView = `showView(viewName, clearSession = false) {
        console.log('[VIEW] Mostrando:', viewName);
        
        if (viewName === 'login') {
            document.getElementById('view-login')?.classList.remove('hidden');
            if (document.getElementById('view-login')) document.getElementById('view-login').style.display = 'flex';
            document.getElementById('app-container')?.classList.add('hidden');
            if (clearSession) { window.LS.remove('user'); this.state.user = null; }
            return;
        } else {
            document.getElementById('view-login')?.classList.add('hidden');
            document.getElementById('app-container')?.classList.remove('hidden');
            if (document.getElementById('app-container')) document.getElementById('app-container').style.display = 'flex';
        }

        // Ocultar todas las secciones del app-shell
        const viewIds = ["view-my-events", "view-admin", "view-system", "view-groups", "view-smtp", "view-pre-registrations", "view-survey-manager"];
        viewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Mapear y mostrar
        let targetId = "view-" + viewName;
        if (['legal', 'account'].includes(viewName)) targetId = "view-system";
        
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
        }

        // UI Sidebar
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'bg-primary/10', 'text-primary'));
        let btnId = 'nav-btn-' + viewName;
        if (['legal', 'account'].includes(viewName)) btnId = 'nav-btn-system';
        if (viewName === 'smtp') btnId = 'nav-btn-smtp';
        
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) activeBtn.classList.add('active', 'bg-primary/10', 'text-primary');

        window.scrollTo(0, 0);
    },`;

content = content.replace(showViewPattern, cleanShowView);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fix v2 applied.');
