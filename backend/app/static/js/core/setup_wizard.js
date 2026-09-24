window.I18N = window.I18N || {};
window.I18N.setupWizard = {
    en: {
        modalTitle: 'Setup Wizard',
        title: 'Setup Wizard',
        modalDescription: "Scan your software's schema and train the assistant.",
        description: "Scan your software's schema and train the assistant.",
        appNameLabel: 'Application Name',
        appName: 'Application Name',
        appNameDefault: 'Report Assistant',
        assistantNameLabel: 'Assistant Name',
        assistantName: 'Assistant Name',
        assistantNameDefault: 'Report-AI',
        serverLabel: 'MSSQL Server',
        server: 'MSSQL Server',
        serverPlaceholder: 'localhost or SERVER\\INSTANCE',
        databaseLabel: 'Database',
        database: 'Database',
        databasePlaceholder: 'ERPDB',
        userLabel: 'User (leave empty for Windows Auth)',
        user: 'User (leave empty for Windows Auth)',
        passwordLabel: 'Password',
        password: 'Password',
        btnTestConnection: 'Test Connection and List Tables',
        testConnection: 'Test Connection and List Tables',
        connectionFailed: 'Connection failed',
        loadingTables: 'Loading tables...',
        tableListError: 'Failed to load tables:',
        btnBack: 'Back',
        back: 'Back',
        selectTablesNotice: 'Select the tables you want to train the assistant on ({count} tables found).',
        btnTeachSelected: 'Teach Selected Tables',
        teachSelected: 'Teach Selected Tables',
        ingestingSchema: 'Processing schema into memory...',
        firmCodeLabel: 'Company / Branch Code',
        firmCode: 'Company / Branch Code',
        firmCodePlaceholder: 'F001 or MAIN',
        firmNameLabel: 'Company / Branch Name',
        firmName: 'Company / Branch Name',
        firmNamePlaceholder: 'Headquarters',
        ruleLabel: 'First business rule (optional)',
        rule: 'First business rule (optional)',
        rulePlaceholder: "e.g. Use STATUS = 1 for active stock. Product name column is MALINCINSI.",
        btnFinish: 'Complete Setup',
        finish: 'Complete Setup'
    },
    tr: {
        modalTitle: 'Kurulum Sihirbazı',
        title: 'Kurulum Sihirbazı',
        modalDescription: 'Kendi yazılımınızın şemasını tarayıp asistanı eğitin.',
        description: 'Kendi yazılımınızın şemasını tarayıp asistanı eğitin.',
        appNameLabel: 'Uygulama Adı',
        appName: 'Uygulama Adı',
        appNameDefault: 'Rapor Asistan',
        assistantNameLabel: 'Asistan Adı',
        assistantName: 'Asistan Adı',
        assistantNameDefault: 'Rapor-AI',
        serverLabel: 'MSSQL Sunucu',
        server: 'MSSQL Sunucu',
        serverPlaceholder: 'localhost veya SUNUCU\\INSTANCE',
        databaseLabel: 'Veritabanı',
        database: 'Veritabanı',
        databasePlaceholder: 'ERPDB',
        userLabel: 'Kullanıcı (boşsa Windows Auth)',
        user: 'Kullanıcı (boşsa Windows Auth)',
        passwordLabel: 'Şifre',
        password: 'Şifre',
        btnTestConnection: 'Bağlantıyı Dene ve Tabloları Listele',
        testConnection: 'Bağlantıyı Dene ve Tabloları Listele',
        connectionFailed: 'Bağlantı başarısız',
        loadingTables: 'Tablolar yükleniyor...',
        tableListError: 'Tablo listesi alınamadı:',
        btnBack: 'Geri',
        back: 'Geri',
        selectTablesNotice: 'Asistana öğretmek istediğiniz tabloları seçin ({count} tablo bulundu).',
        btnTeachSelected: 'Seçilen Tabloları Öğret',
        teachSelected: 'Seçilen Tabloları Öğret',
        ingestingSchema: 'Şema hafızaya işleniyor...',
        firmCodeLabel: 'Firma / Şube Kodu',
        firmCode: 'Firma / Şube Kodu',
        firmCodePlaceholder: 'F001 veya MAIN',
        firmNameLabel: 'Firma / Şube Adı',
        firmName: 'Firma / Şube Adı',
        firmNamePlaceholder: 'Merkez',
        ruleLabel: 'İlk iş kuralı (isteğe bağlı)',
        rule: 'İlk iş kuralı (isteğe bağlı)',
        rulePlaceholder: "Örn: Aktif stoklar için STATUS = 1 kullan. Ürün adı kolonu MALINCINSI'dir.",
        btnFinish: 'Kurulumu Bitir',
        finish: 'Kurulumu Bitir'
    }
};

window.I18N.en = Object.assign(window.I18N.en || {}, window.I18N.setupWizard.en);
window.I18N.tr = Object.assign(window.I18N.tr || {}, window.I18N.setupWizard.tr);

