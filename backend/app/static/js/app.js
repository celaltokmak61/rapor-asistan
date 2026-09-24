document.addEventListener('DOMContentLoaded', async () => {
    if (typeof loadKokpitBootstrap === 'function') {
        await loadKokpitBootstrap();
    }
    if (window.KokpitConfig?.needsWizard && window.SetupWizard) {
        SetupWizard.init();
    }
    AuthModule?.initPageAuth('cockpit');

    document.documentElement.removeAttribute('data-theme');
    try { localStorage.removeItem('kokpit_theme'); } catch (e) {}
    currentModule = 'ai_studio';
    window.KokpitState.currentModule = 'ai_studio';
    initLiveRefresh();
    initDateFilters();
    initNavigation();
    initMobileDrawer();
    initStudioChart();
    initFuzzyAutocompletes();
    initPaginationHandlers();
    AiStudioModule?.init();

    const stdView = document.getElementById('standardModuleView');
    const aiView = document.getElementById('aiStudioView');
    if (stdView) stdView.style.display = 'none';
    if (aiView) aiView.style.display = window.innerWidth <= 850 ? 'flex' : 'grid';

    // Global Eventler
    document.getElementById('branchSelect')?.addEventListener('change', (e) => {
        currentFirma = e.target.value;
        window.KokpitState.currentFirma = currentFirma;
        if (currentModule !== 'ai_studio') {
            loadModule(currentModule);
        }
    });

    const debouncedStdFilter = debounce((val) => filterData(val, 'std'), 150);
    const debouncedStudioFilter = debounce((val) => {
        if (window.AiStudioModule && typeof window.AiStudioModule.applyFilters === 'function') {
            window.AiStudioModule.applyFilters();
        } else {
            filterData(val, 'studio');
        }
    }, 150);

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        debouncedStdFilter(e.target.value);
    });

    document.getElementById('studioSearchInput')?.addEventListener('input', (e) => {
        debouncedStudioFilter(e.target.value);
    });

    document.getElementById('btnExcelExport')?.addEventListener('click', () => exportTableToExcel());
    document.getElementById('mobileExcelBtn')?.addEventListener('click', () => exportTableToExcel());
    document.getElementById('btnStudioExcelExport')?.addEventListener('click', () => exportTableToExcel());
});

// --- 🔐 GİRİŞ FORMU İŞLEYİCİSİ ---
window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const btn = document.getElementById('btnLoginSubmit');
    const errEl = document.getElementById('loginErrorMsg');

    if (errEl) errEl.style.display = 'none';
    if (!u || !p) return;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Giriş Yapılıyor...</span>';

    try {
        const user = await AuthModule.login(u, p);
        AuthModule.initPageAuth('cockpit');
        loadModule(currentModule);
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'Hatalı kullanıcı adı veya şifre!';
            errEl.style.display = 'block';
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀</span> <span>Güvenli Giriş Yap</span>';
    }
};

// --- 📅 CANLI TARİH ARALIĞI YÖNETİMİ ---
function initDateFilters() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    currentStartDate = `${yyyy}-${mm}-01`;
    currentEndDate = `${yyyy}-${mm}-${dd}`;
    window.KokpitState.currentStartDate = currentStartDate;
    window.KokpitState.currentEndDate = currentEndDate;

    // Tarih girdi kutucuklarını ilk değerleriyle senkronize et
    ['filterStartDate', 'studioStartDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentStartDate;
    });
    ['filterEndDate', 'studioEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentEndDate;
    });

    // Hazır Tarih Seçici Butonları (Bugün, Dün, Bu Ay, Geçen Ay, 2026 Yılı)
    document.querySelectorAll('#mainDatePresetGroup .date-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const range = btn.getAttribute('data-range');
            applyDatePreset(range);
        });
    });

    // Standart Tablo Tarih Kutucukları Değişimi (filterStartDate & filterEndDate)
    let dateInputDebounce = null;
    const onDateInputChange = (immediate = false) => {
        const s = document.getElementById('filterStartDate')?.value;
        const e = document.getElementById('filterEndDate')?.value;
        if (s && e) {
            currentStartDate = s;
            currentEndDate = e;
            window.KokpitState.currentStartDate = currentStartDate;
            window.KokpitState.currentEndDate = currentEndDate;

            // AI Studio tarihlerini de eşitle
            const studioStart = document.getElementById('studioStartDate');
            const studioEnd = document.getElementById('studioEndDate');
            if (studioStart) studioStart.value = currentStartDate;
            if (studioEnd) studioEnd.value = currentEndDate;

            document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));

            if (immediate) {
                clearTimeout(dateInputDebounce);
                refreshCurrentView();
            } else {
                clearTimeout(dateInputDebounce);
                dateInputDebounce = setTimeout(() => {
                    refreshCurrentView();
                }, 400);
            }
        }
    };

    document.getElementById('filterStartDate')?.addEventListener('change', () => onDateInputChange(true));
    document.getElementById('filterEndDate')?.addEventListener('change', () => onDateInputChange(true));
    document.getElementById('filterStartDate')?.addEventListener('input', () => onDateInputChange(false));
    document.getElementById('filterEndDate')?.addEventListener('input', () => onDateInputChange(false));

    document.getElementById('btnApplyDateFilter')?.addEventListener('click', (e) => {
        e.preventDefault();
        onDateInputChange(true);
    });

    // AI Studio Tarih Butonu ve Kutucukları
    document.getElementById('btnApplyStudioDate')?.addEventListener('click', () => {
        const s = document.getElementById('studioStartDate')?.value;
        const e = document.getElementById('studioEndDate')?.value;
        if (s && e) {
            currentStartDate = s;
            currentEndDate = e;
            window.KokpitState.currentStartDate = s;
            window.KokpitState.currentEndDate = e;

            const stdStart = document.getElementById('filterStartDate');
            const stdEnd = document.getElementById('filterEndDate');
            if (stdStart) stdStart.value = s;
            if (stdEnd) stdEnd.value = e;

            document.querySelectorAll('.date-preset-btn').forEach(b => b.classList.remove('active'));
            refreshCurrentView();
        }
    });
}

