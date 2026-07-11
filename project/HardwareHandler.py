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
        """
        Trả về [(seatID, distance_cm | None)].
        Chỉ đo cảm biến + bật đèn cho ghế đang trong khung giờ booking hiện tại.
        Ghế không được book → tắt đèn, không đo (trả về None).
        """
        thresholds     = self._loadThresholds()
        activeSeatIds  = self._getActiveBookedSeatIds()
        result = []
        for sensor in self.lstSR04Sensors:
            threshold = thresholds.get(sensor.unSeatID, 50)

            if sensor.unSeatID not in activeSeatIds:
                # Ghế không trong khung giờ booking → tắt đèn, bỏ qua đo
                sensor.updateLED(None, threshold)
                result.append((sensor.unSeatID, None))
                continue

            dist = sensor.measure()
            # Truyền threshold vào updateLED — bật đèn khi có người trong ngưỡng
            sensor.updateLED(dist, threshold)
            result.append((sensor.unSeatID, dist))
        return result

    # ── Lấy danh sách ghế đang trong khung giờ booking hiện tại ─────────────────
    def _getActiveBookedSeatIds(self) -> set:
        try:
            from app import dbHandler as _db
        except ImportError:
            return set()
        try:
            return _db.getActiveBookedSeatIds()
        except Exception as e:
            print(f"[HardwareHandler] Lỗi getActiveBookedSeatIds: {e}")
            return set()

    # ── Đọc thẻ RFID ────────────────────────────────────────────────────────────
    def readCard(self):
        return self.objRC522Sensor.readCard()

    # ── Xử lý RFID: mượn sách (pending) + trả sách (tự động) ────────────────
    def handleRfid(self, uid: int):
        """
        Gọi mỗi khi Pi đọc được tag RFID.
        uid: số nguyên từ RC522Sensor.readCard()

        Flow mượn:
          - Chuyển uid → rfidUID string
          - Tìm sách có RfidUID khớp
          - Nếu sách có pending_borrow → hoàn tất mượn → ghi rfid_result
        Flow trả:
          - Nếu sách đang được mượn và KHÔNG có pending → tự động trả
        """
        try:
            from app import pending_borrow, rfid_result, _pending_lock, dbHandler as _db
            from datetime import datetime, timedelta
        except ImportError:
            return

        # Chuyển uid thành hex string cho dễ đọc
        rfid_uid = format(uid, '08X')   # ví dụ: "ABCDEF12"

        # Tìm sách theo RfidUID
        book = _db.getBookByRfid(rfid_uid)
        if not book:
            print(f"[RFID] Tag {rfid_uid} chưa đăng ký cho sách nào")
            return

        book_id = book["id"]
        now     = datetime.now().timestamp()

        with _pending_lock:
            pending = pending_borrow.get(book_id)

            # ── Có pending → xác nhận mượn ──────────────────────────────────
            if pending:
                if now > pending["expires"]:
                    pending_borrow.pop(book_id, None)
                    print(f"[RFID] Pending cho sách {book_id} đã hết hạn")
                    return

                user_id  = pending["userId"]
                due_days = pending.get("dueDays", 14)  # user ằ chọn khi mượn
                start_dt = datetime.now()
                end_dt   = start_dt + timedelta(days=due_days)

                ok = _db.createBookBorrow(
                    user_id,
                    book_id,
                    start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                )
                if ok:
                    rfid_result[book_id] = {
                        "success":  True,
                        "message":  f"Đã mượn: {book['title']}",
                        "userName": pending["userName"],
                        "due":      end_dt.strftime("%d/%m/%Y"),
                    }
                    print(f"[RFID] Mượn OK: {book['title']} → {pending['userName']}")
                else:
                    rfid_result[book_id] = {
                        "success": False,
                        "message": "Mượn thất bại (sách không khả dụng)",
                    }
                return

            # ── Không có pending → thử tự động trả ─────────────────────────
            active = _db.getActiveBorrowByBook(book_id)
            if active:
                returned_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
                ok = _db.returnBook(active["borrowId"], returned_at)
                if ok:
                    print(f"[RFID] Trả OK: {book['title']} ← {active['userName']}")
                    # Ghi vào rfid_result để frontend biết (polling /borrow-status)
                    rfid_result[book_id] = {
                        "success":    True,
                        "message":    f"Đã trả: {book['title']}",
                        "userName":   active["userName"],
                        "returnedAt": returned_at,
                        "isReturn":   True,
                    }
                else:
                    print(f"[RFID] Trả thất bại: {book['title']}")
            else:
                print(f"[RFID] Sách {book['title']} không có lượt mượn active")

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

        thresholds    = self._loadThresholds()
        activeSeatIds = self._getActiveBookedSeatIds()
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

        for seat_id, dist in readings:
            thresh    = thresholds.get(seat_id, 50)
            isBooked  = seat_id in activeSeatIds
            # Ghế không trong khung giờ booking → luôn coi như không có người,
            # bất kể cảm biến đọc được gì (web sẽ không hiển thị "đang có người")
            occupied  = isBooked and dist is not None and dist < thresh
            presence_state[seat_id] = {
                "occupied":   occupied,
                "distance":   dist if isBooked else None,
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