const SetupWizard = {
    selectedTables: new Set(),
    appName: '',
    assistantName: '',
    getLang() {
        try {
            const lang = localStorage.getItem('rapor_lang') || (navigator.language && navigator.language.startsWith('tr') ? 'tr' : 'en');
            return lang === 'tr' ? 'tr' : 'en';
        } catch (_) {
            return 'en';
        }
    },
    t(key, params) {
        const lang = (this && typeof this.getLang === 'function') ? this.getLang() : SetupWizard.getLang();
        const source = (window.I18N && window.I18N.setupWizard) || window.I18N || {};
        const dict = source[lang] || source.en || {};
        let text = dict[key] != null ? dict[key] : (source.en && source.en[key] != null ? source.en[key] : key);
        if (params && typeof text === 'string') {
            Object.keys(params).forEach((k) => {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
            });
        }
        return text;
    },
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
                    <h2>${this.t('modalTitle')}</h2>
                    <p>${this.t('modalDescription')}</p>
                </div>
                <div id="setupWizardStep"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.showStep1();
    },
    showStep1() {
        const el = document.getElementById('setupWizardStep');
        const defaultApp = (window.KokpitConfig && window.KokpitConfig.appName) || this.t('appNameDefault');
        const defaultAssistant = (window.KokpitConfig && window.KokpitConfig.assistantName) || this.t('assistantNameDefault');
        el.innerHTML = `
            <div class="login-form-group"><label>${this.t('appNameLabel')}</label><input id="wizAppName" class="login-input" value="${defaultApp}"></div>
            <div class="login-form-group"><label>${this.t('assistantNameLabel')}</label><input id="wizAssistant" class="login-input" value="${defaultAssistant}"></div>
            <div class="login-form-group"><label>${this.t('serverLabel')}</label><input id="wizServer" class="login-input" placeholder="${this.t('serverPlaceholder')}"></div>
            <div class="login-form-group"><label>${this.t('databaseLabel')}</label><input id="wizDatabase" class="login-input" placeholder="${this.t('databasePlaceholder')}"></div>
            <div class="login-form-group"><label>${this.t('userLabel')}</label><input id="wizUser" class="login-input"></div>
            <div class="login-form-group"><label>${this.t('passwordLabel')}</label><input id="wizPassword" type="password" class="login-input"></div>
            <div id="wizError" class="login-error-msg"></div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.saveConnection()">${this.t('btnTestConnection')}</button>
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
                const msg = Array.isArray(detail) ? JSON.stringify(detail) : (detail || json.error || this.t('connectionFailed'));
                throw new Error(msg);
            }
            this.appName = document.getElementById('wizAppName').value.trim() || (window.KokpitConfig && window.KokpitConfig.appName) || this.t('appNameDefault');
            this.assistantName = document.getElementById('wizAssistant').value.trim() || (window.KokpitConfig && window.KokpitConfig.assistantName) || this.t('assistantNameDefault');
            await this.showStep2();
        } catch (e) {
            err.innerText = e.message;
            err.style.display = 'block';
        }
    },
    async showStep2() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `<p style="color:#d1fae5;">${this.t('loadingTables')}</p>`;
        const res = await fetch('/api/v1/setup/tables');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            el.innerHTML = `<p style="color:#fca5a5;">${this.t('tableListError')} ${json.detail || json.error || res.status}</p>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.showStep1()">${this.t('btnBack')}</button>`;
            return;
        }
        const tables = json.tables || [];
        this.selectedTables = new Set(tables.slice(0, 25).map((t) => t.name));
        el.innerHTML = `
            <p style="color:#d1fae5; font-size:13px;">${this.t('selectTablesNotice', { count: tables.length })}</p>
            <div style="max-height: 280px; overflow:auto; border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:8px; margin:12px 0;">
                ${tables.map((t) => `
                    <label style="display:flex; gap:8px; color:#fff; font-size:12px; padding:4px 0;">
                        <input type="checkbox" ${this.selectedTables.has(t.name) ? 'checked' : ''} onchange="SetupWizard.toggleTable('${t.name}', this.checked)">
                        <span>${t.schema}.${t.name}</span>
                    </label>
                `).join('')}
            </div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.ingestSelected()">${this.t('btnTeachSelected')}</button>
        `;
    },
    toggleTable(name, checked) {
        if (checked) this.selectedTables.add(name);
        else this.selectedTables.delete(name);
    },
    async ingestSelected() {
        const el = document.getElementById('setupWizardStep');
        el.innerHTML = `<p style="color:#d1fae5;">${this.t('ingestingSchema')}</p>`;
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
            <div class="login-form-group"><label>${this.t('firmCodeLabel')}</label><input id="wizFirmCode" class="login-input" placeholder="${this.t('firmCodePlaceholder')}"></div>
            <div class="login-form-group"><label>${this.t('firmNameLabel')}</label><input id="wizFirmName" class="login-input" placeholder="${this.t('firmNamePlaceholder')}"></div>
            <div class="login-form-group"><label>${this.t('ruleLabel')}</label>
                <textarea id="wizRule" class="login-input" style="min-height:80px;" placeholder="${this.t('rulePlaceholder')}"></textarea>
            </div>
            <button class="btn-login-submit" type="button" onclick="SetupWizard.finish()">${this.t('btnFinish')}</button>
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
                app_name: this.appName || (window.KokpitConfig && window.KokpitConfig.appName),
                assistant_name: this.assistantName || (window.KokpitConfig && window.KokpitConfig.assistantName)
            })
        });
        const overlay = document.getElementById('setupWizardOverlay');
        if (overlay) overlay.remove();
        window.location.reload();
    }
};
window.SetupWizard = SetupWizard;
