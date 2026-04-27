/* ===================================================================
   ДоговірPro — Application Logic
   AI Contract Generator for Ukrainian FOPs
   =================================================================== */

(function () {
    'use strict';

    // ===== STATE =====
    const state = {
        currentStep: 1,
        contractType: null,   // 'pidryad' | 'poslugy'
        mode: 'full',         // 'full' | 'template'
        aiProvider: 'gemini', // 'gemini' (Стандарт) | 'openai' (Продвинутий)
        generatedContract: null,
        history: JSON.parse(localStorage.getItem('dp_history') || '[]'),
        auth: { login: '', password: '' },
    };

    // ===== DOM REFS =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        steps: $$('.steps__item'),
        lines: $$('.steps__line'),
        step1: $('#step-1'),
        step2: $('#step-2'),
        step3: $('#step-3'),
        typeCards: $$('.card'),
        modeButtons: $$('.mode-toggle__btn'),
        btnNext1: $('#btn-next-1'),
        btnBack2: $('#btn-back-2'),
        btnGenerate: $('#btn-generate'),
        btnBack3: $('#btn-back-3'),
        btnDownload: $('#btn-download'),
        btnNew: $('#btn-new'),
        btnSettings: $('#btn-settings'),
        btnHistory: $('#btn-history'),
        btnSaveSettings: $('#btn-save-settings'),
        modalSettings: $('#modal-settings'),
        modalHistory: $('#modal-history'),
        modalCloseSettings: $('#modal-close-settings'),
        modalCloseHistory: $('#modal-close-history'),
        loading: $('#loading'),
        previewContent: $('#preview-content'),
        sectionCustomer: $('#section-customer'),
        sectionContractor: $('#section-contractor'),
        toast: $('#toast'),
        historyList: $('#history-list'),
        step2Subtitle: $('#step2-subtitle'),
    };

    // ===== SETTINGS PERSISTENCE =====
    function loadSettings() {
        return JSON.parse(localStorage.getItem('dp_settings') || JSON.stringify({
            provider: 'gemini',
            apiKey: '',
            model: '',
            defaultName: '',
            defaultRnokpp: '',
            defaultIban: '',
            defaultAddress: '',
            defaultBank: '',
        }));
    }

    function saveSettings(s) {
        localStorage.setItem('dp_settings', JSON.stringify(s));
    }

    function populateSettingsModal() {
        const s = loadSettings();
        $('#ai-provider').value = s.provider || 'gemini';
        $('#api-key').value = s.apiKey || '';
        $('#ai-model').value = s.model || '';
        $('#default-name').value = s.defaultName || '';
        $('#default-rnokpp').value = s.defaultRnokpp || '';
        $('#default-iban').value = s.defaultIban || '';
        $('#default-address').value = s.defaultAddress || '';
        $('#default-bank').value = s.defaultBank || '';
    }

    function readSettingsFromModal() {
        return {
            provider: $('#ai-provider').value,
            apiKey: $('#api-key').value.trim(),
            model: $('#ai-model').value.trim(),
            defaultName: $('#default-name').value.trim(),
            defaultRnokpp: $('#default-rnokpp').value.trim(),
            defaultIban: $('#default-iban').value.trim(),
            defaultAddress: $('#default-address').value.trim(),
            defaultBank: $('#default-bank').value.trim(),
        };
    }

    // ===== NAVIGATION =====
    function goToStep(n) {
        state.currentStep = n;

        // Hide all steps
        [els.step1, els.step2, els.step3].forEach(s => s.classList.add('step--hidden'));

        // Show current
        if (n === 1) els.step1.classList.remove('step--hidden');
        if (n === 2) els.step2.classList.remove('step--hidden');
        if (n === 3) els.step3.classList.remove('step--hidden');

        // Update indicator
        els.steps.forEach((item, i) => {
            const stepNum = i + 1;
            item.classList.remove('steps__item--active', 'steps__item--done');
            if (stepNum === n) item.classList.add('steps__item--active');
            if (stepNum < n) item.classList.add('steps__item--done');
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== STEP 1 LOGIC =====
    function handleTypeSelect(type) {
        state.contractType = type;
        els.typeCards.forEach(c => {
            c.classList.toggle('card--selected', c.dataset.type === type);
        });
        updateNext1State();
    }

    function handleModeSelect(mode) {
        state.mode = mode;
        els.modeButtons.forEach(b => {
            b.classList.toggle('mode-toggle__btn--active', b.dataset.mode === mode);
        });
        updateNext1State();
    }

    function updateNext1State() {
        els.btnNext1.disabled = !state.contractType;
    }

    // ===== STEP 2 LOGIC =====
    function setupStep2() {
        const isTemplate = state.mode === 'template';
        els.sectionCustomer.style.display = isTemplate ? 'none' : '';
        els.sectionContractor.style.display = isTemplate ? 'none' : '';

        const typeLabel = state.contractType === 'pidryad' ? 'підряду' : 'надання послуг';
        const modeLabel = isTemplate ? '(шаблон з плейсхолдерами)' : '(повний договір)';
        els.step2Subtitle.textContent = `Договір ${typeLabel} ${modeLabel}`;

        // Auto-fill default data if available
        if (!isTemplate) {
            const s = loadSettings();
            if (s.defaultName && !$('#cust-name').value) {
                $('#cust-name').value = s.defaultName;
                $('#cust-rnokpp').value = s.defaultRnokpp;
                $('#cust-iban').value = s.defaultIban;
                $('#cust-address').value = s.defaultAddress;
                $('#cust-bank').value = s.defaultBank;
            }
        }
    }

    // ===== AI INTEGRATION =====
    function buildSystemPrompt() {
        const contractLabel = state.contractType === 'pidryad' ? 'підряду' : 'надання послуг';
        const partyLabel = state.contractType === 'pidryad' ? 'Підрядник' : 'Виконавець';

        return `Ти — досвідчений український юрист, що спеціалізується на договірному праві. 
Твоє завдання — скласти юридично бездоганний Договір ${contractLabel} українською мовою.

ОБОВ'ЯЗКОВІ ПРАВИЛА:
1. Договір відповідає Цивільному кодексу України (${state.contractType === 'pidryad' ? 'глава 61, ст. 837-864' : 'глава 63, ст. 901-907'}).
2. КАТЕГОРИЧНО ЗАБОРОНЕНО використовувати терміни трудового права: "зарплата", "графік роботи", "відпустка", "лікарняний", "посада", "працівник", "роботодавець", "підпорядкування", "трудовий розпорядок", "посадова інструкція".
3. ${partyLabel} САМОСТІЙНО організовує свій робочий процес, використовує власні засоби та матеріали (якщо інше не передбачено).
4. Оплата ВИКЛЮЧНО після підписання Акта приймання-передачі виконаних робіт/наданих послуг.
5. Обов'язково включи розділ про форс-мажорні обставини з посиланням на засвідчення ТПП України.
6. Обов'язково включи розділ про конфіденційність.
7. Обов'язково включи розділ про порядок вирішення спорів (переговори → суд).
8. Сторони: "Замовник" та "${partyLabel}".
9. Преамбула: ФОП діє "на підставі відомостей з Єдиного державного реєстру" (НЕ на підставі Статуту).
10. Реквізити ФОП: РНОКПП (НЕ ЄДРПОУ), IBAN, адреса, банк.
11. Пені за прострочення: подвійна облікова ставка НБУ від суми заборгованості за кожен день прострочення.

ФОРМАТ ВІДПОВІДІ:
Поверни ТІЛЬКИ валідний JSON (без markdown, без \`\`\`, без пояснень) з такою структурою:
{
  "title": "ДОГОВІР ${contractLabel.toUpperCase()} №___",
  "preamble": "повний текст преамбули з даними сторін",
  "sections": [
    {"title": "1. ПРЕДМЕТ ДОГОВОРУ", "content": "текст розділу з підпунктами 1.1, 1.2..."},
    {"title": "2. СТРОКИ ВИКОНАННЯ", "content": "текст..."},
    {"title": "3. ЦІНА ТА ПОРЯДОК РОЗРАХУНКІВ", "content": "текст..."},
    {"title": "4. ПРАВА ТА ОБОВ'ЯЗКИ ЗАМОВНИКА", "content": "текст..."},
    {"title": "5. ПРАВА ТА ОБОВ'ЯЗКИ ${partyLabel.toUpperCase()}А", "content": "текст..."},
    {"title": "6. ПОРЯДОК ЗДАЧІ-ПРИЙМАННЯ", "content": "текст..."},
    {"title": "7. ВІДПОВІДАЛЬНІСТЬ СТОРІН", "content": "текст..."},
    {"title": "8. КОНФІДЕНЦІЙНІСТЬ", "content": "текст..."},
    {"title": "9. ФОРС-МАЖОРНІ ОБСТАВИНИ", "content": "текст..."},
    {"title": "10. СТРОК ДІЇ, ЗМІНА ТА РОЗІРВАННЯ ДОГОВОРУ", "content": "текст..."},
    {"title": "11. ПРИКІНЦЕВІ ПОЛОЖЕННЯ", "content": "текст..."}
  ],
  "requisites": {
    "customer": "повний блок реквізитів Замовника",
    "contractor": "повний блок реквізитів ${partyLabel}а"
  }
}`;
    }

    function buildUserPrompt() {
        const isTemplate = state.mode === 'template';
        const description = $('#work-description').value.trim();
        const price = $('#price').value.trim();
        const city = $('#city').value.trim() || 'Київ';
        const dateStart = $('#date-start').value;
        const dateEnd = $('#date-end').value;
        const payDays = $('#pay-days').value || '5';

        let customerData, contractorData;

        if (isTemplate) {
            customerData = 'Замовник: [ПІБ ЗАМОВНИКА], РНОКПП: [РНОКПП ЗАМОВНИКА], Адреса: [АДРЕСА ЗАМОВНИКА], IBAN: [IBAN ЗАМОВНИКА], Банк: [БАНК ЗАМОВНИКА]';
            contractorData = 'Підрядник/Виконавець: [ПІБ ПІДРЯДНИКА], РНОКПП: [РНОКПП ПІДРЯДНИКА], Адреса: [АДРЕСА ПІДРЯДНИКА], IBAN: [IBAN ПІДРЯДНИКА], Банк: [БАНК ПІДРЯДНИКА]';
        } else {
            customerData = `Замовник: ФОП ${$('#cust-name').value.trim() || '[ПІБ]'}, РНОКПП: ${$('#cust-rnokpp').value.trim() || '[РНОКПП]'}, Адреса: ${$('#cust-address').value.trim() || '[АДРЕСА]'}, IBAN: ${$('#cust-iban').value.trim() || '[IBAN]'}, Банк: ${$('#cust-bank').value.trim() || '[БАНК]'}`;
            contractorData = `Підрядник/Виконавець: ФОП ${$('#contr-name').value.trim() || '[ПІБ]'}, РНОКПП: ${$('#contr-rnokpp').value.trim() || '[РНОКПП]'}, Адреса: ${$('#contr-address').value.trim() || '[АДРЕСА]'}, IBAN: ${$('#contr-iban').value.trim() || '[IBAN]'}, Банк: ${$('#contr-bank').value.trim() || '[БАНК]'}`;
        }

        return `Склади договір зі наступними параметрами:
- Режим: ${isTemplate ? 'ШАБЛОН (використовуй плейсхолдери [В КВАДРАТНИХ ДУЖКАХ] для невідомих даних)' : 'ПОВНИЙ ДОГОВІР'}
- Місто: ${city}
- Дата: ${isTemplate ? '[ДАТА]' : (dateStart || '[ДАТА]')}
- ${customerData}
- ${contractorData}
- Опис робіт/послуг: ${description}
- Ціна: ${isTemplate ? '[СУМА] грн' : (price ? price + ' грн' : '[СУМА] грн')}
- Строк початку: ${isTemplate ? '[ДАТА ПОЧАТКУ]' : (dateStart || '[ДАТА ПОЧАТКУ]')}
- Строк закінчення: ${isTemplate ? '[ДАТА ЗАКІНЧЕННЯ]' : (dateEnd || '[ДАТА ЗАКІНЧЕННЯ]')}
- Оплата протягом ${payDays} днів після підписання Акту`;
    }

    async function callServerAPI(systemPrompt, userPrompt) {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                login: state.auth.login,
                password: state.auth.password,
                provider: state.aiProvider,
                systemPrompt,
                userPrompt,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Помилка сервера: ${response.status}`);
        }

        return data.contract;
    }

    async function generateContract() {
        const description = $('#work-description').value.trim();
        if (!description) {
            showToast('Опишіть роботи або послуги', true);
            return;
        }

        showLoading(true);

        try {
            const systemPrompt = buildSystemPrompt();
            const userPrompt = buildUserPrompt();
            const contract = await callServerAPI(systemPrompt, userPrompt);

            state.generatedContract = contract;
            renderPreview(contract);
            saveToHistory(contract, description);
            goToStep(3);
        } catch (err) {
            console.error('Generation error:', err);
            showToast(`Помилка: ${err.message}`, true);
        } finally {
            showLoading(false);
        }
    }

    // ===== RENDERING =====
    function renderPreview(contract) {
        let html = '';
        html += `<h2 style="text-align:center;margin-bottom:24px;font-size:1.1rem;">${escHtml(contract.title || 'ДОГОВІР')}</h2>`;
        html += `<p>${escHtml(contract.preamble || '')}</p>`;

        if (contract.sections) {
            contract.sections.forEach(section => {
                html += `<h2>${escHtml(section.title)}</h2>`;
                html += `<p>${escHtml(section.content)}</p>`;
            });
        }

        if (contract.requisites) {
            html += `<h2>РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН</h2>`;
            html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:12px;">`;
            html += `<div><strong>ЗАМОВНИК:</strong><br>${escHtml(contract.requisites.customer || '')}</div>`;
            html += `<div><strong>${state.contractType === 'pidryad' ? 'ПІДРЯДНИК' : 'ВИКОНАВЕЦЬ'}:</strong><br>${escHtml(contract.requisites.contractor || '')}</div>`;
            html += `</div>`;
        }

        els.previewContent.innerHTML = html;
    }

    function escHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    // ===== DOCX GENERATION =====
    async function downloadDocx() {
        const contract = state.generatedContract;
        if (!contract) return;

        // Build plain text for the docx
        let text = '';
        text += (contract.title || 'ДОГОВІР') + '\n\n';
        text += (contract.preamble || '') + '\n\n';

        if (contract.sections) {
            contract.sections.forEach(section => {
                text += section.title + '\n\n';
                text += section.content + '\n\n';
            });
        }

        text += 'РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН\n\n';
        if (contract.requisites) {
            text += 'ЗАМОВНИК:\n' + (contract.requisites.customer || '') + '\n\n';
            const label = state.contractType === 'pidryad' ? 'ПІДРЯДНИК' : 'ВИКОНАВЕЦЬ';
            text += label + ':\n' + (contract.requisites.contractor || '') + '\n';
        }

        // Generate a simple .docx using a minimal approach
        // We create an HTML-based docx since we don't have the docx library loaded
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; }
    h1 { text-align: center; font-size: 14pt; margin-bottom: 20pt; }
    h2 { font-size: 12pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
    p { text-align: justify; margin-bottom: 6pt; }
    .requisites { display: flex; justify-content: space-between; margin-top: 20pt; }
    .requisites div { width: 45%; }
</style>
</head>
<body>
<h1>${escHtmlForDoc(contract.title || 'ДОГОВІР')}</h1>
<p>${escHtmlForDoc(contract.preamble || '')}</p>
${(contract.sections || []).map(s => `<h2>${escHtmlForDoc(s.title)}</h2><p>${escHtmlForDoc(s.content)}</p>`).join('')}
<h2>РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН</h2>
<table width="100%"><tr>
<td width="50%" valign="top"><b>ЗАМОВНИК:</b><br>${escHtmlForDoc(contract.requisites?.customer || '')}</td>
<td width="50%" valign="top"><b>${state.contractType === 'pidryad' ? 'ПІДРЯДНИК' : 'ВИКОНАВЕЦЬ'}:</b><br>${escHtmlForDoc(contract.requisites?.contractor || '')}</td>
</tr></table>
</body>
</html>`;

        // Convert HTML to blob as .doc (Word can open HTML with .doc extension)
        const blob = new Blob(['\ufeff' + htmlContent], {
            type: 'application/msword'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const typeLabel = state.contractType === 'pidryad' ? 'pidryad' : 'poslugy';
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `Dogovir_${typeLabel}_${dateStr}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Договір завантажено!');
    }

    function escHtmlForDoc(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    // ===== HISTORY =====
    function saveToHistory(contract, description) {
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString('uk-UA'),
            type: state.contractType,
            mode: state.mode,
            description: description.slice(0, 80),
            contract,
        };
        state.history.unshift(entry);
        if (state.history.length > 20) state.history.pop();
        localStorage.setItem('dp_history', JSON.stringify(state.history));
    }

    function renderHistory() {
        if (!state.history.length) {
            els.historyList.innerHTML = '<p class="history-list__empty">Ще немає згенерованих договорів</p>';
            return;
        }

        els.historyList.innerHTML = state.history.map(entry => {
            const typeLabel = entry.type === 'pidryad' ? 'Підряд' : 'Послуги';
            return `
                <div class="history-item" data-id="${entry.id}">
                    <div class="history-item__info">
                        <span class="history-item__title">${typeLabel}: ${escHtml(entry.description)}...</span>
                        <span class="history-item__date">${entry.date}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Bind clicks
        els.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const entry = state.history.find(h => h.id === id);
                if (entry) {
                    state.generatedContract = entry.contract;
                    state.contractType = entry.type;
                    state.mode = entry.mode;
                    renderPreview(entry.contract);
                    closeModal(els.modalHistory);
                    goToStep(3);
                }
            });
        });
    }

    // ===== UI HELPERS =====
    function showLoading(visible) {
        els.loading.classList.toggle('loading--visible', visible);
    }

    function showToast(message, isError = false) {
        els.toast.textContent = message;
        els.toast.className = 'toast toast--visible' + (isError ? ' toast--error' : '');
        setTimeout(() => {
            els.toast.className = 'toast';
        }, 3500);
    }

    function openModal(modal) {
        modal.classList.add('modal-overlay--visible');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(modal) {
        modal.classList.remove('modal-overlay--visible');
        document.body.style.overflow = '';
    }

    // ===== EVENT BINDINGS =====
    // ===== LOGIN =====
    function showApp() {
        $('#login-screen').classList.add('login-screen--hidden');
        $('#header').style.display = '';
        $('.main').style.display = '';
    }

    function setupLogin() {
        const loginForm = $('#login-form');
        const loginError = $('#login-error');
        const header = $('#header');
        const main = $('.main');

        // Hide app until logged in
        header.style.display = 'none';
        main.style.display = 'none';

        // Check if already logged in (session)
        const saved = sessionStorage.getItem('dp_auth');
        if (saved) {
            try {
                state.auth = JSON.parse(saved);
                showApp();
            } catch(e) {}
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginError.textContent = '';

            const login = $('#login-name').value.trim();
            const password = $('#login-password').value;

            if (!login || !password) {
                loginError.textContent = 'Введіть логін і пароль';
                return;
            }

            // Verify credentials via server
            const submitBtn = $('#login-submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Перевірка...';

            try {
                const res = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        login,
                        password,
                        authOnly: true,
                    }),
                });

                if (res.status === 401) {
                    loginError.textContent = 'Невірний логін або пароль';
                    return;
                }

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    loginError.textContent = data.error || 'Помилка сервера';
                    return;
                }

                // Auth successful
                state.auth = { login, password };
                sessionStorage.setItem('dp_auth', JSON.stringify(state.auth));
                showApp();
            } catch (err) {
                loginError.textContent = 'Помилка з\'єднання з сервером';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Увійти';
            }
        });
    }

    function init() {
        // Setup login first
        setupLogin();

        // Type cards
        els.typeCards.forEach(card => {
            card.addEventListener('click', () => handleTypeSelect(card.dataset.type));
        });

        // Mode buttons
        els.modeButtons.forEach(btn => {
            btn.addEventListener('click', () => handleModeSelect(btn.dataset.mode));
        });

        // AI Provider toggle
        const aiButtons = $$('.ai-toggle__btn');
        aiButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                state.aiProvider = btn.dataset.provider;
                aiButtons.forEach(b => b.classList.toggle('ai-toggle__btn--active', b === btn));
            });
        });

        // Navigation
        els.btnNext1.addEventListener('click', () => {
            setupStep2();
            goToStep(2);
        });

        els.btnBack2.addEventListener('click', () => goToStep(1));
        els.btnBack3.addEventListener('click', () => goToStep(2));

        els.btnGenerate.addEventListener('click', (e) => {
            e.preventDefault();
            generateContract();
        });

        els.btnDownload.addEventListener('click', downloadDocx);

        els.btnNew.addEventListener('click', () => {
            state.generatedContract = null;
            state.contractType = null;
            els.typeCards.forEach(c => c.classList.remove('card--selected'));
            els.btnNext1.disabled = true;
            goToStep(1);
        });

        // Settings modal
        els.btnSettings.addEventListener('click', () => {
            populateSettingsModal();
            openModal(els.modalSettings);
        });

        els.modalCloseSettings.addEventListener('click', () => closeModal(els.modalSettings));

        els.btnSaveSettings.addEventListener('click', () => {
            const s = readSettingsFromModal();
            saveSettings(s);
            closeModal(els.modalSettings);
            showToast('Налаштування збережено');
        });

        // History modal
        els.btnHistory.addEventListener('click', () => {
            renderHistory();
            openModal(els.modalHistory);
        });

        els.modalCloseHistory.addEventListener('click', () => closeModal(els.modalHistory));

        // Close modals on overlay click
        [els.modalSettings, els.modalHistory].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal);
            });
        });

        // Close modals on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal(els.modalSettings);
                closeModal(els.modalHistory);
            }
        });

        // Set default dates
        const today = new Date().toISOString().slice(0, 10);
        const monthLater = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        $('#date-start').value = today;
        $('#date-end').value = monthLater;
    }

    // ===== BOOT =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
