// ==========================================================================
// Yardımcı araçlar
// ==========================================================================

function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
        el.innerHTML = `
            <tr>
                <td colspan="15" style="text-align: center; padding: 40px; color: #4ade80;">
                    <div style="font-size: 24px; animation: spin 1s linear infinite; display: inline-block;">⚙️</div>
                    <div style="margin-top: 10px; font-weight: 700;">Canlı Veriler Çekiliyor...</div>
                </td>
            </tr>
        `;
    }
}

function floatVal(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const clean = String(v).replace(/₺/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

function formatCompactNumberTR(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toLocaleString('tr-TR');
}

function toTitleCaseTR(str) {
    if (!str) return '';
    return str.split(' ').map(w => {
        if (!w) return '';
        const first = w.charAt(0).toLocaleUpperCase('tr-TR');
        const rest = w.slice(1).toLocaleLowerCase('tr-TR');
        return first + rest;
    }).join(' ');
}

// 🌟 RENKLİ, PROFESYONEL VE GERÇEK EXCEL (.XLSX) İNDİRME MOTORU
let isExportingExcel = false;

async function exportTableToExcel(customFilename = null) {
    if (isExportingExcel) {
        console.warn('Excel dışa aktarma işlemi zaten devam ediyor...');
        return;
    }

    const activeMod = window.KokpitState?.currentModule || (typeof currentModule !== 'undefined' ? currentModule : 'genel');
    const aiViewEl = document.getElementById('aiStudioView');
    const isAiViewOpen = aiViewEl && (window.getComputedStyle(aiViewEl).display !== 'none');
    const isStudio = (activeMod === 'ai_studio') || isAiViewOpen;

    let targetData = [];
    if (isStudio) {
        targetData = (window.KokpitState?.studioFilteredData && window.KokpitState.studioFilteredData.length > 0)
            ? window.KokpitState.studioFilteredData
            : ((typeof studioFilteredData !== 'undefined' && studioFilteredData.length > 0)
                ? studioFilteredData
                : (window.studioFilteredData || window.KokpitState?.studioActiveData || []));
    } else {
        targetData = window.KokpitState?.filteredData || (typeof filteredData !== 'undefined' ? filteredData : []) || window.KokpitState?.activeData || [];
    }

    if (!targetData || targetData.length === 0) {
        alert('İndirilecek veri bulunamadı. Lütfen önce bir rapor oluşturun veya filtreleri kontrol edin.');
        return;
    }

    isExportingExcel = true;

    let reportTitle = (window.KokpitConfig?.appName || 'Rapor Asistan') + ' Raporu';
    let reportSub = 'Canlı Veritabanı Verisi';

    if (isStudio) {
        reportTitle = window.KokpitState?.currentAiReportTitle || window.currentAiReportTitle || document.getElementById('studioReportTitle')?.innerText || 'AI Özel Rapor Çıktısı';
        reportSub = document.getElementById('studioReportSubtitle')?.innerText || 'AI Doğal Dil Analiz Çıktısı';
    } else {
        const titleEl = document.getElementById('tableReportTitle') || document.getElementById('standardReportTitle');
        const subEl = document.getElementById('tableReportSubtitle') || document.getElementById('standardReportSubtitle');
        if (titleEl) reportTitle = titleEl.innerText;
        if (subEl) reportSub = subEl.innerText;

        const activeModule = window.KokpitState?.currentModule || currentModule;
        if (activeModule === 'mutabakat' && window.MutabakatModule?.selectedCategories && window.MutabakatModule.allCategories?.length > 0) {
            const selCount = window.MutabakatModule.selectedCategories.size;
            const totalCount = window.MutabakatModule.allCategories.length;
            if (selCount < totalCount) {
                const preview = Array.from(window.MutabakatModule.selectedCategories).slice(0, 3).join(', ');
                const more = selCount > 3 ? ` ve ${selCount - 3} diğer` : '';
                reportSub += `  •  Seçili Kategoriler (${selCount}/${totalCount}): ${preview}${more}`;
            }
        }
    }

    const btns = [
        document.getElementById('btnExcelExport'),
        document.getElementById('mobileExcelBtn'),
        document.getElementById('btnStudioExcelExport')
    ];
    btns.forEach(b => {
        if (b) {
            b.disabled = true;
            b.innerText = '⏳ Hazırlanıyor...';
        }
    });

    try {
        const payloadModule = isStudio ? 'ai_studio' : (window.KokpitState?.currentModule || currentModule);
        const response = await fetch('/api/v1/export/excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                module: payloadModule,
                view: (payloadModule === 'mutabakat') ? (window.MutabakatModule?.currentView || 'ozet') : null,
                title: reportTitle,
                subtitle: reportSub,
                data: targetData
            })
        });

        if (!response.ok) {
            let detail = 'Excel üretilirken sunucu hatası oluştu.';
            try {
                const errJson = await response.json();
                if (errJson?.detail) detail = errJson.detail;
            } catch (_) {}
            throw new Error(detail);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Windows MAX_PATH uyumlu güvenli ve kısa dosya adı oluştur
        let cleanName = (customFilename || reportTitle || 'Rapor')
            .replace(/[\/\\:*?"<>|()\[\],;`'!@#$%^&+=]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .trim();
        if (cleanName.length > 35) {
            cleanName = cleanName.substring(0, 35).replace(/_$/, '');
        }
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const safeDownloadName = `${cleanName || 'Rapor'}_${dateStr}.xlsx`;
        
        a.download = safeDownloadName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 1000);

        if (typeof showToast === 'function') {
            showToast(`✅ ${safeDownloadName} başarıyla indirildi!`, 'success');
        }

    } catch (err) {
        console.error('Excel indirme hatası:', err);
        alert('Excel indirilirken hata oluştu: ' + err.message);
    } finally {
        isExportingExcel = false;
        btns.forEach(b => {
            if (b) {
                b.disabled = false;
                if (b.id === 'btnStudioExcelExport') {
                    const count = targetData ? targetData.length : 0;
                    b.innerHTML = `<span>📥</span> <span id="btnStudioExcelExportText">Excel'e Aktar${count > 0 ? ` (${count})` : ''}</span>`;
                } else {
                    b.innerHTML = `<span>📥</span> <span>Excel İndir</span>`;
                }
            }
        });
    }
}
window.exportTableToCSV = exportTableToExcel;

// --- ⚡ DEBOUNCE FONKSİYONU ---
function debounce(fn, wait = 150) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}
window.debounce = debounce;

// --- 🍞 MODERN BİLDİRİM (TOAST) GÖSTERİCİ ---
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('kokpitToastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'kokpitToastContainer';
        toastContainer.style.cssText = 'position:fixed; top:20px; right:20px; z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none;';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const bg = isSuccess ? 'rgba(13, 31, 24, 0.95)' : 'rgba(40, 10, 10, 0.95)';
    const border = isSuccess ? '1.5px solid #2cbe56' : '1.5px solid #ef4444';
    const color = isSuccess ? '#4ade80' : '#f87171';
    const icon = isSuccess ? '⚡' : '⚠️';

    toast.style.cssText = `background:${bg}; border:${border}; color:#ffffff; padding:10px 16px; border-radius:10px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px; box-shadow:0 10px 30px rgba(0,0,0,0.6); backdrop-filter:blur(10px); transition:all 0.3s ease; transform:translateY(-10px); opacity:0; pointer-events:auto;`;
    toast.innerHTML = `<span style="font-size:15px;">${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    });

    setTimeout(() => {
        toast.style.transform = 'translateY(-10px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}
window.showToast = showToast;
