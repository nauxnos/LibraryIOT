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

# ── IoT Sensor Presence State ──────────────────────────────────────────────
# { seat_id (int): {"occupied": bool, "distance": float, "updated_at": str} }
presence_state = {}

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


# ===== PWA ROUTES =====

@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")

@app.route("/service-worker.js")
def service_worker():
    from flask import make_response
    resp = make_response(app.send_static_file("service-worker.js"))
    resp.headers["Service-Worker-Allowed"] = "/"
    resp.headers["Cache-Control"] = "no-cache"
    return resp

@app.route("/offline")
def offline():
    return render_template("offline.html")


@app.route("/get-seat-presence")
@login_required
def get_seat_presence():
    """Return current sensor presence for all seats. Used by frontend polling."""
    return jsonify(presence_state)


@app.route("/get-activity-log")
@admin_required
def get_activity_log():
    """Merge seat bookings + book borrows into unified activity timeline for admin dashboard."""
    try:
        bookings = dbHandler.getAllSeatBookings()
        borrows  = dbHandler.getAllBorrows()

        events = []

        for b in bookings:
            events.append({
                "type":      "seat_book",
                "time":      b["start"],
                "userName":  b["userName"],
                "email":     b["email"],
                "detail":    b["seatName"],
                "subDetail": f"{b['start'][11:16]} – {b['end'][11:16] if b['end'] else '?'}",
                "active":    b["active"],
                "id":        b["bookingId"],
            })

        for bw in borrows:
            action = "seat_return" if bw["returnedAt"] else "book_borrow"
            events.append({
                "type":      action,
                "time":      bw["returnedAt"] if bw["returnedAt"] else bw["borrowedAt"],
                "userName":  bw["userName"],
                "email":     bw["email"],
                "detail":    bw["title"],
                "subDetail": f"Hạn trả: {bw['due']}" if not bw["returnedAt"] else f"Trả lúc {bw['returnedAt'][11:16]}",
                "active":    bw["active"],
                "overdue":   bw.get("overdue", False),
                "id":        bw["borrowId"],
            })

        # Sort by time desc
        events.sort(key=lambda e: e["time"] or "", reverse=True)
        return jsonify(events[:200])   # cap at 200 most recent
    except Exception as e:
        print(f"get-activity-log error: {e}")
        return jsonify({"error": "ServerError"}), 500


# ===== SEAT-BOOK LINK =====

@app.route("/get-seat-user-info")
@admin_required
def get_seat_user_info():
    """Admin: xem user + sách đang mượn tại một ghế cụ thể."""
    try:
        seat_id = request.args.get("seat_id", type=int)
        if not seat_id:
            return jsonify({"error": "MissingSeatID"}), 400
        info = dbHandler.getSeatUserInfo(seat_id)
        return jsonify(info)
    except Exception as e:
        print(f"get-seat-user-info error: {e}")
        return jsonify({"error": "ServerError"}), 500

# ===== BOOK RATING =====

@app.route("/rate-book", methods=["POST"])
@login_required
def rate_book():
    try:
        data    = request.get_json()
        book_id = data.get("bookId")
        stars   = int(data.get("stars", 0))
        comment = data.get("comment", "").strip()
        if not book_id or stars < 1 or stars > 5:
            return jsonify({"success": False, "error": "InvalidInput"})
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        if dbHandler.createRating(user_id, book_id, stars, comment):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "RatingFailed"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-book-ratings")
@login_required
def get_book_ratings():
    try:
        book_id = request.args.get("book_id", type=int)
        if not book_id:
            return jsonify({"error": "MissingBookID"}), 400
        data = dbHandler.getBookRatings(book_id)
        # Also attach current user's rating if any
        user_id = dbHandler.getUserIdByEmail(session["user"]["email"])
        data["myRating"] = dbHandler.getUserRating(user_id, book_id)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/get-top-rated")
@admin_required
def get_top_rated():
    try:
        period = request.args.get("period", "month")
        return jsonify(dbHandler.getTopRatedBooks(period))
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

# ===== CATEGORY =====

