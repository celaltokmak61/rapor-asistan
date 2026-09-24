window.KokpitConfig = {
    appName: 'Rapor Asistan',
    tagline: 'Eğitilebilir Text-to-SQL raporlama platformu',
    assistantName: 'Rapor-AI',
    packId: 'generic',
    packName: 'Generic',
    modules: [],
    branches: [],
    databases: [],
    setupComplete: false,
    needsWizard: false
};

async function loadKokpitBootstrap() {
    try {
        const res = await fetch('/api/v1/setup/bootstrap');
        const json = await res.json();
        if (!json || json.success === false) return json;
        window.KokpitConfig = {
            appName: json.app_name || 'Rapor Asistan',
            tagline: json.tagline || '',
            assistantName: json.assistant_name || 'Rapor-AI',
            packId: json.pack_id || 'generic',
            packName: json.pack_name || '',
            modules: json.modules || [],
            branches: json.branches || [],
            databases: json.databases || [],
            setupComplete: !!json.setup_complete,
            needsWizard: !!json.needs_wizard
        };
        applyKokpitBranding();
        return json;
    } catch (err) {
        console.warn('Bootstrap yüklenemedi:', err);
        return null;
    }
}

function applyKokpitBranding() {
    const cfg = window.KokpitConfig || {};
    document.title = cfg.appName || document.title;
    document.querySelectorAll('.brand-title h1, .login-header h2, .mobile-drawer-header strong').forEach((el) => {
        el.textContent = (cfg.appName || 'Rapor Asistan').toUpperCase();
    });
    const adminTitle = document.getElementById('adminPageTitle');
    if (adminTitle) adminTitle.textContent = `⚙️ ${(cfg.appName || 'Rapor Asistan').toUpperCase()} YÖNETİM & EĞİTİM PANELİ`;
    document.querySelectorAll('.brand-title span, .login-header p').forEach((el) => {
        if (el && cfg.tagline) el.textContent = cfg.tagline;
    });
    const assistantEls = [
        document.querySelector('#navAiStudioBtn span:last-child'),
        document.querySelector('#mobileNavAiStudioBtn span:last-child'),
        document.querySelector('#copilotLauncher span:last-child')
    ];
    assistantEls.forEach((el) => {
        if (el) el.textContent = cfg.assistantName || 'AI Asistan';
    });

    const allowed = new Set((cfg.modules || []).map((m) => m.id));
    if (allowed.size > 0) {
        document.querySelectorAll('[data-module]').forEach((el) => {
            const id = el.getAttribute('data-module');
            el.style.display = allowed.has(id) ? '' : 'none';
        });
        const first = (cfg.modules || []).find((m) => m.id !== 'ai_studio') || cfg.modules[0];
        if (first && window.KokpitState && !allowed.has(window.KokpitState.currentModule)) {
            window.KokpitState.currentModule = first.id;
            if (typeof currentModule !== 'undefined') currentModule = first.id;
        }
    }

    const branchSelect = document.getElementById('branchSelect');
    if (branchSelect && (cfg.branches || []).length) {
        const current = branchSelect.value;
        const opts = ['<option value="ALL">Tüm kayıtlar / şubeler</option>'].concat(
            cfg.branches.map((b) => `<option value="${b.code}">${b.code} - ${b.name}</option>`)
        );
        branchSelect.innerHTML = opts.join('');
        let preferred = current;
        const known = new Set(cfg.branches.map((b) => b.code).concat(['ALL']));
        if (!known.has(current)) {
            preferred = cfg.branches[0]?.code || 'ALL';
        }
        branchSelect.value = preferred;
        if (window.KokpitState) window.KokpitState.currentFirma = preferred;
        if (typeof currentFirma !== 'undefined') currentFirma = preferred;
    }

    const dbSelect = document.getElementById('goldenTargetDb');
    if (dbSelect && (cfg.databases || []).length) {
        dbSelect.innerHTML = (cfg.databases.map((d) => `<option value="${d.id}">${d.label || d.id}</option>`).join('')) || '<option value="">Varsayılan</option>';
    }
    const studioTitle = document.getElementById('studioAssistantTitle');
    if (studioTitle) studioTitle.textContent = cfg.assistantName || 'Rapor-AI';
}

window.loadKokpitBootstrap = loadKokpitBootstrap;
window.applyKokpitBranding = applyKokpitBranding;
