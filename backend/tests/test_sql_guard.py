from app.engine.trainer import TrainingAgent


def test_select_is_allowed():
    agent = TrainingAgent()
    res = agent.validate_sql("SELECT name, city FROM customers WHERE status = 1")
    assert res["valid"] is True


def test_insert_is_blocked():
    agent = TrainingAgent()
    res = agent.validate_sql("INSERT INTO customers (name) VALUES ('x')")
    assert res["valid"] is False


def test_drop_is_blocked():
    agent = TrainingAgent()
    res = agent.validate_sql("DROP TABLE customers")
    assert res["valid"] is False


def test_update_is_blocked():
    agent = TrainingAgent()
    res = agent.validate_sql("UPDATE products SET unit_price = 1")
    assert res["valid"] is False
