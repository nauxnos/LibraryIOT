import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import json
import os

class DatabaseHandler:
    def __init__(self, strFilePath: str):
        self.strFilePath = strFilePath
        self.conn = sqlite3.connect(self.strFilePath, check_same_thread=False)
        if self.conn is not None:
            self.conn.execute("PRAGMA foreign_keys = ON")
            print("Connected to database successfully!")

    @contextmanager
    def get_cursor(self):
        """Context manager for database cursor"""
        cursor = self.conn.cursor()
        try:
            yield cursor
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            print(f"Database error: {e}")
            raise
        finally:
            cursor.close()

    def __del__(self):
        print("Closing database connection...")
        try:
            self.conn.close()
        except:
            pass

    # ===== USER OPERATIONS =====

    def insertUser(self, strUserName: str, strEmail: str, strPassword: str) -> bool:
        """Insert new user into database"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM User WHERE Email = ?", (strEmail,))
            if cursor.fetchone():
                return False
            cursor.execute(
                "INSERT INTO User (UserName, Email, Password) VALUES (?, ?, ?)",
                (strUserName, strEmail, strPassword)
            )
            return True

    def verifyUser(self, strEmail: str, strPassword: str) -> bool:
        """Verify user credentials"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM User WHERE Email = ? AND Password = ?",
                (strEmail, strPassword)
            )
            return cursor.fetchone() is not None

    def getUserName(self, strEmail: str) -> Optional[str]:
        """Get username by email"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT UserName FROM User WHERE Email = ?", (strEmail,))
            result = cursor.fetchone()
            return result[0] if result else None

    def getUserIdByEmail(self, email: str) -> Optional[int]:
        """Get UserID from email"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT UserID FROM User WHERE Email = ?", (email,))
            row = cursor.fetchone()
            return row[0] if row else None

    def updateUserInfo(self, strEmail: str, strNewUserName: str, strNewPassword: str) -> bool:
        """Update user information"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE User SET UserName = ?, Password = ? WHERE Email = ?",
                (strNewUserName, strNewPassword, strEmail)
            )
            return cursor.rowcount > 0

    def updateUserPasswordById(self, user_id: int, new_password: str) -> bool:
        """Admin: update a user's password by user ID."""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE User SET Password = ? WHERE UserID = ?",
                (new_password, user_id)
            )
            return cursor.rowcount > 0

    def deleteUser(self, userID: int) -> bool:
        """Delete user by ID (cascades to bookings/borrows)"""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM User WHERE UserID = ?", (userID,))
            return cursor.rowcount > 0

    def getAllUsers(self) -> List[Dict[str, Any]]:
        """Get all users"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT UserID, UserName, Email, CreateDate FROM User")
            return [
                {"id": row[0], "name": row[1], "email": row[2], "created": row[3]}
                for row in cursor.fetchall()
            ]

    def getUserById(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get one user by ID."""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT UserID, UserName, Email, CreateDate FROM User WHERE UserID = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {"id": row[0], "name": row[1], "email": row[2], "created": row[3]}

    # ===== BOOK OPERATIONS =====

    def insertBook(self, unBookID: int, strBookName: str, strAuthor: str) -> bool:
        """Insert new book"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM Book WHERE BookID = ?", (unBookID,))
            if cursor.fetchone():
                return False
            cursor.execute(
                "INSERT INTO Book (BookID, BookName, Author, Status) VALUES (?, ?, ?, 1)",
                (unBookID, strBookName, strAuthor)
            )
            return True

    def updateBook(self, unBookID: int, strNewBookName: str, strNewAuthor: str) -> bool:
        """Update book information"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE Book SET BookName = ?, Author = ? WHERE BookID = ?",
                (strNewBookName, strNewAuthor, unBookID)
            )
            return cursor.rowcount > 0

    def deleteBook(self, bookID: int) -> bool:
        """Delete book by ID"""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM Book WHERE BookID = ?", (bookID,))
            return cursor.rowcount > 0

    def updateBookStatus(self, unBookID: int, blStatus: bool) -> bool:
        """Update book availability status"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE Book SET Status = ? WHERE BookID = ?",
                (int(blStatus), unBookID)
            )
            return cursor.rowcount > 0

    def getAllBooks(self) -> List[Dict[str, Any]]:
        """Get all books"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT BookID, BookName, Author, Status, BorrowedCount, RfidUID FROM Book")
            return [
                {
                    "id": row[0], "title": row[1], "author": row[2],
                    "status": bool(row[3]), "borrowedCount": row[4],
                    "rfidUid": row[5] or "",
                }
                for row in cursor.fetchall()
            ]

    # ===== SEAT OPERATIONS =====

    def insertSeat(self, unSeatID: int) -> bool:
        """Insert new seat"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM Seat WHERE SeatID = ?", (unSeatID,))
            if cursor.fetchone():
                return False
            cursor.execute("INSERT INTO Seat (SeatID, Status) VALUES (?, 1)", (unSeatID,))
            return True

    def deleteAllSeat(self) -> bool:
        """Delete all seats from database"""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM Seat")
            return True

    def getSeatBooking(self, unUserID: int) -> Optional[Tuple]:
        """Get active seat booking for a user (for dashboard status check)"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT sm.SeatID, sm.StartTime, sm.EndTime
                FROM SeatManager sm
                WHERE sm.UserID = ? AND sm.EndTime IS NULL
                LIMIT 1
            """, (unUserID,))
            return cursor.fetchone()

    # ===== SEAT BOOKING =====

    def hasSeatConflict(self, seat_id: int, start_time: str, end_time: str) -> bool:
        """Check if seat has a conflicting booking"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT 1 FROM SeatManager
                WHERE SeatID = ?
                  AND (EndTime IS NULL OR EndTime > ?)
                  AND StartTime < ?
            """, (seat_id, start_time, end_time))
            return cursor.fetchone() is not None

    def createSeatBooking(self, unUserID: int, unSeatID: int, tmStartTime: str, tmEndTime: Optional[str] = None) -> bool:
        """Create seat booking record"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM User WHERE UserID = ?", (unUserID,))
            if not cursor.fetchone():
                return False
            cursor.execute("SELECT Status FROM Seat WHERE SeatID = ?", (unSeatID,))
            seat = cursor.fetchone()
            if not seat:
                return False
            cursor.execute(
                "INSERT INTO SeatManager (UserID, SeatID, StartTime, EndTime) VALUES (?, ?, ?, ?)",
                (unUserID, unSeatID, tmStartTime, tmEndTime)
            )
            return True

    def deleteSeatBooking(self, unSeatBookingID: int) -> bool:
        """Delete seat booking"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT SeatID FROM SeatManager WHERE SeatBookingID = ?", (unSeatBookingID,))
            result = cursor.fetchone()
            if not result:
                return False
            cursor.execute("DELETE FROM SeatManager WHERE SeatBookingID = ?", (unSeatBookingID,))
            return True

    def getUserBookings(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all bookings for a user with seat names from layout.json"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT sm.SeatBookingID, sm.SeatID, sm.StartTime, sm.EndTime
                FROM SeatManager sm
                WHERE sm.UserID = ?
                ORDER BY sm.StartTime DESC
            """, (user_id,))
            rows = cursor.fetchall()

        seat_names = self._load_seat_names()
        now = datetime.now()

        result = []
        for row in rows:
            start_dt = None
            end_dt   = None
            try:
                start_dt = datetime.fromisoformat(row[2])
                end_dt   = datetime.fromisoformat(row[3]) if row[3] else None
            except Exception:
                pass

            active = end_dt is None or end_dt > now

            result.append({
                "bookingId": row[0],
                "seatId":    row[1],
                "seatName":  seat_names.get(row[1], f"Ghế #{row[1]}"),
                "start":     row[2],
                "end":       row[3],
                "startFmt":  start_dt.strftime("%d/%m/%Y %H:%M") if start_dt else row[2],
                "endFmt":    end_dt.strftime("%d/%m/%Y %H:%M")   if end_dt   else "—",
                "active":    active
            })
        return result

    def isBookingOwner(self, booking_id: int, user_id: int) -> bool:
        """Check booking belongs to user"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM SeatManager WHERE SeatBookingID = ? AND UserID = ?",
                (booking_id, user_id)
            )
            return cursor.fetchone() is not None

    def getAllSeatBookings(self) -> List[Dict[str, Any]]:
        """Get all seat bookings with user info — for admin"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT
                    sm.SeatBookingID,
                    sm.SeatID,
                    u.UserID,
                    u.UserName,
                    u.Email,
                    sm.StartTime,
                    sm.EndTime
                FROM SeatManager sm
                JOIN User u ON sm.UserID = u.UserID
                ORDER BY sm.StartTime DESC
            """)
            rows = cursor.fetchall()

        seat_names = self._load_seat_names()
        now = datetime.now()

        return [
            {
                "bookingId": row[0],
                "seatId":    row[1],
                "seatName":  seat_names.get(row[1], f"Ghế #{row[1]}"),
                "userId":    row[2],
                "userName":  row[3],
                "email":     row[4],
                "start":     row[5],
                "end":       row[6] if row[6] else None,
                "active":    row[6] is None or datetime.fromisoformat(row[6]) > now
            }
            for row in rows
        ]

    def getSeatSchedule(self, unSeatID: int) -> List[Dict[str, Any]]:
        """Get schedule for one seat — public (no user info)"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT StartTime, EndTime
                FROM SeatManager
                WHERE SeatID = ?
                ORDER BY StartTime DESC
            """, (unSeatID,))
            return [{"start": row[0], "end": row[1]} for row in cursor.fetchall()]

    # ===== BOOK BORROWING =====

    def createBookBorrow(self, unUserID: int, unBookID: int, tmStartTime: str, tmEndTime: str) -> bool:
        """Create book borrow record. tmEndTime = due date (required)."""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM User WHERE UserID = ?", (unUserID,))
            if not cursor.fetchone():
                return False
            cursor.execute("SELECT Status FROM Book WHERE BookID = ?", (unBookID,))
            book = cursor.fetchone()
            if not book or not book[0]:
                return False
            cursor.execute(
                "INSERT INTO BookManager (UserID, BookID, StartTime, EndTime) VALUES (?, ?, ?, ?)",
                (unUserID, unBookID, tmStartTime, tmEndTime)
            )
            cursor.execute(
                "UPDATE Book SET Status = 0, BorrowedCount = BorrowedCount + 1 WHERE BookID = ?",
                (unBookID,)
            )
            return True

    def deleteBookBorrow(self, unBorrowID: int) -> bool:
        """Delete book borrow and restore book status"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT BookID FROM BookManager WHERE BookBorrowID = ?", (unBorrowID,))
            result = cursor.fetchone()
            if not result:
                return False
            cursor.execute("DELETE FROM BookManager WHERE BookBorrowID = ?", (unBorrowID,))
            cursor.execute("UPDATE Book SET Status = 1 WHERE BookID = ?", (result[0],))
            return True

    def countActiveBorrows(self, user_id: int) -> int:
        """Count active borrows (not yet returned)"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM BookManager WHERE UserID = ? AND ReturnedAt IS NULL",
                (user_id,)
            )
            return cursor.fetchone()[0]

    def getBorrowDueDate(self, user_id: int, book_id: int) -> str:
        """Get due date string for active borrow"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT EndTime FROM BookManager
                WHERE UserID = ? AND BookID = ? AND ReturnedAt IS NULL
                ORDER BY BookBorrowID DESC LIMIT 1
            """, (user_id, book_id))
            row = cursor.fetchone()
            if not row:
                return ""
            try:
                return datetime.fromisoformat(row[0]).strftime("%d/%m/%Y")
            except Exception:
                return row[0]

    def isBorrowOwner(self, borrow_id: int, user_id: int) -> bool:
        """Check borrow belongs to user"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM BookManager WHERE BookBorrowID = ? AND UserID = ?",
                (borrow_id, user_id)
            )
            return cursor.fetchone() is not None

    def returnBook(self, borrow_id: int, returned_at: str) -> bool:
        """Return book: set ReturnedAt and restore book status"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT BookID FROM BookManager WHERE BookBorrowID = ?", (borrow_id,))
            row = cursor.fetchone()
            if not row:
                return False
            cursor.execute(
                "UPDATE BookManager SET ReturnedAt = ? WHERE BookBorrowID = ?",
                (returned_at, borrow_id)
            )
            cursor.execute("UPDATE Book SET Status = 1 WHERE BookID = ?", (row[0],))
            return cursor.rowcount > 0

    def getUserBorrowedBooks(self, unUserID: int) -> List[Tuple]:
        """Get active borrows for a user (admin status check)"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ? AND bm.ReturnedAt IS NULL
            """, (unUserID,))
            return cursor.fetchall()

    def getUserBorrowsDetail(self, user_id: int) -> List[Dict[str, Any]]:
        """Get detailed active borrows for a user"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT bm.BookBorrowID, b.BookID, b.BookName, b.Author,
                       bm.StartTime, bm.EndTime
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ? AND bm.ReturnedAt IS NULL
                ORDER BY bm.StartTime DESC
            """, (user_id,))
            result = []
            for row in cursor.fetchall():
                try:
                    due     = datetime.fromisoformat(row[5]).strftime("%d/%m/%Y")
                    overdue = datetime.now() > datetime.fromisoformat(row[5])
                except Exception:
                    due, overdue = "—", False
                result.append({
                    "borrowId": row[0],
                    "bookId":   row[1],
                    "title":    row[2],
                    "author":   row[3],
                    "due":      due,
                    "overdue":  overdue
                })
            return result

    def getUserBorrowsHistory(self, user_id: int) -> List[Dict[str, Any]]:
        """Get all borrow records for a user, including returned books."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT bm.BookBorrowID, b.BookID, b.BookName, b.Author,
                       bm.StartTime, bm.EndTime, bm.ReturnedAt
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ?
                ORDER BY bm.StartTime DESC
            """, (user_id,))
            result = []
            now = datetime.now()
            for row in cursor.fetchall():
                try:
                    due_dt = datetime.fromisoformat(row[5])
                    due = due_dt.strftime("%d/%m/%Y")
                    overdue = row[6] is None and now > due_dt
                except Exception:
                    due, overdue = "—", False
                try:
                    borrowed_fmt = datetime.fromisoformat(row[4]).strftime("%d/%m/%Y %H:%M")
                except Exception:
                    borrowed_fmt = row[4]
                try:
                    returned_fmt = datetime.fromisoformat(row[6]).strftime("%d/%m/%Y %H:%M") if row[6] else ""
                except Exception:
                    returned_fmt = row[6] or ""
                result.append({
                    "borrowId": row[0],
                    "bookId": row[1],
                    "title": row[2],
                    "author": row[3],
                    "borrowedAt": row[4],
                    "borrowedFmt": borrowed_fmt,
                    "due": due,
                    "returnedAt": row[6],
                    "returnedFmt": returned_fmt,
                    "active": row[6] is None,
                    "overdue": overdue
                })
            return result

    def getAllBorrows(self) -> List[Dict[str, Any]]:
        """Get all borrow records with user + book info — for admin activity log"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT
                    bm.BookBorrowID,
                    u.UserID,
                    u.UserName,
                    u.Email,
                    b.BookID,
                    b.BookName,
                    b.Author,
                    bm.StartTime,
                    bm.EndTime,
                    bm.ReturnedAt
                FROM BookManager bm
                JOIN User u ON bm.UserID = u.UserID
                JOIN Book b ON bm.BookID = b.BookID
                ORDER BY bm.StartTime DESC
            """)
            now = datetime.now()
            result = []
            for row in cursor.fetchall():
                try:
                    due_dt  = datetime.fromisoformat(row[8])
                    overdue = row[9] is None and due_dt < now
                    due_str = due_dt.strftime("%d/%m/%Y")
                except Exception:
                    overdue, due_str = False, "—"
                result.append({
                    "borrowId":   row[0],
                    "userId":     row[1],
                    "userName":   row[2],
                    "email":      row[3],
                    "bookId":     row[4],
                    "title":      row[5],
                    "author":     row[6],
                    "borrowedAt": row[7],
                    "due":        due_str,
                    "returnedAt": row[9],
                    "active":     row[9] is None,
                    "overdue":    overdue,
                })
            return result

    def getTopBorrowedBooks(self, period: str = "week", limit: int = 10) -> List[Dict[str, Any]]:
        """Get top borrowed books by borrow records for week/month/all."""
        period_filters = {
            "week": "datetime('now', '-7 days')",
            "month": "datetime('now', '-30 days')",
        }
        where = ""
        if period in period_filters:
            where = f"WHERE bm.StartTime >= {period_filters[period]}"

        with self.get_cursor() as cursor:
            cursor.execute(f"""
                SELECT b.BookID, b.BookName, b.Author,
                       COUNT(bm.BookBorrowID) as borrow_count,
                       b.BorrowedCount,
                       b.Status
                FROM Book b
                JOIN BookManager bm ON b.BookID = bm.BookID
                {where}
                GROUP BY b.BookID, b.BookName, b.Author, b.BorrowedCount, b.Status
                ORDER BY borrow_count DESC, b.BorrowedCount DESC, b.BookName ASC
                LIMIT ?
            """, (limit,))
            return [
                {
                    "id": r[0],
                    "title": r[1],
                    "author": r[2],
                    "periodBorrowCount": r[3],
                    "borrowedCount": r[4],
                    "status": bool(r[5]),
                }
                for r in cursor.fetchall()
            ]

    # ===== SEAT-BOOK LINK =====

    def getSeatUserInfo(self, seat_id: int) -> Optional[Dict[str, Any]]:
        """Get user + active borrows for whoever is currently booked at a seat."""
        with self.get_cursor() as cursor:
            now = datetime.now().isoformat()
            # Find active booking for this seat
            cursor.execute("""
                SELECT sm.SeatBookingID, sm.UserID, u.UserName, u.Email,
                       sm.StartTime, sm.EndTime
                FROM SeatManager sm
                JOIN User u ON sm.UserID = u.UserID
                WHERE sm.SeatID = ?
                  AND sm.StartTime <= ?
                  AND (sm.EndTime IS NULL OR sm.EndTime > ?)
                ORDER BY sm.StartTime DESC LIMIT 1
            """, (seat_id, now, now))
            row = cursor.fetchone()
            if not row:
                return None
            user_id = row[1]
            # Get active borrows for that user
            cursor.execute("""
                SELECT b.BookID, b.BookName, b.Author,
                       bm.StartTime, bm.EndTime, bm.BookBorrowID
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ? AND bm.ReturnedAt IS NULL
                ORDER BY bm.StartTime DESC
            """, (user_id,))
            borrows = []
            for brow in cursor.fetchall():
                try:
                    due = datetime.fromisoformat(brow[4]).strftime("%d/%m/%Y")
                    overdue = datetime.now() > datetime.fromisoformat(brow[4])
                except Exception:
                    due, overdue = "—", False
                borrows.append({
                    "bookId":   brow[0],
                    "title":    brow[1],
                    "author":   brow[2],
                    "borrowedAt": brow[3],
                    "due":      due,
                    "overdue":  overdue,
                    "borrowId": brow[5],
                })
            return {
                "bookingId": row[0],
                "userId":    row[1],
                "userName":  row[2],
                "email":     row[3],
                "start":     row[4],
                "end":       row[5],
                "borrows":   borrows,
            }

    # ===== BOOK RATING =====

    def createRating(self, user_id: int, book_id: int, stars: int, comment: str) -> bool:
        """Insert or replace a book rating (one per user per book)."""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM User WHERE UserID = ?", (user_id,))
            if not cursor.fetchone():
                return False
            cursor.execute("""
                INSERT INTO BookRating (UserID, BookID, Stars, Comment)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(UserID, BookID) DO UPDATE
                SET Stars=excluded.Stars, Comment=excluded.Comment,
                    CreatedAt=datetime('now')
            """, (user_id, book_id, stars, comment))
            return True

    def getBookRatings(self, book_id: int) -> Dict[str, Any]:
        """Get rating summary + individual ratings for a book."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT AVG(Stars), COUNT(*) FROM BookRating WHERE BookID = ?
            """, (book_id,))
            row = cursor.fetchone()
            avg_stars = round(row[0], 1) if row[0] else 0
            count     = row[1]
            cursor.execute("""
                SELECT u.UserName, br.Stars, br.Comment, br.CreatedAt
                FROM BookRating br
                JOIN User u ON br.UserID = u.UserID
                WHERE br.BookID = ?
                ORDER BY br.CreatedAt DESC
            """, (book_id,))
            reviews = [
                {"userName": r[0], "stars": r[1], "comment": r[2], "date": r[3]}
                for r in cursor.fetchall()
            ]
            return {"avg": avg_stars, "count": count, "reviews": reviews}

    def getTopRatedBooks(self, period: str = "month") -> List[Dict[str, Any]]:
        """Get top books by avg rating, filtered by period (week/month/year/all)."""
        with self.get_cursor() as cursor:
            date_filter = {
                "week":  "datetime('now', '-7 days')",
                "month": "datetime('now', '-30 days')",
                "year":  "datetime('now', '-365 days')",
            }.get(period, "datetime('now', '-3650 days')")

            cursor.execute(f"""
                SELECT b.BookID, b.BookName, b.Author,
                       AVG(br.Stars) as avg_stars,
                       COUNT(br.RatingID) as rating_count,
                       b.BorrowedCount
                FROM Book b
                JOIN BookRating br ON b.BookID = br.BookID
                WHERE br.CreatedAt >= {date_filter}
                GROUP BY b.BookID
                HAVING rating_count >= 1
                ORDER BY avg_stars DESC, rating_count DESC
                LIMIT 10
            """)
            return [
                {
                    "id": r[0], "title": r[1], "author": r[2],
                    "avgStars": round(r[3], 1), "ratingCount": r[4],
                    "borrowedCount": r[5]
                }
                for r in cursor.fetchall()
            ]

    def getUserRating(self, user_id: int, book_id: int) -> Optional[Dict]:
        """Get this user's existing rating for a book (if any)."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT Stars, Comment FROM BookRating
                WHERE UserID = ? AND BookID = ?
            """, (user_id, book_id))
            row = cursor.fetchone()
            return {"stars": row[0], "comment": row[1]} if row else None

    # ===== CATEGORY =====

    def getAllCategories(self) -> List[Dict[str, Any]]:
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT c.CategoryID, c.Name, c.Description,
                       COUNT(bc.BookID) as book_count
                FROM Category c
                LEFT JOIN BookCategory bc ON c.CategoryID = bc.CategoryID
                GROUP BY c.CategoryID
                ORDER BY c.Name
            """)
            return [
                {"id": r[0], "name": r[1], "description": r[2], "bookCount": r[3]}
                for r in cursor.fetchall()
            ]

    def insertCategory(self, name: str, description: str = "") -> bool:
        with self.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM Category WHERE Name = ?", (name,))
            if cursor.fetchone(): return False
            cursor.execute(
                "INSERT INTO Category (Name, Description) VALUES (?, ?)",
                (name, description)
            )
            return True

    def deleteCategory(self, cat_id: int) -> bool:
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM Category WHERE CategoryID = ?", (cat_id,))
            return cursor.rowcount > 0

    def setBooksForCategory(self, cat_id: int, book_ids: List[int]) -> bool:
        """Replace all books in a category."""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM BookCategory WHERE CategoryID = ?", (cat_id,))
            for bid in book_ids:
                cursor.execute(
                    "INSERT OR IGNORE INTO BookCategory (CategoryID, BookID) VALUES (?, ?)",
                    (cat_id, bid)
                )
            return True

    def getBooksByCategory(self, cat_id: int) -> List[int]:
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT BookID FROM BookCategory WHERE CategoryID = ?", (cat_id,)
            )
            return [r[0] for r in cursor.fetchall()]

    def getAllBooksWithCategories(self) -> List[Dict[str, Any]]:
        """Get all books with their category IDs."""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT BookID, BookName, Author, Status, BorrowedCount FROM Book")
            books = {r[0]: {"id": r[0], "title": r[1], "author": r[2],
                            "status": bool(r[3]), "borrowedCount": r[4],
                            "categories": []}
                     for r in cursor.fetchall()}
            cursor.execute("SELECT BookID, CategoryID FROM BookCategory")
            for bid, cid in cursor.fetchall():
                if bid in books:
                    books[bid]["categories"].append(cid)
            return list(books.values())

    # ===== STATISTICS =====

    def getTrafficStats(self) -> Dict[str, Any]:
        """Booking + borrow counts by hour-of-day and by day-of-week."""
        with self.get_cursor() as cursor:
            # By hour
            cursor.execute("""
                SELECT strftime('%H', StartTime) as hr, COUNT(*) as cnt
                FROM SeatManager GROUP BY hr ORDER BY hr
            """)
            by_hour_seat = {int(r[0]): r[1] for r in cursor.fetchall()}

            cursor.execute("""
                SELECT strftime('%H', StartTime) as hr, COUNT(*) as cnt
                FROM BookManager GROUP BY hr ORDER BY hr
            """)
            by_hour_book = {int(r[0]): r[1] for r in cursor.fetchall()}

            # By day of week (0=Sun in SQLite)
            cursor.execute("""
                SELECT strftime('%w', StartTime) as dow, COUNT(*) as cnt
                FROM SeatManager GROUP BY dow ORDER BY dow
            """)
            by_dow_seat = {int(r[0]): r[1] for r in cursor.fetchall()}

            cursor.execute("""
                SELECT strftime('%w', StartTime) as dow, COUNT(*) as cnt
                FROM BookManager GROUP BY dow ORDER BY dow
            """)
            by_dow_book = {int(r[0]): r[1] for r in cursor.fetchall()}

            # Daily trend (last 30 days)
            cursor.execute("""
                SELECT date(StartTime) as d, COUNT(*) as cnt
                FROM SeatManager
                WHERE StartTime >= datetime('now', '-30 days')
                GROUP BY d ORDER BY d
            """)
            daily_seat = [{"date": r[0], "count": r[1]} for r in cursor.fetchall()]

            cursor.execute("""
                SELECT date(StartTime) as d, COUNT(*) as cnt
                FROM BookManager
                WHERE StartTime >= datetime('now', '-30 days')
                GROUP BY d ORDER BY d
            """)
            daily_book = [{"date": r[0], "count": r[1]} for r in cursor.fetchall()]

            return {
                "byHour": {
                    "seat": [by_hour_seat.get(h, 0) for h in range(24)],
                    "book": [by_hour_book.get(h, 0) for h in range(24)],
                },
                "byDow": {
                    "seat": [by_dow_seat.get(d, 0) for d in range(7)],
                    "book": [by_dow_book.get(d, 0) for d in range(7)],
                },
                "daily": {"seat": daily_seat, "book": daily_book},
            }



    def setBookRfid(self, book_id: int, rfid_uid: str) -> bool:
        """Gán RfidUID cho sách (admin đăng ký tag)."""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE Book SET RfidUID = ? WHERE BookID = ?",
                (rfid_uid.strip(), book_id)
            )
            return cursor.rowcount > 0

    def getBookByRfid(self, rfid_uid: str) -> Optional[Dict]:
        """Tìm sách theo RfidUID — dùng khi Pi quẹt tag."""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT BookID, BookName, Author, Status FROM Book WHERE RfidUID = ?",
                (rfid_uid.strip(),)
            )
            row = cursor.fetchone()
            if not row: return None
            return {"id": row[0], "title": row[1], "author": row[2], "status": bool(row[3])}

    def getActiveBorrowByBook(self, book_id: int) -> Optional[Dict]:
        """Tìm lượt mượn đang active của sách — dùng khi tự động trả qua RFID."""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT bm.BookBorrowID, u.UserName, u.Email
                FROM BookManager bm
                JOIN User u ON bm.UserID = u.UserID
                WHERE bm.BookID = ? AND bm.ReturnedAt IS NULL
                ORDER BY bm.StartTime DESC LIMIT 1
            """, (book_id,))
            row = cursor.fetchone()
            if not row: return None
            return {"borrowId": row[0], "userName": row[1], "email": row[2]}

    # ===== HELPERS =====

    def _load_seat_names(self) -> Dict[int, str]:
        """Load seat id→name map from layout.json"""
        try:
            if os.path.exists("layout.json"):
                with open("layout.json", "r", encoding="utf-8") as f:
                    layout = json.load(f)
                return {
                    obj["id"]: obj["name"]
                    for obj in layout.get("objects", [])
                    if obj["type"] == "seat"
                }
        except Exception:
            pass
        return {}
