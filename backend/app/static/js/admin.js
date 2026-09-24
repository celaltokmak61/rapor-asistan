// Admin & AI eğitim konsolu

let allGoldenSql = [];
let allLearnedNotes = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadKokpitBootstrap === 'function') {
        await loadKokpitBootstrap();
    }
    AuthModule?.initPageAuth('admin');

    initAdminTabs();
    initTrainer();
    loadGoldenKnowledge();
    loadColumnMappings();
    loadUsers();

    // Kolon İsimlendirme Formu
    document.getElementById('formColumnName')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const col = document.getElementById('dbColumnInput').value.trim().toUpperCase();
        const label = document.getElementById('displayNameInput').value.trim();
        if (!col || !label) return;

        try {
            const res = await fetch('/api/v1/admin/preferences/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column_name: col, display_label: label })
            });
            const json = await res.json();
            if (json.success) {
                alert('Kolon adı başarıyla güncellendi ve tüm sistemle eşitlendi!');
                document.getElementById('dbColumnInput').value = '';
                document.getElementById('displayNameInput').value = '';
                loadColumnMappings();
            } else {
                alert('Hata: ' + json.detail);
            }
        } catch (err) {
            console.error('Kolon kaydetme hatası:', err);
        }
    });

    // Kullanıcı Ekleme Formu
    document.getElementById('formNewUser')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fn = document.getElementById('newFullName').value.trim();
        const u = document.getElementById('newUsername').value.trim();
        const p = document.getElementById('newPassword').value.trim();
        const r = document.getElementById('newUserRole').value;

        if (!fn || !u || !p) {
            alert('Lütfen ad-soyad, kullanıcı adı ve şifre alanlarını doldurun.');
            return;
        }

        try {
            const res = await fetch('/api/v1/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fn, username: u, password: p, role: r })
            });
            const json = await res.json();
            if (json.success) {
                alert(`✅ ${fn} (${r.toUpperCase()}) kullanıcısı başarıyla eklendi!`);
                document.getElementById('newFullName').value = '';
                document.getElementById('newUsername').value = '';
                document.getElementById('newPassword').value = '';
                loadUsers();
            } else {
                alert('Hata: ' + (json.detail || json.error || 'Kullanıcı eklenemedi.'));
            }
        } catch (err) {
            console.error('Kullanıcı ekleme hatası:', err);
        }
    });

    // Altın SQL Filtre Arama
    document.getElementById('filterGoldenInput')?.addEventListener('input', (e) => {
        filterGoldenList(e.target.value);
    });

    // 💡 Önerilen Sık Sorular Başlatma
    loadFrequentQuestions();

    // Yeni Soru Önerisi Ekleme Formu
    document.getElementById('formNewFrequentQuestion')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('newQuestionText').value.trim();
        const label = document.getElementById('newChipLabel').value.trim();
        const category = document.getElementById('newQuestionCategory').value;
        const count = parseInt(document.getElementById('newAskCount').value || '1', 10);
        const isPinned = document.getElementById('newIsPinned').checked ? 1 : 0;

        if (!text) {
            alert('Lütfen soru metnini yazın.');
            return;
        }

        try {
            const res = await fetch('/api/v1/admin/knowledge/frequent-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_text: text,
                    chip_label: label,
                    category: category,
                    ask_count: count,
                    is_pinned: isPinned
                })
            });
            const json = await res.json();
            if (json.success) {
                alert('✅ Yeni soru önerisi başarıyla eklendi!');
                document.getElementById('newQuestionText').value = '';
                document.getElementById('newChipLabel').value = '';
                document.getElementById('newAskCount').value = '1';
                document.getElementById('newIsPinned').checked = false;
                loadFrequentQuestions();
            } else {
                alert('Hata: ' + (json.detail || 'Soru eklenemedi.'));
            }
        } catch (err) {
            console.error('Soru ekleme hatası:', err);
            alert('Bağlantı hatası.');
        }
    });

    // Soru Filtreleme Arama
    document.getElementById('filterQuestionsInput')?.addEventListener('input', (e) => {
        filterFrequentQuestions(e.target.value);
    });
});

