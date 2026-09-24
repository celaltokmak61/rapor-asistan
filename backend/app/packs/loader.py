from functools import lru_cache
from app.core.config import settings


@lru_cache(maxsize=1)
def get_pack():
    pack_id = (settings.ACTIVE_PACK or "demo").strip().lower()
    if pack_id in ("vega", "vega-arctos", "sefim"):
        try:
            from app.packs.vega.pack import build_pack
            return build_pack()
        except ImportError:
            pass
    if pack_id in ("demo", "sample", "commerce"):
        from app.packs.demo.pack import build_pack
        return build_pack()
    from app.packs.generic.pack import build_pack
    return build_pack()


def active_pack():
    return get_pack()
