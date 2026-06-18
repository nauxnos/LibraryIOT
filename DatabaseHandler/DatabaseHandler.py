import sqlite3

class DatabaseHandler:
    def __init__(self, strFilePath):
        self.strFilePath = strFilePath
        self.conn = sqlite3.connect(self.strFilePath)
        self.cursor = self.conn.cursor()

    def __del__(self):
        self.conn.close()

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

    def insertUser(self, strUserName, strEmail, strPassword):
        # Kiểm tra nếu email đã tồn tại
        self.cursor.execute("SELECT * FROM User WHERE Email = ?", (strEmail,))
        blUserFind = self.cursor.fetchone()
        # Nếu email chưa tồn tại, thực hiện chèn dữ liệu vào bảng User
        if not blUserFind:
            self.cursor.execute("INSERT INTO User (UserName, Email, Password) VALUES (?, ?, ?)", (strUserName, strEmail, strPassword))
            self.commit()
            return True
        # Nếu email đã tồn tại, trả về False để thông báo lỗi
        else:
            return False

    def insertBook(self, strBookName):
        # Kiểm tra nếu book đã tồn tại
        self.cursor.execute("SELECT * FROM Book WHERE BookName = ?", (strBookName,))
        blBookFind = self.cursor.fetchone()
        # Nếu book chưa tồn tại, thực hiện chèn dữ liệu vào bảng Book
        if not blBookFind:
            self.cursor.execute("INSERT INTO Book (BookName, Status) VALUES (?, ?)", (strBookName, True))
            self.commit()
            return True
        # Nếu book đã tồn tại, trả về False để thông báo lỗi
        else:
            return False

    def insertSeat(self, unSeatNumber):
        # Kiểm tra nếu seat đã tồn tại
        self.cursor.execute("SELECT * FROM Seat WHERE SeatID = ?", (unSeatNumber,))
        blSeatFind = self.cursor.fetchone()
        # Nếu seat chưa tồn tại, thực hiện chèn dữ liệu vào bảng Seat
        if not blSeatFind:
            self.cursor.execute("INSERT INTO Seat (SeatID, Status) VALUES (?, ?)", (unSeatNumber, True))
            self.commit()
            return True
        # Nếu saetr đã tồn tại, trả về False để thông báo lỗi
        else:
            return False

    def creatBookBorrow(self, unUserID, unBookID, tmStartTime, tmEndTime):
        # Kiểm tra nếu user đã tồn tại
        self.cursor.execute("SELECT * FROM User WHERE UserID = ?", (unUserID,))
        blUserFind = self.cursor.fetchone()
        # Kiểm tra nếu book đã tồn tại
        self.cursor.execute("SELECT * FROM Book WHERE BookID = ?", (unBookID,))
        blBookFind = self.cursor.fetchone()
        # Nếu user và book đều tồn tại, thực hiện chèn dữ liệu vào bảng BookManager
        if blUserFind and blBookFind:
            self.cursor.execute("INSERT INTO BookManager (UserID, BookID, StartTime, EndTime) VALUES (?, ?, ?, ?)", (unUserID, unBookID, tmStartTime, tmEndTime))
            self.commit()
            return True
        # Nếu user hoặc book không tồn tại, trả về False để thông báo lỗi
        else:
            return False

    def creatSeatBooking(self, unUserID, unSeatID, tmStartTime, tmEndTime):
        # Kiểm tra nếu user đã tồn tại
        self.cursor.execute("SELECT * FROM User WHERE UserID = ?", (unUserID,))
        blUserFind = self.cursor.fetchone()
        # Kiểm tra nếu seat đã tồn tại
        self.cursor.execute("SELECT * FROM Seat WHERE SeatID = ?", (unSeatID,))
        blSeatFind = self.cursor.fetchone()
        # Nếu user và seat đều tồn tại, thực hiện chèn dữ liệu vào bảng BookManager
        if blUserFind and blSeatFind:
            self.cursor.execute("INSERT INTO SeatManager (UserID, SeatID, StartTime, EndTime) VALUES (?, ?, ?, ?)", (unUserID, unSeatID, tmStartTime, tmEndTime))
            self.commit()
            return True
        # Nếu user hoặc seat không tồn tại, trả về False để thông báo lỗi
        else:
            return False

    def updateBookStatus(self, unBookID, blStatus):
        # cap nhat trang thai cua book
        self.cursor.execute(
        "UPDATE Book SET Status = ? WHERE BookID = ?",
        (blStatus, unBookID))
        self.commit()
        return True

    def updateUserInfo(self, unUserID, strNewUserName, strNewEmail, strNewPassword):
        # cap nhat thong tin cua user
        self.cursor.execute(
        "UPDATE User SET (UserName, Email, Password) = (?, ?, ?) WHERE UserID = ?",
        (strNewUserName, strNewEmail, strNewPassword, unUserID))
        self.commit()
        return True

    def updateSeatStatus(self, unSeatID, blStatus):
        # cap nhat trang thai cua seat
        self.cursor.execute(
        "UPDATE Seat SET Status = ? WHERE SeatID = ?",
        (blStatus, unSeatID))
        self.commit()
        return True

    def updateSeatBooking(self, unSeatID, tmEndTime):
        # cap nhat thoi gian ket thuc cua seat booking
        self.cursor.execute(
        "UPDATE SeatManager SET Endtime = ? WHERE SeatID = ?",
        (tmEndTime, unSeatID))
        self.commit()
        return True

    def updateBookBorrow(self, unBookID, tmEndTime):
        # cap nhat thoi gian ket thuc cua book borrow
        self.cursor.execute(
        "UPDATE BookManager SET Endtime = ? WHERE BookID = ?",
        (tmEndTime, unBookID))
        self.commit()
        return True

    def deleteUser(self, unUserID):
        # kiem tra xem user co dang muon sach hay dat ghe khong, neu co thi khong cho xoa
        self.cursor.execute(
        "SELECT UserName FROM User WHERE UserID = ?",
        (unUserID,))
        objResult = self.cursor.fetchone()
        if objResult is None:
            return False
        # xoa ban ghi book borrow
        self.cursor.execute(
        "DELETE FROM User WHERE UserID = ?",
        (unUserID, ))
        self.commit()
        return True

    def deleteBook(self, bookID):
        pass

    def deleteSeat(self, seatID):
        pass

    def deleteBookBorrow(self, unBorrowID):
        # lay bookID tu borrowID
        self.cursor.execute(
        "SELECT BookID FROM BookManager WHERE BookBorrowID = ?",
        (unBorrowID,))
        objResult = self.cursor.fetchone()
        if objResult is None:
            return False
        unBookID = objResult[0]
        # xoa ban ghi book borrow
        self.cursor.execute(
        "DELETE FROM BookManager WHERE BookBorrowID = ?",
        (unBorrowID, ))
        self.commit()
        return self.updateBookStatus(unBookID, True)

    def deleteSeatBooking(self, unSeatBookingID):
        # lay seatID tu seatBookingID
        self.cursor.execute(
        "SELECT SeatID FROM SeatManager WHERE SeatBookingID = ?",
        (unSeatBookingID,))
        objResult = self.cursor.fetchone()
        if objResult is None:
            return False
        unSeatID = objResult[0]
        # xoa ban ghi seat booking
        self.cursor.execute(
        "DELETE FROM SeatManager WHERE SeatBookingID = ?",
        (unSeatBookingID, ))
        self.commit()
        return self.updateSeatStatus(unSeatID, True)
    
    def getAvailableSeats(self):
        # lay danh sach cac ghe con trong (Status = True)
        self.cursor.execute("SELECT * FROM Seat WHERE Status = 1")
        return self.cursor.fetchall()
    
    def isSeatFull(self):
        # kiem tra xem he thong da het ghe chua
        self.cursor.execute("SELECT COUNT(*) FROM Seat WHERE Status = 1")
        return self.cursor.fetchone()[0] == 0
    
    def getSeatBooking(self, unSeatID):
        # lay thong tin booking hien tai cua mot ghe (UserID, thoi gian booking)
        self.cursor.execute("""
            SELECT sm.UserID, sm.StartTime, sm.EndTime 
            FROM SeatManager sm
            WHERE sm.SeatID = ? AND sm.EndTime IS NULL
        """, (unSeatID,))
        return self.cursor.fetchone()
    
    def getAvailableBooks(self):
        # lay danh sach con trong thu vien (chua duoc muon)
        self.cursor.execute("SELECT * FROM Book WHERE Status = 1")
        return self.cursor.fetchall()
    
    def getBorrowedBooks(self):
        # lay danh sach cac book dang duoc muon (Status = False)
        self.cursor.execute("SELECT * FROM Book WHERE Status = 0")
        return self.cursor.fetchall()
    
    def getUserBorrowedBooks(self, unUserID):
        # lay danh sach cac book dang duoc muon boi mot user
        self.cursor.execute("""
            SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime 
            FROM BookManager bm
            JOIN Book b ON bm.BookID = b.BookID
            WHERE bm.UserID = ? AND bm.EndTime IS NULL
        """, (unUserID,))
        return self.cursor.fetchall()
    
    def getDueTomorrow(self, date):
        # lay danh sach cac book se het han vao ngay mai (phuc vu gui thong bao)
        tomorrow = (datetime.strptime(date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        self.cursor.execute("""
            SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime 
            FROM BookManager bm
            JOIN Book b ON bm.BookID = b.BookID
            WHERE bm.EndTime = ?
        """, (tomorrow,))
        return self.cursor.fetchall()
    
    def getOverdueBooks(self, current_time):
        # lay danh sach book da qua han (EndTime < current_time)
        self.cursor.execute("""
            SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime 
            FROM BookManager bm
            JOIN Book b ON bm.BookID = b.BookID
            WHERE bm.EndTime < ? AND bm.EndTime IS NOT NULL
        """, (current_time,))
        return self.cursor.fetchall()
    
    def getBorrowerInfo(self, unBookID):
        # lay thong tin nguoi muon sach cu the
        self.cursor.execute("""
            SELECT u.UserID, u.UserName, u.Email, bm.StartTime, bm.EndTime 
            FROM BookManager bm
            JOIN User u ON bm.UserID = u.UserID
            WHERE bm.BookID = ? AND bm.EndTime IS NULL
        """, (unBookID,))
        return self.cursor.fetchone()
    
    def returnBook(self, unBookID, unUserID):
        # xu ly tra sach: cap nhat trang thai sach + xoa/cap nhat record muon
        # cap nhat trang thai sach thanh available
         self.cursor.execute("""
            UPDATE Book SET Status = 1 WHERE BookID = ?
        """, (unBookID,))
        # cap nhat thoi gian ket thuc muon trong BookManager
        self.cursor.execute("""
            UPDATE BookManager SET EndTime = ? WHERE BookID = ? AND UserID = ? AND EndTime IS NULL
        """, (datetime.now(), unBookID, unUserID))
        self.commit()
        return True