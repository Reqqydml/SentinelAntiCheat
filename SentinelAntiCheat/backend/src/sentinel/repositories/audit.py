from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class AuditRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._ensure()

    def _ensure(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                  id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  model_version TEXT NOT NULL,
                  input_hash TEXT NOT NULL,
                  payload_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def write(self, payload: dict, model_version: str = "v0.1") -> str:
        packed = json.dumps(payload, sort_keys=True)
        input_hash = hashlib.sha256(packed.encode("utf-8")).hexdigest()
        row_id = str(uuid4())
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO audit_log (id, created_at, model_version, input_hash, payload_json) VALUES (?, ?, ?, ?, ?)",
                (row_id, datetime.now(UTC).isoformat(), model_version, input_hash, packed),
            )
            conn.commit()
        return row_id

    def recent(self, *, limit: int = 100, event_id: str | None = None) -> list[dict]:
        q = (
            "SELECT id, created_at, model_version, payload_json "
            "FROM audit_log ORDER BY created_at DESC LIMIT ?"
        )
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(q, (max(1, min(limit, 500)),)).fetchall()

        out: list[dict] = []
        for row_id, created_at, model_version, payload_json in rows:
            try:
                payload = json.loads(payload_json)
            except Exception:
                continue
            req = payload.get("request", {})
            resp = payload.get("response", {})
            if event_id and req.get("event_id") != event_id:
                continue
            out.append(
                {
                    "id": row_id,
                    "created_at": created_at,
                    "model_version": model_version,
                    "request": req,
                    "response": resp,
                }
            )
        return out
