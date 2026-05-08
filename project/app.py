from flask import Flask, redirect, request, jsonify, render_template, session
from database.DatabaseHandler import DatabaseHandler
import os
from dotenv import load_dotenv
from functools import wraps
from datetime import datetime, timedelta
import re
import json

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", os.urandom(24))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

dbHandler = DatabaseHandler("database/library.db")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"success": False, "error": "NotLoggedIn"}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return jsonify({"success": False, "error": "NotLoggedIn"}), 401
        if not session["user"].get("isAdmin", False):
            return jsonify({"success": False, "error": "Unauthorized"}), 403
        return f(*args, **kwargs)
    return decorated_function

def validate_email(email):
    import re
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))

@app.route("/")
def home():
    if "user" in session:
        return redirect("/main")
    return render_template("login.html")

@app.route("/admin")
@login_required
def admin():
    if not session["user"].get("isAdmin", False):
        return redirect("/main")
    return render_template("admin.html")

@app.route("/main")
@login_required
def main():
    return render_template("dashboard.html", user=session["user"])

@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json()
        name, email, password = data.get("name","").strip(), data.get("email","").strip(), data.get("password","")
        if not name or not email or not password:
            return jsonify({"success": False, "error": "MissingFields"})
        if not validate_email(email):
            return jsonify({"success": False, "error": "InvalidEmail"})
        if len(password) < 6:
            return jsonify({"success": False, "error": "PasswordTooShort"})
        if dbHandler.insertUser(name, email, password):
            session["user"] = {"name": name, "email": email, "isAdmin": False}
            return jsonify({"success": True, "redirect": "/main"})
        return jsonify({"success": False, "error": "EmailExists"})
    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email, password = data.get("email","").strip(), data.get("password","")
        if not email or not password:
            return jsonify({"success": False, "error": "MissingFields"})
        if email == os.getenv("ADMIN_USERNAME") and password == os.getenv("ADMIN_PASSWORD"):
            session["user"] = {"name": "Admin", "email": email, "isAdmin": True}
            return jsonify({"success": True, "redirect": "/admin"})
        if dbHandler.verifyUser(email, password):
            session["user"] = {"name": dbHandler.getUserName(email), "email": email, "isAdmin": False}
            return jsonify({"success": True, "redirect": "/main"})
        return jsonify({"success": False, "error": "InvalidCredentials"})
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect("/")

@app.route("/update-profile", methods=["POST"])
@login_required
def update_profile():
    try:
        data = request.get_json()
        name = data.get("name","").strip()
        email = session["user"]["email"]
        new_password = data.get("password","").strip()
        if not name:
            return jsonify({"success": False, "error": "MissingName"})
        if not new_password:
            import sqlite3
            conn = sqlite3.connect("database/library.db")
            row = conn.execute("SELECT Password FROM User WHERE Email = ?", (email,)).fetchone()
            conn.close()
            new_password = row[0] if row else ""
        if dbHandler.updateUserInfo(email, name, new_password):
            session["user"]["name"] = name
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "UpdateFailed"})
    except Exception as e:
        print(f"Update profile error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/add-book", methods=["POST"])
@login_required
def add_book():
    try:
        data = request.get_json()
        id, title, author = data.get("id","").strip(), data.get("title","").strip(), data.get("author","").strip()
        if not id or not title or not author:
            return jsonify({"success": False, "error": "MissingFields"})
        if dbHandler.insertBook(id, title, author):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "BookExists"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-booklist")
@login_required
def get_booklist():
    try:
        return jsonify(dbHandler.getAllBooks())
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/edit-book", methods=["POST"])
@login_required
def update_book():
    try:
        data = request.get_json()
        book_id, title, author = data.get("id"), data.get("title","").strip(), data.get("author","").strip()
        if not book_id or not title or not author:
            return jsonify({"success": False, "error": "MissingFields"})
        if dbHandler.updateBook(book_id, title, author):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "BookNotFound"})
    except Exception as e:
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
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-accountlist")
@admin_required
def get_accountlist():
    try:
        accounts = dbHandler.getAllUsers()
        for acc in accounts:
            acc["bookings"] = "Chưa đặt" if dbHandler.getSeatBooking(acc["id"]) is None else "Đã đặt"
            acc["borrows"]  = "Chưa mượn" if dbHandler.getUserBorrowedBooks(acc["id"]) == [] else "Đã mượn"
        return jsonify(accounts)
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/delete-account", methods=["POST"])
@admin_required
def delete_account():
    try:
        data = request.get_json()
        user_id = data.get("id")
        if not user_id:
            return jsonify({"success": False, "error": "MissingID"})
        if dbHandler.deleteUser(user_id):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "UserNotFound"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/save-layout", methods=["POST"])
