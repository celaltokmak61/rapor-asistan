from typing import Dict, Any, List, Optional
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
import sqlite3
from app.core.config import settings

try:
    import pyodbc
except ImportError:
    pyodbc = None


def _serialize(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.strftime("%d.%m.%Y %H:%M")
    if isinstance(val, date):
        return val.strftime("%d.%m.%Y")
    if isinstance(val, Decimal):
        return float(val)
    if val is None:
        return "-"
    return val


class DatabaseManager:
    def __init__(self):
        self.server = settings.MSSQL_SERVER
        self.database = settings.MSSQL_DATABASE
        self.user = settings.MSSQL_USER
        self.password = settings.MSSQL_PASSWORD
        self.driver = settings.MSSQL_DRIVER

    def dialect(self) -> str:
        d = (settings.SQL_DIALECT or settings.DB_BACKEND or "sqlite").lower()
        if d in ("sqlite3", "file"):
            return "sqlite"
        if d in ("postgres", "postgresql"):
            return "postgres"
        if d in ("mssql", "sqlserver", "tsql"):
            return "tsql"
        return d

    def sqlite_path(self, target_db: Optional[str] = None) -> Path:
        if target_db and Path(str(target_db)).suffix in (".db", ".sqlite"):
            return Path(target_db)
        if settings.SQLITE_PATH:
            return Path(settings.SQLITE_PATH)
        if target_db and target_db not in ("demo", "DEFAULT", "default", ""):
            candidate = Path(target_db)
            if candidate.exists():
                return candidate
        return Path(__file__).resolve().parent.parent / "packs" / "demo" / "data" / "commerce.db"

    def get_connection_string(self, target_db: Optional[str] = None) -> str:
        db = target_db or self.database
        if self.user and self.password:
            return (
                f"DRIVER={{{self.driver}}};"
                f"SERVER={self.server};"
                f"DATABASE={db};"
                f"UID={self.user};"
                f"PWD={self.password};"
                f"TrustServerCertificate=yes;"
                f"Connection Timeout=5;"
            )
        return (
            f"DRIVER={{{self.driver}}};"
            f"SERVER={self.server};"
            f"DATABASE={db};"
            f"Trusted_Connection=yes;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=5;"
        )

    def test_connection(self, target_db: Optional[str] = None) -> Dict[str, Any]:
        dialect = self.dialect()
        if dialect == "sqlite":
            path = self.sqlite_path(target_db)
            try:
                if not path.exists():
                    return {"success": False, "error": f"SQLite file not found: {path}"}
                with sqlite3.connect(str(path)) as conn:
                    row = conn.execute("SELECT sqlite_version()").fetchone()
                return {
                    "success": True,
                    "database": str(path.name),
                    "version": f"SQLite {row[0]}" if row else "SQLite",
                    "dialect": "sqlite",
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

        if pyodbc is None:
            return {"success": False, "error": "pyodbc is not installed. Use SQL_DIALECT=sqlite for the demo, or pip install pyodbc for MSSQL."}
        try:
            conn_str = self.get_connection_string(target_db)
            with pyodbc.connect(conn_str, timeout=5) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT @@VERSION AS Version, DB_NAME() AS CurrentDB")
                row = cursor.fetchone()
                return {
                    "success": True,
                    "database": row[1],
                    "version": row[0].split("\n")[0] if row else "OK",
                    "dialect": "tsql",
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def execute_query(self, sql_query: str, target_db: Optional[str] = None, max_rows: Optional[int] = None) -> Dict[str, Any]:
        dialect = self.dialect()
        if dialect == "sqlite":
            return self._execute_sqlite(sql_query, target_db=target_db, max_rows=max_rows)
        return self._execute_odbc(sql_query, target_db=target_db, max_rows=max_rows)

    def _execute_sqlite(self, sql_query: str, target_db: Optional[str] = None, max_rows: Optional[int] = None) -> Dict[str, Any]:
        try:
            path = self.sqlite_path(target_db)
            if not path.exists():
                return {"success": False, "error": f"SQLite file not found: {path}"}
            conn = sqlite3.connect(str(path))
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.cursor()
                cursor.execute(sql_query)
                if not cursor.description:
                    return {"success": True, "row_count": 0, "columns": [], "data": []}
                columns = [c[0] for c in cursor.description]
                rows = cursor.fetchmany(max_rows) if max_rows and max_rows > 0 else cursor.fetchall()
                data = []
                for row in rows:
                    item = {}
                    for col, val in zip(columns, row):
                        item[col] = _serialize(val)
                    data.append(item)
                return {"success": True, "row_count": len(data), "columns": columns, "data": data}
            finally:
                conn.close()
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _execute_odbc(self, sql_query: str, target_db: Optional[str] = None, max_rows: Optional[int] = None) -> Dict[str, Any]:
        if pyodbc is None:
            return {"success": False, "error": "pyodbc is not installed. pip install pyodbc"}
        try:
            conn_str = self.get_connection_string(target_db)
            with pyodbc.connect(conn_str, timeout=12) as conn:
                cursor = conn.cursor()
                cursor.execute(sql_query)
                if not cursor.description:
                    return {"success": True, "row_count": 0, "columns": [], "data": []}
                columns = [column[0] for column in cursor.description]
                rows = cursor.fetchmany(max_rows) if max_rows and max_rows > 0 else cursor.fetchall()
                data = []
                for row in rows:
                    row_dict = {}
                    for col, val in zip(columns, row):
                        row_dict[col] = _serialize(val)
                    data.append(row_dict)
                return {"success": True, "row_count": len(data), "columns": columns, "data": data}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_table_schema(self, table_name: str, target_db: Optional[str] = None) -> Dict[str, Any]:
        dialect = self.dialect()
        safe = table_name.replace("'", "").replace('"', "").replace(";", "")
        if dialect == "sqlite":
            res = self.execute_query(f"PRAGMA table_info({safe})", target_db=target_db)
            if res.get("success") and res.get("data"):
                cols = {row.get("name"): row.get("type") for row in res["data"] if row.get("name")}
                return {
                    "success": True,
                    "table": table_name,
                    "db": str(self.sqlite_path(target_db).name),
                    "columns": cols,
                    "column_count": len(cols),
                }
            return {"success": False, "error": f"Table not found: {table_name}"}

        sql = f"""
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '{safe}'
        ORDER BY ORDINAL_POSITION
        """
        res = self.execute_query(sql, target_db=target_db)
        if res.get("success") and res.get("data"):
            cols = {row["COLUMN_NAME"]: row["DATA_TYPE"] for row in res["data"]}
            return {
                "success": True,
                "table": table_name,
                "db": target_db or self.database,
                "columns": cols,
                "column_count": len(cols),
            }
        return {"success": False, "error": f"Table not found: {table_name}"}

    def list_tables(self, target_db: Optional[str] = None) -> Dict[str, Any]:
        dialect = self.dialect()
        if dialect == "sqlite":
            sql = """
            SELECT 'main' AS TABLE_SCHEMA, name AS TABLE_NAME,
                   CASE type WHEN 'view' THEN 'VIEW' ELSE 'BASE TABLE' END AS TABLE_TYPE
            FROM sqlite_master
            WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
            ORDER BY type, name
            """
        else:
            sql = """
            SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            ORDER BY TABLE_TYPE, TABLE_SCHEMA, TABLE_NAME
            """
        return self.execute_query(sql, target_db=target_db)


db_manager = DatabaseManager()
