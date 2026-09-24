// ==========================================================================
// Copilot
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const launcher = document.getElementById('copilotLauncher');
    const drawer = document.getElementById('copilotDrawer');
    const closeBtn = document.getElementById('copilotCloseBtn');
    const sendBtn = document.getElementById('copilotSendBtn');
    const input = document.getElementById('copilotInput');
    const chatBody = document.getElementById('copilotChatBody');
    const suggestionBox = document.getElementById('copilotSuggestionBox');
    const suggestionList = document.getElementById('copilotSuggestionList');

    const SESSION_ID = 'copilot_session_main';

    launcher?.addEventListener('click', () => {
        drawer.classList.toggle('open');
        if (drawer.classList.contains('open')) {
            input.focus();
            loadCopilotHistory();
        }
    });

    closeBtn?.addEventListener('click', () => {
        drawer.classList.remove('open');
    });

    sendBtn?.addEventListener('click', () => sendCopilotMessage());
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendCopilotMessage();
    });

    // Oturum Hafızasını Yükle
    async function loadCopilotHistory() {
        if (chatBody.children.length > 1) return; // Zaten yüklendiyse tekrar yükleme
        try {
            const res = await fetch(`/api/v1/chat/history?session_id=${SESSION_ID}`);
            const json = await res.json();
            if (json.success && json.history && json.history.length > 0) {
                chatBody.innerHTML = '';
                json.history.forEach(m => {
                    appendMessage(m.role, formatStrategicInsight(m.content));
                });
            }
        } catch (e) {
            console.log('Sohbet geçmişi yüklenemedi:', e);
        }
    }

    // Fuzzy Suggestion Listener
    let debounce = null;
    input?.addEventListener('input', () => {
        clearTimeout(debounce);
        const val = input.value.trim();
        if (val.length < 2) {
            suggestionBox?.classList.remove('show');
            return;
        }

        debounce = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/search/suggest?q=${encodeURIComponent(val)}&limit=3`);
                const json = await res.json();
                const sugs = json.suggestions || [];

                if (sugs.length === 0) {
                    suggestionBox?.classList.remove('show');
                    return;
                }

                if (suggestionList) {
                    suggestionList.innerHTML = sugs.map(s => `
                        <div class="fuzzy-suggestion-item" data-val="${s.canonical_name}">
                            <span>✨ ${s.canonical_name}</span>
                            <span class="fuzzy-score-pill">%${Math.round(s.score)}</span>
                        </div>
                    `).join('');

                    suggestionBox?.classList.add('show');

                    suggestionList.querySelectorAll('.fuzzy-suggestion-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const selectedVal = item.getAttribute('data-val');
                            input.value = `${selectedVal} satış ve durumunu analiz et`;
                            suggestionBox?.classList.remove('show');
                            input.focus();
                        });
                    });
                }
            } catch (err) {
                console.error('Copilot fuzzy hatası:', err);
            }
        }, 150);
    });

    document.addEventListener('click', (e) => {
        if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== input) {
            suggestionBox.classList.remove('show');
        }
    });

    async function sendCopilotMessage() {
        suggestionBox?.classList.remove('show');
        const msg = input.value.trim();
        if (!msg) return;

        input.value = '';
        appendMessage('user', msg);

        const loadingId = appendMessage('ai', '🧠 Veritabanı taranıyor...');

        try {
            const todayIso = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: msg, 
                    active_firm: window.KokpitState?.currentFirma || 'ALL',
                    session_id: SESSION_ID,
                    start_date: window.KokpitState?.currentStartDate || `${todayIso.slice(0, 7)}-01`,
                    end_date: window.KokpitState?.currentEndDate || todayIso
                })
            });
            const json = await res.json();
            
            const loadingBubble = document.getElementById(loadingId);
            if (loadingBubble) loadingBubble.remove();

            if (!json.success) {
                appendMessage('ai', `❌ ${json.explanation || json.error || 'Bir hata oluştu.'}`);
                return;
            }

            let formattedContent = formatStrategicInsight(json.explanation || json.strategic_insight);
            
            let reply = `
                <div class="ai-msg-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:16px;">🤖</span>
                        <strong style="color:#4ade80; font-size:12.5px;">Rapor-AI</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="ai-badge-icon badge-green" style="font-size:9.5px; padding:2px 6px;">⏱️ ${json.duration_ms || 0} ms</span>
                    </div>
                </div>
                <div class="ai-msg-content">
                    ${formattedContent}
                </div>
            `;

            if (json.total_rows !== undefined) {
                reply += `<div style="color:#75a59e; font-size:11px; margin-top:8px; display:flex; align-items:center; gap:6px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px;">
                    <span>📊</span> <span><strong>${json.total_rows}</strong> satır • <em>${json.model || 'Rapor-AI'}</em></span>
                </div>`;
            }

            // AI Stüdyo Sayfasına Aktar Butonu
            if (json.data && json.data.length > 0) {
                window.lastAiResponse = json;
                window.lastAiQuery = msg;
                reply += `
                    <div style="display:flex; gap:6px; margin-top:10px;">
                        <button class="btn btn-green" style="flex:1; font-size:11px; padding:6px 10px; justify-content:center;" onclick="window.transferToAiStudio()">
                            🚀 AI Stüdyoya Aktar
                        </button>
                    </div>
                `;
            }

            appendMessage('ai', reply);

        } catch (err) {
            console.error('Copilot hatası:', err);
            appendMessage('ai', 'Bağlantı hatası oluştu.');
        }
    }

    function appendMessage(sender, text) {
        const id = 'msg_' + Date.now();
        const bubble = document.createElement('div');
        bubble.className = `bubble ${sender === 'user' ? 'bubble-user' : 'bubble-ai'}`;
        bubble.id = id;
        bubble.innerHTML = text;
        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
        return id;
    }
});

// Zengin Metin & Analiz Başlık Formatlayıcı
function formatStrategicInsight(text) {
    if (!text) return '';
    if (window.AIFormatter && typeof window.AIFormatter.format === 'function') {
        return window.AIFormatter.format(text);
    }
    return text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffffff;">$1</strong>');
}

// Mini Copilot'tan Ana AI Stüdyo Sayfasına Aktarım Köprüsü
window.transferToAiStudio = function() {
    const drawer = document.getElementById('copilotDrawer');
    if (drawer) drawer.classList.remove('open');

    const aiTabBtn = document.getElementById('navAiStudioBtn');
    if (aiTabBtn) aiTabBtn.click();

    if (window.lastAiResponse && window.lastAiQuery) {
        const json = window.lastAiResponse;
        const msg = window.lastAiQuery;

        let repTitle = json.report_title || json.explanation || 'AI Rapor Çıktısı';
        if (window.appendStudioMessage) {
            window.appendStudioMessage('user', msg);
            let reply = formatStrategicInsight(json.explanation || json.strategic_insight);
            if (json.total_rows !== undefined) {
                reply += `<br><span style="color:#75a59e; font-size:11.5px;">📊 ${json.total_rows} satır canlı veri aktarıldı (⏱️ ${json.duration_ms} ms - ${json.model})</span>`;
            }
            window.appendStudioMessage('ai', reply);
        }

        const studioTitleEl = document.getElementById('studioReportTitle');
        const studioSubEl = document.getElementById('studioReportSubtitle');
        if (studioTitleEl) studioTitleEl.innerText = repTitle;
        if (studioSubEl) studioSubEl.innerText = `AI çıktısı • ${json.total_rows || 0} satır (⏱️ ${json.duration_ms || 0} ms - ${json.model || ''})`;

        const studioTableTitle = document.getElementById('studioTableReportTitle');
        const studioTableSub = document.getElementById('studioTableReportSubtitle');
        if (studioTableTitle) studioTableTitle.innerText = repTitle;
        if (studioTableSub) studioTableSub.innerText = `${json.total_rows || 0} satır`;

        document.getElementById('studioRowCount').innerText = `${json.total_rows || 0} Satır`;
        document.getElementById('studioModelStat').innerText = `${json.duration_ms || 0} ms (${json.model || ''})`;
        document.getElementById('studioChartTitle').innerText = `📊 ${repTitle}`;

        const rows = json.data || [];
        window.studioActiveData = rows;
        window.studioFilteredData = [...rows];
        window.KokpitState.studioActiveData = rows;
        window.KokpitState.studioFilteredData = [...rows];
        window.studioCurrentPage = 1;
        window.KokpitState.studioCurrentPage = 1;
        window.KokpitState.currentAiReportTitle = repTitle;

        if (window.renderPagedTable) {
            window.renderPagedTable('studio');
        }
        if (window.AiStudioModule && window.AiStudioModule.renderChart) {
            window.AiStudioModule.renderChart(rows);
        }
    }
};

window.clearCopilotHistory = async function() {
    if (confirm('Sohbet geçmişini sıfırlamak istediğinize emin misiniz?')) {
        await fetch('/api/v1/chat/history?session_id=copilot_session_main', { method: 'DELETE' });
        const chatBody = document.getElementById('copilotChatBody');
        if (chatBody) {
            chatBody.innerHTML = `
                <div class="bubble bubble-ai">
                    Merhaba Celal Bey! 👋<br>
                    Sohbet hafızası sıfırlandı. Yeni analiz veya rapor isteğinizi sorabilirsiniz.
                </div>
            `;
        }
    }
};
