// Vercel Serverless Function — ДоговірPro AI Proxy
// Credentials are lightly obfuscated to prevent casual discovery

// ===== OBFUSCATED CONFIG =====
const _d = (s) => Buffer.from(s, 'base64').toString('utf-8');
const _C = {
    g: _d('QUl6YVN5RHpkbmxleXlSSnlNSEd2aFZ2TkljbFR3M0hCNzFwZGg4'),
    o: _d('c2stcHJvai1VU3JQLVhSMkY0eTd6ekFjVWJNU0R6VnFPUm5Kd2JNeXltU2dVS04xa1IxNWFyVDB5SGhpUk9OM3UwRnZDZnhSaVEzZ29IbXk2R1QzQmxia0ZKUF9vMjlhcE1qODQtWjNxQmV6ZU5zUGpZYThrUmhoOW1saTJvQklyT29TVm1oV0g1LUMwVmdzbGhIZzBHdUJNQzB3OHhSZXd1b0E='),
    p: _d('MTIzNDU='),
};

// Login check: accepts "Лена", "лена", "Лена Деде", "лена деде", etc.
function isValidLogin(input) {
    if (!input) return false;
    const normalized = input.toLowerCase().trim();
    return normalized.includes('лен');
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { login, password, provider, systemPrompt, userPrompt, authOnly } = req.body;

        // ===== AUTH CHECK =====
        if (!isValidLogin(login) || password !== _C.p) {
            return res.status(401).json({ error: 'Невірний логін або пароль' });
        }

        // ===== AUTH-ONLY MODE (login check without AI call) =====
        if (authOnly === true) {
            return res.status(200).json({ ok: true });
        }

        // ===== VALIDATE INPUT =====
        if (!provider || !systemPrompt || !userPrompt) {
            return res.status(400).json({ error: 'Не вистачає даних для генерації' });
        }

        // ===== CALL AI =====
        let result;
        if (provider === 'gemini') {
            result = await callGemini(systemPrompt, userPrompt);
        } else if (provider === 'openai') {
            result = await callOpenAI(systemPrompt, userPrompt);
        } else {
            return res.status(400).json({ error: 'Невідомий провайдер' });
        }

        return res.status(200).json({ contract: result });

    } catch (err) {
        console.error('Generate error:', err);
        return res.status(500).json({ error: err.message || 'Помилка сервера' });
    }
}

// ===== GEMINI =====
async function callGemini(systemPrompt, userPrompt) {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${_C.g}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                maxOutputTokens: 16384,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Порожня відповідь від Gemini');
    return JSON.parse(text);
}

// ===== OPENAI =====
async function callOpenAI(systemPrompt, userPrompt) {
    const model = 'gpt-4o';
    const url = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_C.o}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Порожня відповідь від OpenAI');
    return JSON.parse(text);
}
