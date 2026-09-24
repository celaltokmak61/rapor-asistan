import logging
import json
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.engine.gemini_client import gemini_client
from app.engine.groq_client import groq_client
from app.engine.ollama_client import ollama_client
from app.db.knowledge_db import knowledge_db

logger = logging.getLogger(__name__)

class UnifiedLLMClient:
    """Gemini Havuzu (5 Model) -> Groq Havuzu (4 Model) -> Ollama Yerel geçişli kesintisiz LLM motoru."""

    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.last_successful_model = "Google Gemini"

    @property
    def current_model(self) -> str:
        return self.last_successful_model

    async def is_available(self) -> bool:
        if self.provider == "gemini":
            return await gemini_client.is_available()
        elif self.provider == "groq":
            return await groq_client.is_available()
        else:
            return await ollama_client.is_available()

    async def chat(self, messages: List[Dict[str, str]], format_json: bool = True) -> Dict[str, Any]:
        # 1. Aşama: Google Gemini Havuzu
        if self.provider == "gemini":
            res = await gemini_client.chat(messages=messages, format_json=format_json)
            if res.get("success"):
                self.last_successful_model = res.get("model", "Google Gemini")
                return res
            logger.warning(f"[UYARI] Gemini havuzundaki tüm modeller tükendi, Groq havuzuna geçiliyor...")

        # 2. Aşama: Groq LPU Havuzu
        if self.provider in ["gemini", "groq"]:
            groq_res = await groq_client.chat(messages=messages, format_json=format_json)
            if groq_res.get("success"):
                self.last_successful_model = groq_res.get("model", "Groq LPU")
                return groq_res
            logger.warning(f"[UYARI] Groq havuzundaki modeller de tükendi, yerel Ollama'ya geçiliyor...")

        # 3. Aşama / Nihai Çevrimdışı Kalkan: Yerel Ollama
        ollama_res = await ollama_client.chat(messages=messages, format_json=format_json)
        self.last_successful_model = f"Ollama ({settings.LLM_MODEL}) 🖥️"
        return ollama_res

    async def analyze_data_strategically(
        self,
        user_query: str,
        report_title: str,
        data_rows: List[Dict[str, Any]],
        session_history: List[Dict[str, Any]] = None,
        active_firm: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        🌟 2. KADEME STRATEJİK YÖNETİCİ DANIŞMANI:
        Canlı MSSQL verisini, şirket değerlerini, kâr/fire kurallarını ve teşhis rehberlerini
        harmanlayarak yöneticiye derinlemesine teşhis, risk analizi ve somut aksiyon tavsiyesi üretir.
        """
        try:
            # 1. Kurumsal Bilgileri Çek
            corp_values = knowledge_db.get_active_corporate_values()
            rules = knowledge_db.get_active_business_rules()
            playbooks = knowledge_db.get_active_diagnostic_playbooks()

            values_text = "\n".join([f"- ⭐ {v['title']}: {v['description']}" for v in corp_values]) or "Dürüst raporlama, şeffaf stok, sürdürülebilir kârlılık."
            rules_text = "\n".join([
                f"- ⚖️ [{r['category']}] {r['rule_name']}: {r['rule_text']} (Min Kâr: %{r.get('min_margin_pct') or '-'}, Fire Tol: %{r.get('max_loss_pct') or '-'}, Önlem: {r.get('action_recommendation') or '-'})" 
                for r in rules
            ]) or "Öğretilmiş iş kuralları yoksa yalnızca canlı veriyi yorumla; uydurma eşik kullanma."
            
            pb_text = "\n".join([
                f"- 🔍 [{pb['anomaly_type']}] {pb['title']}: {pb['root_cause_guide']} | Aksiyon: {pb['action_template']}"
                for pb in playbooks
            ]) or "Anomali tespitinde önce hareket gecikmesi, transfer ve sayım farklarını incele."

            # Aktif ve dolu satırları önceliklendirerek ilk 15 satırlık özeti hazırla
            active_rows = []
            if data_rows:
                # Toplam veya miktar kolonu 0 olmayanları öne al
                non_zero = [r for r in data_rows if any(isinstance(v, (int, float)) and v != 0 for v in r.values())]
                active_rows = non_zero[:15] if non_zero else data_rows[:15]

            data_str = json.dumps(active_rows, ensure_ascii=False)
            date_ctx_str = f"{end_date} (veya {start_date} - {end_date})" if (start_date or end_date) else "Canlı / Güncel Tarih"

            from app.core.config import settings as app_settings
            from app.packs.loader import get_pack
            pack = get_pack()
            extra_unit_rules = ""
            system_prompt = f"""
Sen {app_settings.APP_NAME} platformunun Baş Operasyon ve Finans Danışmanısın.
Görevin kuru tablo listelemek değil; kurumsal değerler, kârlılık hedefleri ve öğretilmiş iş kuralları çerçevesinde canlı veriyi analiz edip yöneticiye stratejik rehberlik sunmaktır.

🏛️ KURUMSAL DEĞERLER:
{values_text}

⚖️ AKTİF İŞ KURALLARI:
{rules_text}

🔍 TEŞHİS REHBERLERİ:
{pb_text}

ANALİZ KURALLARI:
1. Analize incelenen tarihi belirterek başla (Örn: '**{date_ctx_str}** tarihi itibarıyla...').
2. Rakamları yüzeysel okuma; sapma, eksi stok, maliyet artışı ve riskleri tespit et.
3. Önemli rakamları kalın `**` ve net birimlerle yaz.
4. Çıktını şu 3 bölümle, profesyonel Türkçe ile sun:
   - 📊 **Yönetici Özeti**
   - ⚠️ **Kritik Bulgular & Riskler**
   - 💡 **Stratejik Aksiyon & Tavsiye**
{extra_unit_rules}
⛔ Kullanıcıya dönen metinde ham tablo / kolon adları geçmesin; iş dili kullan.
"""

            messages = [{"role": "system", "content": system_prompt}]

            # Oturum geçmişi varsa kompakt ekle
            if session_history:
                for h in session_history[-3:]:
                    cnt = str(h.get("content") or "")
                    messages.append({"role": h.get("role", "user"), "content": cnt[:400]})

            user_prompt = f"""
Kullanıcı Sorusu: "{user_query}"
Üretilen Rapor: "{report_title}"
Analiz Edilen Tarih / Dönem: {date_ctx_str}
Toplam Satır Sayısı: {len(data_rows)}
Canlı Veri Özeti (Öncelikli Satırlar):
{data_str}

Lütfen bu veriyi kurumsal hafıza ve iş kuralları ışığında, ilgili tarihin gerçek durumunu belirterek analiz et.
"""
            messages.append({"role": "user", "content": user_prompt})

            res = await self.chat(messages=messages, format_json=False)
            if res.get("success"):
                return {
                    "success": True,
                    "insight": res.get("content", "").strip(),
                    "model": res.get("model", self.current_model)
                }
            return {
                "success": False,
                "insight": "Veri başarıyla çekildi. Ancak anlık analiz motoru yoğunluğu nedeniyle derin analiz üretilemedi.",
                "error": res.get("error")
            }
        except Exception as e:
            logger.error(f"Stratejik Analiz Hatası: {e}")
            return {
                "success": False,
                "insight": "Rapor verisi hazırlandı.",
                "error": str(e)
            }

llm_client = UnifiedLLMClient()
