import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict, Any, Tuple

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

    def updateUserInfo(self, strEmail: str, strNewUserName: str, strNewPassword: str) -> bool:
        """Update user information"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE User SET UserName = ?, Password = ? WHERE Email = ?",
                (strNewUserName, strNewPassword, strEmail)
            )
            return cursor.rowcount > 0

    def deleteUser(self, userID: int) -> bool:
        """Delete user by ID"""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM User WHERE UserID = ?", (userID,))
            return cursor.rowcount > 0

    def getAllUsers(self) -> List[Dict[str, Any]]:
        """Get all users"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT UserID, UserName, Email, CreateDate FROM User")
            return [
                {
                    "id": row[0],
                    "name": row[1],
                    "email": row[2],
                    "created": row[3]
                }
                for row in cursor.fetchall()
            ]

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
            cursor.execute("SELECT BookID, BookName, Author, Status, BorrowedCount FROM Book")
            return [
                {
                    "id": row[0],
                    "title": row[1],
                    "author": row[2],
                    "status": bool(row[3]),
                    "borrowedCount": row[4]
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

    def updateSeatStatus(self, unSeatID: int, blStatus: bool) -> bool:
        """Update seat status"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "UPDATE Seat SET Status = ? WHERE SeatID = ?",
                (int(blStatus), unSeatID)
            )
            return cursor.rowcount > 0

    def getSeatBooking(self, unUserID: int) -> Optional[Tuple]:
        """Get current seat booking for a user"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT sm.SeatID, sm.StartTime, sm.EndTime 
                FROM SeatManager sm
                WHERE sm.UserID = ? AND sm.EndTime IS NULL
            """, (unUserID,))
            return cursor.fetchone()

    def deleteAllSeat(self) -> bool:
        """Delete all seats from database"""
        with self.get_cursor() as cursor:
            cursor.execute("DELETE FROM Seat")
            return cursor.rowcount > 0

    # ===== BOOKING & BORROW OPERATIONS =====
    
    def createBookBorrow(self, unUserID: int, unBookID: int, tmStartTime: str, tmEndTime: Optional[str] = None) -> bool:
        """Create book borrow record"""
        with self.get_cursor() as cursor:
            # Verify user and book exist
            cursor.execute("SELECT 1 FROM User WHERE UserID = ?", (unUserID,))
            if not cursor.fetchone():
                return False
            
            cursor.execute("SELECT Status FROM Book WHERE BookID = ?", (unBookID,))
            book = cursor.fetchone()
            if not book or not book[0]:
                return False
            
            # Create borrow record
            cursor.execute(
                "INSERT INTO BookManager (UserID, BookID, StartTime, EndTime) VALUES (?, ?, ?, ?)",
                (unUserID, unBookID, tmStartTime, tmEndTime)
            )
            
            # Update book status and count
            cursor.execute(
                "UPDATE Book SET Status = 0, BorrowedCount = BorrowedCount + 1 WHERE BookID = ?",
                (unBookID,)
            )
            return True

    def createSeatBooking(self, unUserID: int, unSeatID: int, tmStartTime: str, tmEndTime: Optional[str] = None) -> bool:
        """Create seat booking record"""
        with self.get_cursor() as cursor:
            # Verify user and seat exist
            cursor.execute("SELECT 1 FROM User WHERE UserID = ?", (unUserID,))
            if not cursor.fetchone():
                return False
            
            cursor.execute("SELECT Status FROM Seat WHERE SeatID = ?", (unSeatID,))
            seat = cursor.fetchone()
            if not seat or not seat[0]:
                return False
            
            # Create booking record
            cursor.execute(
                "INSERT INTO SeatManager (UserID, SeatID, StartTime, EndTime) VALUES (?, ?, ?, ?)",
                (unUserID, unSeatID, tmStartTime, tmEndTime)
            )
            
            # Update seat status
            cursor.execute("UPDATE Seat SET Status = 0 WHERE SeatID = ?", (unSeatID,))
            return True

    def deleteBookBorrow(self, unBorrowID: int) -> bool:
        """Delete book borrow record and restore book status"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT BookID FROM BookManager WHERE BookBorrowID = ?", (unBorrowID,))
            result = cursor.fetchone()
            if not result:
                return False
            
            unBookID = result[0]
            cursor.execute("DELETE FROM BookManager WHERE BookBorrowID = ?", (unBorrowID,))
            cursor.execute("UPDATE Book SET Status = 1 WHERE BookID = ?", (unBookID,))
            return True

    def deleteSeatBooking(self, unSeatBookingID: int) -> bool:
        """Delete seat booking and restore seat status"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT SeatID FROM SeatManager WHERE SeatBookingID = ?", (unSeatBookingID,))
            result = cursor.fetchone()
            if not result:
                return False
            
            unSeatID = result[0]
            cursor.execute("DELETE FROM SeatManager WHERE SeatBookingID = ?", (unSeatBookingID,))
            cursor.execute("UPDATE Seat SET Status = 1 WHERE SeatID = ?", (unSeatID,))
            return True

    def getUserBorrowedBooks(self, unUserID: int) -> List[Tuple]:
        """Get all books currently borrowed by a user"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime 
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ? AND bm.EndTime IS NULL
            """, (unUserID,))
            return cursor.fetchall()

    # ===== THÊM VÀO DatabaseHandler.py (trong class DatabaseHandler) =====

    def getAllSeatBookings(self) -> List[Dict[str, Any]]:
        """Lấy toàn bộ lịch đặt ghế kèm thông tin người thuê — dành cho admin"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT
                    sm.SeatBookingID,
                    sm.SeatID,
                    s2.SeatID as SeatDBID,
                    sm.Email,
                    u.UserName,
                    u.Email,
                    sm.StartTime,
                    sm.EndTime
                FROM SeatManager sm
                JOIN User u ON sm.Email = u.Email
                JOIN Seat s2 ON sm.SeatID = s2.SeatID
                ORDER BY sm.StartTime DESC
            """)
            rows = cursor.fetchall()
            # Đọc tên ghế từ layout.json nếu có
            import json, os
            seat_names = {}
            try:
                if os.path.exists("layout.json"):
                    with open("layout.json", "r", encoding="utf-8") as f:
                        layout = json.load(f)
                    seat_names = {
                        obj["id"]: obj["name"]
                        for obj in layout.get("objects", [])
                        if obj["type"] == "seat"
                    }
            except Exception:
                pass

            return [
                {
                    "bookingId": row[0],
                    "seatId":    row[1],
                    "seatName":  seat_names.get(row[1], f"Ghế #{row[1]}"),
                    "userId":    row[3],
                    "userName":  row[4],
                    "email":     row[5],
                    "start":     row[6],
                    "end":       row[7] or "—"
                }
                for row in rows
            ]

    def getSeatSchedule(self, unSeatID: int) -> List[Dict[str, Any]]:
        """Lấy lịch của 1 ghế — chỉ trả start/end, không lộ user"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT StartTime, EndTime
                FROM SeatManager
                WHERE SeatID = ?
                ORDER BY StartTime DESC
            """, (unSeatID,))
            return [
                {"start": row[0], "end": row[1] or None}
                for row in cursor.fetchall()
            ]


    def getUserIdByEmail(self, email: str) -> Optional[int]:
        """Lấy UserID từ email"""
        with self.get_cursor() as cursor:
            cursor.execute("SELECT UserID FROM User WHERE Email = ?", (email,))
            row = cursor.fetchone()
            return row[0] if row else None
 
    # ── SEAT BOOKING ──────────────────────────────
 
    def hasSeatConflict(self, seat_id: int, start_time: str, end_time: str) -> bool:
        """Kiểm tra ghế có bị trùng lịch không"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT 1 FROM SeatManager
                WHERE SeatID = ?
                  AND (EndTime IS NULL OR EndTime > ?)
                  AND StartTime < ?
            """, (seat_id, start_time, end_time))
            return cursor.fetchone() is not None
 
    def getUserBookings(self, user_id: int) -> List[Dict[str, Any]]:
        """Lấy tất cả booking của user, kèm tên ghế từ layout.json"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT sm.SeatBookingID, sm.SeatID, sm.StartTime, sm.EndTime
                FROM SeatManager sm
                WHERE sm.UserID = ?
                ORDER BY sm.StartTime DESC
            """, (user_id,))
            rows = cursor.fetchall()
 
        # Đọc tên ghế từ layout.json
        import json, os
        seat_names = {}
        try:
            if os.path.exists("layout.json"):
                with open("layout.json", "r", encoding="utf-8") as f:
                    layout = json.load(f)
                seat_names = {
                    obj["id"]: obj["name"]
                    for obj in layout.get("objects", [])
                    if obj["type"] == "seat"
                }
        except Exception:
            pass
 
        return [
            {
                "bookingId": row[0],
                "seatId":    row[1],
                "seatName":  seat_names.get(row[1], f"Ghế #{row[1]}"),
                "start":     row[2],
                "end":       row[3],
                "active":    row[3] is None
            }
            for row in rows
        ]
 
    def isBookingOwner(self, booking_id: int, user_id: int) -> bool:
        """Kiểm tra booking có thuộc về user không"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM SeatManager WHERE SeatBookingID = ? AND UserID = ?",
                (booking_id, user_id)
            )
            return cursor.fetchone() is not None
 
    # ── BOOK BORROWING ────────────────────────────
 
    def countActiveBorrows(self, user_id: int) -> int:
        """Đếm số sách đang mượn (chưa trả)"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM BookManager
                WHERE UserID = ? AND EndTime IS NULL
            """, (user_id,))
            return cursor.fetchone()[0]
 
    def getBorrowDueDate(self, user_id: int, book_id: int) -> str:
        """Tính hạn trả = start + 14 ngày"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT StartTime FROM BookManager
                WHERE UserID = ? AND BookID = ? AND EndTime IS NULL
                ORDER BY BookBorrowID DESC LIMIT 1
            """, (user_id, book_id))
            row = cursor.fetchone()
            if not row:
                return ""
            from datetime import datetime, timedelta
            start = datetime.fromisoformat(row[0])
            due   = start + timedelta(days=14)
            return due.strftime("%d/%m/%Y")
 
    def isBorrowOwner(self, borrow_id: int, user_id: int) -> bool:
        """Kiểm tra borrow có thuộc về user không"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM BookManager WHERE BookBorrowID = ? AND UserID = ?",
                (borrow_id, user_id)
            )
            return cursor.fetchone() is not None
 
    def returnBook(self, borrow_id: int, end_time: str) -> bool:
        """Trả sách: cập nhật EndTime và mở lại trạng thái sách"""
        with self.get_cursor() as cursor:
            cursor.execute(
                "SELECT BookID FROM BookManager WHERE BookBorrowID = ?",
                (borrow_id,)
            )
            row = cursor.fetchone()
            if not row:
                return False
            book_id = row[0]
            cursor.execute(
                "UPDATE BookManager SET EndTime = ? WHERE BookBorrowID = ?",
                (end_time, borrow_id)
            )
            cursor.execute(
                "UPDATE Book SET Status = 1 WHERE BookID = ?",
                (book_id,)
            )
            return cursor.rowcount > 0
 
    def getUserBorrowsDetail(self, user_id: int) -> List[Dict[str, Any]]:
        """Lấy danh sách sách đang mượn (chưa trả) của user"""
        with self.get_cursor() as cursor:
            cursor.execute("""
                SELECT bm.BookBorrowID, b.BookID, b.BookName, b.Author, bm.StartTime
                FROM BookManager bm
                JOIN Book b ON bm.BookID = b.BookID
                WHERE bm.UserID = ? AND bm.EndTime IS NULL
                ORDER BY bm.StartTime DESC
            """, (user_id,))
            from datetime import datetime, timedelta
            result = []
            for row in cursor.fetchall():
                try:
                    start = datetime.fromisoformat(row[4])
                    due   = (start + timedelta(days=14)).strftime("%d/%m/%Y")
                    overdue = datetime.now() > start + timedelta(days=14)
                except Exception:
                    due = "—"
                    overdue = False
                result.append({
                    "borrowId": row[0],
                    "bookId":   row[1],
                    "title":    row[2],
                    "author":   row[3],
                    "due":      due,
                    "overdue":  overdue
                })
            return result