function applyDatePreset(preset) {
    const now = new Date();
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    if (preset === 'today') {
        currentStartDate = formatDate(now);
        currentEndDate = formatDate(now);
    } else if (preset === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        currentStartDate = formatDate(yest);
        currentEndDate = formatDate(yest);
    } else if (preset === 'this_month') {
        currentStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        currentEndDate = formatDate(now);
    } else if (preset === 'last_month') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        currentStartDate = formatDate(firstDayLastMonth);
        currentEndDate = formatDate(lastDayLastMonth);
    } else if (preset === 'this_year') {
        currentStartDate = `${now.getFullYear()}-01-01`;
        currentEndDate = formatDate(now);
    }

    window.KokpitState.currentStartDate = currentStartDate;
    window.KokpitState.currentEndDate = currentEndDate;

    // Tüm tarih girdi kutucuklarını güncelle
    ['filterStartDate', 'studioStartDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentStartDate;
    });
    ['filterEndDate', 'studioEndDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentEndDate;
    });

    // Aktif buton stilini tüm bar'larda eşitle
    document.querySelectorAll('.date-preset-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-range') === preset);
    });

    refreshCurrentView();
}

function refreshCurrentView() {
    if (currentModule === 'ai_studio') {
        if (lastAiUserQuery) AiStudioModule.sendMessage(lastAiUserQuery);
    } else {
        loadModule(currentModule);
    }
}


// --- ⚡ CANLI MSSQL YENİLEME ---
function initLiveRefresh() {
    document.getElementById('btnLiveRefresh')?.addEventListener('click', () => {
        showToast('⚡ MSSQL Veritabanından Canlı Veri Çekiliyor...', 'info');
        window.KokpitState.bypassCache = true;
        if (currentModule === 'ai_studio') {
            if (lastAiUserQuery) AiStudioModule.sendMessage(lastAiUserQuery);
        } else {
            loadModule(currentModule);
        }
    });
}

// --- 🧭 MENÜ VE MODÜL DEĞİŞİMİ ---
function initNavigation() {
    const navItems = document.querySelectorAll('.tab-btn');
    const mobileNavItems = document.querySelectorAll('.mobile-nav-btn');
    const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav-item');

    const handleModuleChange = (modName) => {
        currentModule = modName;
        window.KokpitState.currentModule = modName;

        navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-module') === modName));
        mobileNavItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-module') === modName));
        bottomNavItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-module') === modName));

        const stdView = document.getElementById('standardModuleView');
        const aiView = document.getElementById('aiStudioView');

        if (stdView) stdView.style.display = 'none';
        if (aiView) {
            aiView.style.display = window.innerWidth <= 850 ? 'flex' : 'grid';
            if (!aiView.classList.contains('tab-chat') && !aiView.classList.contains('tab-display')) {
                aiView.classList.add('tab-chat');
            }
        }
        setTimeout(() => studioChartInstance?.resize(), 150);
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            handleModuleChange(item.getAttribute('data-module'));
        });
    });

    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            handleModuleChange(item.getAttribute('data-module'));
        });
    });

    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            handleModuleChange(item.getAttribute('data-module'));
        });
    });
}