@app.route("/get-categories")
@login_required
def get_categories():
    try:
        return jsonify(dbHandler.getAllCategories())
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

@app.route("/add-category", methods=["POST"])
@admin_required
def add_category():
    try:
        data = request.get_json()
        name = data.get("name", "").strip()
        desc = data.get("description", "").strip()
        if not name:
            return jsonify({"success": False, "error": "MissingName"})
        if dbHandler.insertCategory(name, desc):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "CategoryExists"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/delete-category", methods=["POST"])
@admin_required
def delete_category():
    try:
        cat_id = request.get_json().get("id")
        if not cat_id:
            return jsonify({"success": False, "error": "MissingID"})
        if dbHandler.deleteCategory(cat_id):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "NotFound"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/set-category-books", methods=["POST"])
@admin_required
def set_category_books():
    try:
        data    = request.get_json()
        cat_id  = data.get("categoryId")
        book_ids = data.get("bookIds", [])
        if not cat_id:
            return jsonify({"success": False, "error": "MissingID"})
        dbHandler.setBooksForCategory(cat_id, book_ids)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.route("/get-booklist-with-categories")
@login_required
def get_booklist_with_categories():
    try:
        return jsonify(dbHandler.getAllBooksWithCategories())
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500

# ===== STATISTICS =====

@app.route("/get-traffic-stats")
@admin_required
def get_traffic_stats():
    try:
        return jsonify(dbHandler.getTrafficStats())
    except Exception as e:
        return jsonify({"error": "ServerError"}), 500


@app.route("/get-all-ratings")
@login_required
def get_all_ratings():
    """Rating summary for all books — used to populate stars on book cards."""
    try:
        with dbHandler.get_cursor() as cursor:
            cursor.execute("""
                SELECT BookID,
                       ROUND(AVG(Stars), 1) as avg_stars,
                       COUNT(*)             as rating_count
                FROM BookRating
                GROUP BY BookID
            """)
            return jsonify([
                {"bookId": r[0], "avgStars": r[1], "ratingCount": r[2]}
                for r in cursor.fetchall()
            ])
    except Exception as e:
        return jsonify([])   # graceful — table may not exist yet


# ═══════════════════════════════════════════════════
# RFID BORROW/RETURN  — pending state + polling
# ═══════════════════════════════════════════════════
import threading

# pending_borrow: { bookId: {userId, userName, expires} }
# Tạo khi user bấm "Mượn" trên web, xóa khi Pi xác nhận hoặc timeout
pending_borrow = {}
_pending_lock  = threading.Lock()

# rfid_result: { bookId: {success, message, userName, due} }
# Pi ghi vào đây sau khi xác nhận, frontend polling đọc
rfid_result = {}


@app.route("/start-borrow", methods=["POST"])
@login_required
def start_borrow():
    """
    Bước 1: User bấm Mượn trên web.
    Tạo pending entry, chờ Pi quẹt RFID trong 60 giây.
    """
    try:
        data    = request.get_json()
        book_id = data.get("bookId")
        if not book_id:
            return jsonify({"success": False, "error": "MissingFields"})

        user_id  = dbHandler.getUserIdByEmail(session["user"]["email"])
        if not user_id:
            return jsonify({"success": False, "error": "UserNotFound"})
        if dbHandler.countActiveBorrows(user_id) >= 3:
            return jsonify({"success": False, "error": "BorrowLimit"})

        book = next((b for b in dbHandler.getAllBooks() if b["id"] == book_id), None)
        if not book or not book["status"]:
            return jsonify({"success": False, "error": "BookUnavailable"})

        expires = datetime.now().timestamp() + 60   # 60 giây timeout

        with _pending_lock:
            pending_borrow[book_id] = {
                "userId":   user_id,
                "userName": session["user"]["name"],
                "expires":  expires,
            }
            # Xóa kết quả cũ nếu có
            rfid_result.pop(book_id, None)

        return jsonify({"success": True, "expires": int(expires)})

    except Exception as e:
        print(f"start-borrow error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500


@app.route("/borrow-status")
@login_required
def borrow_status():
    """
    Bước 2: Frontend polling mỗi 2s để biết Pi đã xác nhận chưa.
    """
    try:
        book_id = request.args.get("book_id", type=int)
        if not book_id:
            return jsonify({"status": "error"})

        now = datetime.now().timestamp()

        # Có kết quả từ Pi chưa?
        with _pending_lock:
            result = rfid_result.get(book_id)
            if result:
                rfid_result.pop(book_id, None)
                pending_borrow.pop(book_id, None)
                return jsonify({"status": "done", **result})

            # Còn pending không?
            pending = pending_borrow.get(book_id)
            if not pending:
                return jsonify({"status": "idle"})
            if now > pending["expires"]:
                pending_borrow.pop(book_id, None)
                return jsonify({"status": "timeout"})

        return jsonify({
            "status":      "waiting",
            "secondsLeft": int(pending["expires"] - now),
        })

    except Exception as e:
        return jsonify({"status": "error"})


@app.route("/cancel-pending-borrow", methods=["POST"])
@login_required
def cancel_pending_borrow():
    """User hủy chờ RFID."""
    try:
        book_id = request.get_json().get("bookId")
        with _pending_lock:
            pending_borrow.pop(book_id, None)
            rfid_result.pop(book_id, None)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False})


