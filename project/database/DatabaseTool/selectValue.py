import sqlite3
import sys

conn = sqlite3.connect("../library.db")
cursor = conn.cursor()
arg = sys.argv[1] if len(sys.argv) > 1 else None
cursor.execute(f"SELECT * FROM {arg}")
for row in cursor.fetchall():
    print(row)

conn.close()