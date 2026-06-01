"""
run.py — Khởi động toàn bộ hệ thống Thư Viện Số
Flask + HardwareHandler cùng tiến trình, cùng máy (Raspberry Pi).

Cách dùng:
  python run.py           # chạy cả Flask lẫn hardware
  python run.py --no-hw   # chỉ Flask (test trên máy tính không có GPIO)
"""

import sys, os, threading, time, signal, logging
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-8s] %(message)s",
    datefmt="%H:%M:%S",
)
log     = logging.getLogger("run")
NO_HW   = "--no-hw" in sys.argv
_stop   = threading.Event()

# ── Flask thread ───────────────────────────────────────────────────────────────
def run_flask():
    from app import app
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5001"))
    log.info(f"Flask → http://{host}:{port}")
    app.run(host=host, port=port, debug=False, use_reloader=False)

# ── Hardware thread ────────────────────────────────────────────────────────────
def run_hardware():
    try:
        from HardwareHandler import HardwareHandler
    except ImportError as e:
        log.error(f"Không import được HardwareHandler: {e}")
        log.error("→ Chạy lại với --no-hw nếu không có GPIO")
        return

    handler  = HardwareHandler()
    interval = float(os.getenv("PUSH_INTERVAL", "1.0"))
    log.info(f"Hardware loop — {len(handler.lstSR04Sensors)} sensor(s), interval={interval}s")

    # Watch layout.json — reload sensors nếu admin lưu layout mới
    layout_mtime = _mtime("layout.json")

    try:
        while not _stop.is_set():
            # Auto-reload khi layout.json thay đổi
            new_mtime = _mtime("layout.json")
            if new_mtime != layout_mtime:
                layout_mtime = new_mtime
                log.info("layout.json thay đổi — reload sensors")
                handler.reloadSensors()

            try:
                readings = handler.getDistance()
                handler.pushPresence(readings)

                card = handler.readCard()
                if card:
                    log.info(f"Card: {card}")

            except Exception as e:
                log.warning(f"Sensor error: {e}")

            _stop.wait(interval)

    finally:
        handler.cleanup()
        log.info("GPIO cleanup xong")

def _mtime(path):
    try:    return os.path.getmtime(path)
    except: return 0

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    # Flask chạy trên thread riêng (daemon)
    t_flask = threading.Thread(target=run_flask, name="Flask", daemon=True)
    t_flask.start()

    if not NO_HW:
        t_hw = threading.Thread(target=run_hardware, name="Hardware", daemon=True)
        t_hw.start()
    else:
        log.info("Hardware bị tắt (--no-hw)")

    def shutdown(sig, frame):
        log.info("Đang dừng...")
        _stop.set()
        sys.exit(0)

    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    log.info("Hệ thống đang chạy. Ctrl-C để dừng.")
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()