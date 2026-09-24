from app.packs.demo.pack import build_pack as demo_pack
from app.packs.generic.pack import build_pack as generic_pack
from app.packs.demo.prompt import build_system_prompt
from app.packs.base import PromptContext


def test_demo_pack_shape():
    pack = demo_pack()
    assert pack.id == "demo"
    assert pack.dialect == "sqlite"
    assert pack.seed_dir.exists()
    assert any(m.id == "ai_studio" for m in pack.modules)


def test_generic_pack_shape():
    pack = generic_pack()
    assert pack.id == "generic"
    assert pack.routers == []


def test_demo_prompt_mentions_schema():
    ctx = PromptContext(
        user_query="sales",
        active_firm="MAIN",
        start_date=None,
        end_date=None,
        firmalar_str="- MAIN",
        learned_str="rule",
        date_context="today",
        golden_str="",
        today_str="2026-09-24",
        dialect="sqlite",
        app_name="Rapor Asistan",
        assistant_name="Rapor-AI",
        default_database="demo",
        schema_catalog="customers, orders",
    )
    prompt = build_system_prompt(ctx)
    assert "SELECT only" in prompt or "SELECT" in prompt
    assert "customers" in prompt
