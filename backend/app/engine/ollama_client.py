import httpx
import json
from typing import Dict, Any, Generator, Optional
from app.core.config import settings

class OllamaClient:
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model or settings.LLM_MODEL
        self.timeout = 300.0

    async def is_available(self) -> bool:
        """Ollama sunucusunun ayakta ve erişilebilir olup olmadığını kontrol eder."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

    async def get_available_models(self) -> list:
        """Ollama üzerinde kurulu modellerin listesini döner."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    return [m.get("name") for m in data.get("models", [])]
        except Exception:
            pass
        return []

    async def generate_response(self, prompt: str, system_prompt: str, format_json: bool = False, temperature: float = 0.1) -> Dict[str, Any]:
        """Ollama generate API'si ile yanıt alır."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_ctx": 8192
            }
        }
        if format_json:
            payload["format"] = "json"

        timeout_cfg = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=300.0)
        try:
            full_content = []
            total_duration = 0
            async with httpx.AsyncClient(timeout=timeout_cfg) as client:
                async with client.stream("POST", f"{self.base_url}/api/generate", json=payload) as response:
                    if response.status_code != 200:
                        err = await response.aread()
                        return {"success": False, "error": f"Ollama HTTP {response.status_code}: {err.decode()}"}
                    
                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            full_content.append(chunk.get("response", ""))
                            if "total_duration" in chunk:
                                total_duration = chunk["total_duration"]

            return {
                "success": True,
                "response": "".join(full_content),
                "total_duration_ms": round(total_duration / 1e6, 2)
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ollama bağlantı hatası: {str(e)}"
            }

    async def chat(self, messages: list, format_json: bool = False) -> Dict[str, Any]:
        """Ollama Chat API'si ile kesintisiz streaming diyalog yürütür (Asla zaman aşımına uğramaz)."""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,  # Streaming bağlantıyı canlı tutar
            "options": {
                "temperature": 0.1,
                "num_ctx": 8192
            }
        }
        if format_json:
            payload["format"] = "json"

        timeout_cfg = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=300.0)
        try:
            full_content = []
            total_duration = 0
            async with httpx.AsyncClient(timeout=timeout_cfg) as client:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    if response.status_code != 200:
                        err = await response.aread()
                        return {"success": False, "error": f"Ollama HTTP {response.status_code}: {err.decode()}"}
                    
                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            msg_chunk = chunk.get("message", {}).get("content", "")
                            full_content.append(msg_chunk)
                            if "total_duration" in chunk:
                                total_duration = chunk["total_duration"]

            return {
                "success": True,
                "content": "".join(full_content),
                "total_duration_ms": round(total_duration / 1e6, 2)
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ollama bağlantı hatası: {str(e)}"
            }

ollama_client = OllamaClient()
