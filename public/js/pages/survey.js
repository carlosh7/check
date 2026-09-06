        const urlParams = new URLSearchParams(window.location.search);
        const eventId = urlParams.get('eventId');
        const surveyForm = document.getElementById('survey-form');

        async function loadSurvey() {
            // F1 2026-08: endpoint de compatibilidad por evento (antes /surveys daba 404)
            const res = await fetch(`/api/events/${eventId}/surveys`);
            const data = await res.json();
            const questions = Array.isArray(data) ? [] : (data.questions || []);

            if (questions.length > 0) {
                const questionsHtml = questions.map((q) => {
                    let inputHtml
                    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length === 2) {
                        // Booleana (Sí/No) — valores 5/1 mantienen compatibilidad con dashboard
                        inputHtml = `
                            <div style="display: flex; gap: 2rem; justify-content: center; margin: 1rem 0;">
                                <label style="cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; gap: 0.5rem; font-size: 1.1rem;">
                                    <input type="radio" name="q-${q.id}" value="5" required style="width: 20px; height: 20px;"> ✅ ${q.options[0].label}
                                </label>
                                <label style="cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; gap: 0.5rem; font-size: 1.1rem;">
                                    <input type="radio" name="q-${q.id}" value="1" required style="width: 20px; height: 20px;"> ❌ ${q.options[1].label}
                                </label>
                            </div>
                        `;
                    } else if (q.type === 'rating') {
                        inputHtml = `
                            <div style="display: flex; gap: 1rem; justify-content: center; margin: 1rem 0;">
                                ${[1,2,3,4,5].map(v => `
                                    <label style="cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; gap: 0.25rem;">
                                        <input type="radio" name="q-${q.id}" value="${v}" required>
                                        <span style="font-size: 0.8rem;">${v}★</span>
                                    </label>
                                `).join('')}
                            </div>
                        `;
                    } else if ((q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'dropdown') && Array.isArray(q.options)) {
                        inputHtml = `
                            <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; margin: 1rem 0;">
                                ${q.options.map(o => `
                                    <label style="cursor: pointer; display: flex; align-items: center; min-height: 44px; gap: 0.4rem; font-size: 1rem;">
                                        <input type="radio" name="q-${q.id}" value="${o.label.replace(/"/g, '&quot;')}" required> ${o.label}
                                    </label>
                                `).join('')}
                            </div>
                        `;
                    } else {
                        // Texto libre
                        inputHtml = `
                            <div style="margin: 1rem 0;">
                                <input type="text" name="q-${q.id}" required placeholder="Tu respuesta..."
                                    style="width: 100%; max-width: 480px; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--outline); background: transparent; color: inherit;">
                            </div>
                        `;
                    }

                    return `
                        <div class="form-group" style="margin-top: 2rem; border-top: 1px solid var(--outline); padding-top: 1.5rem;">
                            <label style="font-size: 1.1rem; font-weight: 600; text-align: center; display: block;">${q.title}</label>
                            ${inputHtml}
                        </div>
                    `;
                }).join('');

                surveyForm.insertAdjacentHTML('afterbegin', questionsHtml);
                surveyForm.dataset.templateMode = '1';
            } else {
                // Fallback clásico (sin encuesta configurada)
                surveyForm.insertAdjacentHTML('afterbegin', `
                    <div class="form-group" style="text-align: center;">
                        <label style="font-size: 1.1rem; font-weight: 600;">¿Cómo calificarías tu experiencia general?</label>
                        <div style="display: flex; gap: 1rem; justify-content: center; margin: 1.5rem 0;">
                            ${[1,2,3,4,5].map(v => `
                                <label style="cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; gap: 0.25rem;">
                                    <input type="radio" name="rating" value="${v}" required>
                                    <span style="font-size: 0.8rem;">${v}★</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                `);
            }
        }

        surveyForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(surveyForm);
            const comment = document.getElementById('survey-comment').value;

            let payload;
            if (surveyForm.dataset.templateMode === '1') {
                // Modo builder: enviar cada respuesta bajo su questionId
                payload = { responses: {}, comment: comment };
                for (const [key, value] of formData.entries()) {
                    if (key.startsWith('q-')) payload.responses[key.slice(2)] = value;
                }
            } else {
                // Fallback: promedio como rating general
                let totalRating = 0;
                let count = 0;
                for (const value of formData.values()) {
                    if (!isNaN(value)) { totalRating += parseInt(value); count++; }
                }
                payload = { responses: { general_rating: count > 0 ? Math.round(totalRating / count) : 5 }, comment: comment };
            }

            try {
                const res = await fetch(`/api/events/${eventId}/surveys/responses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    surveyForm.classList.add('hidden');
                    document.getElementById('survey-thanks').classList.remove('hidden');
                }
            } catch (err) { console.error(err); }
        };

        loadSurvey();