@app.route("/register-book-rfid", methods=["POST"])
@admin_required
def register_book_rfid():
    """Admin đăng ký RfidUID cho sách (quẹt tag 1 lần)."""
    try:
        data     = request.get_json()
        book_id  = data.get("bookId")
        rfid_uid = data.get("rfidUid", "").strip()
        if not book_id or not rfid_uid:
            return jsonify({"success": False, "error": "MissingFields"})
        if dbHandler.setBookRfid(book_id, rfid_uid):
            return jsonify({"success": True})
        return jsonify({"success": False, "error": "BookNotFound"})
    except Exception as e:
        return jsonify({"success": False, "error": "ServerError"}), 500


# ═══════════════════════════════════════════════════
# EMAIL NOTIFICATION  (Gmail SMTP, admin-triggered)
# ═══════════════════════════════════════════════════
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send a single email via Gmail SMTP. Returns True on success."""
    gmail_user = os.getenv("GMAIL_USER", "")
    gmail_pass = os.getenv("GMAIL_APP_PASSWORD", "")
    if not gmail_user or not gmail_pass:
        print("[Email] GMAIL_USER or GMAIL_APP_PASSWORD not set in .env")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Thư Viện Số <{gmail_user}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=10) as server:
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, to_email, msg.as_string())
        print(f"[Email] Sent to {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"[Email] Error sending to {to_email}: {e}")
        return False


def _email_template(title: str, body_html: str) -> str:
    """Wrap content in a simple HTML email template."""
    return f"""<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#2D5A3D;padding:24px 28px">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">📚 Thư Viện Số</h1>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 16px;color:#1a1814;font-size:18px">{title}</h2>
      {body_html}
    </div>
    <div style="background:#f5f3ef;padding:14px 28px;font-size:12px;color:#888">
      Email tự động từ hệ thống Thư Viện Số. Vui lòng không trả lời email này.
    </div>
  </div>
