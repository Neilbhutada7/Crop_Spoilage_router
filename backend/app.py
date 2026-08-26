import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import Config
from routes import api, limiter

_FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")


def create_app():
    # static_folder=None disables Flask's own auto-registered static route
    # (which would otherwise collide with the catch-all route below) --
    # serve_frontend() below handles every non-API path itself.
    app = Flask(__name__, static_folder=None)
    app.secret_key = Config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8MB -- generous for a phone photo, caps abuse

    if Config.CROSS_ORIGIN_DEPLOYMENT:
        # Frontend (e.g. Vercel) and backend (e.g. Render) on different
        # domains -- the session cookie needs SameSite=None + Secure to
        # survive a cross-site fetch with credentials: "include", or the
        # browser silently drops it and every login "succeeds" but the next
        # request looks logged out.
        app.config["SESSION_COOKIE_SAMESITE"] = "None"
        app.config["SESSION_COOKIE_SECURE"] = True

    # supports_credentials + an explicit origin list (not "*") is required for
    # the session cookie to travel cross-origin. Localhost dev ports always
    # allowed (Vite dev server); FRONTEND_ORIGIN adds the real deployed
    # frontend domain(s) on top, comma-separated.
    allowed_origins = [f"http://localhost:{port}" for port in range(5173, 5183)] + \
                      [f"http://127.0.0.1:{port}" for port in range(5173, 5183)]
    if Config.FRONTEND_ORIGIN:
        allowed_origins += [o.strip() for o in Config.FRONTEND_ORIGIN.split(",") if o.strip()]
    CORS(
        app,
        supports_credentials=True,
        origins=allowed_origins,
    )
    app.register_blueprint(api)
    limiter.init_app(app)

    @app.before_request
    def require_custom_header():
        # Exempt GET/HEAD/OPTIONS and the login route
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return
        if request.path == "/api/auth/login":
            return
        if not request.headers.get("X-Requested-With") == "XMLHttpRequest":
            return jsonify({"error": "CSRF verification failed: Missing X-Requested-With header."}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    # Single-origin serving: the built React app (frontend/dist, from
    # `npm run build`) is served directly by Flask so the whole product is
    # reachable at one link. Any path that isn't /api/... and isn't a real
    # static file falls back to index.html so React Router's client-side
    # routes (e.g. /dashboard, /batch-analysis) resolve on a hard refresh.
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        if not os.path.isdir(_FRONTEND_DIST):
            # Backend-only deployment (e.g. Render, with the frontend
            # deployed separately on Vercel) -- frontend/dist was never
            # built here, so there's nothing to serve. A clear message
            # beats a crash on every non-API request.
            return jsonify({
                "status": "AgriRoute AI backend is running",
                "note": "This deployment serves the API only -- the frontend is hosted separately.",
            })
        full_path = os.path.join(_FRONTEND_DIST, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(_FRONTEND_DIST, path)
        return send_from_directory(_FRONTEND_DIST, "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    # Local dev only -- production uses gunicorn (see Procfile), which
    # imports `app` directly and never hits this block. $PORT respected in
    # case this is ever run directly on a host that assigns it dynamically.
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
