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
        const partyUpper = partyLabel.toUpperCase();

        return `Ти — досвідчений український юрист-практик (15+ років у договірному праві).
Склади повний Договір ${contractLabel} українською мовою з двома додатками.

═══ ЮРИДИЧНА БАЗА ═══
ЦКУ: ${state.contractType === 'pidryad' ? 'глава 61, ст. 837–864' : 'глава 63, ст. 901–907'}.

═══ ЗАБОРОНИ ═══
НІКОЛИ не вживай терміни трудового права: "зарплата", "графік роботи", "відпустка", "лікарняний", "посада", "працівник", "роботодавець", "підпорядкування", "трудовий розпорядок", "посадова інструкція", "штатний розпис".

═══ ПРАВИЛА ═══
1. Сторони: "Замовник" та "${partyLabel}".
2. ${partyLabel} САМОСТІЙНО організовує роботу, визначає час/місце/спосіб, використовує власні засоби.
3. Преамбула: ФОП діє "на підставі відомостей з Єдиного державного реєстру" (НЕ Статуту).
4. Оплата — за результат, після підписання Акта (Додаток №2).
5. Вартість: передоплата (% + строк), решта (строк), безготівково або готівкою.
6. Передоплата невідшкодовувана при відмові Замовника менш ніж за 5 к.д.
7. Пеня: подвійна облікова ставка НБУ за кожен день прострочення.
8. Форс-мажор: посилання на ТПП України.
9. Спори: переговори → претензія (10 к.д.) → суд.
10. Конфіденційність обов'язкова.
11. Реквізити: ПІБ, РНОКПП, тел., email, IBAN, банк, адреса.
12. Договір у 2 примірниках. Додатки №1 і №2 — невід'ємні частини.

═══ ФОРМАТУВАННЯ ═══
Кожен підпункт (1.1, 1.2...) на ОКРЕМОМУ рядку через \\n. НЕ об'єднуй підпункти в один абзац.

═══ ДОДАТКИ ═══
Додаток №1 — таблиця 3–7 послуг з опису замовника. Розбий загальну ціну на складові (сума = загальна ціна). "РАЗОМ:" + "Примітки:".
Додаток №2 — Акт: список послуг, дата, вартість, "Оплата повністю/частково (підкреслити)", "Претензій НЕ МАЄ/МАЄ (підкреслити)", "Зауваження:".

═══ JSON-ВІДПОВІДЬ ═══
Поверни ВИКЛЮЧНО валідний JSON. Без markdown, без \`\`\`, без пояснень. Переноси рядків — \\n.
{
  "title": "ДОГОВІР ${contractLabel.toUpperCase()} №___",
  "subtitle": "короткий опис суті договору",
  "cityDate": "м. [ПІДСТАВ МІСТО З ПАРАМЕТРІВ] «___» __________ 20___ р.",
  "preamble": "Фізична особа ___ (далі — \\"${partyLabel}\\"), з одного боку, та фізична особа ___ (далі — \\"Замовник\\"), з іншого боку...",
  "sections": [
    {"title": "1. ПРЕДМЕТ ДОГОВОРУ", "content": "1.1 ${partyLabel} зобов'язується...\\n1.2 Обсяг уточнюється у Додатку №1...\\n1.3 Послуги надаються відповідно до ЦКУ."},
    {"title": "2. ВАРТІСТЬ ПОСЛУГ ТА ПОРЯДОК РОЗРАХУНКІВ", "content": "2.1 Загальна вартість...\\n2.2 Порядок оплати: передоплата...\\n2.3 Оплата безготівково/готівкою...\\n2.4 Передоплата невідшкодовувана..."},
    {"title": "3. СТРОКИ НАДАННЯ ПОСЛУГ", "content": "3.1 Дата...\\n3.2 Час...\\n3.3 Місце..."},
    {"title": "4. ПРАВА ТА ОБОВ'ЯЗКИ ЗАМОВНИКА", "content": "4.1 ...\\n4.2 ..."},
    {"title": "5. ПРАВА ТА ОБОВ'ЯЗКИ ${partyUpper}А", "content": "5.1 ...\\n5.2 ..."},
    {"title": "6. ПОРЯДОК ЗДАЧІ-ПРИЙМАННЯ", "content": "текст..."},
    {"title": "7. ВІДПОВІДАЛЬНІСТЬ СТОРІН", "content": "текст..."},
    {"title": "8. КОНФІДЕНЦІЙНІСТЬ", "content": "текст..."},
    {"title": "9. ФОРС-МАЖОРНІ ОБСТАВИНИ", "content": "текст..."},
    {"title": "10. СТРОК ДІЇ, ЗМІНА ТА РОЗІРВАННЯ ДОГОВОРУ", "content": "текст..."},
    {"title": "11. ПРИКІНЦЕВІ ПОЛОЖЕННЯ", "content": "11.1 Договір у 2 примірниках...\\n11.2 Невід'ємні частини: Додаток №1, №2.\\n11.3 Зміни — письмово."}
  ],
  "requisites": {
    "customer": "ЗАМОВНИК:\\nПІБ: ___\\nПаспорт/ID: ___\\nТел.: ___\\nEmail: ___\\nАдреса: ___\\n\\nПідпис: ___\\nДата: ___",
    "contractor": "${partyLabel.toUpperCase()}:\\nПІБ: ___\\nІПН: ___\\nТел.: ___\\nEmail: ___\\nIBAN: ___\\nБанк: ___\\nАдреса: ___\\n\\nПідпис: ___\\nДата: ___"
  },
  "appendix1": {
    "title": "ДОДАТОК № 1",
    "subtitle": "до Договору про ${contractLabel} від «___» __________ 20___ р.",
    "heading": "ПЕРЕЛІК ПОСЛУГ, ВАРТІСТЬ ТА УМОВИ",
    "services": [
      {"num": "1", "name": "Назва послуги", "details": "Опис / деталі", "qty": "", "price": ""},
      {"num": "2", "name": "...", "details": "...", "qty": "", "price": ""}
    ],
    "total": "РАЗОМ:",
    "notes": "Примітки: ___"
  },
  "appendix2": {
    "title": "ДОДАТОК № 2",
    "subtitle": "до Договору про ${contractLabel} від «___» __________ 20___ р.",
    "heading": "АКТ ПРИЙОМУ-ПЕРЕДАЧІ НАДАНИХ ПОСЛУГ",
    "content": "Ми, що підписалися нижче: ${partyLabel} ___ та Замовник ___, склали цей Акт про наступне:\\n1. ${partyLabel} надав, а Замовник прийняв такі послуги:\\n— ___\\n2. Дата надання послуг: «___» __________ 20___ р.\\n3. Загальна вартість послуг: ___ грн.\\n4. Оплата здійснена повністю / частково (потрібне підкреслити).\\n5. Замовник претензій до якості наданих послуг: НЕ МАЄ / МАЄ (потрібне підкреслити).\\n6. Зауваження Замовника (за наявності): ___"
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
        const contractLabel = state.contractType === 'pidryad' ? 'підряду' : 'надання послуг';

        let customerData, contractorData;

        if (isTemplate) {
            customerData = 'Замовник: [ПІБ], РНОКПП: [РНОКПП], Паспорт/ID: [НОМЕР], Тел.: [ТЕЛЕФОН], Email: [EMAIL], Адреса: [АДРЕСА]';
            contractorData = 'Виконавець: [ПІБ], РНОКПП (ІПН): [ІПН], Тел.: [ТЕЛЕФОН], Email: [EMAIL], IBAN: [IBAN], Банк: [БАНК], Адреса: [АДРЕСА]';
        } else {
            customerData = 'Замовник: ФОП ' + ($('#cust-name').value.trim() || '[ПІБ]') + ', РНОКПП: ' + ($('#cust-rnokpp').value.trim() || '[РНОКПП]') + ', Адреса: ' + ($('#cust-address').value.trim() || '[АДРЕСА]') + ', IBAN: ' + ($('#cust-iban').value.trim() || '[IBAN]') + ', Банк: ' + ($('#cust-bank').value.trim() || '[БАНК]');
            contractorData = 'Виконавець: ФОП ' + ($('#contr-name').value.trim() || '[ПІБ]') + ', РНОКПП: ' + ($('#contr-rnokpp').value.trim() || '[РНОКПП]') + ', Адреса: ' + ($('#contr-address').value.trim() || '[АДРЕСА]') + ', IBAN: ' + ($('#contr-iban').value.trim() || '[IBAN]') + ', Банк: ' + ($('#contr-bank').value.trim() || '[БАНК]');
        }

        return 'Склади Договір ' + contractLabel + '.\n\n'
            + 'РЕЖИМ: ' + (isTemplate ? 'ШАБЛОН — невідомі дані = [ПЛЕЙСХОЛДЕР]' : 'ПОВНИЙ ДОГОВІР') + '\n\n'
            + 'СТОРОНИ:\n'
            + '• ' + customerData + '\n'
            + '• ' + contractorData + '\n\n'
            + 'ПАРАМЕТРИ:\n'
            + '• Місто: ' + city + ' (підстав у "cityDate")\n'
            + '• Дата початку: ' + (isTemplate ? '[ДАТА]' : (dateStart || '[ДАТА]')) + '\n'
            + '• Дата закінчення: ' + (isTemplate ? '[ДАТА]' : (dateEnd || '[ДАТА]')) + '\n'
            + '• Ціна: ' + (isTemplate ? '[СУМА] грн' : (price ? price + ' грн' : '[СУМА] грн')) + '\n'
            + '• Оплата: ' + payDays + ' к.д. після Акту\n\n'
            + 'ОПИС РОБІТ (розбий на 3–7 послуг для таблиці Додатку №1, розподіли ціну по рядках):\n'
            + description + '\n\n'
            + 'ВИМОГИ ДО ЯКОСТІ:\n'
            + '— Кожен підпункт (1.1, 1.2) на окремому рядку (\n).\n'
            + '— Текст юридично точний, без "води" та канцеляризмів.\n'
            + '— JSON повинен бути 100% валідним.';
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
        const partyName = state.contractType === 'pidryad' ? 'ПІДРЯДНИК' : 'ВИКОНАВЕЦЬ';
        let html = '';
        html += '<h2 style="text-align:center;margin-bottom:4px;font-size:1.15rem;font-weight:700;">' + escHtml(contract.title || 'ДОГОВІР') + '</h2>';
        if (contract.subtitle) {
            html += '<p style="text-align:center;margin-bottom:8px;font-size:0.9rem;color:#5c5c60;font-style:italic;">' + escHtml(contract.subtitle) + '</p>';
        }
        if (contract.cityDate) {
            html += '<p style="text-align:center;margin-bottom:20px;font-size:0.85rem;color:#86868b;">' + escHtml(contract.cityDate) + '</p>';
        }
        html += '<p>' + escHtml(contract.preamble || '') + '</p>';

        if (contract.sections) {
            contract.sections.forEach(function(section) {
                html += '<h2>' + escHtml(section.title) + '</h2>';
                html += '<p>' + escHtml(section.content) + '</p>';
            });
        }

        if (contract.requisites) {
            html += '<h2>РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН</h2>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:12px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;">';
            html += '<div><strong>ЗАМОВНИК:</strong><br>' + escHtml(contract.requisites.customer || '') + '</div>';
            html += '<div><strong>' + partyName + ':</strong><br>' + escHtml(contract.requisites.contractor || '') + '</div>';
            html += '</div>';
        }

        // ДОДАТОК №1
        if (contract.appendix1) {
            var a = contract.appendix1;
            html += '<div style="margin-top:40px;padding-top:24px;border-top:2px solid #1d1d1f;">';
            html += '<h2 style="text-align:center;font-size:1.05rem;margin-bottom:4px;">' + escHtml(a.title) + '</h2>';
            if (a.subtitle) html += '<p style="text-align:center;font-size:0.85rem;color:#5c5c60;margin-bottom:4px;">' + escHtml(a.subtitle) + '</p>';
            if (a.heading) html += '<h3 style="text-align:center;font-size:0.95rem;margin-bottom:16px;font-weight:700;">' + escHtml(a.heading) + '</h3>';
            if (a.services && a.services.length) {
                html += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:12px;">';
                html += '<thead><tr style="background:#f4f6f2;"><th style="border:1px solid #ccc;padding:6px 8px;width:30px;">№</th><th style="border:1px solid #ccc;padding:6px 8px;">Послуга</th><th style="border:1px solid #ccc;padding:6px 8px;">Опис / деталі</th><th style="border:1px solid #ccc;padding:6px 8px;width:80px;">Кількість</th><th style="border:1px solid #ccc;padding:6px 8px;width:90px;">Вартість (грн)</th></tr></thead><tbody>';
                a.services.forEach(function(s) {
                    html += '<tr><td style="border:1px solid #ccc;padding:6px 8px;text-align:center;">' + escHtml(s.num) + '</td><td style="border:1px solid #ccc;padding:6px 8px;">' + escHtml(s.name) + '</td><td style="border:1px solid #ccc;padding:6px 8px;">' + escHtml(s.details || '') + '</td><td style="border:1px solid #ccc;padding:6px 8px;text-align:center;">' + escHtml(s.qty || '') + '</td><td style="border:1px solid #ccc;padding:6px 8px;text-align:right;">' + escHtml(s.price || '') + '</td></tr>';
                });
                html += '<tr style="font-weight:700;"><td colspan="4" style="border:1px solid #ccc;padding:6px 8px;text-align:right;">' + escHtml(a.total || 'РАЗОМ:') + '</td><td style="border:1px solid #ccc;padding:6px 8px;text-align:right;"></td></tr>';
                html += '</tbody></table>';
            }
            if (a.notes) html += '<p style="font-size:0.82rem;color:#5c5c60;">' + escHtml(a.notes) + '</p>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:20px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;">';
            html += '<div><strong>ВИКОНАВЕЦЬ:</strong><br>ПІБ: ___<br>ІПН: ___<br>Тел.: ___<br>Email: ___<br>IBAN: ___<br><br>Підпис: ___<br>Дата: ___</div>';
            html += '<div><strong>ЗАМОВНИК:</strong><br>ПІБ: ___<br>Паспорт/ID: ___<br>Тел.: ___<br>Email: ___<br>Адреса: ___<br><br>Підпис: ___<br>Дата: ___</div>';
            html += '</div></div>';
        }

        // ДОДАТОК №2
        if (contract.appendix2) {
            var a2 = contract.appendix2;
            html += '<div style="margin-top:40px;padding-top:24px;border-top:2px solid #1d1d1f;">';
            html += '<h2 style="text-align:center;font-size:1.05rem;margin-bottom:4px;">' + escHtml(a2.title) + '</h2>';
            if (a2.subtitle) html += '<p style="text-align:center;font-size:0.85rem;color:#5c5c60;margin-bottom:4px;">' + escHtml(a2.subtitle) + '</p>';
            if (a2.heading) html += '<h3 style="text-align:center;font-size:0.95rem;margin-bottom:16px;font-weight:700;">' + escHtml(a2.heading) + '</h3>';
            html += '<p>' + escHtml(a2.content || '') + '</p>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:20px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;">';
            html += '<div><strong>ВИКОНАВЕЦЬ:</strong><br>ПІБ: ___<br>ІПН: ___<br>Тел.: ___<br>Email: ___<br>IBAN: ___<br><br>Підпис: ___<br>Дата: ___</div>';
            html += '<div><strong>ЗАМОВНИК:</strong><br>ПІБ: ___<br>Паспорт/ID: ___<br>Тел.: ___<br>Email: ___<br>Адреса: ___<br><br>Підпис: ___<br>Дата: ___</div>';
            html += '</div></div>';
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

        // HTML-based doc generation (the plain text block was removed as unused)

        // Generate a simple .docx using a minimal approach
        // We create an HTML-based docx since we don't have the docx library loaded
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 2cm; }
    h1 { text-align: center; font-size: 14pt; margin-bottom: 6pt; }
    .subtitle { text-align: center; font-size: 12pt; font-style: italic; margin-bottom: 6pt; }
    .city-date { text-align: center; font-size: 11pt; margin-bottom: 16pt; color: #555; }
    h2 { font-size: 12pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
    h3 { font-size: 12pt; font-weight: bold; text-align: center; margin-top: 10pt; margin-bottom: 8pt; }
    p { text-align: justify; margin-bottom: 6pt; }
    table.services { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
    table.services th, table.services td { border: 1px solid #000; padding: 4pt 6pt; font-size: 10pt; }
    table.services th { background: #f0f0f0; font-weight: bold; }
    .sig-table td { width: 50%; vertical-align: top; padding: 8pt; border: 1px solid #000; }
    .appendix-break { page-break-before: always; margin-top: 24pt; }
</style>
</head>
<body>
<h1>${escHtmlForDoc(contract.title || 'ДОГОВІР')}</h1>
${contract.subtitle ? '<p class="subtitle">' + escHtmlForDoc(contract.subtitle) + '</p>' : ''}
${contract.cityDate ? '<p class="city-date">' + escHtmlForDoc(contract.cityDate) + '</p>' : ''}
<p>${escHtmlForDoc(contract.preamble || '')}</p>
${(contract.sections || []).map(s => '<h2>' + escHtmlForDoc(s.title) + '</h2><p>' + escHtmlForDoc(s.content) + '</p>').join('')}
<h2>РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН</h2>
<table class="sig-table" width="100%"><tr>
<td><b>ЗАМОВНИК:</b><br>${escHtmlForDoc(contract.requisites?.customer || '')}</td>
<td><b>${state.contractType === 'pidryad' ? 'ПІДРЯДНИК' : 'ВИКОНАВЕЦЬ'}:</b><br>${escHtmlForDoc(contract.requisites?.contractor || '')}</td>
</tr></table>
${contract.appendix1 ? buildAppendix1Html(contract.appendix1) : ''}
${contract.appendix2 ? buildAppendix2Html(contract.appendix2) : ''}
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

    function buildAppendix1Html(a) {
        var html = '<div class="appendix-break">';
        html += '<h2 style="text-align:center;">' + escHtmlForDoc(a.title) + '</h2>';
        if (a.subtitle) html += '<p style="text-align:center;font-size:11pt;">' + escHtmlForDoc(a.subtitle) + '</p>';
        if (a.heading) html += '<h3>' + escHtmlForDoc(a.heading) + '</h3>';
        if (a.services && a.services.length) {
            html += '<table class="services"><thead><tr><th>№</th><th>Послуга</th><th>Опис / деталі</th><th>Кількість / год.</th><th>Вартість (грн)</th></tr></thead><tbody>';
            a.services.forEach(function(s) {
                html += '<tr><td>' + escHtmlForDoc(s.num) + '</td><td>' + escHtmlForDoc(s.name) + '</td><td>' + escHtmlForDoc(s.details || '') + '</td><td>' + escHtmlForDoc(s.qty || '') + '</td><td>' + escHtmlForDoc(s.price || '') + '</td></tr>';
            });
            html += '<tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">РАЗОМ:</td><td>' + escHtmlForDoc(a.total || '') + '</td></tr>';
            html += '</tbody></table>';
        }
        if (a.notes) html += '<p>' + escHtmlForDoc(a.notes) + '</p>';
        html += '<br><table class="sig-table" width="100%"><tr>';
        html += '<td><b>ВИКОНАВЕЦЬ:</b><br>ПІБ: ___<br>ІПН: ___<br>Тел.: ___<br>Email: ___<br>IBAN: ___<br><br>Підпис: ___<br>Дата: ___</td>';
        html += '<td><b>ЗАМОВНИК:</b><br>ПІБ: ___<br>Паспорт/ID: ___<br>Тел.: ___<br>Email: ___<br>Адреса: ___<br><br>Підпис: ___<br>Дата: ___</td>';
        html += '</tr></table></div>';
        return html;
    }

    function buildAppendix2Html(a2) {
        var html = '<div class="appendix-break">';
        html += '<h2 style="text-align:center;">' + escHtmlForDoc(a2.title) + '</h2>';
        if (a2.subtitle) html += '<p style="text-align:center;font-size:11pt;">' + escHtmlForDoc(a2.subtitle) + '</p>';
        if (a2.heading) html += '<h3>' + escHtmlForDoc(a2.heading) + '</h3>';
        html += '<p>' + escHtmlForDoc(a2.content || '') + '</p>';
        html += '<br><table class="sig-table" width="100%"><tr>';
        html += '<td><b>ВИКОНАВЕЦЬ:</b><br>ПІБ: ___<br>ІПН: ___<br>Тел.: ___<br>Email: ___<br>IBAN: ___<br><br>Підпис: ___<br>Дата: ___</td>';
        html += '<td><b>ЗАМОВНИК:</b><br>ПІБ: ___<br>Паспорт/ID: ___<br>Тел.: ___<br>Email: ___<br>Адреса: ___<br><br>Підпис: ___<br>Дата: ___</td>';
        html += '</tr></table></div>';
        return html;
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
