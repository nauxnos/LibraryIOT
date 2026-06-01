import RPi.GPIO as GPIO
import time

class SR04Sensor:
    def __init__(self, unTrigPin, unEchoPin, unLedPin, unSeatID):
        self.unTrig = unTrigPin
        self.unEcho = unEchoPin
        self.unLed = unLedPin
        self.unSeatID = unSeatID

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.unTrig, GPIO.OUT)
        GPIO.setup(self.unEcho, GPIO.IN)
        GPIO.setup(self.unLed, GPIO.OUT)
        GPIO.output(self.unTrig, False)
        GPIO.output(self.unLed, False)

    def measure(self):
        GPIO.output(self.unTrig, True)
        time.sleep(0.00001)
        GPIO.output(self.unTrig, False)

        start = None
        end = None

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

        distance = (end - start) * 34300 / 2
        return distance

    def updateLED(self, distance):
        if distance is not None and distance < 3:
            GPIO.output(self.unLed, True)
        else:
            GPIO.output(self.unLed, False)

    def cleanup(self):
        GPIO.cleanup()