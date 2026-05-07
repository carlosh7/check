/**
 * modules/components/Table.js
 * Sistema de renderizado de tablas
 */

class Table {
    constructor() {
        this.defaults = {
            className: 'data-table',
            pagination: true,
            perPage: 100,
            searchable: true,
            sortable: true,
        };
    }
    
    // Renderizar tabla de eventos
    renderEventsTable(events, containerId = 'events-table-container') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="text-center p-8 text-slate-500">No hay eventos</div>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'data-table w-full';
        
        // Header
        table.innerHTML = `
            <thead>
                <tr class="bg-white/[0.01]">
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 !w-[40px] !px-3">#</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Invitados</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${events.map((event, index) => this._renderEventRow(event, index)).join('')}
            </tbody>
        `;
        
        container.innerHTML = '';
        container.appendChild(table);
    }
    
    // Renderizar fila de evento
    _renderEventRow(event, index) {
        const estado = event.status || 'draft';
        const estadoLabel = this._getEstadoLabel(estado);
        const estadoClass = this._getEstadoClass(estado);
        
        return `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="!py-3 !px-3 text-xs text-slate-500">${index + 1}</td>
                <td class="!py-3 !px-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-[#0ba5ec]/20 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[#0ba5ec] text-sm">event</span>
                        </div>
                        <span class="text-sm font-medium text-white">${event.name || 'Sin nombre'}</span>
                    </div>
                </td>
                <td class="!py-3 !px-3 text-sm text-slate-400">${event.client || '-'}</td>
                <td class="!py-3 !px-3 text-sm text-slate-400">${this._formatDate(event.date)}</td>
                <td class="!py-3 !px-3">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${estadoClass}">${estadoLabel}</span>
                </td>
                <td class="!py-3 !px-3 text-sm text-slate-400">${event.total_guests || event.guestCount || 0}</td>
                <td class="!py-3 !px-3">
                    <div class="flex gap-1">
                        <button onclick="App.openEventConfig('${event.id}')" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors" title="Editar">
                            <span class="material-symbols-outlined text-slate-400 text-sm">edit</span>
                        </button>
                        <button onclick="App.deleteEvent('${event.id}')" class="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 transition-colors" title="Eliminar">
                            <span class="material-symbols-outlined text-slate-400 text-sm">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    // Renderizar tabla de invitados
    renderGuestsTable(guests, containerId = 'guests-table-container') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!guests || guests.length === 0) {
            container.innerHTML = '<div class="text-center p-8 text-slate-500">No hay invitados</div>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'data-table w-full';
        
        table.innerHTML = `
            <thead>
                <tr class="bg-white/[0.01]">
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Email</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Empresa</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</th>
                    <th class="!py-3 !px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${guests.map(guest => this._renderGuestRow(guest)).join('')}
            </tbody>
        `;
        
        container.innerHTML = '';
        container.appendChild(table);
    }
    
    // Renderizar fila de invitado
    _renderGuestRow(guest) {
        const status = guest.status || 'pending';
        const statusLabel = this._getGuestStatusLabel(status);
        const statusClass = this._getGuestStatusClass(status);
        
        return `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="!py-3 !px-3 text-sm text-white">${guest.name || '-'}</td>
                <td class="!py-3 !px-3 text-sm text-slate-400">${guest.email || '-'}</td>
                <td class="!py-3 !px-3 text-sm text-slate-400">${guest.organization || '-'}</td>
                <td class="!py-3 !px-3">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusClass}">${statusLabel}</span>
                </td>
                <td class="!py-3 !px-3">
                    <button onclick="App.checkInGuest('${guest.id}')" class="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors" title="Check-in">
                        <span class="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
                    </button>
                </td>
            </tr>
        `;
    }
    
    // Helpers
    _getEstadoLabel(estado) {
        const labels = {
            active: 'Activo',
            upcoming: 'Próximo',
            completed: 'Finalizado',
            draft: 'Borrador',
            cancelled: 'Cancelado',
            inactive: 'Inactivo'
        };
        return labels[estado] || estado;
    }
    
    _getEstadoClass(estado) {
        const classes = {
            active: 'bg-emerald-500/20 text-emerald-400',
            upcoming: 'bg-blue-500/20 text-blue-400',
            completed: 'bg-slate-500/20 text-slate-400',
            draft: 'bg-amber-500/20 text-amber-400',
            cancelled: 'bg-red-500/20 text-red-400',
            inactive: 'bg-slate-500/20 text-slate-500'
        };
        return classes[estado] || 'bg-slate-500/20 text-slate-400';
    }
    
    _getGuestStatusLabel(status) {
        const labels = {
            pending: 'Pendiente',
            confirmed: 'Confirmado',
            'checked-in': 'Check-in',
            cancelled: 'Cancelado'
        };
        return labels[status] || status;
    }
    
    _getGuestStatusClass(status) {
        const classes = {
            pending: 'bg-amber-500/20 text-amber-400',
            confirmed: 'bg-blue-500/20 text-blue-400',
            'checked-in': 'bg-emerald-500/20 text-emerald-400',
            cancelled: 'bg-red-500/20 text-red-400'
        };
        return classes[status] || 'bg-slate-500/20 text-slate-400';
    }
    
    _formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CO');
        } catch {
            return dateStr;
        }
    }
}

// Instancia singleton
export const TableManager = new Table();

export default TableManager;