</body></html>"""


@app.route("/send-email", methods=["POST"])
@admin_required
def send_email_route():
    """Admin gửi email thông báo.
    Body: { type: 'overdue'|'due_soon'|'custom', borrowIds?: [...], to?: str, subject?: str, message?: str }
    """
    try:
        data     = request.get_json()
        email_type = data.get("type", "custom")
        results  = {"sent": 0, "failed": 0, "errors": []}

        if email_type in ("overdue", "due_soon"):
            # Gửi hàng loạt cho các lượt mượn sắp/đã quá hạn
            borrow_ids = data.get("borrowIds", [])
            borrows = dbHandler.getAllBorrows()
            now     = datetime.now()

            targets = []
            for b in borrows:
                if b["returnedAt"]:
                    continue   # đã trả rồi
                if borrow_ids and b["borrowId"] not in borrow_ids:
                    continue   # chỉ lọc theo id nếu được truyền vào
                try:
                    due_dt = datetime.strptime(b["due"], "%d/%m/%Y")
                except Exception:
                    continue
                days_left = (due_dt - now).days

                if email_type == "overdue" and days_left >= 0:
                    continue   # chưa quá hạn
                if email_type == "due_soon" and not (0 <= days_left <= 3):
                    continue   # không trong window 3 ngày

                targets.append({**b, "daysLeft": days_left, "dueDt": due_dt})

            if not targets:
                return jsonify({"success": True, "message": "Không có lượt mượn nào phù hợp.", **results})

            for b in targets:
                days_left = b["daysLeft"]
                if email_type == "overdue":
                    overdue_days = abs(days_left)
                    subject  = f"[Thư Viện] Sách quá hạn {overdue_days} ngày — {b['title']}"
                    body_html = f"""
                        <p style="color:#555;line-height:1.7">Xin chào <strong>{b['userName']}</strong>,</p>
                        <p style="color:#555;line-height:1.7">Bạn đang mượn cuốn sách dưới đây đã <strong style="color:#c0392b">quá hạn {overdue_days} ngày</strong>:</p>
                        <div style="background:#fdf3f3;border-left:4px solid #c0392b;padding:14px 18px;border-radius:6px;margin:16px 0">
                          <div style="font-size:16px;font-weight:600;color:#1a1814">{b['title']}</div>
                          <div style="color:#888;margin-top:4px">{b['author']}</div>
                          <div style="color:#c0392b;margin-top:8px;font-size:14px">⚠️ Hạn trả: {b['due']}</div>
                        </div>
                        <p style="color:#555;line-height:1.7">Vui lòng mang sách đến thư viện để trả sớm nhất có thể.</p>"""
                else:
                    subject   = f"[Thư Viện] Sách sắp hết hạn sau {days_left} ngày — {b['title']}"
                    body_html = f"""
                        <p style="color:#555;line-height:1.7">Xin chào <strong>{b['userName']}</strong>,</p>
                        <p style="color:#555;line-height:1.7">Sách bạn đang mượn sẽ <strong style="color:#c8a96e">hết hạn sau {days_left} ngày</strong>:</p>
                        <div style="background:#fdf8ee;border-left:4px solid #c8a96e;padding:14px 18px;border-radius:6px;margin:16px 0">
                          <div style="font-size:16px;font-weight:600;color:#1a1814">{b['title']}</div>
                          <div style="color:#888;margin-top:4px">{b['author']}</div>
                          <div style="color:#c8a96e;margin-top:8px;font-size:14px">📅 Hạn trả: {b['due']}</div>
                        </div>
                        <p style="color:#555;line-height:1.7">Nếu cần thêm thời gian, bạn có thể gia hạn qua hệ thống hoặc liên hệ thủ thư.</p>"""

                ok = _send_email(b["email"], subject,
                                 _email_template(subject, body_html))
                if ok: results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(b["email"])

        elif email_type == "custom":
            # Gửi email tự do đến 1 địa chỉ
            to      = data.get("to", "").strip()
            subject = data.get("subject", "Thông báo từ Thư Viện").strip()
            message = data.get("message", "").strip()
            if not to or not message:
                return jsonify({"success": False, "error": "MissingFields"})
            body_html = f"<p style='color:#555;line-height:1.8;white-space:pre-wrap'>{message}</p>"
            ok = _send_email(to, subject, _email_template(subject, body_html))
            if ok: results["sent"] = 1
            else:  results["failed"] = 1

        else:
            return jsonify({"success": False, "error": "UnknownType"})

        return jsonify({
            "success": results["failed"] == 0,
            "message": f"Đã gửi {results['sent']} email" + (f", lỗi {results['failed']}" if results["failed"] else ""),
            **results
        })

    except Exception as e:
        print(f"send-email error: {e}")
        return jsonify({"success": False, "error": "ServerError"}), 500

@app.errorhandler(404)
def not_found(e):
    return render_template("login.html"), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)