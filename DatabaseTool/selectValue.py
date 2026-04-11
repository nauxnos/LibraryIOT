import sqlite3

conn = sqlite3.connect("library.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM SeatManager")
for row in cursor.fetchall():
    print(row)

conn.close()