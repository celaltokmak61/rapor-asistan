import httpx
import json
import time
import logging
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_CASCADING_POOL = [
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "groq/compound",
    "openai/gpt-oss-120b"
]

class GroqClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model_pool = GROQ_CASCADING_POOL
        self.active_model = self.model_pool[0]
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"

    async def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                return res.status_code == 200
        except Exception:
            return False

    async def chat(self, messages: list, format_json: bool = True) -> Dict[str, Any]:
        """Groq LPU havuzunu sırayla dener (Kota/Rate limit durumunda sonrakine geçer)."""
        if not self.api_key:
            return {"success": False, "error": "GROQ_API_KEY tanımlanmamış."}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        last_error = ""
        for model in self.model_pool:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.1
            }
            if format_json:
                payload["response_format"] = {"type": "json_object"}

            start_time = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(self.base_url, headers=headers, json=payload)
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    
                    if res.status_code == 200:
                        data = res.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        self.active_model = model
                        return {
                            "success": True,
                            "content": content,
                            "total_duration_ms": duration_ms,
                            "model": f"Groq ({model}) ⚡"
                        }
                    else:
                        err_msg = f"{model} ({res.status_code}): {res.text[:120]}"
                        logger.warning(f"[Groq Havuz Geçişi] {err_msg} -> Sıradaki Groq modeline geçiliyor...")
                        last_error = err_msg
                        continue
            except Exception as e:
                err_msg = f"{model} Bağlantı Hatası: {str(e)}"
                logger.warning(f"[Groq Havuz Geçişi] {err_msg} -> Sıradaki modele geçiliyor...")
                last_error = err_msg
                continue

        return {
            "success": False,
            "error": f"Tüm Groq modelleri tükendi. Son hata: {last_error}",
            "total_duration_ms": 0
        }

groq_client = GroqClient()
