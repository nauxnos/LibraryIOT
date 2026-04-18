"""
Socket Client - Gửi message sang Control Logic
"""

import socket
import json
from datetime import datetime


class SocketClient:
    """Client để gửi message sang Control Logic qua socket"""
    
    def __init__(self, host='localhost', port=9999):
        self.host = host
        self.port = port
        self.timeout = 30
    
    def send(self, msg_type: str, data: dict = None) -> dict:
        """
        Gửi message và nhận response
        
        Args:
            msg_type: Loại message (LOGIN, SIGN_UP, BOOK_SEAT, etc.)
            data: Dictionary chứa data
            
        Returns:
            dict: Response từ Control Logic
        """
        sock = None
        try:
            # Tạo kết nối socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            sock.connect((self.host, self.port))
            
            # Tạo message
            message = {
                "type": msg_type,
                "data": data or {},
                "timestamp": datetime.now().isoformat()
            }
            
            # Gửi message
            sock.send(json.dumps(message).encode('utf-8'))
            
            # Nhận response
            response_data = sock.recv(4096).decode('utf-8')
            response = json.loads(response_data)
            
            return response
            
        except socket.timeout:
            return {
                "success": False,
                "message": "Timeout khi chờ response từ Control Logic"
            }
        except ConnectionRefusedError:
            return {
                "success": False,
                "message": "Không thể kết nối đến Control Logic"
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "message": "Response không hợp lệ"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Lỗi: {str(e)}"
            }
        finally:
            if sock:
                try:
                    sock.close()
                except:
                    pass
    
    def close(self):
        """Đóng kết nối (nếu cần)"""
        pass


# Singleton instance
socket_client = SocketClient()


# Convenience functions
def send_message(msg_type: str, data: dict = None) -> dict:
    """Gửi message ngắn gọn"""
    return socket_client.send(msg_type, data)


# Test
if __name__ == '__main__':
    # Test kết nối
    client = SocketClient()
    response = client.send('CHECK_SEAT', {})
    print(f"Response: {response}")