function initAdminTabs() {
    const tabBtns = document.querySelectorAll('.admin-tabs .tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(tabId)?.classList.add('active');

            if (tabId === 'tabFrequentQuestions') {
                loadFrequentQuestions();
            }
        });
    });
}

// Eğitim
function initTrainer() {
    const btnTrain = document.getElementById('btnTrainAi');
    const input = document.getElementById('trainerInput');
    const resultCard = document.getElementById('trainerResultCard');

    btnTrain?.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) {
            alert('Lütfen öğretmek istediğiniz kuralı veya bilgiyi yazın.');
            return;
        }

        btnTrain.disabled = true;
        btnTrain.innerHTML = '<span>⚡</span> <span>Yapay Zeka Analiz Ediyor & Hafızaya İşliyor...</span>';

        try {
            const res = await fetch('/api/v1/admin/knowledge/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction: text })
            });
            const json = await res.json();

            btnTrain.disabled = false;
            btnTrain.innerHTML = '<span>🧠</span> <span>Yapay Zekaya Öğret & Hafızaya İşle</span>';

            if (!json.success) {
                alert('Hata: ' + (json.detail || json.error || 'Eğitim işlenemedi.'));
                return;
            }

            // ⚠️ Benzer / Çakışan Altın Sorgu Bulunduysa Karşılaştırma Modalını Aç
            if (json.conflict_detected && json.existing_golden) {
                openConflictModal(json, text);
                return;
            }

            // Sonuç Kartını Doldur
            resultCard.style.display = 'block';
            document.getElementById('trainResultTitle').innerText = json.action_type === 'knowledge_learned' ? '✅ Kurumsal Kural Hafızaya Kilitlendi!' : '✅ Altın SQL Şablonu Üretildi & Test Edildi!';
            document.getElementById('trainResultModel').innerText = `⏱️ ${json.duration_ms} ms (${json.model})`;
            document.getElementById('trainResultExplanation').innerHTML = `<strong>Rapor Başlığı:</strong> ${json.report_title || ''}<br><strong>Açıklama:</strong> ${json.explanation || ''}`;

            const sqlWrap = document.getElementById('trainSqlPreviewWrap');
            const dataWrap = document.getElementById('trainDataPreviewWrap');

            if (json.sql_query) {
                sqlWrap.style.display = 'block';
                document.getElementById('trainSqlCode').innerText = json.sql_query;
            } else {
                sqlWrap.style.display = 'none';
            }

            if (json.preview_data && json.preview_data.length > 0) {
                dataWrap.style.display = 'block';
                renderPreviewTable(json.preview_data);
            } else {
                dataWrap.style.display = 'none';
            }

            input.value = '';
            loadGoldenKnowledge();

        } catch (err) {
            btnTrain.disabled = false;
            btnTrain.innerHTML = '<span>🧠</span> <span>Yapay Zekaya Öğret & Hafızaya İşle</span>';
            console.error('Eğitim hatası:', err);
            alert('Bağlantı hatası oluştu.');
        }
    });

    // Form Altın SQL Ekleme
    document.getElementById('formNewGoldenSql')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const soru = document.getElementById('goldenSoru').value.trim();
        const db = document.getElementById('goldenTargetDb').value;
        const chart = document.getElementById('goldenChartType').value;
        const sql = document.getElementById('goldenSql').value.trim();

        if (!soru || !sql) return;

        try {
            const res = await fetch('/api/v1/admin/knowledge/golden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    soru: soru,
                    sql_query: sql,
                    target_database: db,
                    chart_type: chart,
                    aciklama: soru
                })
            });
            const json = await res.json();
            if (json.success) {
                alert('Altın SQL şablonu başarıyla kurumsal hafızaya eklendi!');
                document.getElementById('goldenSoru').value = '';
                document.getElementById('goldenSql').value = '';
                loadGoldenKnowledge();
            } else {
                alert('Hata: ' + json.detail);
            }
        } catch (err) {
            console.error('Altın SQL kaydetme hatası:', err);
        }
    });

    // Canlı MSSQL Test Butonu
    document.getElementById('btnTestGoldenSql')?.addEventListener('click', async () => {
        const sql = document.getElementById('goldenSql').value.trim();
        const db = document.getElementById('goldenTargetDb').value;
        if (!sql) {
            alert('Lütfen önce test edilecek SQL sorgusunu yazın.');
            return;
        }

        try {
            const res = await fetch('/api/v1/admin/knowledge/test-sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: sql, target_database: db })
            });
            const json = await res.json();
            if (json.success) {
                alert(`✅ Başarılı! Sorgu hatasız çalıştı. Toplam ${json.row_count} satır sonuç döndü.`);
            } else {
                alert(`❌ SQL Hatası: ${json.error}`);
            }
        } catch (err) {
            console.error('Test hatası:', err);
        }
    });
}

