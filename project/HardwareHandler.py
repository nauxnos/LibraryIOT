"""
HardwareHandler.py
Vì Flask và hardware chạy cùng tiến trình trên 1 Raspberry Pi,
hardware ghi thẳng vào app.presence_state — không cần HTTP/requests.
"""

from Hardware.RC522Sensor import RC522Sensor
from Hardware.SR04Sensor   import SR04Sensor
import json, os
from datetime import datetime


class HardwareHandler:
    def __init__(self):
        # Đọc cấu hình GPIO từ layout.json (lưu từ canvas editor)
        self.lstSR04Sensors = self._loadSensors()
        self.objRC522Sensor = RC522Sensor()

    # ── Khởi tạo sensors từ layout.json ────────────────────────────────────────
    def _loadSensors(self):
        sensors = []
        try:
            with open("layout.json", encoding="utf-8") as f:
                layout = json.load(f)
            for obj in layout.get("objects", []):
                if obj.get("type") != "seat":
                    continue
                trig = obj.get("gpio_trig")
                echo = obj.get("gpio_echo")
                led  = obj.get("gpio_led")
                sid  = obj["id"]
                if trig and echo:           # chỉ tạo sensor nếu đã cấu hình pin
                    sensors.append(SR04Sensor(trig, echo, led or 0, sid))
        except Exception as e:
            print(f"[HardwareHandler] Không đọc được layout.json: {e}")
        return sensors

    # ── Đọc khoảng cách tất cả ghế ─────────────────────────────────────────────
    def getDistance(self):
        """Trả về [(seatID, distance_cm | None)]"""
        result = []
        for sensor in self.lstSR04Sensors:
            dist = sensor.measure()
            sensor.updateLED(dist)
            result.append((sensor.unSeatID, dist))
        return result

    # ── Đọc thẻ RFID ────────────────────────────────────────────────────────────
    def readCard(self):
        return self.objRC522Sensor.readCard()

    # ── Ghi thẳng vào presence_state của app.py ────────────────────────────────
    def pushPresence(self, readings):
        """
        Ghi dữ liệu cảm biến trực tiếp vào biến presence_state của Flask app.
        Không dùng HTTP vì cùng tiến trình.
        readings: [(seatID, distance_cm | None)]
        """
        try:
            from app import presence_state
        except ImportError:
            return

        thresholds = self._loadThresholds()
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

        for seat_id, dist in readings:
            thresh   = thresholds.get(seat_id, 50)
            occupied = dist is not None and dist < thresh
            presence_state[seat_id] = {
                "occupied":   occupied,
                "distance":   dist,
                "threshold":  thresh,
                "updated_at": now,
            }

    # ── Đọc ngưỡng từ layout.json ───────────────────────────────────────────────
    def _loadThresholds(self):
        try:
            with open("layout.json", encoding="utf-8") as f:
                layout = json.load(f)
            return {
                obj["id"]: obj.get("gpio_threshold", 50)
                for obj in layout.get("objects", [])
                if obj.get("type") == "seat"
            }
        except Exception:
            return {}

    # ── Reload sensors khi admin lưu layout mới ─────────────────────────────────
    def reloadSensors(self):
        self.cleanup()
        self.lstSR04Sensors = self._loadSensors()
        print(f"[HardwareHandler] Reloaded — {len(self.lstSR04Sensors)} sensor(s)")

    # ── Dọn GPIO ────────────────────────────────────────────────────────────────
    def cleanup(self):
        for s in self.lstSR04Sensors:
            s.cleanup()