// ==========================================================================
// Tablo / sayfalama
// ==========================================================================

let stdSortColumn = null;
let stdSortDirection = 'asc';
let studioSortColumn = null;
let studioSortDirection = 'asc';

function handleTableSort(columnKey, viewType = 'std') {
    const isStd = viewType === 'std';
    let currentSortCol = isStd ? stdSortColumn : studioSortColumn;
    let currentSortDir = isStd ? stdSortDirection : studioSortDirection;

    if (currentSortCol === columnKey) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortCol = columnKey;
        currentSortDir = 'asc';
    }

    if (isStd) {
        stdSortColumn = currentSortCol;
        stdSortDirection = currentSortDir;
    } else {
        studioSortColumn = currentSortCol;
        studioSortDirection = currentSortDir;
    }

    const dataList = isStd 
        ? (window.KokpitState.filteredData || []) 
        : (window.KokpitState.studioFilteredData || []);
    const isAsc = currentSortDir === 'asc';

    dataList.sort((a, b) => {
        // Mutabakatta ve kategorili tüm raporlarda kategori gruplarını her zaman bir arada tut
        const catKey = a.Kategori !== undefined ? 'Kategori' : (a['Ürün Grubu'] !== undefined ? 'Ürün Grubu' : (a.Grup !== undefined ? 'Grup' : null));
        if (catKey && columnKey !== catKey) {
            const catA = a[catKey] || '';
            const catB = b[catKey] || '';
            if (catA !== catB) {
                return catA.localeCompare(catB, 'tr', { sensitivity: 'base' });
            }
        }

        let va = a[columnKey];
        let vb = b[columnKey];

        if (va === null || va === undefined) va = '';
        if (vb === null || vb === undefined) vb = '';

        const isNumA = typeof va === 'number';
        const isNumB = typeof vb === 'number';

        let numA = isNumA ? va : parseFloat(String(va).replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
        let numB = isNumB ? vb : parseFloat(String(vb).replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim());

        if (!isNaN(numA) && !isNaN(numB) && String(va).trim() !== '' && String(vb).trim() !== '') {
            return isAsc ? numA - numB : numB - numA;
        }

        return isAsc 
            ? String(va).localeCompare(String(vb), 'tr', { sensitivity: 'base' })
            : String(vb).localeCompare(String(va), 'tr', { sensitivity: 'base' });
    });

    renderPagedTable(viewType);
}

function initPaginationHandlers() {
    document.getElementById('stdPageSizeSelect')?.addEventListener('change', (e) => {
        stdPageSize = e.target.value === 'ALL' ? Infinity : parseInt(e.target.value);
        stdCurrentPage = 1;
        renderPagedTable('std');
    });

    document.getElementById('btnStdFirst')?.addEventListener('click', () => {
        stdCurrentPage = 1;
        renderPagedTable('std');
    });
    document.getElementById('btnStdPrev')?.addEventListener('click', () => {
        if (stdCurrentPage > 1) {
            stdCurrentPage--;
            renderPagedTable('std');
        }
    });
    document.getElementById('btnStdNext')?.addEventListener('click', () => {
        const dataList = window.KokpitState.filteredData || [];
        const maxPage = Math.ceil(dataList.length / stdPageSize) || 1;
        if (stdCurrentPage < maxPage) {
            stdCurrentPage++;
            renderPagedTable('std');
        }
    });
    document.getElementById('btnStdLast')?.addEventListener('click', () => {
        const dataList = window.KokpitState.filteredData || [];
        stdCurrentPage = Math.ceil(dataList.length / stdPageSize) || 1;
        renderPagedTable('std');
    });

    // AI Studio Tablo Sayfalama Butonları
    document.getElementById('studioPageSizeSelect')?.addEventListener('change', (e) => {
        studioPageSize = e.target.value === 'ALL' ? Infinity : parseInt(e.target.value);
        studioCurrentPage = 1;
        renderPagedTable('studio');
    });

    document.getElementById('btnStudioFirst')?.addEventListener('click', () => {
        studioCurrentPage = 1;
        renderPagedTable('studio');
    });
    document.getElementById('btnStudioPrev')?.addEventListener('click', () => {
        if (studioCurrentPage > 1) {
            studioCurrentPage--;
            renderPagedTable('studio');
        }
    });
    document.getElementById('btnStudioNext')?.addEventListener('click', () => {
        const dataList = window.KokpitState.studioFilteredData || [];
        const maxPage = Math.ceil(dataList.length / studioPageSize) || 1;
        if (studioCurrentPage < maxPage) {
            studioCurrentPage++;
            renderPagedTable('studio');
        }
    });
    document.getElementById('btnStudioLast')?.addEventListener('click', () => {
        const dataList = window.KokpitState.studioFilteredData || [];
        studioCurrentPage = Math.ceil(dataList.length / studioPageSize) || 1;
        renderPagedTable('studio');
    });
}

// ==========================================================================
// 🏢 ŞUBE VE DİP TOPLAM MOTORU YARDIMCI FONKSİYONLARI
// ==========================================================================

function normalizeTextTr(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/ı/g, 'i')
        .trim();
}