function renderPreviewTable(rows) {
    const thead = document.getElementById('trainPreviewHeader');
    const tbody = document.getElementById('trainPreviewBody');
    if (!rows || rows.length === 0) return;

    const cols = Object.keys(rows[0]);
    thead.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';

    let html = '';
    for (const r of rows) {
        html += '<tr>';
        for (const c of cols) {
            html += `<td>${r[c] !== null && r[c] !== undefined ? r[c] : '-'}</td>`;
        }
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

// --- ALTIN SQL VE KURALLAR LİSTELEME ---
async function loadGoldenKnowledge() {
    try {
        const resG = await fetch('/api/v1/admin/knowledge/golden');
        const jsonG = await resG.json();
        allGoldenSql = jsonG.data || [];
        renderGoldenList(allGoldenSql);

        const resN = await fetch('/api/v1/admin/knowledge/notes');
        const jsonN = await resN.json();
        allLearnedNotes = jsonN.data || [];
        renderNotesList(allLearnedNotes);

        const badge = document.getElementById('knowledgeCountBadge');
        if (badge) {
            badge.innerText = `${allGoldenSql.length} Altın SQL • ${allLearnedNotes.length} Kural Aktif`;
        }
    } catch (err) {
        console.error('Bilgi havuzu yükleme hatası:', err);
    }
}

function renderGoldenList(items) {
    const tbody = document.getElementById('goldenSqlTableBody');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#75a59e;">Kayıtlı altın SQL bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(g => `
        <tr>
            <td><strong>#${g.id}</strong></td>
            <td style="font-weight:600; color:#fff;">${g.soru}</td>
            <td><span class="badge badge-green">${g.target_database}</span></td>
            <td>${g.chart_type}</td>
            <td><code style="font-size:11px; color:#d1fae5; display:block; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${g.sql_query}</code></td>
            <td>
                <button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#f87171;" onclick="deleteGoldenSql(${g.id})">🗑️ Sil</button>
            </td>
        </tr>
    `).join('');
}

function filterGoldenList(kw) {
    if (!kw) {
        renderGoldenList(allGoldenSql);
        return;
    }
    const lower = kw.toLowerCase();
    const filtered = allGoldenSql.filter(g => 
        (g.soru && g.soru.toLowerCase().includes(lower)) || 
        (g.sql_query && g.sql_query.toLowerCase().includes(lower))
    );
    renderGoldenList(filtered);
}

function renderNotesList(items) {
    const tbody = document.getElementById('learnedNotesTableBody');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#75a59e;">Kayıtlı kural bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(n => `
        <tr>
            <td><strong>#${n.id}</strong></td>
            <td style="color:#ffffff;">${n.note}</td>
            <td style="font-size:11px; color:#75a59e;">${n.created_at || '-'}</td>
            <td>
                <button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#f87171;" onclick="deleteLearnedNote(${n.id})">🗑️ Sil</button>
            </td>
        </tr>
    `).join('');
}

window.deleteGoldenSql = async function(id) {
    if (!confirm('Bu altın SQL şablonunu silmek istediğinizden emin misiniz?')) return;
    try {
        const res = await fetch(`/api/v1/admin/knowledge/golden/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadGoldenKnowledge();
        }
    } catch (err) {
        console.error('Silme hatası:', err);
    }
};