// --- 📱 MOBİL ÇEKMECE (DRAWER) VE MENÜ KONTROLÜ ---
function initMobileDrawer() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const drawer = document.getElementById('mobileMenuDrawer');
    const overlay = document.getElementById('mobileMenuOverlay');
    const closeBtn = document.getElementById('mobileCloseBtn');
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');

    const openDrawer = () => {
        drawer?.classList.add('open');
        overlay?.classList.add('open');
        document.body.classList.add('drawer-open');
    };

    const closeDrawer = () => {
        drawer?.classList.remove('open');
        overlay?.classList.remove('open');
        document.body.classList.remove('drawer-open');
    };

    hamburgerBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (drawer?.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        closeDrawer();
    });

    overlay?.addEventListener('click', () => {
        closeDrawer();
    });

    // Mobil menüden bir modüle tıklandığında çekmeceyi otomatik kapat
    mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            closeDrawer();
        });
    });

    // ESC tuşuna basıldığında çekmeceyi kapat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer?.classList.contains('open')) {
            closeDrawer();
        }
    });
}

// --- 🤖 AI STUDIO MOBİL SEKME GEÇİŞİ (Sohbet vs Rapor) ---
window.switchStudioMobileTab = function(tabName) {
    const aiView = document.getElementById('aiStudioView');
    const btnChat = document.getElementById('btnStudioTabChat');
    const btnDisplay = document.getElementById('btnStudioTabDisplay');
    const dot = document.getElementById('studioTabDot');

    if (!aiView) return;

    if (tabName === 'display') {
        aiView.classList.remove('tab-chat');
        aiView.classList.add('tab-display');
        btnChat?.classList.remove('active');
        btnDisplay?.classList.add('active');
        if (dot) dot.style.display = 'none';

        setTimeout(() => {
            studioChartInstance?.resize();
        }, 150);
    } else {
        aiView.classList.remove('tab-display');
        aiView.classList.add('tab-chat');
        btnDisplay?.classList.remove('active');
        btnChat?.classList.add('active');
    }
};

function initChart() {
    const chartDom = document.getElementById('mainChart');
    if (chartDom && window.echarts) {
        chartInstance = echarts.init(chartDom, 'dark');
        window.chartInstance = chartInstance;
        window.KokpitState.chartInstance = chartInstance;
        window.addEventListener('resize', () => chartInstance?.resize());
    }
}

function initStudioChart() {
    const chartDom = document.getElementById('studioChart');
    if (chartDom && window.echarts) {
        studioChartInstance = echarts.init(chartDom, 'dark');
        window.KokpitState.studioChartInstance = studioChartInstance;
        window.addEventListener('resize', () => studioChartInstance?.resize());
    }
}

async function loadModule(_moduleName) {
    currentModule = 'ai_studio';
    window.KokpitState.currentModule = 'ai_studio';
    const stdView = document.getElementById('standardModuleView');
    const aiView = document.getElementById('aiStudioView');
    if (stdView) stdView.style.display = 'none';
    if (aiView) aiView.style.display = window.innerWidth <= 850 ? 'flex' : 'grid';
}

function updateStandardHeader() {}
function renderKPIs() {}
function renderChart() {}

// --- 🔍 FUZZY AUTOCOMPLETE MOTORU ---
function initFuzzyAutocompletes() {
    setupFuzzySearch('studioSearchInput', 'studioSearchSuggestionList', (val) => {
        if (window.AiStudioModule && typeof window.AiStudioModule.applyFilters === 'function') {
            window.AiStudioModule.applyFilters();
        } else {
            filterData(val, 'studio');
        }
    });
}

function setupFuzzySearch(inputId, suggestionListId, onSelectCallback) {
    const input = document.getElementById(inputId);
    const suggestionList = document.getElementById(suggestionListId);
    if (!input || !suggestionList) return;

    let debounceTimer = null;
    let selectedIndex = -1;

    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        selectedIndex = -1;

        if (query.length < 2) {
            suggestionList.style.display = 'none';
            suggestionList.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/search/fuzzy?q=${encodeURIComponent(query)}&limit=7`);
                const json = await res.json();

                if (json.success && json.results && json.results.length > 0) {
                    suggestionList.innerHTML = json.results.map((item, idx) => `
                        <div class="suggestion-item" data-index="${idx}" data-name="${item.name}">
                            <div class="suggestion-name">
                                <span>${item.type === 'stok' ? '📦' : '👥'}</span>
                                <strong>${highlightMatch(item.name, query)}</strong>
                            </div>
                            <span class="suggestion-type">${item.type.toUpperCase()}</span>
                        </div>
                    `).join('');
                    suggestionList.style.display = 'block';

                    suggestionList.querySelectorAll('.suggestion-item').forEach(el => {
                        el.addEventListener('click', () => {
                            const name = el.getAttribute('data-name');
                            input.value = name;
                            suggestionList.style.display = 'none';
                            onSelectCallback(name);
                        });
                    });
                } else {
                    suggestionList.style.display = 'none';
                }
            } catch (err) {
                console.error('Fuzzy arama hatası:', err);
                suggestionList.style.display = 'none';
            }
        }, 150);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionList.contains(e.target)) {
            suggestionList.style.display = 'none';
        }
    });
}

function highlightMatch(text, query) {
    if (!text || !query) return text;
    const regex = new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span style="color: #4ade80; text-decoration: underline;">$1</span>');
}
