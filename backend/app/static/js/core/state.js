window.KokpitState = {
    currentModule: 'ai_studio',
    currentFirma: 'ALL',
    currentKategori: 'TÜMÜ',
    currentStartDate: '',
    currentEndDate: '',
    lastAiUserQuery: '',
    activeData: [],
    filteredData: [],
    stdCurrentPage: 1,
    stdPageSize: 100,
    isShowingNegativeOnly: false,
    studioActiveData: [],
    studioFilteredData: [],
    studioCurrentPage: 1,
    studioPageSize: 100,
    currentAiReportTitle: 'AI Rapor Çıktısı',
    chartInstance: null,
    studioChartInstance: null
};

let currentModule = window.KokpitState.currentModule;
let currentFirma = window.KokpitState.currentFirma;
let currentKategori = window.KokpitState.currentKategori;
let currentStartDate = window.KokpitState.currentStartDate;
let currentEndDate = window.KokpitState.currentEndDate;
let activeData = window.KokpitState.activeData;
let filteredData = window.KokpitState.filteredData;
let stdCurrentPage = window.KokpitState.stdCurrentPage;
let stdPageSize = window.KokpitState.stdPageSize;
let isShowingNegativeOnly = window.KokpitState.isShowingNegativeOnly;
let studioActiveData = window.KokpitState.studioActiveData;
let studioFilteredData = window.KokpitState.studioFilteredData;
let studioCurrentPage = window.KokpitState.studioCurrentPage;
let studioPageSize = window.KokpitState.studioPageSize;
let chartInstance = null;
let studioChartInstance = null;
