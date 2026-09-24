from app.engine.trainer import training_agent
import asyncio


def test_golden_sql_instant_match():
    async def run():
        res = await training_agent.process_training_input("low stock items")
        assert res["success"] is True
        parsed = res["response"]
        assert parsed["action_type"] == "sql_query"
        assert "inventory" in parsed["sql_query"].lower()
        assert "Golden SQL" in res["model"] or "Hafızadan" in parsed["explanation"] or res["duration_ms"] <= 5
        return res

    asyncio.run(run())


def test_turkish_golden_sql_match():
    async def run():
        res = await training_agent.process_training_input("bu ayın satış özeti")
        assert res["success"] is True
        assert res["response"]["sql_query"]
        assert "orders" in res["response"]["sql_query"].lower()

    asyncio.run(run())
