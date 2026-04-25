import sqlite3

conn = sqlite3.connect("library.db")
cursor = conn.cursor()

# data = [("An","An@gmail.com", "1234"), ("Binh","Binh@gmail.com", "12345"), ("Cuong","Cuong@gmail.com", "123456")]
# print(data[1])
# UserName = input("Enter UserName: ")
# Email = input("Enter Email: ")
# Password = input("Enter Password: ")

# cursor.execute("INSERT INTO users (UserName, Email, Password) VALUES (?, ?, ?)", (UserName, Email, Password))

# conn.commit()

# cursor.execute("SELECT * FROM users")
# for row in cursor.fetchall():
#     print(row)

# conn.close()
# def abc():
#     print("Hello world")

def register(username, email, password):
    # Kiểm tra nếu username đã tồn tại
    return False
    cursor.execute("INSERT INTO users (UserName, Email, Password) VALUES (?, ?, ?)", (username, email, password))
    return True

print(register("An", "abc", "1234"))

