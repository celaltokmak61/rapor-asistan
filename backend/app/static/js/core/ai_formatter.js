/**
 * ==========================================================================
 * AI yanıt formatlayıcı
 * ==========================================================================
 * Yapay zeka cevaplarını ve önerilerini zenginleştiren, renkli kartlar,
 * KPI hapları, risk/eylem kutuları ve ikonlarla görselleştiren motor.
 */

const AIFormatter = {
    /**
     * Ham yapay zeka metnini zengin, renkli ve interaktif HTML'e dönüştürür.
     */
    format(rawText, metadata = {}) {
        if (!rawText) return '';

        let text = String(rawText).trim();

        // 0. Veritabanı Tablo İsimlerini Temizle (Kullanıcıya Asla Gösterme)
        text = this._sanitizeTableNames(text);

        // 1. Markdown Başlık ve Kalın Yazıları Temizle & Zenginleştir
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="ai-highlight-bold">$1</strong>');
        text = text.replace(/`([^`]+)`/g, '<code class="ai-code-pill">$1</code>');

        // 2. Ana Başlık Bölümlerini Renkli Kartlara Dönüştür
        // A) 📊 Yönetici Özeti
        text = text.replace(/(?:^|\n)(?:###|\*\*|•)?\s*(?:📊|📈)?\s*(?:Yönetici Özeti|Genel Özet|Özet)(?:\*\*|:)?\s*([\s\S]*?)(?=(?:\n(?:###|\*\*|•)?\s*(?:⚠️|🚨|💡|🎯|📌|Kritik|Risk|Stratejik|Aksiyon|Tavsiye))|$)/gi, (match, content) => {
            const cleanContent = content.trim();
            if (!cleanContent) return '';
            return `
                <div class="ai-card ai-card-summary">
                    <div class="ai-card-header">
                        <span class="ai-badge-icon badge-blue">📊 YÖNETİCİ ÖZETİ</span>
                    </div>
                    <div class="ai-card-body">${this._formatListAndPills(cleanContent)}</div>
                </div>
            `;
        });

        // B) ⚠️ Kritik Bulgular & Riskler
        text = text.replace(/(?:^|\n)(?:###|\*\*|•)?\s*(?:⚠️|🚨)?\s*(?:Kritik Bulgular(?:\s*&\s*Riskler)?|Riskler|Uyarılar|Tespitler)(?:\*\*|:)?\s*([\s\S]*?)(?=(?:\n(?:###|\*\*|•)?\s*(?:💡|🎯|📌|Stratejik|Aksiyon|Tavsiye|Öneri))|$)/gi, (match, content) => {
            const cleanContent = content.trim();
            if (!cleanContent) return '';
            return `
                <div class="ai-card ai-card-warning">
                    <div class="ai-card-header">
                        <span class="ai-badge-icon badge-amber">⚠️ KRİTİK BULGULAR & RİSKLER</span>
                    </div>
                    <div class="ai-card-body">${this._formatListAndPills(cleanContent)}</div>
                </div>
            `;
        });

        // C) 💡 Stratejik Aksiyon & Tavsiyeler
        text = text.replace(/(?:^|\n)(?:###|\*\*|•)?\s*(?:💡|🎯)?\s*(?:Stratejik Aksiyon(?:\s*&\s*Tavsiye(?:ler)?)?|Aksiyon(?:lar)?|Tavsiyeler|Öneriler|Eylem Planı)(?:\*\*|:)?\s*([\s\S]*?)(?=(?:\n(?:###|\*\*|•)?\s*(?:📌|ℹ️|Notlar))|$)/gi, (match, content) => {
            const cleanContent = content.trim();
            if (!cleanContent) return '';
            return `
                <div class="ai-card ai-card-action">
                    <div class="ai-card-header">
                        <span class="ai-badge-icon badge-green">💡 STRATEJİK EYLEM PLANI & TAVSİYELER</span>
                    </div>
                    <div class="ai-card-body">${this._formatListAndPills(cleanContent)}</div>
                </div>
            `;
        });

        // D) 📌 Notlar & Özel Bilgiler
        text = text.replace(/(?:^|\n)(?:###|\*\*|•)?\s*(?:📌|ℹ️)?\s*(?:Notlar|Bilgi|Hatırlatma)(?:\*\*|:)?\s*([\s\S]*?)$/gi, (match, content) => {
            const cleanContent = content.trim();
            if (!cleanContent) return '';
            return `
                <div class="ai-card ai-card-info">
                    <div class="ai-card-header">
                        <span class="ai-badge-icon badge-purple">📌 STRATEJİK NOTLAR & REHBER</span>
                    </div>
                    <div class="ai-card-body">${this._formatListAndPills(cleanContent)}</div>
                </div>
            `;
        });

        // Kartlara ayrılmamış dış metinler için liste ve hap formatlama
        text = this._formatListAndPills(text);

        // Satır sonları ve boşluk düzenleme
        text = text.replace(/\n{2,}/g, '<div class="ai-paragraph-spacer"></div>');
        text = text.replace(/\n/g, '<br>');

        return text;
    },

    /**
     * Metin içindeki sayı, para, yüzde, küvet/koli miktarlarını ve madde imlerini renklendirir.
     */
    _formatListAndPills(str) {
        if (!str) return '';

        let res = str;

        // 1. Madde İmleri ve Numaralı Adımlar
        // 1. 2. 3. veya 1) Adımları
        res = res.replace(/^(?:[0-9]+[.)]|[\d]+[-])\s*(.*)$/gm, '<div class="ai-step-item"><span class="ai-step-dot">⚡</span><span>$1</span></div>');
        // • veya - Madde İmleri
        res = res.replace(/^(?:[-*•])\s*(.*)$/gm, '<div class="ai-bullet-item"><span class="ai-bullet-icon">🔹</span><span>$1</span></div>');

        // 2. Para Birimleri (TL, ₺, USD, EUR) -> Altın/Yeşil Rozet (Çift ikon oluşumunu önle)
        res = res.replace(/(?:💰\s*)?(\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*(?:TL|₺|EUR|\$|USD)\b)/gi, '<span class="ai-pill ai-pill-money">💰 $1</span>');

        // 3. Yüzdeler (%55, %40.5 vb.) -> Mavi/Teal Rozet
        res = res.replace(/(?:📈\s*|📉\s*)?(%\s*\d+(?:[\.,]\d+)?)/g, '<span class="ai-pill ai-pill-pct">📈 $1</span>');

        // 4. Koli ve Küvet Miktarları (Örn: 89 Küvet, 24'lü Koli, 16'lı Koli, 150 Adet) -> Turkuaz Rozet
        res = res.replace(/(?:📦\s*)?(\b\d+(?:[\.,]\d+)?\s*(?:Küvet|Kuvet|Koli|Adet|KG|Porsiyon|Tepsi)\b)/gi, '<span class="ai-pill ai-pill-qty">📦 $1</span>');

        // 5. Kritik İş Terimleri Vurgusu (Çift emoji oluşumunu önle)
        res = res.replace(/(?:🚨\s*|⚠️\s*)?\b(Eksi Stok|Kayıp|Zarar|Fire Oranı|Yüksek Fire|Düşük Kâr|Kritik Sapma)\b/gi, '<span class="ai-tag tag-neg">🚨 $1</span>');
        res = res.replace(/(?:✨\s*|⭐\s*)?\b(Taze Üretim|Sıfır İsraf|Yüksek Kâr|Hedef Üstü|Başarılı|Maksimum Verim)\b/gi, '<span class="ai-tag tag-pos">✨ $1</span>');

        return res;
    },

    /**
     * Veritabanı teknik tablo isimlerini kullanıcı dostu iş terimlerine dönüştürür.
     */
    _sanitizeTableNames(text) {
        if (!text) return '';
        return text
            .replace(/F\d{4}(?:D\d{4})?TBLDEVGIRHAREKET(?:BASLIK)?/gi, 'İmalathane Üretim Kayıtları')
            .replace(/F\d{4}(?:D\d{4})?TBLDEVGIRBASLIK/gi, 'İmalathane Üretim Fişleri')
            .replace(/F\d{4}(?:D\d{4})?TBLSATFATHAREKET/gi, 'Satış Fatura Hareketleri')
            .replace(/F\d{4}(?:D\d{4})?TBLSATFATBASLIK/gi, 'Satış Faturaları')
            .replace(/F\d{4}(?:D\d{4})?TBLSATIRSHAREKET/gi, 'Satış İrsaliye Hareketleri')
            .replace(/F\d{4}(?:D\d{4})?TBLSATIRSBASLIK/gi, 'Satış İrsaliyeleri')
            .replace(/F\d{4}(?:D\d{4})?TBLDEPOENVANTER/gi, 'Depo Stok Varlığı')
            .replace(/F\d{4}(?:D\d{4})?TBLALSIPHAREKET/gi, 'Şube Sipariş Kayıtları')
            .replace(/F\d{4}TBLSTOKLAR/gi, 'Stok Kartları')
            .replace(/F\d{4}TBLCARI/gi, 'Cari Müşteri Kartları')
            .replace(/F\d{4}TBLDEPOLAR/gi, 'Depo Tanımları')
            .replace(/TBLSAYIMDOSYALARI/gi, 'Fiziki Sayım Dosyaları')
            .replace(/TBLBIRIMLEREX/gi, 'Ölçü Birimleri')
            .replace(/TBL\w+/gi, 'Sistem Veri Kayıtları');
    }
};

window.AIFormatter = AIFormatter;
