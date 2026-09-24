from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


@dataclass
class Branch:
    code: str
    name: str
    role: str = "branch"


@dataclass
class PackModule:
    id: str
    title: str
    icon: str = "📊"
    description: str = ""


@dataclass
class PromptContext:
    user_query: Optional[str]
    active_firm: str
    start_date: Optional[str]
    end_date: Optional[str]
    firmalar_str: str
    learned_str: str
    date_context: str
    golden_str: str
    today_str: str
    dialect: str
    app_name: str
    assistant_name: str
    default_database: str
    schema_catalog: str = ""


@dataclass
class Pack:
    id: str
    name: str
    dialect: str = "tsql"
    default_database: str = ""
    default_firm: str = ""
    branches: List[Branch] = field(default_factory=list)
    modules: List[PackModule] = field(default_factory=list)
    databases: List[Dict[str, str]] = field(default_factory=list)
    product_catalog_sql: str = ""
    product_catalog_db: str = ""
    seed_dir: Optional[Path] = None
    routers: List[Any] = field(default_factory=list)
    exports: Dict[str, Any] = field(default_factory=dict)
    build_system_prompt: Optional[Callable[[PromptContext], str]] = None

    def branch_map(self) -> Dict[str, str]:
        mapping = {b.code: b.name for b in self.branches}
        mapping["ALL"] = "Tüm Şubeler"
        return mapping