@admin_required
def save_layout():
    try:
        data = request.get_json()
        dbHandler.deleteAllSeat()
        for obj in data.get("objects", []):
            if obj["type"] == "seat":
                dbHandler.insertSeat(obj["id"])
        with open("layout.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-layout")
@login_required
def get_layout():
    try:
        with open("layout.json", "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-schedule")
@admin_required
def get_schedule():
    try:
        return jsonify(dbHandler.getAllSeatBookings())
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/cancel-booking", methods=["POST"])
@admin_required
def cancel_booking():
    try:
        data = request.get_json()
        booking_id = data.get("id")
        if not booking_id:
            return jsonify({"success": False, "error": "MissingID"})
        if dbHandler.deleteSeatBooking(booking_id):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "NotFound"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-seat-schedule")
@login_required
def get_seat_schedule():
    try:
        seat_id = request.args.get("seat_id", type=int)
        if not seat_id:
            return jsonify({"error": "MissingSeatID"}), 400
        schedule = dbHandler.getSeatSchedule(seat_id)
        return jsonify([{"start": s["start"], "end": s["end"]} for s in schedule])
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/book-seat", methods=["POST"])
@login_required
def book_seat():
    try:
        data = request.get_json()
        seat_id, date_str, hours = data.get("seatId"), data.get("date"), data.get("hours", [])
        if not seat_id or not date_str or not hours:
            return jsonify({"success": False, "error": "MissingFields"})
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not user_id:
            return jsonify({"success": False, "error": "UserNotFound"})
        hours_sorted = sorted(hours)
        start_time = f"{date_str}T{str(hours_sorted[0]).zfill(2)}:00:00"
        end_time   = f"{date_str}T{str(hours_sorted[-1]+1).zfill(2)}:00:00"
        if dbHandler.hasSeatConflict(seat_id, start_time, end_time):
            return jsonify({"success": False, "error": "TimeConflict"})
        if dbHandler.createSeatBooking(user_id, seat_id, start_time, end_time):
            return jsonify({"success": True, "start": start_time, "end": end_time})
        return jsonify({"success": False, "error": "BookingFailed"})
    except Exception as e:
        print(f"Book seat error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/my-bookings")
@login_required
def my_bookings():
    try:
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not user_id:
            return jsonify([])
        return jsonify(dbHandler.getUserBookings(user_id))
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/cancel-my-booking", methods=["POST"])
@login_required
def cancel_my_booking():
    try:
        data = request.get_json()
        booking_id = data.get("id")
        if not booking_id:
            return jsonify({"success": False, "error": "MissingID"})
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not dbHandler.isBookingOwner(booking_id, user_id):
            return jsonify({"success": False, "error": "Unauthorized"})
        if dbHandler.deleteSeatBooking(booking_id):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "NotFound"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/borrow-book", methods=["POST"])
@login_required
def borrow_book():
    try:
        data     = request.get_json()
        book_id  = data.get("bookId")
        due_days = int(data.get("dueDays", 14))

        if not book_id:
            return jsonify({"success": False, "error": "MissingFields"})
        if due_days < 1 or due_days > 90:
            return jsonify({"success": False, "error": "InvalidDueDays"})

        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not user_id:
            return jsonify({"success": False, "error": "UserNotFound"})
        if dbHandler.countActiveBorrows(user_id) >= 3:
            return jsonify({"success": False, "error": "BorrowLimit"})

        start_dt = datetime.now()
        end_dt   = start_dt + timedelta(days=due_days)
        start_time = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_time   = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        if dbHandler.createBookBorrow(user_id, book_id, start_time, end_time):
            due_str = end_dt.strftime("%d/%m/%Y")
            return jsonify({"success": True, "due": due_str})

        return jsonify({"success": False, "error": "BorrowFailed"})
    except Exception as e:
        print(f"Borrow book error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/return-book", methods=["POST"])
@login_required
def return_book():
    try:
        data = request.get_json()
        borrow_id = data.get("borrowId")
        if not borrow_id:
            return jsonify({"success": False, "error": "MissingFields"})
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not dbHandler.isBorrowOwner(borrow_id, user_id):
            return jsonify({"success": False, "error": "Unauthorized"})
        end_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        if dbHandler.returnBook(borrow_id, end_time):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "ReturnFailed"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/my-borrows")
@login_required
def my_borrows():
    try:
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not user_id:
            return jsonify([])
        return jsonify(dbHandler.getUserBorrowsDetail(user_id))
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.errorhandler(404)
def not_found(e):
    return render_template("login.html"), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)