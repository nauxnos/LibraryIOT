from Hardware.RC522Sensor import RC522Sensor
from Hardware.SR04Sensor import SR04Sensor
import json

with open("gpio_config.json") as f:
    config = json.load(f)

SENSORS = [
    (s["trig"], s["echo"], s["led"], s["seatID"])
    for s in config["sensors"]
]

class HardwareHandler:
    def __init__(self):
        lstTrigEchoLed = SENSORS
        self.lstSR04Sensors = [SR04Sensor(unTrig, unEcho, unLed, unSeatID) for unTrig, unEcho, unLed, unSeatID in lstTrigEchoLed]
        self.objRC522Sensor = RC522Sensor()
    
    def getDistance(self):
        lstDistances = []
        for objSensor in self.lstSR04Sensors:
            distance = objSensor.measure()
            objSensor.updateLED(distance)
            lstDistances.append((objSensor.unSeatID, distance))
        return lstDistances

    def readCard(self):
        return self.objRC522Sensor.readCard()
    
    def cleanup(self):
        for objSensor in self.lstSR04Sensors:
            objSensor.cleanup()

def main():
    hardwareHandler = HardwareHandler()
    try:
        while True:
            lstDistances = hardwareHandler.getDistance()
            print(lstDistances)
            card_id = hardwareHandler.readCard()
            if card_id:
                print(f"Card read: {card_id}")
    except KeyboardInterrupt:
        hardwareHandler.cleanup()

if __name__ == "__main__":
    main()