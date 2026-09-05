        const API_URL = '/api';
        const urlParams = new URLSearchParams(window.location.search);
        const guestId = urlParams.get('g');
        const eventId = urlParams.get('e');
        
        let ticketData = null;

        async function loadTicket() {
            if (!guestId || !eventId) {
                showError('Boleto no válido. Faltan parámetros.');
                return;
            }

            try {
                const [eventRes, guestRes] = await Promise.all([
                    fetch(`${API_URL}/events/${eventId}`).then(r => r.json()),
                    fetch(`${API_URL}/guests/by-id/${guestId}`).then(r => r.json())
                ]);

                if (!eventRes || !guestRes) {
                    showError('No se encontró el boleto solicitado.');
                    return;
                }

                ticketData = { event: eventRes, guest: guestRes };
                renderTicket();
                
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                
            } catch (error) {
                console.error('Error cargando boleto:', error);
                showError('Error al cargar el boleto. Intenta nuevamente.');
            }
        }

        function renderTicket() {
            if (!ticketData) return;
            
            const { event, guest } = ticketData;
            
            document.getElementById('ticket-event-name').textContent = event.name;
            document.getElementById('ticket-guest-name').textContent = guest.name;
            document.getElementById('ticket-date').textContent = new Date(event.date).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            document.getElementById('ticket-location').textContent = event.location;
            document.getElementById('ticket-guest-id').textContent = guest.id.substring(0, 8) + '...';
            
            const logoEl = document.getElementById('ticket-logo');
            if (event.logo_url) {
                logoEl.src = event.logo_url;
                logoEl.alt = `Logo ${event.name}`;
            } else {
                logoEl.innerHTML = '<span class="material-symbols-outlined">event</span>';
            }
            
            const accent = event.ticket_accent_color || '#7c3aed';
            document.getElementById('ticket-header-bg').style.backgroundColor = `${accent}20`;
            
            generateQRCode();
        }

        async function generateQRCode() {
            if (!ticketData) return;
            
            const { event, guest } = ticketData;
            const qrContent = JSON.stringify({ g: guest.id, e: event.id });
            const canvas = document.getElementById('ticket-qr-canvas');
            const dark = event.qr_color_dark || '#000000';
            const light = event.qr_color_light || '#ffffff';
            const logoUrl = event.qr_logo_url;
            
            if (typeof qrcode === 'undefined') {
                const qrImg = document.createElement('img');
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrContent)}&color=${dark.replace('#','')}&bgcolor=${light.replace('#','')}`;
                qrImg.className = 'ticket-qr-img';
                canvas.parentElement.appendChild(qrImg);
                canvas.remove();
                return;
            }
            
            try {
                const qrDataUrl = await qrcode.toDataURL(qrContent, { 
                    width: 400, 
                    margin: 1,
                    color: { dark, light },
                    errorCorrectionLevel: logoUrl ? 'H' : 'M'
                });
                
                if (logoUrl) {
                    const img = new Image();
                    img.onload = () => {
                        const ctx = canvas.getContext('2d');
                        const qrImg = new Image();
                        qrImg.onload = () => {
                            canvas.width = qrImg.width;
                            canvas.height = qrImg.height;
                            ctx.drawImage(qrImg, 0, 0);
                            
                            const logoImg = new Image();
                            logoImg.crossOrigin = "Anonymous";
                            logoImg.onload = () => {
                                const size = canvas.width * 0.2;
                                const x = (canvas.width - size) / 2;
                                const y = (canvas.height - size) / 2;
                                ctx.fillStyle = light;
                                ctx.fillRect(x-5, y-5, size+10, size+10);
                                ctx.drawImage(logoImg, x, y, size, size);
                            };
                            logoImg.src = logoUrl;
                        };
                        qrImg.src = qrDataUrl;
                    };
                    img.src = qrDataUrl;
                } else {
                    const img = new Image();
                    img.onload = () => {
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = qrDataUrl;
                }
            } catch (error) {
                console.error('Error generando QR:', error);
            }
        }

        function downloadTicket() {
            const container = document.getElementById('ticket-container');
            if (!container || typeof html2canvas === 'undefined') {
                alert("Error: Motor de captura no disponible.");
                return;
            }
            
            html2canvas(container, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                logging: false
            }).then(canvas => {
                const link = document.createElement('a');
                const guestName = ticketData?.guest?.name?.replace(/\s+/g, '_') || 'ticket';
                link.download = `Boleto_${guestName}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(error => {
                console.error('Error descargando boleto:', error);
                alert("Error al generar la imagen del boleto.");
            });
        }

        function shareTicket() {
            if (!ticketData) return;
            
            const { guest, event } = ticketData;
            const url = window.location.href;
            const text = encodeURIComponent(`¡Hola ${guest.name}! Aquí tienes tu boleto para ${event.name}: ${url}`);
            
            if (navigator.share) {
                navigator.share({
                    title: `Boleto para ${event.name}`,
                    text: `¡Hola ${guest.name}! Aquí tienes tu boleto para ${event.name}`,
                    url: url
                });
            } else {
                window.open(`https://wa.me/?text=${text}`, '_blank');
            }
        }

        function showError(message) {
            document.getElementById('loading').innerHTML = `
                <div class="ticket-error">
                    <div class="ticket-error-icon">
                        <span class="material-symbols-outlined">error</span>
                    </div>
                    <p class="ticket-error-message">${message}</p>
                    <p class="ticket-error-hint">Verifica el enlace o contacta al organizador.</p>
                </div>
            `;
        }

        document.getElementById('btn-download').addEventListener('click', downloadTicket);
        document.getElementById('btn-share').addEventListener('click', shareTicket);

        loadTicket();
