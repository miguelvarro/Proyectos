import secrets
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_conn


def create_user(username: str, password: str):
    username = (username or "").strip()
    if not username:
        return None

    pw_hash = generate_password_hash(password)
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, pw_hash)
        )
        conn.commit()
        user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return None

    conn.close()
    return user_id


def verify_user(username: str, password: str):
    username = (username or "").strip()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    conn.close()

    if not row:
        return None
    if not check_password_hash(row["password_hash"], password):
        return None
    return row["id"]


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()
    conn.close()
    return token


def get_user_id_from_token(token: str):
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM sessions WHERE token = ?", (token,))
    row = cur.fetchone()
    conn.close()
    return row["user_id"] if row else None


def revoke_session(token: str):
    if not token:
        return
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

