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