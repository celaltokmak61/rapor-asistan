import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.db.knowledge_db import knowledge_db
from app.packs.loader import get_pack


def _load_json(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    return []


def seed_pack(pack=None, force: bool = False) -> Dict[str, Any]:
    pack = pack or get_pack()
    seed_dir = pack.seed_dir
    if not seed_dir or not Path(seed_dir).exists():
        return {"success": True, "seeded": False, "reason": "no_seed_dir", "pack": pack.id}

    already = knowledge_db.get_preference("system", f"pack_seeded:{pack.id}")
    if already and not force:
        return {"success": True, "seeded": False, "reason": "already_seeded", "pack": pack.id}

    counts = {}

    goldens = _load_json(Path(seed_dir) / "golden_sql.json")
    for g in goldens:
        knowledge_db.add_golden_sql(
            soru=g.get("soru", ""),
            sql_query=g.get("sql_query", ""),
            chart_type=g.get("chart_type", "table"),
            target_db=g.get("target_database") or pack.default_database,
            aciklama=g.get("aciklama", ""),
        )
    counts["golden_sql"] = len(goldens)

    schema_rows = _load_json(Path(seed_dir) / "schema_knowledge.json")
    for row in schema_rows:
        knowledge_db.save_schema_knowledge(
            entity_type=row.get("entity_type", "table"),
            code_or_name=row.get("code_or_name") or row.get("entity_key") or "",
            description=row.get("description") or "",
            details=row.get("details") if isinstance(row.get("details"), dict) else None,
        )
    counts["schema_knowledge"] = len(schema_rows)

    notes = _load_json(Path(seed_dir) / "learned_notes.json")
    for n in notes:
        text = n.get("note_text") or n.get("note") or ""
        if text:
            knowledge_db.add_learned_note(text)
    counts["learned_notes"] = len(notes)

    values = _load_json(Path(seed_dir) / "corporate_values.json")
    for v in values:
        knowledge_db.add_corporate_value(
            title=v.get("title", ""),
            description=v.get("description", ""),
            priority=v.get("priority", "YÜKSEK"),
        )
    counts["corporate_values"] = len(values)

    rules = _load_json(Path(seed_dir) / "business_rules.json")
    for r in rules:
        knowledge_db.add_business_rule(
            category=r.get("category", "GENEL"),
            rule_name=r.get("rule_name", ""),
            rule_text=r.get("rule_text", ""),
            min_margin=r.get("min_margin_pct"),
            max_loss=r.get("max_loss_pct"),
            severity=r.get("severity", "UYARI"),
            action_recommendation=r.get("action_recommendation") or "",
        )
    counts["business_rules"] = len(rules)

    playbooks = _load_json(Path(seed_dir) / "diagnostic_playbooks.json")
    for pb in playbooks:
        steps = pb.get("check_steps")
        if not steps and pb.get("check_steps_json"):
            try:
                steps = json.loads(pb["check_steps_json"])
            except Exception:
                steps = []
        knowledge_db.add_diagnostic_playbook(
            anomaly_type=pb.get("anomaly_type", ""),
            title=pb.get("title", ""),
            check_steps=steps or [],
            root_cause_guide=pb.get("root_cause_guide", ""),
            action_template=pb.get("action_template", ""),
        )
    counts["diagnostic_playbooks"] = len(playbooks)

    prefs = _load_json(Path(seed_dir) / "user_preferences.json")
    for p in prefs:
        knowledge_db.save_preference(p.get("category", "genel"), p.get("key_name", ""), p.get("value_content", ""))
    counts["user_preferences"] = len(prefs)

    questions = _load_json(Path(seed_dir) / "frequent_questions.json")
    for q in questions:
        knowledge_db.add_frequent_question(
            question_text=q.get("question_text") or q.get("question") or "",
            chip_label=q.get("chip_label"),
            category=q.get("category", "Genel"),
            is_pinned=int(q.get("is_pinned") or 0),
            ask_count=int(q.get("ask_count") or 1),
        )
    counts["frequent_questions"] = len(questions)

    knowledge_db.save_preference("system", f"pack_seeded:{pack.id}", "1")
    knowledge_db.save_preference("system", "setup_complete", "1")
    return {"success": True, "seeded": True, "pack": pack.id, "counts": counts}
