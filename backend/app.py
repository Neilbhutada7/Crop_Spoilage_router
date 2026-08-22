import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import Config
from routes import api

_FRONTEND_DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")


def create_app():
    # static_folder=None disables Flask's own auto-registered static route
    # (which would otherwise collide with the catch-all route below) --
    # serve_frontend() below handles every non-API path itself.
    app = Flask(__name__, static_folder=None)
    app.secret_key = Config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8MB -- generous for a phone photo, caps abuse
    # supports_credentials + an explicit origin list (not "*") is required for
    # the session cookie to travel on cross-port XHR from the Vite dev server.
    # Same-origin requests (frontend served from this same Flask process,
    # below) don't need CORS at all -- this list only matters when running
    # the Vite dev server separately on one of these ports.
    allowed_origins = [f"http://localhost:{port}" for port in range(5173, 5183)] + \
                      [f"http://127.0.0.1:{port}" for port in range(5173, 5183)]
    CORS(
        app,
        supports_credentials=True,
        origins=allowed_origins,
    )
    app.register_blueprint(api)

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
        full_path = os.path.join(_FRONTEND_DIST, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(_FRONTEND_DIST, path)
        return send_from_directory(_FRONTEND_DIST, "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
