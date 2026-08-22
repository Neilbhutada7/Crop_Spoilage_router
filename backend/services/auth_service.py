"""
Username/password auth backed by the users table, using signed Flask
session cookies (no JWT/token infra needed for a single-frontend demo).
Passwords are hashed with werkzeug's PBKDF2 helper (already a Flask
dependency, no extra package needed).

Scope note: this gates the frontend's dashboard behind a login screen and
gives each session an identified user, but existing API endpoints are not
individually access-controlled -- see DECISIONS.md.
"""
from werkzeug.security import check_password_hash, generate_password_hash

from db import SessionLocal
from models import User


class AuthError(Exception):
    pass


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def signup(username: str, password: str, full_name: str | None) -> dict:
    if not username or not isinstance(username, str) or len(username.strip()) < 3:
        raise AuthError("Username must be at least 3 characters")
    if not password or len(password) < 6:
        raise AuthError("Password must be at least 6 characters")
    username = username.strip()

    session = SessionLocal()
    try:
        existing = session.query(User).filter(User.username == username).first()
        if existing:
            raise AuthError("Username already taken")

        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            full_name=(full_name or "").strip() or None,
        )
        session.add(user)
        session.commit()
        return _user_dict(user)
    finally:
        session.close()


def login(username: str, password: str) -> dict:
    if not username or not password:
        raise AuthError("Username and password are required")

    session = SessionLocal()
    try:
        user = session.query(User).filter(User.username == username.strip()).first()
        if user is None or not check_password_hash(user.password_hash, password):
            raise AuthError("Invalid username or password")
        return _user_dict(user)
    finally:
        session.close()


def get_user(user_id: int) -> dict | None:
    session = SessionLocal()
    try:
        user = session.get(User, user_id)
        return _user_dict(user) if user else None
    finally:
        session.close()