window.deleteLearnedNote = async function(id) {
    if (!confirm('Bu kuralı kurumsal hafızadan silmek istediğinizden emin misiniz?')) return;
    try {
        const res = await fetch(`/api/v1/admin/knowledge/notes/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadGoldenKnowledge();
        }
    } catch (err) {
        console.error('Silme hatası:', err);
    }
};

// --- KOLON EŞLEŞTİRMELERİ ---
async function loadColumnMappings() {
    const listEl = document.getElementById('columnMappingsList');
    if (!listEl) return;

    try {
        const res = await fetch('/api/v1/admin/preferences/columns');
        const json = await res.json();
        const mappings = json.data || {};

        const keys = Object.keys(mappings);
        if (keys.length === 0) {
            listEl.innerHTML = '<p style="color:#75a59e; font-size:12.5px;">Henüz özel kolon eşleştirmesi yapılmamış.</p>';
            return;
        }

        listEl.innerHTML = `
            <table class="report-table">
                <thead><tr><th>Veritabanı Kolonu</th><th>Görünen Başlık</th></tr></thead>
                <tbody>
                    ${keys.map(k => `<tr><td><code>${k}</code></td><td style="font-weight:700; color:#4ade80;">${mappings[k]}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Kolon listeleme hatası:', err);
    }
}

// --- KULLANICI LİSTESİ ---
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/v1/admin/users');
        const json = await res.json();
        const users = json.users || json.data || [];

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">Henüz kayıtlı kullanıcı bulunmuyor.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isAdmin = u.role === 'admin';
            const isProtected = u.username === 'admin';
            const roleBadge = isAdmin
                ? `<span class="badge badge-green">👑 ADMIN</span>`
                : `<span class="badge badge-mint">👤 USER</span>`;

            const deleteBtn = isProtected
                ? `<span style="color:#64748b; font-size:11px; font-weight:600;">🔒 Korumalı</span>`
                : `<button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#f87171;" onclick="deleteUser(${u.id}, '${u.username}')">🗑️ Sil</button>`;

            const safeFn = (u.full_name || '').replace(/'/g, "\\'");
            const safeUn = (u.username || '').replace(/'/g, "\\'");

            return `
                <tr>
                    <td style="font-weight:700; color:#fff;">${u.full_name || '-'}</td>
                    <td style="color:#38bdf8;"><code>${u.username}</code></td>
                    <td>${roleBadge}</td>
                    <td style="font-size:11px; color:#94a3b8;">${u.created_at || '-'}</td>
                    <td>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#38bdf8;" onclick="openEditUserModal(${u.id}, '${safeUn}', '${safeFn}', '${u.role}')">✏️ Düzenle</button>
                            ${deleteBtn}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Kullanıcı listeleme hatası:', err);
    }
}

// --- ✏️ KULLANICI DÜZENLEME & ŞİFRE / ROL DEĞİŞTİRME ---
window.openEditUserModal = function(id, username, fullName, role) {
    document.getElementById('editUserId').value = id;
    document.getElementById('editUsername').value = username;
    document.getElementById('editFullName').value = fullName;
    document.getElementById('editPassword').value = '';
    document.getElementById('editRole').value = role || 'user';
    document.getElementById('editModalTitle').innerText = `✏️ Kullanıcı Düzenle: ${username}`;

    const modal = document.getElementById('userEditModalOverlay');
    if (modal) modal.style.display = 'flex';
};

window.closeEditUserModal = function() {
    const modal = document.getElementById('userEditModalOverlay');
    if (modal) modal.style.display = 'none';
};

window.handleEditUserSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const fn = document.getElementById('editFullName').value.trim();
    const p = document.getElementById('editPassword').value.trim();
    const r = document.getElementById('editRole').value;
    const btn = document.getElementById('btnEditUserSubmit');

    if (!id || !fn) {
        alert('Lütfen ad soyad alanını doldurun.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Kaydediliyor...</span>';

    try {
        const payload = { full_name: fn, role: r };
        if (p) payload.password = p;

        const res = await fetch(`/api/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (json.success) {
            alert('✅ Kullanıcı bilgileri (şifre / rol) başarıyla güncellendi!');
            closeEditUserModal();
            loadUsers();
        } else {
            alert('Hata: ' + (json.detail || 'Güncelleme yapılamadı.'));
        }
    } catch (err) {
        console.error('Kullanıcı güncelleme hatası:', err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> <span>Güncelle & Kaydet</span>';
    }
};

window.deleteUser = async function(id, username) {
    if (!confirm(`"${username}" kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    try {
        const res = await fetch(`/api/v1/admin/users/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadUsers();
        } else {
            alert('Hata: ' + (json.detail || 'Kullanıcı silinemedi.'));
        }
    } catch (err) {
        console.error('Kullanıcı silme hatası:', err);
    }
};

// =========================================================================
// ⚠️ ÇAKIŞAN & BENZER ALTIN SORGU KARŞILAŞTIRMA MODAL MOTORU
// =========================================================================
let currentConflictData = null;
let currentConflictInstruction = '';

window.openConflictModal = function(json, instruction) {
    currentConflictData = json;
    currentConflictInstruction = instruction;

    const modal = document.getElementById('trainingConflictModal');
    if (!modal) return;

    const ex = json.existing_golden;
    
    // Sol Kart: Mevcut Altın Sorgu
    document.getElementById('conflictExistingId').innerText = `ID: ${ex.id}`;
    document.getElementById('conflictExistingTitle').innerText = ex.soru || 'Mevcut Sorgu';
    document.getElementById('conflictExistingDesc').innerText = ex.aciklama || 'Açıklama belirtilmemiş';
    document.getElementById('conflictExistingSql').innerText = ex.sql_query || '';
    renderConflictTable('conflictExistingHead', 'conflictExistingBody', ex.preview_data || []);

    // Sağ Kart: Yeni Eğitilen Sorgu
    document.getElementById('conflictNewTitle').innerText = json.report_title || 'Yeni Altın Rapor';
    document.getElementById('conflictNewDesc').innerText = json.explanation || 'Yapay Zeka Otomatik Mantık Çıkarımı';
    document.getElementById('conflictNewSql').innerText = json.sql_query || '';
    renderConflictTable('conflictNewHead', 'conflictNewBody', json.preview_data || []);

    modal.style.display = 'flex';
};

window.closeConflictModal = function() {
    const modal = document.getElementById('trainingConflictModal');
    if (modal) modal.style.display = 'none';
    currentConflictData = null;
    currentConflictInstruction = '';
};

function renderConflictTable(headId, bodyId, data) {
    const head = document.getElementById(headId);
    const body = document.getElementById(bodyId);
    if (!head || !body) return;

    head.innerHTML = '';
    body.innerHTML = '';

    if (!data || data.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 8px;">Sonuç kaydı bulunamadı.</td></tr>';
        return;
    }

    const cols = Object.keys(data[0]);
    let trH = '<tr>';
    cols.forEach(c => trH += `<th style="padding: 4px 6px; font-size: 10.5px;">${c}</th>`);
    trH += '</tr>';
    head.innerHTML = trH;

    let trB = '';
    data.slice(0, 5).forEach(row => {
        trB += '<tr>';
        cols.forEach(c => {
            const val = row[c] !== null && row[c] !== undefined ? row[c] : '-';
            trB += `<td style="padding: 4px 6px; font-size: 10.5px;">${val}</td>`;
        });
        trB += '</tr>';
    });
    body.innerHTML = trB;
}

// Buton: Mevcut Olanı Güncelle (Üzerine Yaz)
document.getElementById('btnConflictReplace')?.addEventListener('click', async () => {
    if (!currentConflictData || !currentConflictData.existing_golden) return;

    const btn = document.getElementById('btnConflictReplace');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Güncelleniyor...</span>';

    try {
        const payload = {
            replace_id: currentConflictData.existing_golden.id,
            report_title: currentConflictData.report_title,
            sql_query: currentConflictData.sql_query,
            target_database: currentConflictData.target_database || '',
            chart_type: currentConflictData.response?.chart_type || 'table',
            explanation: currentConflictData.explanation || ''
        };

        const res = await fetch('/api/v1/admin/knowledge/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const resJson = await res.json();

        if (resJson.success) {
            alert(`✅ Altın Sorgu (ID: ${currentConflictData.existing_golden.id}) başarıyla güncellendi ve hafızaya kilitlendi!`);
            closeConflictModal();
            document.getElementById('trainerInput').value = '';
            loadGoldenKnowledge();
        } else {
            alert('Hata: ' + (resJson.detail || 'Güncelleme yapılamadı.'));
        }
    } catch (err) {
        console.error('Güncelleme hatası:', err);
        alert('Bağlantı hatası oluştu.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span> <span>Mevcut Sorguyu Güncelle (Üzerine Yaz)</span>';
    }
});

// Buton: İkisini de Sakla (Yeni Olarak Ekle)
document.getElementById('btnConflictKeepBoth')?.addEventListener('click', async () => {
    if (!currentConflictInstruction) return;

    const btn = document.getElementById('btnConflictKeepBoth');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Kaydediliyor...</span>';

    try {
        const res = await fetch('/api/v1/admin/knowledge/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instruction: currentConflictInstruction,
                force_save: true
            })
        });
        const resJson = await res.json();

        if (resJson.success) {
            alert(`✅ Yeni Altın Sorgu ("${resJson.report_title}") bağımsız bir rapor olarak hafızaya eklendi!`);
            closeConflictModal();
            document.getElementById('trainerInput').value = '';
            loadGoldenKnowledge();
        } else {
            alert('Hata: ' + (resJson.detail || 'Kayıt yapılamadı.'));
        }
    } catch (err) {
        console.error('Kayıt hatası:', err);
        alert('Bağlantı hatası oluştu.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>➕</span> <span>İkisini de Sakla (Yeni Olarak Ekle)</span>';
    }
});

// =========================================================================
// 💡 YAPAY ZEKA ÖNERİLEN & EN ÇOK KULLANILAN SORGULAR (ADMIN CONTROLLER)
// =========================================================================
let allFrequentQuestions = [];

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.loadFrequentQuestions = async function() {
    try {
        const res = await fetch('/api/v1/admin/knowledge/frequent-questions');
        const json = await res.json();
        if (json.success) {
            allFrequentQuestions = json.data || [];
            renderFrequentQuestions(allFrequentQuestions);
        }
    } catch (err) {
        console.error('Önerilen sorular listelenirken hata:', err);
    }
};

window.renderFrequentQuestions = function(items) {
    const tbody = document.getElementById('frequentQuestionsTableBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#75a59e;">Kayıtlı soru önerisi bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(q => {
        const safeText = (q.question_text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeLabel = (q.chip_label || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeCat = (q.category || 'Genel').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const isPinned = q.is_pinned === 1;
        const pinIcon = isPinned ? '⭐' : '☆';
        const pinTitle = isPinned ? 'Sabitlemeyi Kaldır' : 'En Üstte Sabitle';
        const pinColor = isPinned ? '#fbbf24' : '#64748b';

        return `
            <tr style="${isPinned ? 'background: rgba(245, 158, 11, 0.04);' : ''}">
                <td style="text-align:center;">
                    <button class="btn-icon" style="color: ${pinColor}; font-size: 16px; cursor: pointer; background: none; border: none; padding: 2px 6px;" 
                            onclick="togglePinFrequentQuestion(${q.id})" title="${pinTitle}">${pinIcon}</button>
                </td>
                <td>
                    <span class="badge badge-green" style="font-size: 11.5px; font-weight: 600;">${escapeHtml(q.chip_label || q.question_text.slice(0, 18))}</span>
                </td>
                <td style="color:#ffffff; font-size: 12.5px; line-height: 1.4;">
                    <strong>${escapeHtml(q.question_text)}</strong>
                </td>
                <td>
                    <span class="badge badge-mint" style="font-size: 11px;">${escapeHtml(q.category || 'Genel')}</span>
                </td>
                <td style="text-align:center;">
                    <span class="badge ${q.ask_count > 5 ? 'badge-amber' : ''}" style="font-size: 11px;">${q.ask_count || 1} kez</span>
                </td>
                <td style="text-align:center; font-size: 11px; color:#94a3b8;">
                    ${q.month_key || '-'}
                </td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px; align-items:center;">
                        <button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#38bdf8;" 
                                onclick="openEditQuestionModal(${q.id}, '${safeText}', '${safeLabel}', '${safeCat}', ${q.ask_count || 1}, ${isPinned ? 1 : 0})">✏️ Düzenle</button>
                        <button class="btn btn-admin" style="padding:4px 8px; font-size:11px; color:#f87171;" 
                                onclick="deleteFrequentQuestion(${q.id})">🗑️ Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.filterFrequentQuestions = function(kw) {
    if (!kw) {
        renderFrequentQuestions(allFrequentQuestions);
        return;
    }
    const lower = kw.toLowerCase();
    const filtered = allFrequentQuestions.filter(q => 
        (q.question_text && q.question_text.toLowerCase().includes(lower)) || 
        (q.chip_label && q.chip_label.toLowerCase().includes(lower)) ||
        (q.category && q.category.toLowerCase().includes(lower))
    );
    renderFrequentQuestions(filtered);
};

window.openEditQuestionModal = function(id, text, label, category, count, isPinned) {
    document.getElementById('editQuestionId').value = id;
    document.getElementById('editQuestionText').value = text;
    document.getElementById('editChipLabel').value = label;
    document.getElementById('editQuestionCategory').value = category || 'Genel';
    document.getElementById('editAskCount').value = count || 1;
    document.getElementById('editIsPinned').checked = (isPinned === 1);

    const modal = document.getElementById('questionEditModalOverlay');
    if (modal) modal.style.display = 'flex';
};

window.closeEditQuestionModal = function() {
    const modal = document.getElementById('questionEditModalOverlay');
    if (modal) modal.style.display = 'none';
};

window.handleEditQuestionSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('editQuestionId').value;
    const text = document.getElementById('editQuestionText').value.trim();
    const label = document.getElementById('editChipLabel').value.trim();
    const category = document.getElementById('editQuestionCategory').value;
    const count = parseInt(document.getElementById('editAskCount').value || '1', 10);
    const isPinned = document.getElementById('editIsPinned').checked ? 1 : 0;

    if (!id || !text) {
        alert('Soru metni boş bırakılamaz.');
        return;
    }

    try {
        const res = await fetch(`/api/v1/admin/knowledge/frequent-questions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_text: text,
                chip_label: label,
                category: category,
                ask_count: count,
                is_pinned: isPinned
            })
        });
        const json = await res.json();
        if (json.success) {
            alert('✅ Soru önerisi başarıyla güncellendi!');
            closeEditQuestionModal();
            loadFrequentQuestions();
        } else {
            alert('Hata: ' + (json.detail || 'Güncelleme yapılamadı.'));
        }
    } catch (err) {
        console.error('Soru güncelleme hatası:', err);
        alert('Bağlantı hatası.');
    }
};

window.deleteFrequentQuestion = async function(id) {
    if (!confirm('Bu soru önerisini silmek istediğinizden emin misiniz?')) return;
    try {
        const res = await fetch(`/api/v1/admin/knowledge/frequent-questions/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            loadFrequentQuestions();
        } else {
            alert('Hata: ' + (json.detail || 'Silinemedi.'));
        }
    } catch (err) {
        console.error('Soru silme hatası:', err);
        alert('Bağlantı hatası.');
    }
};

window.togglePinFrequentQuestion = async function(id) {
    try {
        const res = await fetch(`/api/v1/admin/knowledge/frequent-questions/${id}/toggle-pin`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            loadFrequentQuestions();
        } else {
            alert('Hata: ' + (json.detail || 'İşlem yapılamadı.'));
        }
    } catch (err) {
        console.error('Pin hatası:', err);
    }
};

