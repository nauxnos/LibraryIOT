import RPi.GPIO as GPIO
import time

class SR04Sensor:
    def __init__(self, unTrigPin, unEchoPin, unLedPin, unSeatID):
        self.unTrig   = unTrigPin
        self.unEcho   = unEchoPin
        self.unLed    = unLedPin
        self.unSeatID = unSeatID

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.unTrig, GPIO.OUT)
        GPIO.setup(self.unEcho, GPIO.IN)
        if self.unLed:
            GPIO.setup(self.unLed, GPIO.OUT)
            GPIO.output(self.unLed, False)
        GPIO.output(self.unTrig, False)

    def measure(self):
        """Đo khoảng cách, trả về cm hoặc None nếu timeout."""
        GPIO.output(self.unTrig, True)
        time.sleep(0.00001)
        GPIO.output(self.unTrig, False)

        start = None
        end   = None

        timeout = time.time() + 0.04
        while GPIO.input(self.unEcho) == 0:
            start = time.time()
            if time.time() > timeout:
                return None

        timeout = time.time() + 0.04
        while GPIO.input(self.unEcho) == 1:
            end = time.time()
            if time.time() > timeout:
                return None

        if start is None or end is None:
            return None

        return (end - start) * 34300 / 2

    def updateLED(self, distance, threshold=50):
        """
        Bật LED nếu có vật thể trong phạm vi ngưỡng.
        threshold: cm — lấy từ gpio_threshold trong layout.json (mặc định 50cm).
        """
        if not self.unLed:
            return
        if distance is not None and distance < threshold:
            GPIO.output(self.unLed, True)
        else:
            GPIO.output(self.unLed, False)

    def cleanup(self):
        GPIO.cleanup()