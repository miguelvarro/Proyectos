"""
Mensajes WS (JSON)

Cliente -> Servidor
- { "action": "render", "scene": {...} }
- { "action": "zip_outputs" }

Servidor -> Cliente
- { "type": "hello", "server": "multinucleo" }
- { "type": "job", "job_id": "...", "status": "queued|running|done|error" }
- { "type": "progress", "job_id": "...", "pct": 0-100, "msg": "..." }
- { "type": "result", "job_id": "...", "kind": "render", "filename": "...", "data_b64": "..." }
- { "type": "result", "job_id": "...", "kind": "zip", "filename": "...", "data_b64": "..." }
- { "type": "error", "error": "..." }
"""

