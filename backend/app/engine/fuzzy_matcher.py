import re
import time
from typing import List, Dict, Any, Optional, Tuple
from rapidfuzz import process, fuzz
from app.db.connection import db_manager
from app.db.knowledge_db import knowledge_db

class ProductFuzzyMatcher:
    def __init__(self):
        self._products_cache: List[str] = []
        self._normalized_cache: Dict[str, str] = {} # normalized -> original
        self._last_loaded: float = 0
        self._aliases: Dict[str, str] = {} # alias -> canonical

    def normalize_tr(self, text: str) -> str:
        """Türkçe karakterleri ve noktalama işaretlerini arama standardına dönüştürür."""
        if not text:
            return ""
        text = text.upper()
        tr_map = {
            'Ç': 'C', 'Ğ': 'G', 'I': 'I', 'İ': 'I', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U',
            'ç': 'C', 'ğ': 'G', 'ı': 'I', 'i': 'I', 'ö': 'O', 'ş': 'S', 'ü': 'U'
        }
        for tr_char, en_char in tr_map.items():
            text = text.replace(tr_char, en_char)
        # Nokta, tire, alt çizgi gibi işaretleri boşluğa çevir
        text = re.sub(r'[\.\-\_\/\,\+\*]', ' ', text)
        # Çoklu boşlukları teke indir
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def reload_products_cache(self, force: bool = False):
        """Veritabanından tüm aktif ürün listesini ve takma adları hafızaya yükler."""
        now = time.time()
        if not force and self._products_cache and (now - self._last_loaded < 600):
            return  # 10 dakikalık in-memory önbellek

        try:
            from app.packs.loader import get_pack
            pack = get_pack()
            products = []
            if pack.product_catalog_sql:
                res = db_manager.execute_query(pack.product_catalog_sql, target_db=pack.product_catalog_db or pack.default_database)
                products = [r["URUN"] for r in res.get("data", []) if r.get("URUN")]

            self._products_cache = sorted(list(set(products)))
            self._normalized_cache = {self.normalize_tr(p): p for p in self._products_cache}
            self._last_loaded = now
            print(f"📦 Fuzzy Matcher: {len(self._products_cache)} adet ürün hafızaya kilitlendi.")
        except Exception as e:
            print(f"⚠️ Fuzzy Matcher önbellek yükleme hatası: {e}")

    def find_suggestions(self, user_query: str, limit: int = 5, min_score: float = 65.0) -> List[Dict[str, Any]]:
        """
        Kullanıcı yazarken veya sorgularken en yakın ürünleri döner.
        Örn: 'çelekli mag' -> [{'canonical_name': 'Magnolya.Çilekli', 'score': 92, ...}]
        """
        self.reload_products_cache()
        if not user_query or not self._products_cache:
            return []

        norm_query = self.normalize_tr(user_query)
        if len(norm_query) < 2:
            return []

        # 1. Tam veya Kısmi İçerme (Substring / StartsWith Önceliği)
        direct_matches = []
        for norm_p, orig_p in self._normalized_cache.items():
            if norm_query in norm_p or all(w in norm_p for w in norm_query.split()):
                direct_matches.append({
                    "canonical_name": orig_p,
                    "score": 100,
                    "matched_type": "exact_contains",
                    "suggestion_text": orig_p
                })
            if len(direct_matches) >= limit:
                return direct_matches

        # 2. RapidFuzz Token Sort & Set Ratio (Kelime Sırasından ve Harf Hatalarından Bağımsız)
        choices = list(self._normalized_cache.keys())
        results = process.extract(
            norm_query,
            choices,
            scorer=fuzz.token_set_ratio,
            limit=limit,
            score_cutoff=min_score
        )

        suggestions = []
        for norm_match, score, _ in results:
            orig = self._normalized_cache.get(norm_match)
            if orig:
                suggestions.append({
                    "canonical_name": orig,
                    "score": round(score, 1),
                    "matched_type": "fuzzy_match",
                    "suggestion_text": orig
                })

        return suggestions

    def resolve_best_match(self, term: str) -> Optional[Tuple[str, float]]:
        """Tek bir kelime/ifade için en yüksek benzerlikli resmi ürün adını döner."""
        matches = self.find_suggestions(term, limit=1, min_score=75.0)
        if matches:
            return matches[0]["canonical_name"], matches[0]["score"]
        return None

    def build_multi_like_sql(self, search_term: str, column_name: str = "MALINCINSI") -> str:
        """
        Kelimeleri ayırarak sıralamadan ve noktalardan bağımsız T-SQL LIKE ifadesi üretir.
        Örn: 'çilekli magnolya' -> (MALINCINSI LIKE '%MAGNOLYA%' AND MALINCINSI LIKE '%CILEK%')
        """
        norm = self.normalize_tr(search_term)
        words = [w for w in norm.split() if len(w) > 1]
        if not words:
            return f"{column_name} LIKE '%{search_term}%'"
        
        clauses = [f"{column_name} LIKE '%{w}%'" for w in words]
        return "(" + " AND ".join(clauses) + ")"

fuzzy_matcher = ProductFuzzyMatcher()
