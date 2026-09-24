from pathlib import Path
from app.db.connection import db_manager
from app.engine import schema_discovery


def test_demo_file_exists():
    path = Path(__file__).resolve().parents[1] / "app" / "packs" / "demo" / "data" / "commerce.db"
    assert path.exists()


def test_connection():
    res = db_manager.test_connection()
    assert res["success"] is True
    assert "SQLite" in str(res.get("version"))


def test_list_tables():
    res = schema_discovery.list_tables()
    assert res["success"] is True
    names = {t["name"] for t in res["tables"]}
    assert {"customers", "products", "orders", "order_items", "inventory", "warehouses"} <= names


def test_completed_revenue_query():
    sql = (
        "SELECT ROUND(SUM(total), 2) AS revenue FROM orders WHERE status = 'completed'"
    )
    res = db_manager.execute_query(sql)
    assert res["success"] is True
    assert res["row_count"] == 1
    assert float(res["data"][0]["revenue"]) > 0


def test_low_stock_query():
    sql = "SELECT COUNT(*) AS n FROM inventory WHERE qty < 20"
    res = db_manager.execute_query(sql)
    assert res["success"] is True
    assert int(res["data"][0]["n"]) >= 1
