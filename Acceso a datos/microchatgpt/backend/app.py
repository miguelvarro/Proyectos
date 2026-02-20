#!/usr/bin/env python3
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os

from db import init_db, get_conn
from auth import (
    create_user,
    verify_user,
    create_session,
    get_user_id_from_token,
    revoke_session,
)

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

print(">>> BACKEND app.py CARGADO DESDE:", __file__)
print(">>> OLLAMA_HOST:", OLLAMA_HOST)

app = Flask(__name__, static_folder=None)
CORS(app)

init_db()


# -------------------------
# Auth helpers
# -------------------------
def bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return ""


def current_user_id():
    token = bearer_token()
    if not token:
        return None
    return get_user_id_from_token(token)


def require_auth():
    uid = current_user_id()
    if not uid:
        return None, (jsonify({"ok": False, "error": "No autorizado"}), 401)
    return uid, None


# -------------------------
# Auth endpoints
# -------------------------
@app.post("/api/register")
def api_register():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if len(username) < 3 or len(password) < 4:
        return jsonify({"ok": False, "error": "Usuario o contraseña demasiado cortos"}), 400

    user_id = create_user(username, password)
    if not user_id:
        return jsonify({"ok": False, "error": "El usuario ya existe"}), 400

    token = create_session(user_id)
    return jsonify({"ok": True, "token": token})


@app.post("/api/login")
def api_login():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    user_id = verify_user(username, password)
    if not user_id:
        return jsonify({"ok": False, "error": "Credenciales inválidas"}), 401

    token = create_session(user_id)
    return jsonify({"ok": True, "token": token})


@app.post("/api/logout")
def api_logout():
    uid, err = require_auth()
    if err:
        return err
    token = bearer_token()
    revoke_session(token)
    return jsonify({"ok": True})


# -------------------------
# Conversation helpers
# -------------------------
def create_conversation(user_id: int, model: str, title: str = "Chat"):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO conversations (user_id, title, model) VALUES (?, ?, ?)",
        (user_id, title, model),
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid


def save_message(conversation_id: int, role: str, content: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, role, content),
    )
    conn.commit()
    conn.close()


def conversation_belongs_to_user(conversation_id: int, user_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    )
    ok = cur.fetchone() is not None
    conn.close()
    return ok


def load_messages_for_conversation(conversation_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC",
        (conversation_id,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def load_history_for_ollama(conversation_id: int):
    msgs = load_messages_for_conversation(conversation_id)
    return [{"role": m["role"], "content": m["content"]} for m in msgs]


def get_conversation(conversation_id: int, user_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, model, created_at FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


# -------------------------
# Conversations endpoints
# -------------------------
@app.get("/api/last_conversation")
def api_last_conversation():
    uid, err = require_auth()
    if err:
        return err

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, model, title
        FROM conversations
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (uid,),
    )
    conv = cur.fetchone()
    conn.close()

    if not conv:
        return jsonify({"ok": True, "conversation_id": None, "messages": []})

    msgs = load_messages_for_conversation(conv["id"])
    return jsonify(
        {
            "ok": True,
            "conversation_id": conv["id"],
            "messages": msgs,
            "conversation": {"id": conv["id"], "title": conv["title"], "model": conv["model"]},
        }
    )


@app.get("/api/conversations")
def api_conversations():
    uid, err = require_auth()
    if err:
        return err

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, title, model, created_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 30
        """,
        (uid,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify({"ok": True, "conversations": rows})


@app.post("/api/conversations")
def api_create_conversation():
    uid, err = require_auth()
    if err:
        return err

    data = request.get_json(force=True) or {}
    model = (data.get("model") or "llama3.1:8b-instruct-q4_0").strip()
    title = (data.get("title") or "Chat").strip()

    cid = create_conversation(uid, model, title)
    return jsonify({"ok": True, "conversation_id": cid})


@app.get("/api/conversations/<int:conversation_id>/messages")
def api_conversation_messages(conversation_id: int):
    uid, err = require_auth()
    if err:
        return err

    if not conversation_belongs_to_user(conversation_id, uid):
        return jsonify({"ok": False, "error": "Conversación no encontrada"}), 404

    conv = get_conversation(conversation_id, uid)
    msgs = load_messages_for_conversation(conversation_id)
    return jsonify({"ok": True, "messages": msgs, "conversation": conv})


@app.post("/api/conversations/<int:conversation_id>/model")
def api_set_conversation_model(conversation_id: int):
    uid, err = require_auth()
    if err:
        return err

    if not conversation_belongs_to_user(conversation_id, uid):
        return jsonify({"ok": False, "error": "Conversación no encontrada"}), 404

    data = request.get_json(force=True) or {}
    model = (data.get("model") or "").strip()
    if not model:
        return jsonify({"ok": False, "error": "model requerido"}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE conversations SET model = ? WHERE id = ? AND user_id = ?",
        (model, conversation_id, uid),
    )
    conn.commit()
    conn.close()

    return jsonify({"ok": True})


# -------------------------
# Chat endpoint (legacy + persistente)
# -------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Legacy (sin login):
      { model, message, history: [...] }

    Persistente (con login):
      Headers: Authorization: Bearer <token>
      { model, message, conversation_id?: int }
    """
    data = request.get_json(force=True) or {}
    model = (data.get("model") or "llama3.1:8b-instruct-q4_0").strip()
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({"error": "message is required"}), 400

    uid = current_user_id()
    conversation_id = data.get("conversation_id")

    if uid:
        if not conversation_id:
            title = (message[:40] + "…") if len(message) > 40 else message
            conversation_id = create_conversation(uid, model, title)

        if not conversation_belongs_to_user(int(conversation_id), uid):
            return jsonify({"error": "conversation not allowed"}), 403

        # (opcional pero útil): persistimos el modelo escogido
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "UPDATE conversations SET model = ? WHERE id = ? AND user_id = ?",
            (model, int(conversation_id), uid),
        )
        conn.commit()
        conn.close()

        history = load_history_for_ollama(int(conversation_id))
        messages = list(history) + [{"role": "user", "content": message}]
        save_message(int(conversation_id), "user", message)
    else:
        history = data.get("history") or []
        messages = list(history) + [{"role": "user", "content": message}]

    try:
        r = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=600,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        return jsonify({"error": f"Ollama request failed: {e}"}), 502

    payload = r.json()
    reply = (payload.get("message") or {}).get("content", "")

    if uid and conversation_id:
        save_message(int(conversation_id), "assistant", reply)

    out = {"reply": reply, "raw": payload}
    if uid and conversation_id:
        out["conversation_id"] = int(conversation_id)
        out["ok"] = True
    return jsonify(out)


# -------------------------
# Models endpoint
# -------------------------
@app.route("/api/models", methods=["GET"])
def list_models():
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        return jsonify({"error": f"Ollama request failed: {e}"}), 502
    return jsonify(r.json())


# -------------------------
# Serve frontend
# -------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    root = os.path.join(os.path.dirname(__file__), "..", "frontend")
    if path == "" or path == "/":
        return send_from_directory(root, "index.html")
    return send_from_directory(root, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)

