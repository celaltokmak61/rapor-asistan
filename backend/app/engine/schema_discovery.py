from typing import Any, Dict, List, Optional
from app.db.connection import db_manager
from app.db.knowledge_db import knowledge_db
from app.packs.loader import get_pack


SKIP_PREFIXES = ("sys", "INFORMATION_SCHEMA", "dt_")


def list_tables(target_db: Optional[str] = None) -> Dict[str, Any]:
    res = db_manager.list_tables(target_db=target_db)
    if not res.get("success"):
        return res
    rows = []
    for r in res.get("data", []):
        name = str(r.get("TABLE_NAME") or "")
        if name.lower().startswith(SKIP_PREFIXES):
            continue
        rows.append(
            {
                "schema": r.get("TABLE_SCHEMA"),
                "name": name,
                "type": r.get("TABLE_TYPE"),
            }
        )
    return {"success": True, "count": len(rows), "tables": rows, "database": target_db}


def describe_table(table_name: str, target_db: Optional[str] = None) -> Dict[str, Any]:
    return db_manager.get_table_schema(table_name, target_db=target_db)


def sample_rows(table_name: str, target_db: Optional[str] = None, limit: int = 5) -> Dict[str, Any]:
    from app.packs.loader import get_pack
    safe = table_name.replace("]", "").replace("[", "")
    dialect = (get_pack().dialect or "tsql").lower()
    if dialect in ("postgres", "postgresql"):
        sql = f'SELECT * FROM "{safe}" LIMIT {int(limit)}'
    elif dialect in ("mysql",):
        sql = f"SELECT * FROM `{safe}` LIMIT {int(limit)}"
    elif dialect in ("sqlite",):
        sql = f'SELECT * FROM "{safe}" LIMIT {int(limit)}'
    else:
        sql = f"SELECT TOP {int(limit)} * FROM [{safe}] WITH (NOLOCK)"
    return db_manager.execute_query(sql, target_db=target_db, max_rows=limit)


def ingest_tables(
    table_names: List[str],
    target_db: Optional[str] = None,
    entity_type: str = "table",
) -> Dict[str, Any]:
    ingested = []
    errors = []
    for name in table_names:
        info = describe_table(name, target_db=target_db)
        if not info.get("success"):
            errors.append({"table": name, "error": info.get("error")})
            continue
        columns = info.get("columns") or {}
        knowledge_db.save_schema_knowledge(
            entity_type=entity_type,
            code_or_name=name,
            description=f"{target_db or ''} içinde {name} tablosu".strip(),
            details={"columns": columns, "database": target_db, "column_count": info.get("column_count")},
        )
        ingested.append({"table": name, "column_count": info.get("column_count", 0)})
    return {"success": True, "ingested": ingested, "errors": errors}


def bootstrap_status() -> Dict[str, Any]:
    pack = get_pack()
    firms = knowledge_db.get_schema_knowledge(entity_type="firma")
    tables = knowledge_db.get_schema_knowledge(entity_type="table")
    goldens = knowledge_db.get_all_golden_sql()
    notes = knowledge_db.get_all_learned_notes()
    setup_flag = knowledge_db.get_preference("system", "setup_complete")
    return {
        "pack_id": pack.id,
        "pack_name": pack.name,
        "setup_complete": str(setup_flag or "").lower() in ("1", "true", "yes"),
        "firm_count": len(firms),
        "table_count": len(tables),
        "golden_count": len(goldens),
        "rule_count": len(notes),
        "has_admin": bool(knowledge_db.get_all_users()),
    }
