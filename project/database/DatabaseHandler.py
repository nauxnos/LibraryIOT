import sqlite3

class DatabaseHandler:
    def __init__(self, strFilePath):
        self.strFilePath = strFilePath
        self.conn = sqlite3.connect(self.strFilePath, check_same_thread=False)
        if self.conn is not None:
            print("Connected to database successfully!")
        self.cursor = self.conn.cursor()

    def __del__(self):
        print("Closing database connection...")
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
    
    def verifyUser(self, strEmail, strPassword):
        # Kiểm tra nếu email và password khớp với một bản ghi trong bảng User
        self.cursor.execute("SELECT * FROM User WHERE Email = ? AND Password = ?", (strEmail, strPassword))
        blUserFind = self.cursor.fetchone()
        # Nếu tìm thấy bản ghi, trả về True để xác nhận đăng nhập thành công
        if blUserFind:
            return True
        # Nếu không tìm thấy bản ghi, trả về False để thông báo lỗi
        else:
            return False
        
    def getUserName(self, strEmail):
        # Lấy tên người dùng dựa trên email
        self.cursor.execute("SELECT UserName FROM User WHERE Email = ?", (strEmail,))
        objResult = self.cursor.fetchone()
        if objResult is not None:
            return objResult[0]
        return None

    def insertBook(self, strBookName, strAuthor):
        # Kiểm tra nếu book đã tồn tại
        self.cursor.execute("SELECT * FROM Book WHERE BookName = ?", (strBookName,))
        blBookFind = self.cursor.fetchone()
        # Nếu book chưa tồn tại, thực hiện chèn dữ liệu vào bảng Book
        if not blBookFind:
            self.cursor.execute("INSERT INTO Book (BookName, Author, Status) VALUES (?, ?, ?)", (strBookName, strAuthor, True))
            self.commit()
            return True
        # Nếu book đã tồn tại, trả về False để thông báo lỗi
        else:
            return False
        
    def updateBook(self, unBookID, strNewBookName, strNewAuthor):
        # Kiểm tra nếu book đã tồn tại
        self.cursor.execute("SELECT * FROM Book WHERE BookID = ?", (unBookID,))
        blBookFind = self.cursor.fetchone()
        # Nếu book tồn tại, thực hiện cập nhật dữ liệu trong bảng Book
        if blBookFind:
            self.cursor.execute("UPDATE Book SET BookName = ?, Author = ? WHERE BookID = ?", (strNewBookName, strNewAuthor, unBookID))
            self.commit()
            return True
        # Nếu book không tồn tại, trả về False để thông báo lỗi
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

    def updateUserInfo(self, strEmail, strNewUserName, strNewPassword):
        # cap nhat thong tin cua user
        self.cursor.execute(
        "UPDATE User SET (UserName, Password) = (?, ?) WHERE Email = ?",
        (strNewUserName, strNewPassword, strEmail))
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

    def deleteUser(self, userID):
        # xoa ban ghi user
        self.cursor.execute(
        "DELETE FROM User WHERE UserID = ?",
        (userID, ))
        self.commit()
        return True

    def deleteBook(self, bookID):
        # xoa ban ghi book
        self.cursor.execute(
        "DELETE FROM Book WHERE BookID = ?",
        (bookID, ))
        self.commit()
        return True

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
    
    def getAllBooks(self):
        self.cursor.execute("SELECT BookID, BookName, Author, Status, BorrowedCount FROM Book")
        objResult = self.cursor.fetchall()
        listBooks = []
        for row in objResult:
            book = {
                "id": row[0],
                "title": row[1],
                "author": row[2],
                "status": bool(row[3]),
                "borrowedCount": row[4]
            }
            listBooks.append(book)
        return listBooks
    
    def getAllUsers(self):
        self.cursor.execute("SELECT UserID, UserName, Email, CreateDate FROM User")
        objResult = self.cursor.fetchall()
        listUsers = []
        for row in objResult:
            user = {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "created": row[3]
            }
            listUsers.append(user)
        return listUsers
    
    def getSeatBooking(self, unSeatID):
        # lay thong tin booking hien tai cua mot ghe (UserID, thoi gian booking)
        self.cursor.execute("""
            SELECT sm.UserID, sm.StartTime, sm.EndTime 
            FROM SeatManager sm
            WHERE sm.SeatID = ? AND sm.EndTime IS NULL
        """, (unSeatID,))
        return self.cursor.fetchone()
    
    def getUserBorrowedBooks(self, unUserID):
        # lay danh sach cac book dang duoc muon boi mot user
        self.cursor.execute("""
            SELECT b.BookID, b.BookName, bm.StartTime, bm.EndTime 
            FROM BookManager bm
            JOIN Book b ON bm.BookID = b.BookID
            WHERE bm.UserID = ? AND bm.EndTime IS NULL
        """, (unUserID,))
        return self.cursor.fetchall()