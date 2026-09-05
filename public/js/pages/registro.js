        const API_URL = '/api';
        let eventData = null;
        let categories = [];
        const cart = {};

        function updateCart(catId, delta) {
            cart[catId] = Math.max(0, (cart[catId] || 0) + delta);
            const el = document.getElementById('qty-' + catId);
            if (el) el.textContent = cart[catId] || 0;
            updateCartTotal();
        }
        let _appliedCoupon = null;
        function updateCartTotal() {
            let total = 0; let hasItems = false;
            categories.forEach(function(c) {
                const qty = cart[c.id] || 0;
                if (qty > 0) { total += c.price * qty; hasItems = true; }
            });
            document.getElementById('coupon-section').classList.toggle('hidden', !hasItems);
            const totalEl = document.getElementById('cart-total');
            const summaryEl = document.getElementById('payment-summary');
            const btn = document.getElementById('submit-btn');
            if (totalEl) { totalEl.classList.toggle('hidden', !hasItems); totalEl.textContent = 'Total: $' + total.toFixed(2) + ' ' + (eventData?.currency || 'USD'); }
            if (summaryEl) summaryEl.classList.toggle('hidden', !hasItems);
            if (btn) btn.textContent = hasItems ? 'Pagar con Stripe' : 'Confirmar Registro';
            _appliedCoupon = null; document.getElementById('coupon-result').classList.add('hidden');
        }
        async function applyCoupon() {
            const code = document.getElementById('coupon-input')?.value.trim();
            if (!code) return;
            const items = []; categories.forEach(function(c) { const q = cart[c.id] || 0; if (q > 0) items.push({ category_id: c.id, quantity: q }); });
            try {
                const r = await fetch(API_URL + '/events/' + eventData.id + '/coupons/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code, items: items }) });
                const d = await r.json();
                const el = document.getElementById('coupon-result');
                if (d.valid) {
                    _appliedCoupon = code;
                    el.className = 'text-xs mt-1 text-green-400';
                    el.textContent = '✅ Cupón aplicado: -$' + d.discount.toFixed(2) + ' (Total: $' + d.finalTotal.toFixed(2) + ')';
                } else { el.className = 'text-xs mt-1 text-red-400'; el.textContent = '❌ ' + (d.error || 'Cupón inválido'); }
                el.classList.remove('hidden');
            } catch(e) {}
        }

        // Check if returning from payment
        (function() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('success') === '1') {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');
                document.getElementById('event-registration-form').style.display = 'none';
                document.getElementById('success-message').classList.remove('hidden');
                document.getElementById('success-text').innerText = '¡Pago exitoso! Tu registro ha sido confirmado.';
                return;
            }
            if (params.get('cancel') === '1') {
                alert('El pago fue cancelado. Puedes intentar de nuevo.');
            }
        })();

        async function loadEvent() {
            const params = new URLSearchParams(window.location.search);
            const eventId = params.get('event');

            if (!eventId) {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('error-content').classList.remove('hidden');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/event/${eventId}`);
                if (!res.ok) throw new Error('Evento no encontrado');

                eventData = await res.json();
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('main-content').classList.remove('hidden');

                document.getElementById('page-title').innerText = eventData.reg_title || 'Registro de Invitados';
                document.getElementById('event-name').innerText = eventData.name || 'Evento';
                
                if (eventData.reg_logo_url && eventData.reg_logo_url.trim() !== "") {
                    const logoContainer = document.getElementById('event-logo');
                    logoContainer.classList.remove('hidden');
                    logoContainer.innerHTML = `<img src="${eventData.reg_logo_url}" alt="Logo">`;
                }

                if (eventData.location && eventData.location.trim() !== "" && eventData.location !== "Por definir") {
                    document.getElementById('event-location').innerText = eventData.location;
                } else {
                    document.getElementById('event-location-container').style.display = 'none';
                }

                if (eventData.description) {
                    document.getElementById('event-description').classList.remove('hidden');
                    document.getElementById('event-description').innerText = eventData.description;
                }

                if (eventData.reg_welcome_text) {
                    document.getElementById('welcome-text').classList.remove('hidden');
                    document.getElementById('welcome-text').innerText = eventData.reg_welcome_text;
                }

                if (eventData.reg_success_message) {
                    document.getElementById('success-text').innerText = eventData.reg_success_message;
                }

                // F4: campos personalizados + acompañantes
                loadDynamicFields();

                // Load categories and check payment
                if (eventData.payment_required) {
                    try {
                        const catRes = await fetch(API_URL + '/guests/' + eventData.id + '/categories');
                        if (catRes.ok) {
                            categories = await catRes.json();
                            const catContainer = document.getElementById('field-category');
                            const cartDiv = document.getElementById('cart-items');
                            if (categories && categories.length > 0 && cartDiv) {
                                catContainer.classList.remove('hidden');
                                cartDiv.innerHTML = categories
                                    .filter(function(c) { return c.price > 0; })
                                    .map(function(c) {
                                        return '<div class="flex items-center justify-between p-2 rounded-lg bg-white/5">' +
                                            '<span class="text-sm">' + c.name + ' — <span class="text-[var(--primary)] font-bold">$' + parseFloat(c.price).toFixed(2) + '</span></span>' +
                                            '<div class="flex items-center gap-2"><button class="w-7 h-7 rounded-full bg-white/10 text-white font-bold text-sm" onclick="updateCart(\'' + c.id + '\',-1)">−</button>' +
                                            '<span id="qty-' + c.id + '" class="w-6 text-center text-sm font-bold">0</span>' +
                                            '<button class="w-7 h-7 rounded-full bg-white/10 text-white font-bold text-sm" onclick="updateCart(\'' + c.id + '\',1)">+</button></div></div>';
                                    }).join('');
                            }
                        }
                    } catch(e) { console.error('Error loading categories:', e); }
                }

                if (eventData.reg_policy) {
                    document.getElementById('policy-text').innerHTML = eventData.reg_policy;
                } else {
                    document.getElementById('policy-text').innerHTML = 'Al registrarse, acepta que sus datos sean utilizados únicamente para la gestión del evento.';
                }

                document.getElementById('reg-agreement').required = eventData.reg_require_agreement !== 0;

                document.getElementById('field-phone').style.display = eventData.reg_show_phone !== 0 ? 'block' : 'none';
                document.getElementById('field-org').style.display = eventData.reg_show_org !== 0 ? 'grid' : 'none';
                document.getElementById('field-position').style.display = eventData.reg_show_position === 1 ? 'block' : 'none';
                document.getElementById('field-vegan').style.display = eventData.reg_show_vegan !== 0 ? 'block' : 'none';
                document.getElementById('field-gender').style.display = eventData.reg_show_gender === 1 ? 'block' : 'none';
                document.getElementById('field-dietary').style.display = eventData.reg_show_dietary !== 0 ? 'block' : 'none';

                if (eventData.date) {
                    const eventDate = new Date(eventData.date);
                    const countdownSection = document.getElementById('countdown-section');
                    const now = new Date();
                    const initialDiff = eventDate - now;

                    if (initialDiff <= 0) {
                        countdownSection.style.display = 'none';
                    } else {
                        const countdownInterval = setInterval(() => {
                            const now = new Date();
                            const diff = eventDate - now;
                            if (diff > 0) {
                                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                const s = Math.floor((diff % (1000 * 60)) / 1000);
                                document.getElementById('countdown-timer').innerText =
                                    `${d > 0 ? d + 'd ' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                            } else {
                                countdownSection.style.display = 'none';
                                clearInterval(countdownInterval);
                            }
                        }, 1000);
                    }
                } else {
                    document.getElementById('countdown-section').style.display = 'none';
                }

            } catch (e) {
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('error-content').classList.remove('hidden');
            }
        }

        // ═══ F4: Campos personalizados dinámicos + lógica condicional + acompañantes ═══
        let _regFields = [];
        let _plusOneQuota = 0;

        async function loadDynamicFields() {
            try {
                const res = await fetch(`${API_URL}/events/${eventData.id}/public/registration-form`);
                if (!res.ok) return;
                const data = await res.json();
                _regFields = data.fields || [];
                _plusOneQuota = data.plusOneQuota || 0;
                renderDynamicFields();
                renderPlusOnes();
                document.getElementById('event-registration-form').addEventListener('change', applyConditionalLogic);
            } catch (e) { console.warn('[F4] dynamic fields:', e); }
        }

        function fieldInputHtml(f) {
            const req = f.required ? 'required' : '';
            const name = `cf-${f.id}`;
            if (f.field_type === 'textarea') return `<textarea name="${name}" class="input-field" rows="2" placeholder="${f.label}${f.required ? ' *' : ''}" ${req}></textarea>`;
            if (f.field_type === 'select' || f.field_type === 'radio') {
                const opts = (f.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
                return `<select name="${name}" class="input-field" ${req}><option value="">${f.label}...</option>${opts}</select>`;
            }
            if (f.field_type === 'checkbox') return `<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer;"><input type="checkbox" name="${name}" value="true" ${req}> ${f.label}${f.required ? ' *' : ''}</label>`;
            const type = f.field_type === 'number' ? 'number' : f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text';
            return `<input type="${type}" name="${name}" class="input-field" placeholder="${f.label}${f.required ? ' *' : ''}" ${req}>`;
        }

        function renderDynamicFields() {
            const wrap = document.getElementById('dynamic-fields');
            if (!wrap) return;
            wrap.innerHTML = _regFields.map(f => `
                <div class="registro-form-group" data-field-id="${f.id}"
                     data-cond-field="${f.show_if_field_id || ''}" data-cond-value="${f.show_if_value || ''}">
                    ${['checkbox'].includes(f.field_type) ? '' : `<label class="form-label">${f.label}${f.required ? ' *' : ''}</label>`}
                    ${fieldInputHtml(f)}
                </div>`).join('');
            applyConditionalLogic();
        }

        function applyConditionalLogic() {
            _regFields.forEach(f => {
                if (!f.show_if_field_id) return;
                const depEl = document.querySelector(`[name="cf-${f.show_if_field_id}"]`);
                const wrapEl = document.querySelector(`[data-field-id="${f.id}"]`);
                if (!depEl || !wrapEl) return;
                const val = depEl.type === 'checkbox' ? (depEl.checked ? 'true' : '') : (depEl.value || '');
                const show = f.show_if_value === '*' ? !!val : val === f.show_if_value;
                wrapEl.classList.toggle('hidden', !show);
                if (!show) { depEl.value = ''; if (depEl.type === 'checkbox') depEl.checked = false; }
            });
        }

        function collectCustomFields() {
            const out = {};
            _regFields.forEach(f => {
                const el = document.querySelector(`[name="cf-${f.id}"]`);
                if (!el) return;
                const wrapEl = document.querySelector(`[data-field-id="${f.id}"]`);
                if (wrapEl && wrapEl.classList.contains('hidden')) return; // condición oculta → no enviar
                out[f.id] = el.type === 'checkbox' ? (el.checked ? 'true' : '') : el.value.trim();
            });
            return out;
        }

        function renderPlusOnes() {
            if (_plusOneQuota <= 0) return;
            document.getElementById('plusones-section').classList.remove('hidden');
            document.getElementById('plusones-quota-label').innerText = `(máximo ${_plusOneQuota})`;
            const list = document.getElementById('plusones-list');
            const btnAdd = document.getElementById('btn-add-plusone');
            function addRow() {
                const count = list.querySelectorAll('input').length;
                if (count >= _plusOneQuota) { btnAdd.disabled = true; btnAdd.innerText = `Máximo ${_plusOneQuota} acompañantes`; return; }
                const row = document.createElement('div');
                row.className = 'flex gap-2';
                row.innerHTML = `<input type="text" class="input-field flex-1 plusone-name" placeholder="Nombre del acompañante">`;
                list.appendChild(row);
                if (count + 1 >= _plusOneQuota) { btnAdd.disabled = true; btnAdd.innerText = `Máximo ${_plusOneQuota} acompañantes`; }
            }
            btnAdd.onclick = addRow;
        }

        function collectPlusOnes() {
            return Array.from(document.querySelectorAll('.plusone-name'))
                .map(i => ({ name: i.value.trim() }))
                .filter(p => p.name);
        }

        document.getElementById('event-registration-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!eventData) return alert("Error: Evento no identificado");

            const btn = document.getElementById('submit-btn');
            const orig = btn.innerText;
            btn.innerText = "Procesando...";
            btn.disabled = true;

            const body = {
                event_id: eventData.id,
                name: document.getElementById('reg-name').value.trim(),
                email: document.getElementById('reg-email').value.trim().toLowerCase(),
                phone: document.getElementById('reg-phone').value.trim(),
                organization: document.getElementById('reg-org').value.trim(),
                position: document.getElementById('reg-position').value.trim(),
                gender: document.getElementById('reg-gender').value
            };

            const vegan = document.querySelector('input[name="vegan"]:checked')?.value || 'no';
            const dietary = document.getElementById('reg-diet').value;
            body.dietary_notes = vegan === 'si' ? 'Vegano' + (dietary ? ', ' + dietary : '') : dietary;

            // F4: campos personalizados + acompañantes
            body.custom_fields = collectCustomFields();
            const _pos = collectPlusOnes();
            if (_pos.length > 0) body.plus_ones = _pos;

            // Payment flow (cart)
            const cartItems = [];
            categories.forEach(function(c) {
                const qty = cart[c.id] || 0;
                if (qty > 0) cartItems.push({ category_id: c.id, quantity: qty });
            });
            if (eventData.payment_required && cartItems.length > 0) {
                try {
                    const checkoutBody = { name: body.name, email: body.email, items: cartItems };
                    if (_appliedCoupon) checkoutBody.coupon_code = _appliedCoupon;
                    const checkoutRes = await fetch(API_URL + '/events/' + eventData.id + '/checkout-session', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(checkoutBody)
                    });
                    // Fix v12.44.804: este bloque tenía una llave de cierre sobrante
                    // (presente desde v12.44.712) que cerraba la arrow del submit
                    // antes de tiempo y dejaba TODO el script sin parsear: el
                    // formulario público de registro quedaba muerto en "loading".
                    const checkoutData = await checkoutRes.json();
                    if (checkoutData.success && checkoutData.url) {
                        window.location.href = checkoutData.url;
                        return;
                    } else {
                        alert("Error al iniciar pago: " + (checkoutData.error || 'Error desconocido'));
                        btn.innerText = orig;
                        btn.disabled = false;
                        return;
                    }
                } catch(e) {
                    alert("Error de conexión al procesar pago. Intenta de nuevo.");
                    btn.innerText = orig;
                    btn.disabled = false;
                    return;
                }
            }

            // Free registration
            try {
                const res = await fetch(`${API_URL}/public-register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const d = await res.json();
                if (d.success) {
                    e.target.style.display = 'none';
                    document.getElementById('success-message').classList.remove('hidden');
                    setTimeout(() => window.location.reload(), 4000);
                    document.body.onclick = () => window.location.reload();
                } else {
                    alert("Error: " + (d.error || 'No se pudo completar el registro'));
                }
            } catch (e) {
                alert("Error de conexión. Intenta de nuevo.");
            } finally {
                btn.innerText = orig;
                btn.disabled = false;
            }
        });

        loadEvent();