function checkAndInjectBranchTotals(list) {
    if (!list || list.length === 0) return;
    const firstRow = list[0];
    const keys = Object.keys(firstRow);
    
    // Zaten bir toplam kolonu varsa tekrar ekleme
    const hasTotal = keys.some(k => {
        const norm = normalizeTextTr(k);
        return norm === 'toplam' || norm === 'genel toplam' || norm.includes('sube toplami') || norm.includes('subeler toplami');
    });
    if (hasTotal) return;

    // Şube isimlerini tespit et
    const branchKeywords = [];
    const matchedBranchCols = [];
    for (const k of keys) {
        const norm = normalizeTextTr(k);
        if (branchKeywords.some(b => norm.includes(b))) {
            matchedBranchCols.push(k);
        }
    }

    // 2 veya daha fazla şube kolonu varsa yatay 4 Şube Toplamı üret
    if (matchedBranchCols.length >= 2) {
        for (const r of list) {
            let rowSum = 0;
            let hasVal = false;
            for (const col of matchedBranchCols) {
                let v = r[col];
                if (typeof v === 'string') {
                    const cleaned = v.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                    v = parseFloat(cleaned);
                }
                if (typeof v === 'number' && !isNaN(v)) {
                    rowSum += v;
                    hasVal = true;
                }
            }
            r['4 Şube Toplamı'] = hasVal ? Math.round(rowSum * 100) / 100 : 0;
        }
    }
}

function isNonSummableColumn(colName) {
    if (!colName) return true;
    const norm = normalizeTextTr(colName);
    
    const exactBlacklist = [
        'id', 'ind', 'belgeind', 'hareketind', 'stokind', 'cariind',
        'kod', 'kodu', 'stok kodu', 'cari kodu', 'barkod',
        'no', 'numara', 'belge no', 'evrak no', 'fis no', 'fatura no',
        'tarih', 'sevk tarihi', 'vade tarihi', 'islem tarihi', 'tarihi', 'kayit tarihi',
        'saat', 'sevk saati', 'zaman', 'yil', 'ay', 'gun',
        'birim', 'birimi', 'sube', 'sube adi', 'sube kodu',
        'cari', 'cari adi', 'unvan', 'musteri', 'tedarikci',
        'plaka', 'sofor', 'sofor adi', 'surucu',
        'kategori', 'tip', 'tipi', 'tur', 'turu', 'hareket turu', 'islem turu',
        'telefon', 'tel', 'vkn', 'tc', 'vergi no', 'ozel kod', 'izahat', 'aciklama'
    ];
    if (exactBlacklist.includes(norm)) return true;

    const hasMetric = /(ciro|tutar|miktar|adet|kg|kilo|borc|alacak|bakiye|fark|kalan|gelen|cikan|fiyat|hata)/i.test(norm);
    if (!hasMetric) {
        if (/(^|_|\s)(id|ind|no|kod|kodu|barkod|tarih|date|saat|time|vade|plaka|sofor|telefon|yil|yıl|ay)(\s|_|$)/i.test(norm)) {
            return true;
        }
    }
    return false;
}

function isColumnNumericInDataset(col, list) {
    if (isNonSummableColumn(col)) return false;
    let numericCount = 0;
    let validCount = 0;
    for (const r of list) {
        let val = r[col];
        if (val === null || val === undefined || val === '' || val === '-') continue;
        validCount++;
        if (typeof val === 'number') {
            numericCount++;
        } else if (typeof val === 'string') {
            const cleaned = val.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
            if (!isNaN(parseFloat(cleaned)) && isFinite(cleaned)) {
                numericCount++;
            }
        }
    }
    return validCount > 0 && (numericCount / validCount) >= 0.7;
}

// ==========================================================================
// 🎛️ SÜTUN SEÇİCİ (COLUMN PICKER) VE VERİ ÇUBUĞU MOTORU
// ==========================================================================

