"""
Flask API Gateway - Nhận HTTP request và gửi sang Control Logic qua Socket
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import socket
import json
import threading
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Socket Client Configuration
CONTROL_LOGIC_HOST = 'localhost'
CONTROL_LOGIC_PORT = 9999
SOCKET_TIMEOUT = 30

# Response cache for async responses
response_cache = {}
response_lock = threading.Lock()


class SocketClient:
    """Client để gửi message sang Control Logic"""
    
    def __init__(self, host=CONTROL_LOGIC_PORT, port=CONTROL_LOGIC_PORT):
        self.host = host
        self.port = port
        self.socket = None
    
    def connect(self):
        """Kết nối đến Control Logic"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(SOCKET_TIMEOUT)
            self.socket.connect((self.host, self.port))
            return True
        except Exception as e:
            print(f"Không thể kết nối đến Control Logic: {e}")
            return False
    
    def send_message(self, msg_type: str, data: dict = None) -> dict:
        """Gửi message và chờ response"""
        if not self.connect():
            return {"success": False, "message": "Không thể kết nối đến Control Logic"}
        
        try:
            # Tạo message
            message = {
                "type": msg_type,
                "data": data or {},
                "timestamp": datetime.now().isoformat()
            }
            
            # Gửi message
            self.socket.send(json.dumps(message).encode('utf-8'))
            
            # Nhận response
            response_data = self.socket.recv(4096).decode('utf-8')
            response = json.loads(response_data)
            
            self.socket.close()
            return response
            
        except socket.timeout:
            return {"success": False, "message": "Timeout khi chờ response"}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            if self.socket:
                try:
                    self.socket.close()
                except:
                    pass
    
    def close(self):
        """Đóng kết nối"""
        if self.socket:
            self.socket.close()


# Singleton socket client
socket_client = SocketClient()


def send_to_control_logic(msg_type: str, data: dict = None) -> dict:
    """Gửi message sang Control Logic và nhận response"""
    try:
        return socket_client.send_message(msg_type, data)
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== AUTH ROUTES ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Đăng nhập"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Thiếu username hoặc password"}), 400
    
    response = send_to_control_logic('LOGIN', {
        "username": username,
        "password": password
    })
    
    if response.get('success'):
        return jsonify({
            "success": True,
            "token": response.get('token', 'dummy-token'),
            "user": response.get('user', {})
        })
    else:
        return jsonify(response), 401


