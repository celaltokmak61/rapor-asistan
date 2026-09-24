// AI Studio

const AiStudioModule = {
    sessionId: 'studio_session_main',
    activeFilters: {},
    activeCategoryChip: null,
    isFullWidth: false,

    init() {
        document.getElementById('studioSendBtn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('studioInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('btnStudioClear')?.addEventListener('click', () => this.clearHistory());
        this.loadDynamicPresets();
    },

    async loadDynamicPresets() {
        try {
            const res = await fetch('/api/v1/chat/dynamic-presets');
            const data = await res.json();
            const presets = Array.isArray(data) ? data : (data.presets || []);
            if (!presets || presets.length === 0) return;

            const studioChips = document.getElementById('studioPresetChips');
            const copilotChips = document.getElementById('copilotPresetChips');

            const render = (container, isCopilot = false) => {
                if (!container) return;
                container.innerHTML = presets.map(p => {
                    const isPinned = p.is_pinned === 1;
                    const starIcon = isPinned ? '⭐' : '☆';
                    const qEsc = p.question.replace(/'/g, "\\'");
                    const clickFn = isCopilot ? `askCopilotPreset('${qEsc}')` : `askStudioPreset('${qEsc}')`;
                    return `
                        <div class="ai-chip-item ${isPinned ? 'is-pinned' : ''}">
                            <span class="ai-chip" onclick="${clickFn}" title="${p.question} (${p.ask_count || 1} kez soruldu)">
                                ${p.question}
                            </span>
                            <button type="button" class="btn-pin-question" onclick="AiStudioModule.togglePinQuestion(event, '${qEsc}', ${isPinned ? 0 : 1})" title="${isPinned ? 'Sabitlemeyi Kaldır' : 'Sık Sorulanlara Sabitle'}">
                                ${starIcon}
                            </button>
                        </div>
                    `;
                }).join('');
            };

            render(studioChips, false);
            render(copilotChips, true);
        } catch (e) {
            console.warn('Dinamik sorular yüklenemedi:', e);
        }
    },

    async togglePinQuestion(event, question, pinned) {
        if (event) event.stopPropagation();
        try {
            const res = await fetch('/api/v1/chat/pin-preset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, pinned })
            });
            if (res.ok) {
                if (typeof showToast === 'function') {
                    showToast(pinned ? '⭐ Soru sık sorulanlara sabitlendi!' : 'Soru sabitlemesi kaldırıldı.', 'info');
                }
                await this.loadDynamicPresets();
            }
        } catch (e) {
            console.warn('Pin işlemi hatası:', e);
        }
    },

    async sendMessage(presetQuery = null) {
        const input = document.getElementById('studioInput');
        const query = presetQuery || input?.value.trim();
        if (!query) return;

        if (!presetQuery && input) input.value = '';
        this.appendMessage('user', query);
        lastAiUserQuery = query;

        // 📥 EXCEL İNDİRME / DIŞA AKTARMA NİYETİ YAKALAMA
        const normQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
        const isExportQuery = /^(excel\s*(indir|aktar|al|ver|olarak\s*indir|çıkar)|excele\s*(aktar|indir)|exceli\s*(indir|aktar)|indir|tabloyu\s*(indir|ver|aktar|excele\s*aktar)|raporu\s*(indir|ver|aktar|excele\s*aktar)|bunu\s*excel\s*(yap|indir|aktar)|excel)$/i.test(normQuery) ||
            ((normQuery.includes('excel') || normQuery.includes('tablo') || normQuery.includes('rapor')) && (normQuery.includes('indir') || normQuery.includes('aktar')));

        if (isExportQuery) {
            const hasData = (window.KokpitState?.studioFilteredData?.length > 0) || 
                            (window.studioFilteredData?.length > 0) || 
                            (window.KokpitState?.studioActiveData?.length > 0);
            if (hasData) {
                const count = window.KokpitState?.studioFilteredData?.length || window.studioFilteredData?.length || window.KokpitState?.studioActiveData?.length || 0;
                this.appendMessage('ai', `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:18px;">📥</span>
                            <strong style="color:#4ade80; font-size:13px;">Rapor Excel (.xlsx) Formatında İndiriliyor...</strong>
                        </div>
                        <p style="margin:0; font-size:12px; color:#e2e8f0; line-height:1.4;">
                            Ekranda listelenen <strong>${count}</strong> kalem veri profesyonel renkler, kategori başlıkları ve dip toplamlarıyla Excel dosyası olarak hazırlanıyor. İndirme hemen başlamazsa aşağıdaki butona tıklayabilirsiniz.
                        </p>
                        <div style="margin-top:4px;">
                            <button type="button" class="btn btn-green" onclick="exportTableToExcel()" style="font-size:12px; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;">
                                <span>📥</span> <span>Excel İndir (${count} Satır)</span>
                            </button>
                        </div>
                    </div>
                `);
                exportTableToExcel();
                return;
            } else {
                this.appendMessage('ai', `
                    <div style="display:flex; align-items:flex-start; gap:8px;">
                        <span style="font-size:18px;">ℹ️</span>
                        <div style="font-size:12px; line-height:1.4;">
                            Henüz ekranda indirilmeye hazır bir rapor veya tablo bulunmuyor. Lütfen önce istediğiniz analiz veya raporu yazın (örneğin: <em>"1-31 ağustos imalat hammadde kullanım ve sayım mutabakat raporu"</em>), ardından oluşan veriyi tek tıkla Excel'e aktarabilirsiniz. 🚀
                        </div>
                    </div>
                `);
                return;
            }
        }

        const loadingId = this.appendMessage('ai', '⏳ Veritabanı taranıyor, kurallar analiz ediliyor...');

        try {
            const todayIso = new Date().toISOString().split('T')[0];
            const res = await fetch('/api/v1/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    firm_code: currentFirma,
                    start_date: currentStartDate || `${todayIso.slice(0, 7)}-01`,
                    end_date: currentEndDate || todayIso,
                    session_id: this.sessionId
                })
            });
            const json = await res.json();
            
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            if (!json.success) {
                this.appendMessage('ai', `❌ ${json.explanation || json.error || 'Bir hata oluştu.'}`);
                return;
            }

            if (json.action_type === 'export_executive_package') {
                this.appendMessage('ai', `
                    <div style="display:flex; flex-direction:column; gap:10px; background:linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,78,59,0.25)); border:1px solid rgba(16,185,129,0.35); border-radius:12px; padding:12px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:20px;">👑</span>
                            <strong style="color:#4ade80; font-size:14px;">Yönetici Paketi (Excel)</strong>
                        </div>
                        <p style="margin:0; font-size:12px; color:#e2e8f0; line-height:1.5;">
                            ${json.explanation || 'Tüm raporlar tek bir Excel çalışma kitabında 3 bağımsız sekme olarak hazırlandı.'}
                        </p>
                        <div style="font-size:11.5px; color:#cbd5e1; display:flex; flex-direction:column; gap:3px; background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:8px;">
                            <span>📑 <strong>1. Sekme:</strong> 📊 Yönetici Özeti (21 Satır, Tek Ekran A4, Dip Toplam)</span>
                            <span>📑 <strong>2. Sekme:</strong> 🥐 Şube Ürünleri (223 Kalem Menü/Mamul Ürünü)</span>
                            <span>📑 <strong>3. Sekme:</strong> 🏭 Hammadde Detayı (Tüm Malzemeler Konsolide Giriş-Çıkış)</span>
                        </div>
                        <div style="margin-top:6px;">
                            <a href="/api/v1/export/executive-package" download class="btn btn-green" style="font-size:12.5px; padding:7px 16px; border-radius:8px; display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-weight:600; box-shadow:0 4px 12px rgba(16,185,129,0.35); cursor:pointer;">
                                <span>📥</span> <span>Yönetici Paketini İndir (.xlsx)</span>
                            </a>
                        </div>
                    </div>
                `);
                const a = document.createElement('a');
                a.href = '/api/v1/export/executive-package';
                a.download = 'Yonetici_Paketi.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                return;
            }

            if (json.action_type === 'export_excel') {
                const count = window.KokpitState?.studioFilteredData?.length || window.studioFilteredData?.length || 0;
                this.appendMessage('ai', `
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:18px;">📥</span>
                            <strong style="color:#4ade80; font-size:13px;">Excel Dışa Aktarma Başlatıldı</strong>
                        </div>
                        <p style="margin:0; font-size:12px; color:#e2e8f0;">
                            ${json.explanation || 'Mevcut rapor Excel (.xlsx) formatında indiriliyor.'}
                        </p>
                        <div style="margin-top:4px;">
                            <button type="button" class="btn btn-green" onclick="exportTableToExcel()" style="font-size:12px; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;">
                                <span>📥</span> <span>Excel İndir (${count} Satır)</span>
                            </button>
                        </div>
                    </div>
                `);
                exportTableToExcel();
                return;
            }

            let repTitle = json.report_title || 'AI Rapor Çıktısı';
            let insightText = formatStrategicInsight(json.strategic_insight || json.explanation);
            
            let reply = `
                <div class="ai-msg-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:16px;">🤖</span>
                        <strong style="color:#4ade80; font-size:13px;">${repTitle}</strong>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="ai-badge-icon badge-green" style="font-size:9.5px; padding:2px 6px;">⏱️ ${json.duration_ms || 0} ms</span>
                    </div>
                </div>
                <div class="ai-msg-content">
                    ${insightText}
                </div>
            `;
            if (json.total_rows !== undefined) {
                reply += `<div style="color:#75a59e; font-size:11px; margin-top:8px; display:flex; align-items:center; gap:6px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:6px;">
                    <span>📊</span> <span><strong>${json.total_rows}</strong> satır • <em>${json.model || 'Rapor-AI'}</em> [📅 ${currentStartDate} - ${currentEndDate}]</span>
                </div>`;
            }
            if (window.innerWidth <= 850) {
                reply += `<div style="margin-top:10px;">
                    <button type="button" class="btn btn-green" onclick="switchStudioMobileTab('display')" style="width:100%; justify-content:center; font-size:12px; padding:7px 12px; border-radius:8px; box-shadow:0 2px 10px rgba(44,190,86,0.35);">
                        📊 Üretilen Rapor & Tabloyu Aç ➔
                    </button>
                </div>`;
                const dot = document.getElementById('studioTabDot');
                if (dot) dot.style.display = 'block';
            }
            this.appendMessage('ai', reply);

            window.KokpitState.currentAiReportTitle = repTitle;
            window.currentAiReportTitle = repTitle;
            
            const studioTitleEl = document.getElementById('studioReportTitle');
            const studioSubEl = document.getElementById('studioReportSubtitle');
            if (studioTitleEl) studioTitleEl.innerText = repTitle;
            if (studioSubEl) studioSubEl.innerText = `AI çıktısı • ${json.total_rows || 0} satır (⏱️ ${json.duration_ms || 0} ms - ${json.model || ''}) • ${currentStartDate} - ${currentEndDate}`;

            const studioTableTitle = document.getElementById('studioTableReportTitle');
            const studioTableSub = document.getElementById('studioTableReportSubtitle');
            if (studioTableTitle) studioTableTitle.innerText = repTitle;
            if (studioTableSub) studioTableSub.innerText = `${json.total_rows || 0} satır (${currentStartDate} - ${currentEndDate})`;

            document.getElementById('studioRowCount').innerText = `${json.total_rows || 0} Satır`;
            document.getElementById('studioModelStat').innerText = `${json.duration_ms || 0} ms (${json.model || ''})`;
            document.getElementById('studioChartTitle').innerText = `📊 ${repTitle}`;

            const rows = json.data || [];
            studioActiveData = rows;
            studioFilteredData = [...rows];
            window.KokpitState.studioActiveData = rows;
            window.KokpitState.studioFilteredData = [...rows];
            window.studioActiveData = rows;
            window.studioFilteredData = [...rows];
            studioCurrentPage = 1;
            window.KokpitState.studioCurrentPage = 1;
            renderPagedTable('studio');
            this.buildDynamicFilters(rows);
            this.renderChart(rows);
            this.loadDynamicPresets();

        } catch (err) {
            console.error('Studio hatası:', err);
            this.appendMessage('ai', 'Bağlantı hatası oluştu.');
        }
    },

    appendMessage(sender, text) {
        const chatBody = document.getElementById('studioChatBody');
        if (!chatBody) return '';
        const id = 'studio_msg_' + Date.now();
        const bubble = document.createElement('div');
        bubble.className = `bubble ${sender === 'user' ? 'bubble-user' : 'bubble-ai'}`;
        bubble.id = id;
        bubble.innerHTML = text;
        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
        return id;
    },

    async clearHistory() {
        if (confirm('AI Studio sohbet hafızasını sıfırlamak istediğinize emin misiniz?')) {
            await fetch(`/api/v1/query/history?session_id=${this.sessionId}`, { method: 'DELETE' });
            const chatBody = document.getElementById('studioChatBody');
            if (chatBody) {
                chatBody.innerHTML = `
                    <div class="bubble bubble-ai">
                        Sohbet hafızası başarıyla sıfırlandı. Yeni analiz, reçete ve kâr marjı sorularınızı sorabilirsiniz. 🚀
                    </div>
                `;
            }
        }
    },

    toggleFullWidth() {
        this.isFullWidth = !this.isFullWidth;
        const container = document.getElementById('aiStudioView');
        const toggleBtn = document.getElementById('btnStudioFullscreenToggle');
        const iconEl = document.getElementById('studioFullscreenIcon');
        const textEl = document.getElementById('studioFullscreenText');

        if (container) {
            if (this.isFullWidth) {
                container.classList.add('full-width-table');
                if (toggleBtn) toggleBtn.classList.add('active');
                if (iconEl) iconEl.innerText = '🗗';
                if (textEl) textEl.innerText = 'Paneli Göster';
            } else {
                container.classList.remove('full-width-table');
                if (toggleBtn) toggleBtn.classList.remove('active');
                if (iconEl) iconEl.innerText = '⛶';
                if (textEl) textEl.innerText = 'Geniş Ekran';
            }
        }
        setTimeout(() => {
            if (typeof studioChartInstance !== 'undefined' && studioChartInstance && studioChartInstance.resize) {
                studioChartInstance.resize();
            }
        }, 280);
    },

    buildDynamicFilters(rows) {
        const barEl = document.getElementById('studioDynamicFilterBar');
        if (!barEl) return;

        this.activeFilters = {};
        this.activeCategoryChip = null;

        if (!rows || rows.length === 0) {
            barEl.style.display = 'none';
            barEl.innerHTML = '';
            this.updateFilterStatBadge(0, 0);
            return;
        }

        const allColumns = Object.keys(rows[0]);
        const candidates = [];

        // Metrik / Sayı kolonlarını hariç tut
        const isMetricRegex = /(miktar|adet|tutar|fiyat|ciro|maliyet|deger|değer|fark|bakiye|borc|borç|alacak|oran|yuzde|yüzde|hata|tarih|date|saat|time|logicalref|lref|id\b)/i;

        for (const col of allColumns) {
            if (isMetricRegex.test(col) && !/kategori|ozelkod|özelkod/i.test(col)) continue;

            const valMap = new Map();
            let allNumbers = true;
            let totalLen = 0;
            let validCount = 0;

            for (const r of rows) {
                const val = r[col];
                if (val === null || val === undefined || String(val).trim() === '' || String(val).trim().toUpperCase() === 'NONE') continue;
                const strVal = String(val).trim();
                if (isNaN(Number(strVal))) {
                    allNumbers = false;
                }
                totalLen += strVal.length;
                validCount++;
                valMap.set(strVal, (valMap.get(strVal) || 0) + 1);
            }

            if (allNumbers && !/kategori|ozelkod|özelkod|sube|şube|depo/i.test(col)) continue;
            if (validCount === 0) continue;

            const distinctValues = Array.from(valMap.entries()).sort((a, b) => b[1] - a[1]);
            const count = distinctValues.length;

            // Kriterler: 2 ile 50 arasında farklı değer olmalı
            if (count >= 2 && count <= 50) {
                const avgLen = totalLen / validCount;
                if (avgLen > 45) continue;

                let priority = 5;
                let icon = '🏷️';
                const colLower = col.toLowerCase();

                if (/kategori|grup|ozelkod|özelkod/i.test(colLower)) {
                    priority = 1;
                    icon = '📁';
                } else if (/sube|şube|depo|magaza|mağaza/i.test(colLower)) {
                    priority = 2;
                    icon = '🏢';
                } else if (/firma|cari|tedarikci|tedarikçi|musteri|müşteri/i.test(colLower)) {
                    priority = 3;
                    icon = '🏭';
                } else if (/birim|ambalaj|koli|kuvet|küvet|tur|tür|tip/i.test(colLower)) {
                    priority = 4;
                    icon = '📦';
                } else if (/plaka|arac|araç|sofor|şoför/i.test(colLower)) {
                    priority = 4;
                    icon = '🚚';
                }

                candidates.push({
                    column: col,
                    distinctValues,
                    count,
                    priority,
                    icon
                });
            }
        }

        candidates.sort((a, b) => a.priority - b.priority);
        const topCandidates = candidates.slice(0, 4);

        if (topCandidates.length === 0) {
            barEl.style.display = 'none';
            barEl.innerHTML = '';
            this.updateFilterStatBadge(rows.length, rows.length);
            return;
        }

        barEl.style.display = 'flex';

        let html = `
            <div class="studio-filter-title">
                <span>⚡</span> <span>Hızlı Filtreler:</span>
            </div>
        `;

        // 1. Birincil Kategori için Hızlı Çipler (Pills)
        const primaryCatCandidate = topCandidates.find(c => c.priority === 1) || (topCandidates[0].count <= 8 ? topCandidates[0] : null);
        if (primaryCatCandidate && primaryCatCandidate.count <= 10) {
            const pCol = primaryCatCandidate.column;
            const pColEsc = pCol.replace(/'/g, "\\'");
            html += `
                <div class="studio-filter-chips" data-col="${pCol}">
                    <button type="button" class="studio-quick-chip active" onclick="AiStudioModule.selectQuickChip('${pColEsc}', '')">Tümü (${rows.length})</button>
                    ${primaryCatCandidate.distinctValues.map(([val, cnt]) => {
                        const valEsc = String(val).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                        return `
                        <button type="button" class="studio-quick-chip" data-chip-val="${valEsc}" onclick="AiStudioModule.selectQuickChip('${pColEsc}', '${valEsc}')">
                            ${val} (${cnt})
                        </button>
                    `;
                    }).join('')}
                </div>
            `;
        }

        // 2. Dropdown Seçim Kutuları
        for (const cand of topCandidates) {
            html += `
                <div class="studio-filter-group">
                    <span class="studio-filter-label">${cand.icon} ${cand.column}:</span>
                    <select class="studio-filter-select" data-col="${cand.column}" onchange="AiStudioModule.onFilterSelectChange(this)">
                        <option value="">Tümü (${cand.count})</option>
                        ${cand.distinctValues.map(([val, cnt]) => `
                            <option value="${String(val).replace(/"/g, '&quot;')}">${val} (${cnt})</option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // 3. Canlı Sayaç Rozeti & Sıfırlama Butonu
        html += `
            <span class="filter-stat-badge" id="studioFilterStatBadge">
                <span>●</span> <span>${rows.length} / ${rows.length} Kalem</span>
            </span>
            <button type="button" class="btn-clear-studio-filters" id="btnStudioClearFilters" onclick="AiStudioModule.clearAllFilters()" style="display: none;" title="Tüm filtreleri ve aramayı sıfırla">
                <span>↺</span> <span>Filtreleri Sıfırla</span>
            </button>
        `;

        barEl.innerHTML = html;
        this.updateFilterStatBadge(rows.length, rows.length);
    },

    onFilterSelectChange(selectEl) {
        const col = selectEl.getAttribute('data-col');
        const val = selectEl.value;
        if (val) {
            this.activeFilters[col] = val;
        } else {
            delete this.activeFilters[col];
        }

        const chipContainer = document.querySelector(`.studio-filter-chips[data-col="${col}"]`);
        if (chipContainer) {
            chipContainer.querySelectorAll('.studio-quick-chip').forEach(btn => {
                const cVal = btn.getAttribute('data-chip-val') || '';
                if (cVal === val) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        this.applyFilters();
    },

    selectQuickChip(col, val) {
        if (val) {
            this.activeFilters[col] = val;
        } else {
            delete this.activeFilters[col];
        }

        const selectEl = document.querySelector(`.studio-filter-select[data-col="${col}"]`);
        if (selectEl) selectEl.value = val;

        const chipContainer = document.querySelector(`.studio-filter-chips[data-col="${col}"]`);
        if (chipContainer) {
            chipContainer.querySelectorAll('.studio-quick-chip').forEach(btn => {
                const cVal = btn.getAttribute('data-chip-val') || '';
                if (cVal === val) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        this.applyFilters();
    },

    applyFilters() {
        const sourceList = window.KokpitState?.studioActiveData || studioActiveData || [];
        if (!sourceList || sourceList.length === 0) return;

        const searchInput = document.getElementById('studioSearchInput');
        const searchVal = searchInput?.value.trim() || '';
        const normSearch = typeof normalizeTextTr === 'function' ? normalizeTextTr(searchVal) : searchVal.toLowerCase();

        const activeFilterEntries = Object.entries(this.activeFilters || {});
        const hasActiveDropdowns = activeFilterEntries.length > 0;
        const hasSearch = searchVal.length > 0;

        let filtered = sourceList;

        if (hasActiveDropdowns || hasSearch) {
            filtered = sourceList.filter(row => {
                // 1. Dropdown filtreleri
                for (const [col, filterVal] of activeFilterEntries) {
                    if (filterVal) {
                        const cellVal = String(row[col] ?? '').trim();
                        if (cellVal !== filterVal) return false;
                    }
                }
                // 2. Arama kelimesi kontrolü
                if (hasSearch) {
                    const rowMatch = Object.values(row).some(v => {
                        if (v === null || v === undefined) return false;
                        const normV = typeof normalizeTextTr === 'function' ? normalizeTextTr(v) : String(v).toLowerCase();
                        return normV.includes(normSearch);
                    });
                    if (!rowMatch) return false;
                }
                return true;
            });
        }

        studioFilteredData = filtered;
        window.KokpitState.studioFilteredData = filtered;
        window.studioFilteredData = filtered;
        studioCurrentPage = 1;
        window.KokpitState.studioCurrentPage = 1;

        renderPagedTable('studio');
        this.renderChart(filtered);
        this.updateFilterStatBadge(filtered.length, sourceList.length);

        const clearBtn = document.getElementById('btnStudioClearFilters');
        if (clearBtn) {
            clearBtn.style.display = (hasActiveDropdowns || hasSearch) ? 'inline-flex' : 'none';
        }
    },

    clearAllFilters() {
        this.activeFilters = {};
        const searchInput = document.getElementById('studioSearchInput');
        if (searchInput) searchInput.value = '';

        document.querySelectorAll('.studio-filter-select').forEach(sel => {
            sel.value = '';
        });

        document.querySelectorAll('.studio-filter-chips').forEach(container => {
            container.querySelectorAll('.studio-quick-chip').forEach((btn, idx) => {
                if (idx === 0) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        });

        this.applyFilters();
    },

    updateFilterStatBadge(shownCount, totalCount) {
        const badge = document.getElementById('studioFilterStatBadge');
        if (badge) {
            badge.innerHTML = `<span>●</span> <span>${shownCount} / ${totalCount} Kalem</span>`;
        }
        const excelBtnText = document.getElementById('btnStudioExcelExportText');
        if (excelBtnText) {
            excelBtnText.innerText = `Excel'e Aktar (${shownCount})`;
        }
        const rowCountKpi = document.getElementById('studioRowCount');
        if (rowCountKpi) {
            rowCountKpi.innerText = `${shownCount} Satır`;
        }
    },

    currentChartMode: 'category_summary',
    lastChartRows: null,

    setChartMode(mode) {
        this.currentChartMode = mode;
        const controlContainer = document.getElementById('studioChartViewControls');
        if (controlContainer) {
            controlContainer.querySelectorAll('.chart-mode-btn').forEach(btn => {
                if (btn.getAttribute('data-mode') === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        if (this.lastChartRows && this.lastChartRows.length > 0) {
            this.renderChart(this.lastChartRows, false);
        }
    },

    renderChart(rawRows, autoDetectMode = true) {
        if (!studioChartInstance || !rawRows || rawRows.length === 0) return;
        this.lastChartRows = rawRows;

        let rows = rawRows;
        const firstRow = rows[0];
        const columns = Object.keys(firstRow);

        // 🔍 Kolon Tespiti & Sınıflandırma
        const dateCol = columns.find(c => /tarih|date|gun|gün/i.test(c));
        const catCol = columns.find(c => {
            const norm = typeof normalizeTextTr === 'function' ? normalizeTextTr(c) : c.toLowerCase();
            return /kategori|ozelkod|özelkod|grup/i.test(norm);
        }) || columns.find(c => /sube|şube|depo/i.test(c));

        // Sayısal kolonları tespit et
        const allNumericCols = columns.filter(c => typeof firstRow[c] === 'number');
        if (allNumericCols.length === 0) {
            const ctrl = document.getElementById('studioChartViewControls');
            if (ctrl) ctrl.style.display = 'none';
            return;
        }

        const currencyCols = allNumericCols.filter(c => /ciro|tutar|maliyet|deger|değer|fiyat|fatura|bakiye|bedel/i.test(c));
        const qtyCols = allNumericCols.filter(c => !currencyCols.includes(c) && !/oran|yuzde|yüzde|hata|id\b/i.test(c));

        // Özel Akış / Maliyet Mutabakat Kolonları
        const begValCol = currencyCols.find(c => /baslangic|başlangıç|onceki|önceki|31 tem.*deger|31 tem.*son alis/i.test(c));
        const consumptionValCol = currencyCols.find(c => /kullanim.*deger|kullanım.*değer|uretim.*maliyet|üretim.*maliyet|tuketim.*deger/i.test(c));
        const transferValCol = currencyCols.find(c => /sevk.*deger|sevk.*değeri|sube.*deger|şube.*değer/i.test(c));
        const endValCol = currencyCols.find(c => /31 agu.*deger|31 ağu.*değer|son.*deger|son.*değeri|guncel.*deger|güncel.*değer|kalan.*deger/i.test(c)) || currencyCols[0];
        const diffValCol = currencyCols.find(c => /fark.*tutar|fark.*maliyet|fark.*deger/i.test(c)) || allNumericCols.find(c => c.toLowerCase() === 'fark');

        const isHeavyReport = (allNumericCols.length >= 4 && (catCol || rows.length > 15)) || (rows.length > 25 && catCol);

        const controlContainer = document.getElementById('studioChartViewControls');

        if (isHeavyReport && catCol) {
            const validModes = ['category_summary', 'top_value', 'top_consumption', 'top_diff', 'donut_share'];
            if (autoDetectMode && !validModes.includes(this.currentChartMode)) {
                this.currentChartMode = 'category_summary';
            }

            if (controlContainer) {
                controlContainer.style.display = 'flex';
                controlContainer.innerHTML = `
                    <div class="chart-mode-pill-group">
                        <button type="button" class="chart-mode-btn ${this.currentChartMode === 'category_summary' ? 'active' : ''}" data-mode="category_summary" onclick="AiStudioModule.setChartMode('category_summary')" title="Kategori bazında toplam stok, tüketim ve kalan değer akışı">
                            <span>📁</span> <span>Kategori Özeti</span>
                        </button>
                        <button type="button" class="chart-mode-btn ${this.currentChartMode === 'top_value' ? 'active' : ''}" data-mode="top_value" onclick="AiStudioModule.setChartMode('top_value')" title="En yüksek değere sahip ilk 10 ürün">
                            <span>🏆</span> <span>Top 10 Değer</span>
                        </button>
                        ${(consumptionValCol || transferValCol) ? `
                        <button type="button" class="chart-mode-btn ${this.currentChartMode === 'top_consumption' ? 'active' : ''}" data-mode="top_consumption" onclick="AiStudioModule.setChartMode('top_consumption')" title="En çok tüketilen veya sevk edilen ilk 10 ürün">
                            <span>🔥</span> <span>Top 10 Tüketim</span>
                        </button>` : ''}
                        ${diffValCol ? `
                        <button type="button" class="chart-mode-btn ${this.currentChartMode === 'top_diff' ? 'active' : ''}" data-mode="top_diff" onclick="AiStudioModule.setChartMode('top_diff')" title="Sayım farkı en yüksek olan ilk 10 ürün (Risk & Alarm)">
                            <span>⚠️</span> <span>Sayım Farkları</span>
                        </button>` : ''}
                        <button type="button" class="chart-mode-btn ${this.currentChartMode === 'donut_share' ? 'active' : ''}" data-mode="donut_share" onclick="AiStudioModule.setChartMode('donut_share')" title="Toplam envanter değerinin kategorilere göre yüzde dağılımı">
                            <span>🍩</span> <span>Kategori Payı</span>
                        </button>
                    </div>
                `;
            }

            if (this.currentChartMode === 'category_summary') {
                this.renderCategorySummaryChart(rows, catCol, { begValCol, consumptionValCol, transferValCol, endValCol, diffValCol, currencyCols, allNumericCols });
                return;
            } else if (this.currentChartMode === 'top_value') {
                const labelCol = columns.find(c => /urun|ürün|malzeme|stok adi|stok adı|ad\b/i.test(c)) || columns[0];
                this.renderTopItemsChart(rows, labelCol, endValCol || currencyCols[0] || allNumericCols[0], 'En Yüksek Stok Değeri', '#10b981', '#059669', '₺');
                return;
            } else if (this.currentChartMode === 'top_consumption') {
                const labelCol = columns.find(c => /urun|ürün|malzeme|stok adi|stok adı|ad\b/i.test(c)) || columns[0];
                const activeConsumpCol = consumptionValCol || transferValCol || currencyCols[0] || allNumericCols[0];
                this.renderTopItemsChart(rows, labelCol, activeConsumpCol, 'En Yüksek Tüketim / Çıkış Tutarı', '#f59e0b', '#d97706', '₺');
                return;
            } else if (this.currentChartMode === 'top_diff') {
                const labelCol = columns.find(c => /urun|ürün|malzeme|stok adi|stok adı|ad\b/i.test(c)) || columns[0];
                this.renderDiscrepancyChart(rows, labelCol, diffValCol);
                return;
            } else if (this.currentChartMode === 'donut_share') {
                this.renderDonutShareChart(rows, catCol, endValCol || currencyCols[0] || allNumericCols[0]);
                return;
            }
        } else {
            if (controlContainer) {
                controlContainer.style.display = 'none';
                controlContainer.innerHTML = '';
            }
        }

        // STANDART GRAFİK ÇİZİMİ (Tarih bazlı zaman serileri veya sade tablolar)
        this.renderStandardChart(rows, columns, dateCol, allNumericCols);
    },

    // 1️⃣ KATEGORİ BAZLI MAKRO AKIŞ GRAFİĞİ (YÖNETİCİ ÖZETİ)
    renderCategorySummaryChart(rows, catCol, metrics) {
        const { begValCol, consumptionValCol, transferValCol, endValCol, diffValCol, currencyCols, allNumericCols } = metrics;
        const catMap = {};

        rows.forEach(r => {
            const rawCat = r[catCol];
            const cat = (rawCat && rawCat !== 'None') ? String(rawCat).trim() : 'DİĞER';
            if (!catMap[cat]) {
                catMap[cat] = {
                    count: 0,
                    begVal: 0,
                    consumptionVal: 0,
                    transferVal: 0,
                    endVal: 0,
                    diffVal: 0,
                    customSums: {}
                };
            }
            catMap[cat].count++;
            if (begValCol) catMap[cat].begVal += floatVal(r[begValCol]);
            if (consumptionValCol) catMap[cat].consumptionVal += floatVal(r[consumptionValCol]);
            if (transferValCol) catMap[cat].transferVal += floatVal(r[transferValCol]);
            if (endValCol) catMap[cat].endVal += floatVal(r[endValCol]);
            if (diffValCol) catMap[cat].diffVal += floatVal(r[diffValCol]);

            if (!begValCol && !consumptionValCol) {
                currencyCols.slice(0, 4).forEach(c => {
                    catMap[cat].customSums[c] = (catMap[cat].customSums[c] || 0) + floatVal(r[c]);
                });
            }
        });

        const categories = Object.keys(catMap);
        let series = [];

        if (begValCol || consumptionValCol || endValCol) {
            // Tam Finansal & Stok Akış Serileri
            if (begValCol) {
                series.push({
                    name: 'Dönem Başı Stoğu',
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].begVal)),
                    barMaxWidth: 26,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#38bdf8' },
                            { offset: 1, color: '#0284c7' }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: '#38bdf8', fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value > 0 ? '₺' + formatCompactNumberTR(p.value) : ''
                    }
                });
            }
            if (consumptionValCol) {
                series.push({
                    name: 'Üretim Tüketimi',
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].consumptionVal)),
                    barMaxWidth: 26,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#fb923c' },
                            { offset: 1, color: '#c2410c' }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: '#fb923c', fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value > 0 ? '₺' + formatCompactNumberTR(p.value) : ''
                    }
                });
            }
            if (transferValCol) {
                series.push({
                    name: 'Şubelere Sevk',
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].transferVal)),
                    barMaxWidth: 26,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#c084fc' },
                            { offset: 1, color: '#7e22ce' }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: '#c084fc', fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value > 0 ? '₺' + formatCompactNumberTR(p.value) : ''
                    }
                });
            }
            if (endValCol) {
                series.push({
                    name: 'Dönem Sonu Fiziki Stok',
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].endVal)),
                    barMaxWidth: 26,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#4ade80' },
                            { offset: 1, color: '#15803d' }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: '#4ade80', fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value > 0 ? '₺' + formatCompactNumberTR(p.value) : ''
                    }
                });
            }
            if (diffValCol) {
                series.push({
                    name: 'Net Sayım Farkı',
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].diffVal)),
                    barMaxWidth: 26,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#f87171' },
                            { offset: 1, color: '#b91c1c' }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: '#f87171', fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value !== 0 ? (p.value > 0 ? '+₺' : '-₺') + formatCompactNumberTR(Math.abs(p.value)) : ''
                    }
                });
            }
        } else {
            const activeCols = currencyCols.slice(0, 3);
            const palettes = [
                { s: '#38bdf8', e: '#0284c7', t: '#38bdf8' },
                { s: '#4ade80', e: '#15803d', t: '#4ade80' },
                { s: '#fb923c', e: '#c2410c', t: '#fb923c' }
            ];
            series = activeCols.map((col, idx) => {
                const pal = palettes[idx % palettes.length];
                return {
                    name: col,
                    type: 'bar',
                    data: categories.map(c => Math.round(catMap[c].customSums[col] || 0)),
                    barMaxWidth: 28,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: pal.s },
                            { offset: 1, color: pal.e }
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true, position: 'top', color: pal.t, fontSize: 10, fontWeight: 'bold',
                        formatter: (p) => p.value > 0 ? '₺' + formatCompactNumberTR(p.value) : ''
                    }
                };
            });
        }

        const option = {
            backgroundColor: 'transparent',
            legend: {
                show: true,
                top: '2%',
                textStyle: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold' },
                itemWidth: 14,
                itemHeight: 10,
                itemGap: 16
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: 'rgba(44, 190, 86, 0.4)',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#ffffff', fontSize: 12 },
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    const catName = params[0].axisValue;
                    const catInfo = catMap[catName];
                    let html = `<div style="font-weight:800; font-size:13px; color:#4ade80; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:4px; margin-bottom:6px;">
                        📁 ${catName.toUpperCase()} <span style="font-size:11px; color:#94a3b8; font-weight:500;">(${catInfo?.count || 0} Kalem Ürün)</span>
                    </div>`;
                    params.forEach(p => {
                        const val = typeof p.value === 'number' ? p.value : 0;
                        const marker = `<span style="display:inline-block; margin-right:6px; border-radius:50%; width:9px; height:9px; background-color:${p.color && typeof p.color === 'string' ? p.color : '#38bdf8'};"></span>`;
                        const fVal = '₺' + val.toLocaleString('tr-TR');
                        html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin:3px 0;">
                            <span style="color:#cbd5e1;">${marker} ${p.seriesName}:</span>
                            <strong style="color:#ffffff;">${fVal}</strong>
                        </div>`;
                    });
                    return html;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '10%', top: '16%', containLabel: true },
            xAxis: {
                type: 'category',
                data: categories,
                axisLine: { lineStyle: { color: '#475569' } },
                axisLabel: { color: '#e2e8f0', fontSize: 12, fontWeight: 'bold' }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)', type: 'dashed' } },
                axisLabel: { color: '#94a3b8', formatter: (v) => '₺' + formatCompactNumberTR(v) }
            },
            series: series,
            animationDuration: 700
        };

        studioChartInstance.setOption(option, true);
    },

    // 2️⃣ TOP 10 ÜRÜNLER YATAY ÇUBUK GRAFİĞİ (DEĞER VEYA TÜKETİM)
    renderTopItemsChart(rows, labelCol, metricCol, title, colorStart, colorEnd, prefix = '₺') {
        const sorted = [...rows]
            .filter(r => floatVal(r[metricCol]) > 0)
            .sort((a, b) => floatVal(b[metricCol]) - floatVal(a[metricCol]))
            .slice(0, 10)
            .reverse();

        if (sorted.length === 0) {
            studioChartInstance.setOption({
                title: { text: 'Seçili metrik için veri bulunamadı.', left: 'center', top: 'center', textStyle: { color: '#94a3b8' } }
            }, true);
            return;
        }

        const labels = sorted.map(r => {
            const raw = String(r[labelCol] || '').trim();
            return raw.length > 24 ? raw.substring(0, 23) + '..' : raw;
        });
        const fullLabels = sorted.map(r => String(r[labelCol] || '').trim());
        const values = sorted.map(r => floatVal(r[metricCol]));

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: `🏆 ${title} (İlk 10 Ürün)`,
                left: '2%',
                top: '2%',
                textStyle: { color: '#ffffff', fontSize: 13, fontWeight: '800' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: colorStart,
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#ffffff', fontSize: 12 },
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    const idx = params[0].dataIndex;
                    const fullName = fullLabels[idx];
                    const item = sorted[idx];
                    const val = params[0].value;
                    const catInfo = item['Kategori (Özelkod6)'] || item['Kategori'] || '';
                    return `
                        <div style="font-weight:800; color:#ffffff; margin-bottom:4px; font-size:12.5px;">📦 ${fullName}</div>
                        ${catInfo ? `<div style="color:#94a3b8; font-size:11px; margin-bottom:4px;">Kategori: <strong style="color:#4ade80;">${catInfo}</strong></div>` : ''}
                        <div style="display:flex; justify-content:space-between; gap:16px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:4px;">
                            <span style="color:#cbd5e1;">${metricCol}:</span>
                            <strong style="color:#4ade80; font-size:13px;">${prefix}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                    `;
                }
            },
            grid: { left: '3%', right: '8%', bottom: '6%', top: '14%', containLabel: true },
            xAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)', type: 'dashed' } },
                axisLabel: { color: '#94a3b8', formatter: (v) => prefix + formatCompactNumberTR(v) }
            },
            yAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#475569' } },
                axisLabel: { color: '#ffffff', fontSize: 11.5, fontWeight: '600' }
            },
            series: [{
                name: metricCol,
                type: 'bar',
                data: values,
                barMaxHeight: 22,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: colorStart },
                        { offset: 1, color: colorEnd }
                    ]),
                    borderRadius: [0, 6, 6, 0]
                },
                label: {
                    show: true,
                    position: 'right',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 'bold',
                    formatter: (p) => prefix + formatCompactNumberTR(p.value)
                }
            }],
            animationDuration: 700
        };

        studioChartInstance.setOption(option, true);
    },

    // 3️⃣ SAYIM FARKLARI VE RİSK ANALİZİ (DIVERGING ÇUBUK GRAFİĞİ)
    renderDiscrepancyChart(rows, labelCol, diffCol) {
        if (!diffCol) return;

        const variances = [...rows]
            .filter(r => Math.abs(floatVal(r[diffCol])) > 0.01)
            .sort((a, b) => Math.abs(floatVal(b[diffCol])) - Math.abs(floatVal(a[diffCol])))
            .slice(0, 10)
            .reverse();

        if (variances.length === 0) {
            studioChartInstance.setOption({
                title: {
                    text: '✅ Tebrikler! İncelenen veride herhangi bir sayım farkı / kayıp bulunmuyor.',
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#4ade80', fontSize: 14, fontWeight: 'bold' }
                }
            }, true);
            return;
        }

        const labels = variances.map(r => {
            const raw = String(r[labelCol] || '').trim();
            return raw.length > 24 ? raw.substring(0, 23) + '..' : raw;
        });
        const fullLabels = variances.map(r => String(r[labelCol] || '').trim());
        const values = variances.map(r => floatVal(r[diffCol]));

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: '⚠️ Sayım Farkı En Yüksek 10 Ürün (Risk Analizi)',
                left: '2%',
                top: '2%',
                textStyle: { color: '#f87171', fontSize: 13, fontWeight: '800' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: '#ef4444',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#ffffff', fontSize: 12 },
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    const idx = params[0].dataIndex;
                    const fullName = fullLabels[idx];
                    const item = variances[idx];
                    const val = params[0].value;
                    const statusText = val < 0 ? '🔴 EKSİK / KAYIP' : '🟢 SAYIM FAZLASI';
                    return `
                        <div style="font-weight:800; color:#ffffff; margin-bottom:4px; font-size:12.5px;">📦 ${fullName}</div>
                        <div style="color:${val < 0 ? '#f87171' : '#4ade80'}; font-weight:700; font-size:11.5px; margin-bottom:4px;">${statusText}</div>
                        <div style="display:flex; justify-content:space-between; gap:16px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:4px;">
                            <span style="color:#cbd5e1;">Fark Tutarı:</span>
                            <strong style="color:${val < 0 ? '#f87171' : '#4ade80'}; font-size:13px;">₺${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                    `;
                }
            },
            grid: { left: '3%', right: '8%', bottom: '6%', top: '14%', containLabel: true },
            xAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)', type: 'dashed' } },
                axisLabel: { color: '#94a3b8', formatter: (v) => (v < 0 ? '-₺' : '+₺') + formatCompactNumberTR(Math.abs(v)) }
            },
            yAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: '#475569' } },
                axisLabel: { color: '#ffffff', fontSize: 11.5, fontWeight: '600' }
            },
            series: [{
                name: 'Fark Tutarı',
                type: 'bar',
                data: values.map(v => ({
                    value: v,
                    itemStyle: {
                        color: v < 0 
                            ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#991b1b' }])
                            : new echarts.graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#22c55e' }, { offset: 1, color: '#15803d' }]),
                        borderRadius: v < 0 ? [6, 0, 0, 6] : [0, 6, 6, 0]
                    }
                })),
                barMaxHeight: 22,
                label: {
                    show: true,
                    position: 'inside',
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    formatter: (p) => (p.value < 0 ? '-₺' : '+₺') + formatCompactNumberTR(Math.abs(p.value))
                }
            }],
            animationDuration: 700
        };

        studioChartInstance.setOption(option, true);
    },

    // 4️⃣ KATEGORİ PAY DAĞILIMI (DONUT ÇART)
    renderDonutShareChart(rows, catCol, valCol) {
        const catSums = {};
        let grandTotal = 0;

        rows.forEach(r => {
            const rawCat = r[catCol];
            const cat = (rawCat && rawCat !== 'None') ? String(rawCat).trim() : 'DİĞER';
            const v = floatVal(r[valCol]);
            catSums[cat] = (catSums[cat] || 0) + v;
            grandTotal += v;
        });

        const data = Object.entries(catSums)
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);

        const colors = ['#10b981', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: '🍩 Kategori Bazlı Envanter Değer Payı',
                left: '2%',
                top: '2%',
                textStyle: { color: '#ffffff', fontSize: 13, fontWeight: '800' }
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                borderColor: '#10b981',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#ffffff', fontSize: 12 },
                formatter: (p) => {
                    const pct = grandTotal > 0 ? ((p.value / grandTotal) * 100).toFixed(1) : 0;
                    return `
                        <div style="font-weight:800; color:#4ade80; margin-bottom:4px; font-size:12.5px;">📁 ${p.name}</div>
                        <div style="display:flex; justify-content:space-between; gap:16px;">
                            <span style="color:#cbd5e1;">Stok Değeri:</span>
                            <strong style="color:#ffffff;">₺${p.value.toLocaleString('tr-TR')}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; gap:16px; border-top:1px dashed rgba(255,255,255,0.15); padding-top:4px; margin-top:4px;">
                            <span style="color:#94a3b8;">Genel Pay:</span>
                            <strong style="color:#fde047;">%${pct}</strong>
                        </div>
                    `;
                }
            },
            legend: {
                orient: 'vertical',
                right: '5%',
                top: 'middle',
                textStyle: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
                itemGap: 14,
                formatter: (name) => {
                    const item = data.find(d => d.name === name);
                    const pct = grandTotal > 0 && item ? ((item.value / grandTotal) * 100).toFixed(1) : 0;
                    return `${name}: %${pct}`;
                }
            },
            series: [{
                name: 'Envanter Değeri',
                type: 'pie',
                radius: ['42%', '70%'],
                center: ['40%', '54%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#0d1f18',
                    borderWidth: 3
                },
                color: colors,
                label: {
                    show: true,
                    formatter: '{b}: %{d}',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 'bold'
                },
                data: data
            }],
            animationDuration: 700
        };

        studioChartInstance.setOption(option, true);
    },

    // 5️⃣ STANDART GRAFİK ÇİZİCİ (ZAMAN SERİLERİ / SADE TABLOLAR)
    renderStandardChart(rows, columns, dateCol, allNumericCols) {
        const labelCol = columns[0];
        const isDateBased = dateCol || /tarih|date|gun|gün/i.test(labelCol) || rows.some(r => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(String(r[labelCol])));

        // Eğer 3'ten fazla sayısal kolon varsa, sadece en önemli ilk 2-3 kolonu al
        let seriesCols = allNumericCols;
        if (allNumericCols.length > 3) {
            const currCols = allNumericCols.filter(c => /ciro|tutar|miktar|satis|satış/i.test(c));
            seriesCols = currCols.length > 0 ? currCols.slice(0, 3) : allNumericCols.slice(0, 3);
        }

        const chartData = isDateBased ? rows.slice(0, 60) : rows.slice(0, 12);

        const formatLabel = (val) => {
            if (!val) return '';
            const str = String(val).trim().split('T')[0].split(' ')[0];
            if (isDateBased) {
                const p = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
                if (p) {
                    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
                    const m = parseInt(p[2], 10) - 1;
                    return `${parseInt(p[3], 10)} ${months[m] || p[2]}`;
                }
            }
            return str.length > 18 ? str.substring(0, 17) + '..' : str;
        };

        const categories = chartData.map(r => formatLabel(r[labelCol]));
        const isCurrency = seriesCols.some(c => /ciro|tutar|maliyet|deger|değer|fiyat/i.test(c));

        const getSmartColor = (name, idx) => {
            const u = String(name).toUpperCase();
            const defaultPalettes = [
                { start: '#38bdf8', end: '#0284c7', text: '#38bdf8' },
                { start: '#34d399', end: '#059669', text: '#34d399' },
                { start: '#f59e0b', end: '#d97706', text: '#f59e0b' }
            ];
            return defaultPalettes[idx % defaultPalettes.length];
        };

        const seriesList = seriesCols.map((colName, idx) => {
            const pal = getSmartColor(colName, idx);
            const dataVals = chartData.map(r => floatVal(r[colName]));
            return {
                name: colName,
                type: 'bar',
                data: dataVals,
                barMaxWidth: seriesCols.length > 1 ? 22 : 32,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: pal.start },
                        { offset: 1, color: pal.end }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                },
                label: {
                    show: chartData.length <= 10 && seriesCols.length <= 2,
                    position: 'top',
                    color: pal.text,
                    fontSize: 9.5,
                    fontWeight: 'bold',
                    formatter: (p) => p.value > 0 ? (isCurrency ? '₺' + formatCompactNumberTR(p.value) : formatCompactNumberTR(p.value)) : ''
                }
            };
        });

        const option = {
            backgroundColor: 'transparent',
            legend: {
                show: seriesCols.length > 1,
                top: '2%',
                textStyle: { color: '#cbd5e1', fontSize: 11.5, fontWeight: 'bold' },
                itemWidth: 14,
                itemHeight: 10,
                itemGap: 16
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#ffffff', fontSize: 12 },
                formatter: (params) => {
                    if (!params || params.length === 0) return '';
                    const item = chartData[params[0].dataIndex];
                    const headerLabel = isDateBased ? `📅 ${item[labelCol]}` : `📊 ${item[labelCol]}`;
                    let html = `<div style="font-weight:700; margin-bottom:6px; color:#38bdf8; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:4px; font-size:12.5px;">${headerLabel}</div>`;
                    params.forEach(p => {
                        const val = typeof p.value === 'number' ? p.value : 0;
                        const marker = `<span style="display:inline-block; margin-right:6px; border-radius:50%; width:9px; height:9px; background-color:${p.color && typeof p.color === 'string' ? p.color : '#38bdf8'};"></span>`;
                        const formattedVal = isCurrency ? '₺' + val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : val.toLocaleString('tr-TR');
                        html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:18px; margin:3px 0;">
                            <span style="color:#cbd5e1;">${marker} ${p.seriesName}:</span>
                            <strong style="color:#ffffff;">${formattedVal}</strong>
                        </div>`;
                    });
                    return html;
                }
            },
            grid: { left: '3%', right: '4%', bottom: chartData.length > 15 ? '18%' : '12%', top: '16%', containLabel: true },
            dataZoom: chartData.length > 15 ? [
                { type: 'inside', start: 0, end: 100 },
                { type: 'slider', height: 16, bottom: 4, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.6)' }
            ] : [],
            xAxis: {
                type: 'category',
                data: categories,
                axisLine: { lineStyle: { color: '#475569' } },
                axisLabel: { color: '#cbd5e1', fontSize: 11, rotate: categories.length > 12 ? 35 : 0 }
            },
            yAxis: {
                type: 'value',
                axisLine: { lineStyle: { color: '#475569' } },
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.06)', type: 'dashed' } },
                axisLabel: { color: '#94a3b8', formatter: (v) => isCurrency ? '₺' + formatCompactNumberTR(v) : formatCompactNumberTR(v) }
            },
            series: seriesList,
            animationDuration: 700
        };

        studioChartInstance.setOption(option, true);
    }
};

window.AiStudioModule = AiStudioModule;
window.sendStudioMessage = function(q) { AiStudioModule.sendMessage(q); };
window.askStudioPreset = function(q) { AiStudioModule.sendMessage(q); };
window.askCopilotPreset = function(q) {
    const input = document.getElementById('copilotInput');
    const drawer = document.getElementById('copilotDrawer');
    if (drawer && !drawer.classList.contains('open')) {
        drawer.classList.add('open');
    }
    if (input) {
        input.value = q;
        document.getElementById('copilotSendBtn')?.click();
    }
};
window.appendStudioMessage = function(s, t) { return AiStudioModule.appendMessage(s, t); };

