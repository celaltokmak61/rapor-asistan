const SetupWizard = {
    selectedTables: new Set(),
    appName: '',
    assistantName: '',
    async init() {
        const cfg = window.KokpitConfig || {};
        if (!cfg.needsWizard || cfg.packId === 'demo') return;
        this.render();
    },
    render() {
        if (document.getElementById('setupWizardOverlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'setupWizardOverlay';
        overlay.className = 'login-modal-overlay';
        overlay.style.display = 'flex';
        overlay.style.zIndex = '4000';
        overlay.innerHTML = `
            <div class="login-card" style="max-width: 720px; width: 92vw; text-align: left;">
                <div class="login-header">
                    <div class="login-logo">🛠️</div>
                    <h2>Kurulum Sihirbazı</h2>
                    <p>Kendi yazılımınızın şemasını tarayıp asistanı eğitin.</p>
                </div>
                <div id="setupWizardStep"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.showStep1();
    },
    showStep1() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `
            <div class="login-form-group"><label>Uygulama Adı</label><input id="wizAppName" class="login-input" value="${window.KokpitConfig.appName || 'Rapor Asistan'}"></div>
            <div class="login-form-group"><label>Asistan Adı</label><input id="wizAssistant" class="login-input" value="${window.KokpitConfig.assistantName || 'Rapor-AI'}"></div>
            <div class="login-form-group"><label>MSSQL Sunucu</label><input id="wizServer" class="login-input" placeholder="localhost veya SUNUCU\\INSTANCE"></div>
            <div class="login-form-group"><label>Veritabanı</label><input id="wizDatabase" class="login-input" placeholder="ERPDB"></div>
            <div class="login-form-group"><label>Kullanıcı (boşsa Windows Auth)</label><input id="wizUser" class="login-input"></div>
            <div class="login-form-group"><label>Şifre</label><input id="wizPassword" type="password" class="login-input"></div>
            <div id="wizError" class="login-error-msg"></div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.saveConnection()">Bağlantıyı Dene ve Tabloları Listele</button>
        `;
    },
    async saveConnection() {
        const err = document.getElementById('wizError');
        err.style.display = 'none';
        try {
            const res = await fetch('/api/v1/setup/connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: document.getElementById('wizServer').value,
                    database: document.getElementById('wizDatabase').value,
                    user: document.getElementById('wizUser').value,
                    password: document.getElementById('wizPassword').value
                })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                const detail = json.detail;
                const msg = Array.isArray(detail) ? JSON.stringify(detail) : (detail || json.error || 'Bağlantı başarısız');
                throw new Error(msg);
            }
            this.appName = document.getElementById('wizAppName').value.trim() || 'Rapor Asistan';
            this.assistantName = document.getElementById('wizAssistant').value.trim() || 'Rapor-AI';
            await this.showStep2();
        } catch (e) {
            err.innerText = e.message;
            err.style.display = 'block';
        }
    },
    async showStep2() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `<p style="color:#d1fae5;">Tablolar yükleniyor...</p>`;
        const res = await fetch('/api/v1/setup/tables');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            el.innerHTML = `<p style="color:#fca5a5;">Tablo listesi alınamadı: ${json.detail || json.error || res.status}</p>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.showStep1()">Geri</button>`;
            return;
        }
        const tables = json.tables || [];
        this.selectedTables = new Set(tables.slice(0, 25).map((t) => t.name));
        el.innerHTML = `
            <p style="color:#d1fae5; font-size:13px;">Asistana öğretmek istediğiniz tabloları seçin (${tables.length} tablo bulundu).</p>
            <div style="max-height: 280px; overflow:auto; border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:8px; margin:12px 0;">
                ${tables.map((t) => `
                    <label style="display:flex; gap:8px; color:#fff; font-size:12px; padding:4px 0;">
                        <input type="checkbox" ${this.selectedTables.has(t.name) ? 'checked' : ''} onchange="SetupWizard.toggleTable('${t.name}', this.checked)">
                        <span>${t.schema}.${t.name}</span>
                    </label>
                `).join('')}
            </div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.ingestSelected()">Seçilen Tabloları Öğret</button>
        `;
    },
    toggleTable(name, checked) {
        if (checked) this.selectedTables.add(name);
        else this.selectedTables.delete(name);
    },
    async ingestSelected() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `<p style="color:#d1fae5;">Şema hafızaya işleniyor...</p>`;
        await fetch('/api/v1/setup/ingest-tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tables: Array.from(this.selectedTables) })
        });
        this.showStep3();
    },
    showStep3() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `
            <div class="login-form-group"><label>Firma / Şube Kodu</label><input id="wizFirmCode" class="login-input" placeholder="F001 veya MAIN"></div>
            <div class="login-form-group"><label>Firma / Şube Adı</label><input id="wizFirmName" class="login-input" placeholder="Merkez"></div>
            <div class="login-form-group"><label>İlk iş kuralı (isteğe bağlı)</label>
                <textarea id="wizRule" class="login-input" style="min-height:80px;" placeholder="Örn: Aktif stoklar için STATUS = 1 kullan. Ürün adı kolonu MALINCINSI'dir."></textarea>
            </div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.finish()">Kurulumu Bitir</button>
        `;
    },
    async finish() {
        const code = document.getElementById('wizFirmCode').value.trim();
        const name = document.getElementById('wizFirmName').value.trim();
        const rule = document.getElementById('wizRule').value.trim();
        if (code && name) {
            await fetch('/api/v1/setup/firm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, role: 'main' })
            });
        }
        if (rule) {
            await fetch('/api/v1/setup/teach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: rule })
            });
        }
        await fetch('/api/v1/setup/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_name: this.appName || window.KokpitConfig.appName,
                assistant_name: this.assistantName || window.KokpitConfig.assistantName
            })
        });
        const overlay = document.getElementById('setupWizardOverlay');
        if (overlay) overlay.remove();
        window.location.reload();
    }
};
window.SetupWizard = SetupWizard;