@app.route('/api/auth/register', methods=['POST'])
def register():
    """Đăng ký"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    fullname = data.get('fullname')
    email = data.get('email')
    
    if not all([username, password, fullname, email]):
        return jsonify({"success": False, "message": "Thiếu thông tin"}), 400
    
    response = send_to_control_logic('SIGN_UP', {
        "username": username,
        "password": password,
        "fullname": fullname,
        "email": email
    })
    
    if response.get('success'):
        return jsonify({"success": True, "message": "Đăng ký thành công"})
    else:
        return jsonify(response), 400


# ==================== SEAT ROUTES ====================

@app.route('/api/seats', methods=['GET'])
def get_seats():
    """Lấy danh sách chỗ ngồi"""
    response = send_to_control_logic('CHECK_SEAT', {})
    
    if response.get('success'):
        return jsonify({
            "success": True,
            "seats": response.get('seats', [])
        })
    else:
        return jsonify(response), 500


@app.route('/api/seats/book', methods=['POST'])
def book_seat():
    """Đặt chỗ"""
    data = request.get_json()
    seat_id = data.get('seat_id')
    user_id = data.get('user_id', 1)  # Lấy từ token
    
    if not seat_id:
        return jsonify({"success": False, "message": "Thiếu seat_id"}), 400
    
    response = send_to_control_logic('BOOK_SEAT', {
        "seat_id": seat_id,
        "user_id": user_id
    })
    
    if response.get('success'):
        return jsonify({"success": True, "message": "Đặt chỗ thành công"})
    else:
        return jsonify(response), 400


@app.route('/api/seats/cancel', methods=['POST'])
def cancel_seat():
    """Hủy đặt chỗ"""
    data = request.get_json()
    seat_id = data.get('seat_id')
    user_id = data.get('user_id', 1)
    
    response = send_to_control_logic('CANCEL_SEAT', {
        "seat_id": seat_id,
        "user_id": user_id
    })
    
    if response.get('success'):
        return jsonify({"success": True, "message": "Hủy chỗ thành công"})
    else:
        return jsonify(response), 400


# ==================== BOOK ROUTES ====================

@app.route('/api/books', methods=['GET'])
def get_books():
    """Lấy danh sách sách"""
    response = send_to_control_logic('BORROW', {"action": "list"})
    
    if response.get('success'):
        return jsonify({
            "success": True,
            "books": response.get('books', [])
        })
    else:
        return jsonify(response), 500


@app.route('/api/books/borrowed', methods=['GET'])
def get_borrowed_books():
    """Lấy sách đang mượn"""
    user_id = 1  # Lấy từ token
    
    response = send_to_control_logic('BORROW', {
        "action": "my_borrows",
        "user_id": user_id
    })
    
    if response.get('success'):
        return jsonify({
            "success": True,
            "borrowed": response.get('borrowed', [])
        })
    else:
        return jsonify(response), 500


@app.route('/api/books/borrow', methods=['POST'])
def borrow_book():
    """Mượn sách"""
    data = request.get_json()
    book_id = data.get('book_id')
    user_id = data.get('user_id', 1)
    
    if not book_id:
        return jsonify({"success": False, "message": "Thiếu book_id"}), 400
    
    response = send_to_control_logic('BORROW', {
        "action": "borrow",
        "book_id": book_id,
        "user_id": user_id
    })
    
    if response.get('success'):
        return jsonify({"success": True, "message": "Mượn sách thành công"})
    else:
        return jsonify(response), 400


@app.route('/api/books/return', methods=['POST'])
def return_book():
    """Trả sách"""
    data = request.get_json()
    borrow_id = data.get('borrow_id')
    user_id = data.get('user_id', 1)
    
    response = send_to_control_logic('RETURN', {
        "borrow_id": borrow_id,
        "user_id": user_id
    })
    
    if response.get('success'):
        return jsonify({"success": True, "message": "Trả sách thành công"})
    else:
        return jsonify(response), 400


# ==================== USER ROUTES ====================

@app.route('/api/user/profile', methods=['GET'])
def get_profile():
    """Lấy thông tin profile"""
    user_id = 1  # Lấy từ token
    
    response = send_to_control_logic('LOGIN', {"action": "profile", "user_id": user_id})
    
    if response.get('success'):
        return jsonify({
            "success": True,
            **response.get('user', {})
        })
    else:
        return jsonify(response), 500


@app.route('/api/user/stats', methods=['GET'])
def get_stats():
    """Lấy thống kê"""
    user_id = 1
    
    # Lấy các thông tin thống kê
    seats_response = send_to_control_logic('CHECK_SEAT', {})
    books_response = send_to_control_logic('BORROW', {"action": "list"})
    borrowed_response = send_to_control_logic('BORROW', {"action": "my_borrows", "user_id": user_id})
    
    available_seats = 0
    if seats_response.get('success'):
        available_seats = len([s for s in seats_response.get('seats', []) if s.get('available')])
    
    available_books = 0
    if books_response.get('success'):
        available_books = len(books_response.get('books', []))
    
    borrowed_count = 0
    if borrowed_response.get('success'):
        borrowed_count = len(borrowed_response.get('borrowed', []))
    
    return jsonify({
        "success": True,
        "availableSeats": available_seats,
        "availableBooks": available_books,
        "borrowedBooks": borrowed_count
    })


# ==================== HEALTH CHECK ====================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "api-gateway",
        "timestamp": datetime.now().isoformat()
    })


if __name__ == '__main__':
    print("🚀 Starting API Gateway on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)