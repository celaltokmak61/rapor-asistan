import time
import threading
from typing import Any, Optional, Dict, Tuple

class SimpleMemoryCache:
    """
    ⚡ Hafif, thread-safe bellek içi TTL önbellek.
    Canlı ERP MSSQL veritabanını gereksiz mükerrer yüklerden korur.
    """
    def __init__(self, default_ttl: int = 60):
        self.default_ttl = default_ttl
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                return None
            val, expiry = self._cache[key]
            if time.time() > expiry:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        duration = ttl if ttl is not None else self.default_ttl
        expiry = time.time() + duration
        with self._lock:
            self._cache[key] = (value, expiry)

    def delete(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

# Global tekil önbellek nesnesi
cache = SimpleMemoryCache(default_ttl=60)
memory_cache = cache

