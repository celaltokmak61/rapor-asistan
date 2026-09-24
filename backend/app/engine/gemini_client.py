import httpx
import json
import time
import logging
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_CASCADING_POOL = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-flash-latest"
]

class GeminiClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_pool = GEMINI_CASCADING_POOL
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.active_model = self.model_pool[0]

    async def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/models?key={self.api_key}")
                return res.status_code == 200
        except Exception:
            return False

    async def chat(self, messages: list, format_json: bool = True) -> Dict[str, Any]:
        """Gemini Model Havuzunu sırayla dener (429/Kota biterse otomatik sonrakine geçer)."""
        if not self.api_key:
            return {"success": False, "error": "GEMINI_API_KEY tanımlanmamış."}

        system_instruction = None
        gemini_contents = []

        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "assistant":
                gemini_contents.append({"role": "model", "parts": [{"text": content}]})
            else:
                gemini_contents.append({"role": "user", "parts": [{"text": content}]})

        if not gemini_contents:
            gemini_contents.append({"role": "user", "parts": [{"text": "Merhaba"}]})

        payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.1,
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction
        if format_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        last_error = ""
        # Havuzdaki tüm Gemini modellerini sırayla dene
        for model in self.model_pool:
            model_name = model if model.startswith("models/") else f"models/{model}"
            url = f"{self.base_url}/{model_name}:generateContent?key={self.api_key}"

            start_time = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    res = await client.post(url, json=payload)
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        content = ""
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            content = "".join([p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p]).strip()
                        
                        self.active_model = model
                        return {
                            "success": True,
                            "content": content,
                            "total_duration_ms": duration_ms,
                            "model": f"Google Gemini ({model}) 👑"
                        }
                    else:
                        err_msg = f"{model} ({res.status_code}): {res.text[:120]}"
                        logger.warning(f"[Gemini Havuz Geçişi] {err_msg} -> Sıradaki Gemini modeline geçiliyor...")
                        last_error = err_msg
                        continue
            except Exception as e:
                err_msg = f"{model} Bağlantı Hatası: {str(e)}"
                logger.warning(f"[Gemini Havuz Geçişi] {err_msg} -> Sıradaki modele geçiliyor...")
                last_error = err_msg
                continue

        return {
            "success": False,
            "error": f"Tüm Gemini modelleri tükendi. Son hata: {last_error}",
            "total_duration_ms": 0
        }

gemini_client = GeminiClient()
