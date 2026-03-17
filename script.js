// Theme Management
const themeBtn = document.getElementById('theme-btn');
const html = document.documentElement;

// Cargar tema guardado
const savedTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', savedTheme);

themeBtn.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// View Navigation
const navRegister = document.getElementById('nav-register');
const navAdmin = document.getElementById('nav-admin');
const registerView = document.getElementById('register-view');
const adminView = document.getElementById('admin-view');

navRegister.addEventListener('click', (e) => {
    e.preventDefault();
    registerView.style.display = 'grid';
    adminView.style.display = 'none';
    navRegister.classList.add('active');
    navAdmin.classList.remove('active');
});

navAdmin.addEventListener('click', (e) => {
    e.preventDefault();
    registerView.style.display = 'none';
    adminView.style.display = 'block';
    navAdmin.classList.add('active');
    navRegister.classList.remove('active');
});

// File Import Logic
const fileInput = document.getElementById('file-input');
const resultsDiv = document.getElementById('import-results');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.name.endsWith('.pdf')) {
        resultsDiv.innerHTML = `<div class="event-details">📄 Archivo PDF detectado: <strong>${file.name}</strong>. (Procesamiento de PDF en desarrollo)</div>`;
    } else {
        reader.onload = (evt) => {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            
            // Obtener la primera hoja de trabajo
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convertir el contenido de la hoja a formato JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            displayData(jsonData);
        };
        reader.readAsBinaryString(file);
    }
});

function displayData(data) {
    if (data.length === 0) {
        resultsDiv.innerHTML = '<p>El archivo está vacío.</p>';
        return;
    }

    let html = `<h3>Datos Importados (${data.length} registros)</h3>`;
    html += '<div style="overflow-x: auto; margin-top: 1rem;"><table style="width: 100%; border-collapse: collapse;">';
    
    // Header
    const headers = Object.keys(data[0]);
    html += '<tr style="background: var(--surface-container-high);">';
    headers.forEach(h => {
        html += `<th style="padding: 1rem; text-align: left; border-bottom: 2px solid var(--outline-variant);">${h}</th>`;
    });
    html += '</tr>';

    // Body
    data.slice(0, 10).forEach(row => {
        html += '<tr>';
        headers.forEach(h => {
            html += `<td style="padding: 1rem; border-bottom: 1px solid var(--outline-variant);">${row[h] || ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</table></div>';
    if (data.length > 10) html += '<p style="margin-top: 1rem; color: var(--on-surface-variant);">Mostrando los primeros 10 registros.</p>';
    
    resultsDiv.innerHTML = html;
}

// Form Submission
document.getElementById('registration-form').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('¡Registro exitoso! Te esperamos en el evento.');
    e.target.reset();
});
