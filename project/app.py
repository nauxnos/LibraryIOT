from flask import Flask, redirect, request, jsonify, render_template, session
from database.DatabaseHandler import DatabaseHandler
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
dbHandler = DatabaseHandler("database/library.db")
app.secret_key = "secret123"  # để dùng session


@app.route("/")
def home():
    return render_template("login.html")

@app.route("/admin")
def admin():
    return render_template("admin.html")

@app.route("/main")
def main():
    if "user" not in session:
        return redirect("/")  # chưa login → về login
    return render_template("dashboard.html", user=session["user"])

@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if dbHandler.insertUser(name, email, password):
        session["user"] = {
            "name": name,
            "email": email
        }
        return jsonify({"success": True, "redirect": "/main"})
    return jsonify({"success": False, "error": "EmailExists"})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if email == os.getenv("ADMIN_USERNAME") and password == os.getenv("ADMIN_PASSWORD"):
        session["user"] = {
            "name": "Admin",
            "email": email
        }
        return jsonify({"success": True, "redirect": "/admin"})

    if dbHandler.verifyUser(email, password):
        session["user"] = {
            "name": dbHandler.getUserName(email),
            "email": email
        }
        return jsonify({"success": True, "redirect": "/main"})
    return jsonify({"success": False, "error": "InvalidCredentials"})

@app.route("/logout")
def logout():
    session.pop("user", None)
    return render_template("login.html")

@app.route("/update-profile", methods=["POST"])
def update_profile():
    if "user" not in session:
        return jsonify({"success": False, "error": "NotLoggedIn"})

    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if dbHandler.updateUserInfo(email, name, password):
        session["user"]["name"] = name
        session["user"]["email"] = email
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "UpdateFailed"})

@app.route("/save-layout", methods=["POST"])
def save_layout():
    data = request.get_json()
    print("Received layout:", data)
    return jsonify({"success": True})

@app.route("/add-book", methods=["POST"])
def add_book():
    data = request.get_json()
    title = data.get("title")
    author = data.get("author")

    if dbHandler.insertBook(title, author):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "FailedToAddBook"})

@app.route("/get-booklist")
def get_booklist():
    books = dbHandler.getAllBooks()
    return jsonify(books)

@app.route("/edit-book", methods=["POST"])
def update_book():
    data = request.get_json()
    book_id = data.get("id")
    title = data.get("title")
    author = data.get("author")

    if dbHandler.updateBook(book_id, title, author):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "FailedToUpdateBook"})

@app.route("/delete-book", methods=["POST"])
def delete_book():
    data = request.get_json()
    book_id = data.get("id")

    if dbHandler.deleteBook(book_id):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "FailedToDeleteBook"})

@app.route("/get-accountlist")
def get_accountlist():
    accounts = dbHandler.getAllUsers()
    for acc in accounts:
        acc["bookings"] = "Chưa đặt" if dbHandler.getSeatBooking(acc["id"]) is None else "Đã đặt"
        acc["borrows"] = "Chưa mượn" if dbHandler.getUserBorrowedBooks(acc["id"]) == [] else "Đã mượn"
    return jsonify(accounts)

@app.route("/delete-account", methods=["POST"])
def delete_account():
    data = request.get_json()
    user_id = data.get("id")

    if dbHandler.deleteUser(user_id):
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "FailedToDeleteUser"})

if __name__ == "__main__":
    app.run(host="0.0.0.0")