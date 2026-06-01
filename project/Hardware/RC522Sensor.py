from mfrc522 import MFRC522
import sys
import os

class RC522Sensor:
    def __init__(self):
        self.reader = MFRC522()
    
    def readCard(self):
        # Tắt stderr
        stderr = sys.stderr
        sys.stderr = open(os.devnull, 'w')
        
        try:
            # Chỉ đọc UID, không đọc data → không cần AUTH
            (status, TagType) = self.reader.MFRC522_Request(self.reader.PICC_REQIDL)
            
            if status != self.reader.MI_OK:
                return None
            
            (status, uid) = self.reader.MFRC522_Anticoll()
            
            if status != self.reader.MI_OK:
                return None
            
            # Chuyển UID thành số
            card_id = uid[0] << 24 | uid[1] << 16 | uid[2] << 8 | uid[3]
            return card_id
            
        finally:
            sys.stderr.close()
            sys.stderr = stderr