function getHiddenColumns(mod) {
    try {
        const stored = localStorage.getItem(`kokpit_hidden_cols_${mod}`);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function setHiddenColumns(mod, cols) {
    try {
        localStorage.setItem(`kokpit_hidden_cols_${mod}`, JSON.stringify(cols));
    } catch (e) {}
}

function updateColumnPickerUI(allColumns, curMod) {
    const listEl = document.getElementById('columnPickerList');
    if (!listEl) return;

    window.KokpitState._lastRenderedColumns = allColumns;
    const hiddenCols = getHiddenColumns(curMod);

    listEl.innerHTML = allColumns.map(col => {
        const isChecked = !hiddenCols.includes(col);
        return `
            <label class="column-picker-item">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleColumnVisibility('${col}', this.checked)">
                <span>${col}</span>
            </label>
        `;
    }).join('');
}

window.toggleColumnVisibility = function(colName, isVisible) {
    const curMod = window.KokpitState?.currentModule || (typeof currentModule !== 'undefined' ? currentModule : 'genel');
    let hiddenCols = getHiddenColumns(curMod);
    if (!isVisible) {
        if (!hiddenCols.includes(colName)) hiddenCols.push(colName);
    } else {
        hiddenCols = hiddenCols.filter(c => c !== colName);
    }
    setHiddenColumns(curMod, hiddenCols);
    renderPagedTable('std');
};

window.toggleColumnPicker = function(e) {
    if (e) e.stopPropagation();
    const dd = document.getElementById('columnPickerDropdown');
    if (!dd) return;
    const isVisible = dd.style.display === 'block';
    dd.style.display = isVisible ? 'none' : 'block';
};

window.resetColumnPicker = function() {
    const curMod = window.KokpitState?.currentModule || (typeof currentModule !== 'undefined' ? currentModule : 'genel');
    setHiddenColumns(curMod, []);
    const allCols = window.KokpitState._lastRenderedColumns || [];
    updateColumnPickerUI(allCols, curMod);
    renderPagedTable('std');
};

document.addEventListener('click', (e) => {
    const wrap = document.getElementById('columnPickerWrap');
    const dd = document.getElementById('columnPickerDropdown');
    if (dd && dd.style.display === 'block') {
        if (!wrap || !wrap.contains(e.target)) {
            dd.style.display = 'none';
        }
    }
});

function formatCellContent(val, col, colMaxValues = {}) {
    if (val === null || val === undefined) return '-';
    const colLower = col.toLowerCase();

    // 🔴 1. Eksi Sayı Alarmı (Pulsing Negative Badge)
    if (typeof val === 'number' && val < 0) {
        if (colLower === 'fark') {
            return `<span class="badge-negative-pulse" style="font-weight:700;">⚠️ ${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>`;
        } else if (colLower.includes('hata')) {
            return `<span style="color:#f87171; font-weight:700;">%${val.toFixed(1)}</span>`;
        } else if (colLower.includes('ciro') || colLower.includes('tutar') || colLower.includes('borc') || colLower.includes('alacak')) {
            return `<span class="badge-negative-pulse">⚠️ ₺${val.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>`;
        } else {
            return `<span class="badge-negative-pulse">⚠️ ${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>`;
        }
    }

    if (colLower === 'fark' && typeof val === 'number') {
        if (val > 0) return `<span class="badge badge-green" style="font-weight:700;">+${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>`;
        return `<span style="color:#94a3b8;">0</span>`;
    }

    if (colLower.includes('hata') && typeof val === 'number') {
        if (val > 0) return `<span style="color:#4ade80; font-weight:700;">+%${val.toFixed(1)}</span>`;
        return `<span style="color:#94a3b8;">%0</span>`;
    }

    if (col === 'Olması Gereken' && typeof val === 'number') {
        return `<strong style="color:#38bdf8;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong>`;
    }
    if (col === 'Güncel Sayım' && typeof val === 'number') {
        return `<strong style="color:#fde047;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong>`;
    }
    if ((col === 'Şubeye Gelenler' || col === 'Toplam Giriş') && typeof val === 'number') {
        return `<strong style="color:#4ade80;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong>`;
    }
    if ((col === 'Şubeden Çıkan' || col === 'Toplam Çıkış') && typeof val === 'number') {
        return `<strong style="color:#fb923c;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong>`;
    }
    if (col === 'İade' && typeof val === 'number') {
        return val > 0 ? `<span style="color:#f87171; font-weight:700;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>` : `<span style="color:#94a3b8;">0</span>`;
    }

    // Para Birimleri
    if (typeof val === 'number' && (colLower.includes('ciro') || colLower.includes('tutar') || colLower.includes('değeri') || colLower.includes('fiyat') || colLower.includes('borc') || colLower.includes('borç') || colLower.includes('alacak') || colLower.includes('bakiye') || colLower.includes('gelir') || colLower.includes('gider'))) {
        return '₺' + val.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    // 📊 2. Görsel Veri Çubuğu (Data Bar) - Pozitif Miktar / Stok Değerleri
    if (typeof val === 'number' && val > 0 && colMaxValues && colMaxValues[col]) {
        const maxV = colMaxValues[col];
        const pct = Math.min(100, Math.max(4, Math.round((val / maxV) * 100)));
        const formattedVal = val.toLocaleString('tr-TR', {maximumFractionDigits: 2});
        return `
            <div class="data-bar-wrap">
                <div class="data-bar-bg" style="width: ${pct}%;"></div>
                <span class="data-bar-val">${formattedVal}</span>
            </div>
        `;
    }

    if (typeof val === 'number') {
        return val.toLocaleString('tr-TR', {maximumFractionDigits: 2});
    }

    return String(val);
}

function renderPagedTable(viewType = 'std') {
    const isStd = viewType === 'std';
    let dataList = isStd 
        ? (window.KokpitState?.filteredData || (typeof filteredData !== 'undefined' ? filteredData : [])) 
        : (window.KokpitState?.studioFilteredData || (typeof studioFilteredData !== 'undefined' ? studioFilteredData : []));

    if (!isStd && (!dataList || dataList.length === 0)) {
        if (window.KokpitState?.studioActiveData && window.KokpitState.studioActiveData.length > 0) {
            dataList = window.KokpitState.studioActiveData;
        } else if (typeof studioActiveData !== 'undefined' && studioActiveData && studioActiveData.length > 0) {
            dataList = studioActiveData;
        }
    }

    const pageSize = isStd 
        ? (typeof stdPageSize !== 'undefined' ? stdPageSize : 100) 
        : (typeof studioPageSize !== 'undefined' ? studioPageSize : 100);
    const currentPage = isStd 
        ? (typeof stdCurrentPage !== 'undefined' ? stdCurrentPage : 1) 
        : (typeof studioCurrentPage !== 'undefined' ? studioCurrentPage : 1);

    const tableHeader = document.getElementById(isStd ? 'tableHeader' : 'studioTableHeader');
    const tableBody = document.getElementById(isStd ? 'tableBody' : 'studioTableBody');
    if (!tableHeader || !tableBody) return;
    const pageInfoText = document.getElementById(isStd ? 'stdPageInfoText' : 'studioPageInfoText');
    const currentPageBadge = document.getElementById(isStd ? 'stdCurrentPageBadge' : 'studioCurrentPageBadge');

    const btnFirst = document.getElementById(isStd ? 'btnStdFirst' : 'btnStudioFirst');
    const btnPrev = document.getElementById(isStd ? 'btnStdPrev' : 'btnStudioPrev');
    const btnNext = document.getElementById(isStd ? 'btnStdNext' : 'btnStudioNext');
    const btnLast = document.getElementById(isStd ? 'btnStdLast' : 'btnStudioLast');

    const totalRows = dataList.length;
    if (totalRows === 0) {
        tableHeader.innerHTML = '<tr><th>Bilgi</th></tr>';
        tableBody.innerHTML = '<tr><td style="text-align:center; padding:30px; color:#d1fae5;">Kayıt bulunamadı.</td></tr>';
        if (pageInfoText) pageInfoText.innerText = '0 - 0 / Toplam 0 Kayıt';
        if (currentPageBadge) currentPageBadge.innerText = 'Sayfa 1 / 1';
        if (btnFirst) btnFirst.disabled = true;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        if (btnLast) btnLast.disabled = true;
        return;
    }

    const totalPages = pageSize === Infinity ? 1 : Math.ceil(totalRows / pageSize);
    const validPage = Math.max(1, Math.min(currentPage, totalPages));
    if (isStd) stdCurrentPage = validPage;
    else studioCurrentPage = validPage;

    const startIdx = pageSize === Infinity ? 0 : (validPage - 1) * pageSize;
    const endIdx = pageSize === Infinity ? totalRows : Math.min(startIdx + pageSize, totalRows);

    const isMutabakat = isStd && ((window.KokpitState?.currentModule || currentModule) === 'mutabakat');
    if (!isMutabakat && dataList && dataList.length > 0) {
        checkAndInjectBranchTotals(dataList);
    }
    const allColumns = Object.keys(dataList[0]);

    // 🔍 Kategori Kolonunu Tespit Et (Kategori, Ürün Grubu, Grup vb.)
    const catColName = allColumns.find(c => {
        const norm = normalizeTextTr(c);
        return norm === 'kategori' || norm === 'urun grubu' || norm === 'grup' || norm === 'kategori adi';
    });

    let hasCategoryGrouping = false;
    if (isMutabakat) {
        hasCategoryGrouping = true;
    } else if (catColName && dataList && dataList.length > 0) {
        const distinctCats = new Set(dataList.map(r => (r[catColName] && r[catColName] !== 'None') ? String(r[catColName]).trim() : 'DİĞER'));
        if (distinctCats.size >= 1 && distinctCats.size <= 15) {
            hasCategoryGrouping = true;
        }
    }

    const effectiveCatCol = hasCategoryGrouping ? (catColName || 'Kategori') : null;
    const rawColumns = hasCategoryGrouping ? allColumns.filter(c => c !== effectiveCatCol) : allColumns;

    // 🎛️ Sütun Gizleme / Gösterme Filtresi
    const curMod = isStd ? (window.KokpitState?.currentModule || (typeof currentModule !== 'undefined' ? currentModule : 'genel')) : 'ai_studio';
    const hiddenCols = getHiddenColumns(curMod);
    if (isStd) {
        updateColumnPickerUI(rawColumns, curMod);
    }
    const visibleCols = rawColumns.filter(c => !hiddenCols.includes(c));
    const columns = visibleCols.length > 0 ? visibleCols : rawColumns;

    const pageRows = dataList.slice(startIdx, endIdx);

    // 📊 Sütun Maksimum Değerlerini Hesapla (Görsel Veri Çubukları İçin)
    const colMaxValues = {};
    for (const col of columns) {
        const norm = normalizeTextTr(col);
        const isQtyCol = /(miktar|adet|kalan|mevcut|giris|cikis|stok|toplam)/i.test(norm) && 
                         !norm.includes('fiyat') && !norm.includes('tutar') && !norm.includes('ciro') && !norm.includes('tl') && !norm.includes('hata');
        if (isQtyCol) {
            let maxV = 0;
            for (const r of pageRows) {
                let v = r[col];
                if (typeof v === 'string') v = parseFloat(v.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                if (typeof v === 'number' && !isNaN(v) && v > maxV) maxV = v;
            }
            if (maxV > 0) colMaxValues[col] = maxV;
        }
    }

    const activeSortCol = isStd ? stdSortColumn : studioSortColumn;
    const activeSortDir = isStd ? stdSortDirection : studioSortDirection;

    tableHeader.innerHTML = '<tr>' + columns.map(c => {
        let icon = '<span style="opacity:0.35; font-size:10px; margin-left:4px;">⇅</span>';
        let bgStyle = '';
        if (c === activeSortCol) {
            icon = `<span style="color:#4ade80; font-size:11px; margin-left:4px;">${activeSortDir === 'asc' ? '▲' : '▼'}</span>`;
            bgStyle = 'background: rgba(44, 190, 86, 0.18);';
        }
        return `<th onclick="handleTableSort('${c}', '${viewType}')" style="cursor:pointer; user-select:none; ${bgStyle}" title="'${c}' sütununa göre sırala">${c}${icon}</th>`;
    }).join('') + '</tr>';

    let tbodyHtml = '';

    if (hasCategoryGrouping) {
        // Kategori başlıkları ve alt toplamlar
        const categoryGroups = [];
        let currentCatName = null;
        let currentGroup = null;

        for (const r of pageRows) {
            const rawCat = r[effectiveCatCol];
            const cat = (rawCat && rawCat !== 'None') ? String(rawCat).trim() : 'DİĞER';
            if (cat !== currentCatName) {
                currentCatName = cat;
                currentGroup = { name: cat, rows: [] };
                categoryGroups.push(currentGroup);
            }
            currentGroup.rows.push(r);
        }

        // Subtotal ve Grand total için label colspan hesapla
        let labelColspan = 1;
        if (columns.length > 2 && isNonSummableColumn(columns[0]) && isNonSummableColumn(columns[1])) {
            const col1Norm = normalizeTextTr(columns[1]);
            if (col1Norm.includes('birim') || col1Norm.includes('tip') || col1Norm.includes('koli')) {
                labelColspan = 1;
            } else {
                labelColspan = 2;
            }
        }

        categoryGroups.forEach((group, catIdx) => {
            // A) Kategori Başlık Satırı (Section Header Banner - Tıklanabilir ve Katlanabilir)
            tbodyHtml += `
            <tr class="table-cat-header-row" onclick="toggleMutabakatCat(${catIdx})" style="cursor: pointer; user-select: none; background: linear-gradient(90deg, #132a22 0%, #0d1f18 100%); border-top: 2px solid #2cbe56; border-bottom: 1px solid rgba(44, 190, 86, 0.4);" title="Bu kategorideki ürünleri gizlemek/göstermek için tıklayın">
                <td colspan="${columns.length}" style="padding: 10px 14px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span id="catIcon_${catIdx}" style="font-size: 12px; color: #4ade80;">▼</span>
                            <span style="font-size: 16px;">📁</span>
                            <strong style="color: #4ade80; font-size: 13.5px; letter-spacing: 0.5px;">${group.name.toUpperCase()}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #94a3b8; font-size: 11px; font-weight: 500;">(Grup Alt Toplamları Aşağıdadır ⬇️)</span>
                            <span class="badge badge-green" style="font-size: 11px; padding: 2px 10px; font-weight: 700;">
                                ${group.rows.length} Kalem Ürün
                            </span>
                        </div>
                    </div>
                </td>
            </tr>
            `;

            // B) Kategoriye Ait Ürün Satırları
            for (const r of group.rows) {
                tbodyHtml += `<tr class="cat-row-${catIdx}">`;
                for (const col of columns) {
                    const formatted = formatCellContent(r[col], col, colMaxValues);
                    tbodyHtml += `<td>${formatted}</td>`;
                }
                tbodyHtml += '</tr>';
            }

            // C) Kategori Altı Sütun Toplamları (Subtotal Row)
            const catSums = {};
            for (const col of columns) {
                if (isNonSummableColumn(col)) continue;
                let sum = 0;
                let hasNum = false;
                for (const cr of group.rows) {
                    let v = cr[col];
                    if (typeof v === 'string') {
                        v = parseFloat(v.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                    }
                    if (typeof v === 'number' && !isNaN(v)) {
                        sum += v;
                        hasNum = true;
                    }
                }
                if (hasNum) {
                    catSums[col] = Math.round(sum * 100) / 100;
                }
            }

            tbodyHtml += `<tr class="table-cat-subtotal-row" id="catSubtotal_${catIdx}" style="background: rgba(13, 31, 24, 0.95); border-top: 1.5px dashed rgba(44, 190, 86, 0.5); border-bottom: 2px solid rgba(44, 190, 86, 0.8); font-weight: 700;">`;
            tbodyHtml += `<td colspan="${labelColspan}" style="color: #2dd4bf; font-weight: 800; font-size: 12px; padding-left: 14px;">
                📊 ${group.name.toUpperCase()} TOPLAMI 
                <span style="color: #94a3b8; font-size: 11px; font-weight: 500; margin-left: 6px;">(${group.rows.length} Kalem)</span>
            </td>`;

            for (let i = labelColspan; i < columns.length; i++) {
                const col = columns[i];
                const colLower = col.toLowerCase();
                if (col === 'Birim' || colLower.includes('koli / küvet tipi') || colLower.includes('koli tipi')) {
                    tbodyHtml += `<td style="color: #64748b; text-align: center;">-</td>`;
                } else if (col === 'Önceki Sayım') {
                    const val = catSums['Önceki Sayım'] || 0;
                    tbodyHtml += `<td><strong style="color:#d1fae5;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                } else if (col === 'Şubeye Gelenler' || col === 'Toplam Giriş') {
                    const val = catSums[col] || 0;
                    tbodyHtml += `<td><strong style="color:#4ade80;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                } else if (col === 'Şubeden Çıkan' || col === 'Toplam Çıkış') {
                    const val = catSums[col] || 0;
                    tbodyHtml += `<td><strong style="color:#fb923c;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                } else if (col === 'İade') {
                    const val = catSums['İade'] || 0;
                    tbodyHtml += `<td>${val > 0 ? `<span style="color:#f87171; font-weight:700;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>` : `<span style="color:#94a3b8;">0</span>`}</td>`;
                } else if (col === 'Güncel Sayım') {
                    const val = catSums['Güncel Sayım'] || 0;
                    tbodyHtml += `<td><strong style="color:#fde047;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                } else if (col === 'Olması Gereken') {
                    const val = catSums['Olması Gereken'] || 0;
                    tbodyHtml += `<td><strong style="color:#38bdf8;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                } else if (col === 'Fark') {
                    const fVal = catSums['Fark'] || 0;
                    let fBadge = fVal < 0
                        ? `<span class="badge badge-red" style="font-weight:700;">${fVal.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>`
                        : (fVal > 0 ? `<span class="badge badge-green" style="font-weight:700;">+${fVal.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>` : `<span style="color:#94a3b8;">0</span>`);
                    tbodyHtml += `<td>${fBadge}</td>`;
                } else if (col === 'Hata %') {
                    const catFark = catSums['Fark'] || 0;
                    const catGiris = catSums['Toplam Giriş'] || catSums['Şubeye Gelenler'] || 0;
                    const catBase = catGiris > 0 ? catGiris : (catSums['Toplam Çıkış'] || Math.abs(catSums['Olması Gereken'] || 0));
                    const catHata = catBase > 0 ? (catFark / catBase) * 100 : 0;
                    let formattedHata = catHata < 0 
                        ? `<span style="color:#f87171; font-weight:700;">%${catHata.toFixed(1)}</span>`
                        : (catHata > 0 ? `<span style="color:#4ade80; font-weight:700;">+%${catHata.toFixed(1)}</span>` : `<span style="color:#94a3b8;">%0</span>`);
                    tbodyHtml += `<td>${formattedHata}</td>`;
                } else if (catSums[col] !== undefined) {
                    const val = catSums[col];
                    if (colLower.includes('ciro') || colLower.includes('tutar') || colLower.includes('değeri') || colLower.includes('fiyat')) {
                        tbodyHtml += `<td><strong style="color:#4ade80;">₺${val.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>`;
                    } else {
                        tbodyHtml += `<td><strong style="color:#fde047;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                    }
                } else {
                    tbodyHtml += `<td>-</td>`;
                }
            }
            tbodyHtml += `</tr>`;
        });

        // D) Genel Toplam Satırı (Grand Total)
        const grandSums = {};
        for (const col of columns) {
            if (isNonSummableColumn(col)) continue;
            let sum = 0;
            let hasNum = false;
            for (const r of dataList) {
                let v = r[col];
                if (typeof v === 'string') {
                    v = parseFloat(v.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim());
                }
                if (typeof v === 'number' && !isNaN(v)) {
                    sum += v;
                    hasNum = true;
                }
            }
            if (hasNum) {
                grandSums[col] = Math.round(sum * 100) / 100;
            }
        }

        tbodyHtml += `<tr class="table-grand-total-row" style="background: linear-gradient(90deg, #16382c 0%, #0e251d 100%) !important; border-top: 3px double #2cbe56 !important; border-bottom: 3px double #2cbe56 !important; font-weight: 800; position: sticky; bottom: 0; z-index: 7;">`;
        tbodyHtml += `<td colspan="${labelColspan}" style="color: #4ade80; font-weight: 800; font-size: 13px; padding-left: 14px; background: #132a22 !important;">
            👑 GENEL TOPLAM 
            <span style="color: #2dd4bf; font-size: 11.5px; font-weight: 500; margin-left: 6px;">(Toplam ${dataList.length} Kalem Ürün)</span>
        </td>`;

        for (let i = labelColspan; i < columns.length; i++) {
            const col = columns[i];
            const colLower = col.toLowerCase();
            if (col === 'Birim' || colLower.includes('koli / küvet tipi') || colLower.includes('koli tipi')) {
                tbodyHtml += `<td style="color: #64748b; text-align: center; background: #132a22 !important;">-</td>`;
            } else if (col === 'Önceki Sayım') {
                const val = grandSums['Önceki Sayım'] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#d1fae5; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
            } else if (col === 'Şubeye Gelenler' || col === 'Toplam Giriş') {
                const val = grandSums[col] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#4ade80; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
            } else if (col === 'Şubeden Çıkan' || col === 'Toplam Çıkış') {
                const val = grandSums[col] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#fb923c; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
            } else if (col === 'İade') {
                const val = grandSums['İade'] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;">${val > 0 ? `<span style="color:#f87171; font-weight:700;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>` : `<span style="color:#94a3b8;">0</span>`}</td>`;
            } else if (col === 'Güncel Sayım') {
                const val = grandSums['Güncel Sayım'] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#fde047; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
            } else if (col === 'Olması Gereken') {
                const val = grandSums['Olması Gereken'] || 0;
                tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#38bdf8; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
            } else if (col === 'Fark') {
                const fVal = grandSums['Fark'] || 0;
                let fBadge = fVal < 0
                    ? `<span class="badge badge-red" style="font-weight:700;">${fVal.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>`
                    : (fVal > 0 ? `<span class="badge badge-green" style="font-weight:700;">+${fVal.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</span>` : `<span style="color:#94a3b8;">0</span>`);
                tbodyHtml += `<td style="background: #132a22 !important;">${fBadge}</td>`;
            } else if (col === 'Hata %') {
                const gFark = grandSums['Fark'] || 0;
                const gGiris = grandSums['Toplam Giriş'] || grandSums['Şubeye Gelenler'] || 0;
                const gBase = gGiris > 0 ? gGiris : (grandSums['Toplam Çıkış'] || Math.abs(grandSums['Olması Gereken'] || 0));
                const gHata = gBase > 0 ? (gFark / gBase) * 100 : 0;
                let formattedHata = gHata < 0 
                    ? `<span style="color:#f87171; font-weight:700;">%${gHata.toFixed(1)}</span>`
                    : (gHata > 0 ? `<span style="color:#4ade80; font-weight:700;">+%${gHata.toFixed(1)}</span>` : `<span style="color:#94a3b8;">%0</span>`);
                tbodyHtml += `<td style="background: #132a22 !important;">${formattedHata}</td>`;
            } else if (grandSums[col] !== undefined) {
                const val = grandSums[col];
                if (colLower.includes('ciro') || colLower.includes('tutar') || colLower.includes('değeri') || colLower.includes('fiyat')) {
                    tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#4ade80; font-size:13px;">₺${val.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>`;
                } else {
                    tbodyHtml += `<td style="background: #132a22 !important;"><strong style="color:#fde047; font-size:13px;">${val.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong></td>`;
                }
            } else {
                tbodyHtml += `<td style="background: #132a22 !important;">-</td>`;
            }
        }
        tbodyHtml += `</tr>`;
    } else {
        // 🌟 2. STANDART DİĞER MODÜLLER (Normal satır satır çizim)
        const hasExistingTotalRow = dataList.some(r => 
            Object.values(r).some(v => typeof v === 'string' && (v.trim().toUpperCase() === 'GENEL TOPLAM' || v.trim().toUpperCase() === 'TOPLAM'))
        );

        for (const r of pageRows) {
            const isRowTotal = Object.values(r).some(v => typeof v === 'string' && (v.trim().toUpperCase() === 'GENEL TOPLAM' || v.trim().toUpperCase() === 'TOPLAM'));
            if (isRowTotal) {
                tbodyHtml += '<tr class="table-grand-total-row" style="background: linear-gradient(90deg, #132f24 0%, #0d2119 100%) !important; border-top: 3px double #2cbe56 !important; border-bottom: 3px double #2cbe56 !important; font-weight: 800; position: sticky; bottom: 0; z-index: 5;">';
            } else {
                tbodyHtml += '<tr>';
            }

            for (const col of columns) {
                const formatted = isRowTotal 
                    ? formatCellContent(r[col], col, {}) 
                    : formatCellContent(r[col], col, colMaxValues);
                
                if (isRowTotal) {
                    tbodyHtml += `<td style="padding: 10px 14px; border-top: 2px solid #2cbe56; border-bottom: 2px solid #2cbe56; background: #132a22; font-weight: 800;">${formatted}</td>`;
                } else {
                    tbodyHtml += `<td>${formatted}</td>`;
                }
            }
            tbodyHtml += '</tr>';
        }

        // 🌟 3. TÜM DİĞER RAPORLAR & AI STUDIO İÇİN OTOMATİK GENEL TOPLAM (DİP TOPLAM) SATIRI
        if (!hasExistingTotalRow && dataList.length > 0) {
            const numericColSet = new Set();
            let borcCol = null;
            let alacakCol = null;
            let bakiyeCol = null;

            for (const col of columns) {
                if (isColumnNumericInDataset(col, dataList)) {
                    numericColSet.add(col);
                }
                const norm = normalizeTextTr(col);
                if (norm.includes('borc')) borcCol = col;
                else if (norm.includes('alacak')) alacakCol = col;
                else if (norm.includes('bakiye')) bakiyeCol = col;
            }

            if (numericColSet.size > 0) {
                const grandSums = {};
                for (const col of numericColSet) {
                    let sum = 0;
                    for (const r of dataList) {
                        let val = r[col];
                        if (typeof val === 'string') {
                            const cleaned = val.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                            val = parseFloat(cleaned);
                        }
                        if (typeof val === 'number' && !isNaN(val)) {
                            sum += val;
                        }
                    }
                    grandSums[col] = Math.round(sum * 100) / 100;
                }

                // Cari Ekstre Özel Kuralı: Bakiye kümülatif toplanmaz! Net Bakiye = Borç - Alacak (veya son satır bakiyesi)
                if (bakiyeCol) {
                    if (borcCol && alacakCol) {
                        const sBorc = grandSums[borcCol] || 0;
                        const sAlacak = grandSums[alacakCol] || 0;
                        grandSums[bakiyeCol] = Math.round((sBorc - sAlacak) * 100) / 100;
                    } else if (dataList.length > 0) {
                        const lastRow = dataList[dataList.length - 1];
                        let lastVal = lastRow[bakiyeCol];
                        if (typeof lastVal === 'string') {
                            const cleaned = lastVal.replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                            lastVal = parseFloat(cleaned);
                        }
                        if (typeof lastVal === 'number' && !isNaN(lastVal)) {
                            grandSums[bakiyeCol] = lastVal;
                        }
                    }
                }

                // İlk sayısal sütunun indeksini bul (colspan için)
                let firstNumIdx = -1;
                for (let i = 0; i < columns.length; i++) {
                    if (numericColSet.has(columns[i])) {
                        firstNumIdx = i;
                        break;
                    }
                }

                tbodyHtml += `<tr class="table-grand-total-row" style="background: linear-gradient(90deg, #132f24 0%, #0d2119 100%) !important; border-top: 3px double #2cbe56 !important; border-bottom: 3px double #2cbe56 !important; font-weight: 800; position: sticky; bottom: 0; z-index: 5;">`;

                if (firstNumIdx > 0) {
                    tbodyHtml += `
                    <td colspan="${firstNumIdx}" style="color: #4ade80; font-weight: 800; font-size: 13px; padding: 11px 14px; text-align: left; border-top: 2px solid #2cbe56; border-bottom: 2px solid #2cbe56; background: #132a22;">
                        👑 GENEL TOPLAM 
                        <span style="color: #2dd4bf; font-size: 11.5px; font-weight: 500; margin-left: 6px;">(Toplam ${dataList.length.toLocaleString('tr-TR')} Kayıt)</span>
                    </td>`;
                }

                const loopStart = firstNumIdx > 0 ? firstNumIdx : 0;
                for (let i = loopStart; i < columns.length; i++) {
                    const col = columns[i];
                    const colLower = col.toLowerCase();
                    const isBakiye = (col === bakiyeCol);
                    const isCurrency = colLower.includes('ciro') || colLower.includes('tutar') || colLower.includes('değeri') || 
                                       colLower.includes('borc') || colLower.includes('borç') || colLower.includes('alacak') || 
                                       colLower.includes('tl') || colLower.includes('fiyat') || isBakiye;

                    if (numericColSet.has(col)) {
                        const sumVal = grandSums[col] || 0;
                        let formattedVal = '';

                        if (isBakiye) {
                            const absVal = Math.abs(sumVal);
                            const suffix = sumVal > 0 ? ' (Borçlu)' : (sumVal < 0 ? ' (Alacaklı)' : '');
                            const color = sumVal > 0 ? '#4ade80' : (sumVal < 0 ? '#f87171' : '#94a3b8');
                            formattedVal = `<strong style="color:${color}; font-size:13px;" title="Net Bakiye: Toplam Borç - Toplam Alacak">₺${absVal.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}${suffix}</strong>`;
                        } else if (isCurrency) {
                            formattedVal = `<strong style="color:#4ade80; font-size:13px;">₺${sumVal.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>`;
                        } else if (colLower.includes('hata') || colLower.includes('%')) {
                            formattedVal = `<strong style="color:#38bdf8; font-size:13px;">%${sumVal.toFixed(1)}</strong>`;
                        } else {
                            formattedVal = `<strong style="color:#fde047; font-size:13px;">${sumVal.toLocaleString('tr-TR', {maximumFractionDigits: 2})}</strong>`;
                        }

                        tbodyHtml += `<td style="padding: 11px 14px; border-top: 2px solid #2cbe56; border-bottom: 2px solid #2cbe56; background: #132a22;">${formattedVal}</td>`;
                    } else {
                        // Sayısal olmayan ama sayısal kolonların arasına gelen kolonlar (örn: Birim)
                        tbodyHtml += `<td style="color: #64748b; text-align: center; padding: 11px 14px; border-top: 2px solid #2cbe56; border-bottom: 2px solid #2cbe56; background: #132a22;">-</td>`;
                    }
                }
                tbodyHtml += `</tr>`;
            }
        }
    }
    tableBody.innerHTML = tbodyHtml;

    if (pageInfoText) {
        pageInfoText.innerText = `${(startIdx + 1).toLocaleString('tr-TR')} - ${endIdx.toLocaleString('tr-TR')} / Toplam ${totalRows.toLocaleString('tr-TR')} Kayıt`;
    }
    if (currentPageBadge) {
        currentPageBadge.innerText = `Sayfa ${validPage} / ${totalPages}`;
    }

    if (btnFirst) btnFirst.disabled = validPage === 1;
    if (btnPrev) btnPrev.disabled = validPage === 1;
    if (btnNext) btnNext.disabled = validPage === totalPages;
    if (btnLast) btnLast.disabled = validPage === totalPages;
}

function filterData(keyword, viewType = 'std') {
    const isStd = viewType === 'std';
    if (isStd && ((window.KokpitState?.currentModule || currentModule) === 'mutabakat') && window.MutabakatModule) {
        window.MutabakatModule.applyCategoryFilter();
        return;
    }

    const sourceList = isStd 
        ? (window.KokpitState.activeData || activeData || []) 
        : (window.KokpitState.studioActiveData || studioActiveData || []);

    if (!keyword) {
        if (isStd) {
            filteredData = [...sourceList];
            window.KokpitState.filteredData = [...sourceList];
        } else {
            studioFilteredData = [...sourceList];
            window.KokpitState.studioFilteredData = [...sourceList];
        }
    } else {
        const normalizedKeyword = normalizeTextTr(keyword);
        const res = sourceList.filter(row => {
            return Object.values(row).some(v => normalizeTextTr(v).includes(normalizedKeyword));
        });
        if (isStd) {
            filteredData = res;
            window.KokpitState.filteredData = res;
        } else {
            studioFilteredData = res;
            window.KokpitState.studioFilteredData = res;
        }
    }
    
    if (isStd) stdCurrentPage = 1;
    else studioCurrentPage = 1;

    renderPagedTable(viewType);
}

// ↕️ Mutabakat Kategori Açma / Daraltma Fonksiyonları
window.toggleMutabakatCat = function(idx) {
    const rows = document.querySelectorAll(`.cat-row-${idx}`);
    const icon = document.getElementById(`catIcon_${idx}`);
    if (!rows || rows.length === 0) return;
    const isHidden = rows[0].style.display === 'none';
    rows.forEach(r => r.style.display = isHidden ? '' : 'none');
    if (icon) icon.innerText = isHidden ? '▼' : '▶';
};

window.toggleAllMutabakatCategories = function(expand) {
    const rows = document.querySelectorAll('tr[class*="cat-row-"]');
    rows.forEach(r => r.style.display = expand ? '' : 'none');
    document.querySelectorAll('[id^="catIcon_"]').forEach(icon => {
        icon.innerText = expand ? '▼' : '▶';
    });
};
