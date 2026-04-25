"""
Shared message format between API Gateway and Control Logic
"""

class Message:
    def __init__(self, msg_type: str, data: dict = None):
        self.type = msg_type
        self.data = data or {}
    
    def to_dict(self):
        return {
            "type": self.type,
            "data": self.data
        }
    
    @classmethod
    def from_dict(cls, msg_dict: dict):
        return cls(msg_dict.get("type", ""), msg_dict.get("data", {}))
    
    def __repr__(self):
        return f"Message(type={self.type}, data={self.data})"


# Message types
class MsgType:
    # User
    SIGN_UP = "SIGN_UP"
    LOGIN = "LOGIN"
    
    # Seat
    BOOK_SEAT = "BOOK_SEAT"
    CHECK_SEAT = "CHECK_SEAT"
    CANCEL_SEAT = "CANCEL_SEAT"
    
    # Book
    BORROW = "BORROW"
    RETURN = "RETURN"
    OVERDUE = "OVERDUE"
    
    # Response
    RESPONSE = "RESPONSE"
    ERROR = "ERROR"