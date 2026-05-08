import sqlite3

conn = sqlite3.connect("library.db")
cursor = conn.cursor()

cursor.executescript("""
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS BookManager;
DROP TABLE IF EXISTS SeatManager;
DROP TABLE IF EXISTS Book;
DROP TABLE IF EXISTS Seat;
DROP TABLE IF EXISTS User;

CREATE TABLE User (
    UserID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserName TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    Password TEXT NOT NULL,
    CreateDate TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE Seat (
    SeatID INTEGER PRIMARY KEY AUTOINCREMENT,
    Status INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE Book (
    BookID INTEGER PRIMARY KEY AUTOINCREMENT,
    BookName TEXT NOT NULL,
    Author TEXT NOT NULL,
    BorrowedCount INTEGER NOT NULL DEFAULT 0,
    Status INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE SeatManager (
    SeatBookingID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    SeatID INTEGER NOT NULL,
    StartTime TEXT NOT NULL,
    EndTime TEXT,
    FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE,
    FOREIGN KEY (SeatID) REFERENCES Seat(SeatID) ON DELETE CASCADE
);

CREATE TABLE BookManager (
    BookBorrowID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL,
    BookID INTEGER NOT NULL,
    StartTime TEXT NOT NULL,
    EndTime TEXT NOT NULL,        -- hạn trả dự kiến (bắt buộc)
    ReturnedAt TEXT,              -- thời điểm trả thật (NULL = chưa trả)
    FOREIGN KEY (UserID) REFERENCES User(UserID) ON DELETE CASCADE,
    FOREIGN KEY (BookID) REFERENCES Book(BookID) ON DELETE CASCADE
);
""")

conn.commit()
conn.close()
print("Database created successfully!")