from flask import Flask, redirect, request, jsonify, render_template, session
from database.DatabaseHandler import DatabaseHandler
import os
from dotenv import load_dotenv
from functools import wraps
import re
import json

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))  # Better secret key handling
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

dbHandler = DatabaseHandler("database/library.db")

# ===== DECORATORS =====

def login_required(f):
    """Decorator to require login for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"success": False, "error": "NotLoggedIn"}), 401
        return f(*args, **kwargs)
    return decorated_function

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

# ===== ROUTES =====

@app.route("/")
def home():
    if "user" in session:
        return redirect("/main")
    return render_template("login.html")

@app.route("/admin")
@login_required
def admin():
    # Check if user is admin
    if session["user"].get("email") != os.getenv("ADMIN_USERNAME"):
        return redirect("/main")
    return render_template("admin.html")

@app.route("/main")
@login_required
def main():
    return render_template("dashboard.html", user=session["user"])

# ===== AUTH ROUTES =====

@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        
        # Validate input
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        if not name or not email or not password:
            return jsonify({"success": False, "error": "MissingFields"})
        
        if not validate_email(email):
            return jsonify({"success": False, "error": "InvalidEmail"})
        
        if len(password) < 6:
            return jsonify({"success": False, "error": "PasswordTooShort"})
        
        # TODO: Hash password before storing (use bcrypt or werkzeug.security)
        # For now, storing plain text (NOT RECOMMENDED for production)
        
        if dbHandler.insertUser(name, email, password):
            session["user"] = {
                "name": name,
                "email": email
            }
            return jsonify({"success": True, "redirect": "/main"})
        
        return jsonify({"success": False, "error": "EmailExists"})
    
    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        
        email = data.get("email", "").strip()
        password = data.get("password", "")
        
        if not email or not password:
            return jsonify({"success": False, "error": "MissingFields"})
        
        # Check admin credentials
        if email == os.getenv("ADMIN_USERNAME") and password == os.getenv("ADMIN_PASSWORD"):
            session["user"] = {
                "name": "Admin",
                "email": email,
                "isAdmin": True
            }
            return jsonify({"success": True, "redirect": "/admin"})
        
        # Check regular user
        if dbHandler.verifyUser(email, password):
            session["user"] = {
                "name": dbHandler.getUserName(email),
                "email": email,
                "isAdmin": False
            }
            return jsonify({"success": True, "redirect": "/main"})
        
        return jsonify({"success": False, "error": "InvalidCredentials"})
    
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")

# ===== USER ROUTES =====

@app.route("/update-profile", methods=["POST"])
@login_required
def update_profile():
    try:
        data = request.get_json()
        
        name = data.get("name", "").strip()
        email = session["user"]["email"]  # Don't allow email change
        password = data.get("password", "")
        
        if not name:
            return jsonify({"success": False, "error": "MissingName"})
        
        # If password is empty, keep the old one
        # TODO: This is a simplification - need to handle password properly
        if not password:
            password = "unchanged"  # Placeholder - need better logic
        
        if dbHandler.updateUserInfo(email, name, password):
            session["user"]["name"] = name
            return jsonify({"success": True})
        
        return jsonify({"success": False, "error": "UpdateFailed"})
    
    except Exception as e:
        print(f"Update profile error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

# ===== BOOK ROUTES =====

@app.route("/add-book", methods=["POST"])
@login_required
def add_book():
    try:
        data = request.get_json()
        
        id = data.get("id", "").strip()
        title = data.get("title", "").strip()
        author = data.get("author", "").strip()
        
        if not id or not title or not author:
            return jsonify({"success": False, "error": "MissingFields"})
        
        if dbHandler.insertBook(id, title, author):
            return jsonify({"success": True})
        
        return jsonify({"success": False, "error": "BookExists"})
    
    except Exception as e:
        print(f"Add book error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-booklist")
@login_required
def get_booklist():
    try:
        books = dbHandler.getAllBooks()
        return jsonify(books)
    except Exception as e:
        print(f"Get booklist error: {e}")
        return jsonify({"error": "ServerError"}), 500

@app.route("/edit-book", methods=["POST"])
@login_required
def update_book():
    try:
        data = request.get_json()
        
        book_id = data.get("id")
        title = data.get("title", "").strip()
        author = data.get("author", "").strip()
        
        if not book_id or not title or not author:
            return jsonify({"success": False, "error": "MissingFields"})
        
        if dbHandler.updateBook(book_id, title, author):
            return jsonify({"success": True})
        
        return jsonify({"success": False, "error": "BookNotFound"})
    
    except Exception as e:
        print(f"Update book error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/delete-book", methods=["POST"])
@login_required
def delete_book():
    try:
        data = request.get_json()
        book_id = data.get("id")
        
        if not book_id:
            return jsonify({"success": False, "error": "MissingID"})
        
        if dbHandler.deleteBook(book_id):
            return jsonify({"success": True})
        
        return jsonify({"success": False, "error": "BookNotFound"})
    
    except Exception as e:
        print(f"Delete book error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

# ===== ADMIN ROUTES =====

@app.route("/get-accountlist")
@login_required
def get_accountlist():
    try:
        # Check if user is admin
        if not session["user"].get("isAdmin", False):
            return jsonify({"error": "Unauthorized"}), 403
        
        accounts = dbHandler.getAllUsers()
        
        # Add booking and borrow status
        for acc in accounts:
            acc["bookings"] = "Chưa đặt" if dbHandler.getSeatBooking(acc["id"]) is None else "Đã đặt"
            acc["borrows"] = "Chưa mượn" if dbHandler.getUserBorrowedBooks(acc["id"]) == [] else "Đã mượn"
        
        return jsonify(accounts)
    
    except Exception as e:
        print(f"Get accountlist error: {e}")
        return jsonify({"error": "ServerError"}), 500

@app.route("/delete-account", methods=["POST"])
@login_required
def delete_account():
    try:
        # Check if user is admin
        if not session["user"].get("isAdmin", False):
            return jsonify({"success": False, "error": "Unauthorized"}), 403
        
        data = request.get_json()
        user_id = data.get("id")
        
        if not user_id:
            return jsonify({"success": False, "error": "MissingID"})
        
        if dbHandler.deleteUser(user_id):
            return jsonify({"success": True})
        
        return jsonify({"success": False, "error": "UserNotFound"})
    
    except Exception as e:
        print(f"Delete account error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/save-layout", methods=["POST"])
@login_required
def save_layout():
    try:
        # Check if user is admin
        if not session["user"].get("isAdmin", False):
            return jsonify({"success": False, "error": "Unauthorized"}), 403
        
        data = request.get_json()

        # Delete all existing seats
        dbHandler.deleteAllSeat()

        # Insert new seats
        for unSeatID in [obj["id"] for obj in data.get("objects", []) if obj["type"] == "seat"]:
            print(f"Inserting seat {unSeatID} into database...")
            dbHandler.insertSeat(unSeatID)

        with open("layout.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        return jsonify({"success": True})
    
    except Exception as e:
        print(f"Save layout error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

# ===== ERROR HANDLERS =====

@app.errorhandler(404)
def not_found(e):
    return render_template("login.html"), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# ===== MAIN =====

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)