import { LS, lazyLoad } from '../src/frontend/utils.js';
import { API } from '../src/frontend/api.js';

const ImportExportModule = window.ImportExportModule = {
    VERSION: '12.44.501',
    _importType: null,
    _importData: null,
    _importStats: null,

    openImportModal(type) {
        this._importType = type;
        this._importData = null;
        
        const progressContainer = document.getElementById('import-progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
        
        const newCount = document.getElementById('import-new-count');
        const updateCount = document.getElementById('import-update-count');
        const errorCount = document.getElementById('import-error-count');
        const status = document.getElementById('import-status');
        const progressFill = document.getElementById('import-progress-fill');
        const confirmBtn = document.getElementById('btn-confirm-import');
        
        if (newCount) newCount.textContent = '0';
        if (updateCount) updateCount.textContent = '0';
        if (errorCount) errorCount.textContent = '0';
        if (status) status.textContent = 'Procesando...';
        if (progressFill) progressFill.style.width = '0%';
        if (confirmBtn) confirmBtn.disabled = true;
        
        const modal = document.getElementById('modal-import');
        if (modal) modal.classList.remove('hidden');
    },

    openExportModal(type) {
        this._exportType = type;
        
        const progressContainer = document.getElementById('export-progress-container');
        if (progressContainer) progressContainer.classList.add('hidden');
        
        const modal = document.getElementById('modal-export');
        if (modal) modal.classList.remove('hidden');
    },

    openExportDBModal() {
        this.openExportModal('all');
    },

    downloadImportTemplate: async function() {
        try {
            let token = window.App?.state?.user?.token;
            if (!token) {
                const userStr = LS.get('user');
                const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
                token = user.token || LS.get('token');
            }
            
            const response = await fetch('/api/import/template', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error en respuesta');
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_importacion_check.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Descarga iniciada', text: 'Revisa tu carpeta de descargas', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
            }
        } catch(e) {
            console.error('Error descargando plantilla:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar la plantilla' });
            }
        }
    },

    initImportHandlers: function() {
        const modal = document.getElementById('modal-import');
        if (!modal) return;

        document.getElementById('btn-close-import')?.addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('btn-cancel-import')?.addEventListener('click', () => modal.classList.add('hidden'));

        const dropZone = document.getElementById('import-drop-zone');
        const fileInput = document.getElementById('import-file-input');

        dropZone?.addEventListener('click', () => fileInput?.click());
        
        dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-[var(--primary)]'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('border-[var(--primary)]'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-[var(--primary)]');
            const file = e.dataTransfer.files[0];
            if (file) this.processImportFile(file);
        });

        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processImportFile(file);
        });

        document.getElementById('btn-confirm-import')?.addEventListener('click', () => this.executeImport());
    },

    processImportFile: async function(file) {
        let token = window.App?.state?.user?.token;
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1];
            
            try {
                const response = await fetch('/api/import/validate', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        file: base64,
                        filename: file.name,
                        type: this._importType 
                    })
                });
                const data = await response.json();
            
                if (data.success) {
                    this._importData = data.data;
                    this._importStats = data.stats;
                    
                    document.getElementById('import-progress-container').classList.remove('hidden');
                    document.getElementById('import-new-count').textContent = data.stats.new || 0;
                    document.getElementById('import-update-count').textContent = data.stats.update || 0;
                    document.getElementById('import-error-count').textContent = data.stats.errors || 0;
                    document.getElementById('import-status').textContent = data.stats.message || 'Datos válidos';
                    document.getElementById('import-progress-fill').style.width = '100%';
                    document.getElementById('btn-confirm-import').disabled = false;
                    
                    if (data.errors && data.errors.length > 0) {
                        const details = document.getElementById('import-details');
                        details.classList.remove('hidden');
                        details.innerHTML = data.errors.slice(0, 10).map(e => `<p class="text-red-400">• ${e}</p>`).join('');
                        if (data.errors.length > 10) {
                            details.innerHTML += `<p class="text-[var(--text-muted)]">... y ${data.errors.length - 10} más</p>`;
                        }
                    }
                } else {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({ icon: 'error', title: 'Error', text: data.message || 'Error validando archivo' });
                    }
                }
            } catch(e) {
                console.error('Error procesando archivo:', e);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al procesar el archivo' });
                }
            }
        };
        reader.onerror = () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error leyendo archivo' });
            }
        };
        reader.readAsDataURL(file);
    },

    executeImport: async function() {
        if (!this._importData) return;
        
        let token = window.App?.state?.user?.token;
        if (!token) {
            const userStr = LS.get('user');
            const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
            token = user.token || LS.get('token');
        }
        
        const btn = document.getElementById('btn-confirm-import');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Importando...';

        try {
            const response = await fetch('/api/import/execute', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: this._importType, data: this._importData })
            });
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('import-status').textContent = `Importación completada: ${result.imported} registros`;
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ icon: 'success', title: 'Importación exitosa', text: `${result.imported} registros importados, ${result.updated} actualizados`, timer: 3000, toast: true, position: 'top-end' });
                }
                
                if (this._importType === 'groups') window.App.loadGroups();
                else if (this._importType === 'staff') window.App.loadUsersTable();
                else if (this._importType === 'clients') window.App.loadClients();
                else {
                    window.App.loadGroups();
                    window.App.loadUsersTable();
                    window.App.loadClients();
                }
                
                setTimeout(() => document.getElementById('modal-import')?.classList.add('hidden'), 1500);
            }
        } catch(e) {
            console.error('Error en importación:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error durante la importación' });
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">system_update</span> Importar Datos';
        }
    },

    _exportType: null,

    initExportHandlers: function() {
        const modal = document.getElementById('modal-export');
        if (!modal) return;

        document.getElementById('btn-close-export')?.addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('btn-cancel-export')?.addEventListener('click', () => modal.classList.add('hidden'));

        document.getElementById('btn-confirm-export')?.addEventListener('click', () => this.executeExport());
    },

    executeExport: async function() {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'excel';
        
        const btn = document.getElementById('btn-confirm-export');
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Generando...';
        document.getElementById('export-progress-container').classList.remove('hidden');

        try {
            let token = window.App?.state?.user?.token;
            if (!token) {
                const userStr = LS.get('user');
                const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
                token = user.token || LS.get('token');
            }
            
            const response = await fetch(`/api/export/${this._exportType}?format=${format}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (format === 'excel') {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${this._exportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${this._exportType}_${new Date().toISOString().split('T')[0]}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: 'Exportación completada', text: 'Revisa tu carpeta de descargas', timer: 2000, showConfirmButton: false, toast: true, position: 'top-end' });
            }
            
            setTimeout(() => document.getElementById('modal-export').classList.add('hidden'), 1000);
        } catch(e) {
            console.error('Error en exportación:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar el archivo' });
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm mr-1">download</span> Exportar';
        }
    },

    closeGroupSelector: function() {
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
    }
};

export default ImportExportModule;