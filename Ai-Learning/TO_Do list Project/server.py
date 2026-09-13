#!/usr/bin/env python3
"""
server.py — Lightweight Full-Stack Server & REST API
====================================================
Built with Python's built-in `http.server` module (zero external dependencies).
Connects the web frontend to the real SQLite database (taskflow.db).

Endpoints:
  GET  /api/status               -> Health check & DB status
  POST /api/login                -> Verify user credentials against SQLite
  GET  /api/tasks?username=...   -> Fetch tasks from SQLite
  POST /api/tasks                -> Insert new task into SQLite
  PUT  /api/tasks/<id>           -> Update task status / title in SQLite
  DELETE /api/tasks/<id>         -> Delete task from SQLite
  DELETE /api/tasks/completed    -> Clear completed tasks
  GET  /*                        -> Serves HTML, CSS, JS static files
"""

import http.server
import json
import os
import urllib.parse
from http import HTTPStatus
import database

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
}

class TaskFlowHandler(http.server.BaseHTTPRequestHandler):
    def send_json(self, data, status=HTTPStatus.OK):
        """Helper to send JSON response."""
        encoded = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(encoded)

    def parse_body(self):
        """Helper to read and parse JSON request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw_body)
            except json.JSONDecodeError:
                return {}
        return {}

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ========================================================================
    # GET Requests (Static Files & API Data)
    # ========================================================================
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # API: Status Check
        if path == "/api/status":
            self.send_json({
                "status": "online",
                "database": "SQLite (taskflow.db)",
                "engine": "Python Standard Library"
            })
            return

        # API: Fetch Tasks from SQLite
        if path == "/api/tasks":
            username = params.get("username", ["@tul"])[0]
            tasks = database.get_tasks(username)
            self.send_json({"success": True, "tasks": tasks})
            return

        # Static Files: Serve index.html, login.html, etc.
        if path == "/" or path == "":
            path = "/login.html"

        # Sanitize path to prevent directory traversal
        safe_path = os.path.normpath(path.lstrip("/"))
        file_path = os.path.join(BASE_DIR, safe_path)

        if os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_type = MIME_TYPES.get(ext, "application/octet-stream")

            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.send_error(HTTPStatus.NOT_FOUND, "File Not Found")

    # ========================================================================
    # POST Requests (Login, Task Creation)
    # ========================================================================
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # API: Login
        if path == "/api/login":
            username = body.get("username", "").strip()
            password = body.get("password", "")

            user = database.authenticate_user(username, password)
            if user:
                self.send_json({
                    "success": True,
                    "user": {"username": user["username"], "isGuest": False}
                })
            else:
                self.send_json({
                    "success": False,
                    "error": "Invalid username or password. (Default is @tul / Atul)"
                }, status=HTTPStatus.UNAUTHORIZED)
            return

        # API: Create Task
        if path == "/api/tasks":
            username = body.get("username", "@tul")
            title = body.get("title", "").strip()
            priority = body.get("priority", "medium")
            category = body.get("category", "General")
            due_date = body.get("dueDate", "")

            if not title:
                self.send_json({"success": False, "error": "Task title is required"}, status=HTTPStatus.BAD_REQUEST)
                return

            new_task = database.add_task(username, title, priority, category, due_date)
            self.send_json({"success": True, "task": new_task}, status=HTTPStatus.CREATED)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "API Endpoint Not Found")

    # ========================================================================
    # PUT Requests (Update Task Status / Title)
    # ========================================================================
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # API: Update Task /api/tasks/<id>
        if path.startswith("/api/tasks/"):
            try:
                task_id = int(path.split("/api/tasks/")[1])
                completed = body.get("completed")
                title = body.get("title")

                database.update_task(task_id, title=title, completed=completed)
                self.send_json({"success": True, "id": task_id})
                return
            except (ValueError, IndexError):
                self.send_json({"success": False, "error": "Invalid Task ID"}, status=HTTPStatus.BAD_REQUEST)
                return

        self.send_error(HTTPStatus.NOT_FOUND, "API Endpoint Not Found")

    # ========================================================================
    # DELETE Requests (Delete Task / Clear Completed)
    # ========================================================================
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # API: Clear Completed /api/tasks/completed?username=...
        if path == "/api/tasks/completed":
            username = params.get("username", ["@tul"])[0]
            database.clear_completed_tasks(username)
            self.send_json({"success": True})
            return

        # API: Delete single task /api/tasks/<id>
        if path.startswith("/api/tasks/"):
            try:
                task_id = int(path.split("/api/tasks/")[1])
                database.delete_task(task_id)
                self.send_json({"success": True, "deletedId": task_id})
                return
            except (ValueError, IndexError):
                self.send_json({"success": False, "error": "Invalid Task ID"}, status=HTTPStatus.BAD_REQUEST)
                return

        self.send_error(HTTPStatus.NOT_FOUND, "API Endpoint Not Found")


def run_server():
    """Initializes DB and starts HTTP server."""
    database.init_db()
    server_address = ("", PORT)
    httpd = http.server.ThreadingHTTPServer(server_address, TaskFlowHandler)
    print("=" * 60)
    print(f"🚀 TaskFlow Server is running at: http://localhost:{PORT}")
    print(f"📁 SQLite Database: {database.DB_FILE}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped gracefully.")

if __name__ == "__main__":
    run_server()
