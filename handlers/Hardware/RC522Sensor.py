from mfrc522 import SimpleMFRC522

class RC522Sensor:
    def __init__(self):
        self.reader = SimpleMFRC522()
    
    def readCard(self):
        id, text = self.reader.read_no_block()
        return id