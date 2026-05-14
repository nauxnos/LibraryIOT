// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const AppState = {
  selectedSeat: null,
  myBookings:   [],   // from server
  myBorrows:    [],   // from server
  books:        [],
  layoutData:   null,
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const Utils = {
  // Toast
  showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast show${type ? ' ' + type : ''}`;
    clearTimeout(this._tid);
    this._tid = setTimeout(() => (t.className = 'toast'), 3000);
  },

  // Generic JSON fetch – throws on non-2xx
  async fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  // Convenience POST helper
  post(url, body) {
    return this.fetchJSON(url, { method: 'POST', body: JSON.stringify(body) });
  },

  // Format ISO → "HH:MM DD/MM/YYYY"
  fmtDatetime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  },

  // Format duration in minutes → "X phút" / "Xh Yp" / "X giờ"
  fmtDuration(mins) {
    if (mins <= 0)  return 'sắp xong';
    if (mins < 60)  return `${mins} phút`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}p` : `${h} giờ`;
  },

  // Create a bottom-sheet: modal is appended INSIDE overlay
  // so CSS child selectors (.overlay.open .modal) work correctly
  createSheet(overlayClass, modalClass, onClose) {
    const overlay = document.createElement('div');
    overlay.className = overlayClass;
    overlay.addEventListener('click', e => { if (e.target === overlay) onClose(); });

    const modal = document.createElement('div');
    modal.className = modalClass;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return { overlay, modal };
  },

  // Animate a sheet pair in
  openSheet(overlay, modal) {
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      modal.classList.add('open');
    });
  },

  // Animate a sheet pair out and remove after transition
  // modal is a child of overlay, so removing overlay removes modal too
  closeSheet(overlay, modal, delay = 300) {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    setTimeout(() => overlay.remove(), delay);
  },
};

// ─────────────────────────────────────────────
// LAYOUT RENDERER
// ─────────────────────────────────────────────
const LayoutRenderer = {
  container: null,

  // Seat visual states
  STATES: {
    default:  { bg: '#fff',      border: '#6B9A7D', color: '#2D5A3D', cursor: 'pointer',     shadow: '' },
    hover:    { bg: 'rgba(45,90,61,.12)', border: '#2D5A3D', color: '#2D5A3D', cursor: 'pointer', shadow: '' },
    selected: { bg: '#2D5A3D',   border: '#2D5A3D', color: '#fff',    cursor: 'pointer',     shadow: '0 4px 12px rgba(45,90,61,.3)' },
    taken:    { bg: '#F1EDE3',   border: 'transparent', color: '#BDB8AE', cursor: 'not-allowed', shadow: '' },
  },

  init() {
    this.container = document.getElementById('layout-container');
    if (!this.container) return;
    this._load();
  },

  async _load() {
    try {
      AppState.layoutData = await Utils.fetchJSON('/get-layout');
      this._render();
    } catch {
      this.container.innerHTML =
        '<p style="color:#999;text-align:center;padding:2rem">Layout không khả dụng</p>';
    }
  },

  _render() {
    const { objects, canvasSize = {} } = AppState.layoutData || {};
    if (!objects) return;
    const { width = 800, height = 500 } = canvasSize;

    Object.assign(this.container.style, {
      position: 'relative', width: width + 'px', height: height + 'px',
      background: '#fff', border: '1px solid #e0e0e0',
      borderRadius: '8px', overflow: 'hidden',
      backgroundImage: 'linear-gradient(#f0f0f0 1px,transparent 1px),linear-gradient(90deg,#f0f0f0 1px,transparent 1px)',
      backgroundSize: '40px 40px',
    });
    this.container.innerHTML = '';
    objects.forEach(obj => this.container.appendChild(this._createEl(obj)));
  },

  _createEl(obj) {
    const el        = document.createElement('div');
    el.dataset.id   = obj.id;
    el.dataset.type = obj.type;
    el.dataset.name = obj.name;

    const isTable  = obj.type === 'table';
    const isCircle = obj.shape === 'circle';
    const left = isCircle ? obj.x - obj.radius : obj.x;
    const top  = isCircle ? obj.y - obj.radius : obj.y;
    const w    = isCircle ? obj.radius * 2 : obj.width;
    const h    = isCircle ? obj.radius * 2 : obj.height;

    Object.assign(el.style, {
      position: 'absolute', left: left + 'px', top: top + 'px',
      width: w + 'px', height: h + 'px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontFamily: '"DM Sans",sans-serif', fontWeight: '500',
      userSelect: 'none', boxSizing: 'border-box', transition: 'all .15s ease',
      borderRadius: isCircle ? '50%' : obj.shape === 'roundrect' ? '12px' : '4px',
      background:   isTable ? '#D4C9A8' : '#fff',
      border:       isTable ? '2px solid #A89E80' : '2px solid #6B9A7D',
      color:        isTable ? '#6B6860' : '#2D5A3D',
      cursor:       isTable ? 'default' : 'pointer',
      zIndex:       isTable ? 1 : 2,
      textAlign: 'center', lineHeight: '1.2', padding: '2px',
    });

    el.textContent = obj.name;
    if (!isTable) this._bindSeat(el, obj);
    return el;
  },

  _bindSeat(el, obj) {
    let hoverTimer = null;

    el.addEventListener('mouseenter', () => {
      if (el.dataset.state !== 'selected') {
        el.style.transform = 'scale(1.06)';
        if (el.dataset.state !== 'taken') this._applyStyle(el, 'hover');
      }
      hoverTimer = setTimeout(() => SeatTooltip.show(obj, el), 180);
    });

    el.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      SeatTooltip.hide();
      el.style.transform = '';
      if (el.dataset.state !== 'selected' && el.dataset.state !== 'taken')
        this._applyStyle(el, 'default');
    });

    el.addEventListener('click', () => {
      SeatTooltip.hide();
      SeatPopup.show(obj, el);
    });
  },

  // Apply a named visual state to a seat element
  _applyStyle(el, state) {
    const s = this.STATES[state] || this.STATES.default;
    Object.assign(el.style, {
      background: s.bg, borderColor: s.border, color: s.color,
      cursor: s.cursor, boxShadow: s.shadow,
    });
  },

  selectSeat(el, obj) {
    // Deselect previous
    if (AppState.selectedSeat) {
      const prev = this.container.querySelector(`[data-id="${AppState.selectedSeat.id}"]`);
      if (prev?.dataset.state === 'selected') {
        prev.dataset.state = '';
        this._applyStyle(prev, 'default');
        prev.style.transform = '';
      }
    }
    AppState.selectedSeat = obj;
    el.dataset.state = 'selected';
    this._applyStyle(el, 'selected');
    el.style.transform = 'scale(1.08)';
  },

  markTaken(seatId) {
    const el = this._seatEl(seatId);
    if (!el) return;
    el.dataset.state = 'taken';
    this._applyStyle(el, 'taken');
    el.style.transform = '';
  },

  _seatEl(id) {
    const el = this.container?.querySelector(`[data-id="${id}"]`);
    return el?.dataset.type === 'seat' ? el : null;
  },
};

// ─────────────────────────────────────────────
// SEAT HOVER TOOLTIP
// ─────────────────────────────────────────────
const SeatTooltip = {
  _el:  null,
  _cache: {},
  TTL:  60_000, // ms

  async show(obj, anchor) {
    // Create tooltip immediately (shows loading state)
    this._mount(obj.name);
    this._place(anchor);

    let slots = [];
    try   { slots = await this._fetch(obj.id); }
    catch { /* silent — tooltip still shows "no data" */ }

    if (!this._el || !document.body.contains(this._el)) return; // hidden while fetching
    this._render(obj.name, this._calcStatus(slots));
    this._place(anchor); // re-place now we know real height
  },

  hide() {
    if (!this._el) return;
    Object.assign(this._el.style, { opacity: '0', transform: 'translateY(-4px) scale(.97)' });
    const el = this._el;
    this._el = null;
    setTimeout(() => el.remove(), 150);
  },

  invalidate(seatId) { delete this._cache[seatId]; },

  // ── private ──────────────────────────────────────────────────────────────

  _mount(name) {
    if (this._el) { this._el.remove(); this._el = null; }
    const el = document.createElement('div');
    el.className = 'seat-tooltip';
    el.innerHTML = `
      <div class="stip-name">${name}</div>
      <div class="stip-loading"><span class="stip-spinner"></span><span>Đang tải...</span></div>`;
    document.body.appendChild(el);
    this._el = el;
    requestAnimationFrame(() => Object.assign(el.style, { opacity: '1', transform: 'translateY(0) scale(1)' }));
  },

  _place(anchor) {
    if (!this._el) return;
    const { top: aT, bottom: aB, left: aL, width: aW } = anchor.getBoundingClientRect();
    const GAP = 10;
    const tipH = this._el.offsetHeight || 110;
    const tipW = this._el.offsetWidth  || 200;
    const top  = aT >= tipH + GAP ? aT - tipH - GAP : aB + GAP;
    const left = Math.max(8, Math.min(aL + aW / 2 - tipW / 2, window.innerWidth - tipW - 8));
    Object.assign(this._el.style, { position: 'fixed', top: top + 'px', left: left + 'px' });
  },

  async _fetch(seatId) {
    const now    = Date.now();
    const cached = this._cache[seatId];
    if (cached && now - cached.at < this.TTL) return cached.slots;
    const slots = await Utils.fetchJSON(`/get-seat-schedule?seat_id=${seatId}`);
    this._cache[seatId] = { slots, at: now };
    return slots;
  },

  _calcStatus(slots) {
    const now = new Date();
    const active = slots.find(s => {
      if (!s.start) return false;
      const start = new Date(s.start);
      const end   = s.end ? new Date(s.end) : null;
      return start <= now && (!end || end > now);
    });
    if (active) return { state: 'occupied', freeAt: active.end ? new Date(active.end) : null };

    const next = slots
      .filter(s => s.start && new Date(s.start) > now)
      .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    return { state: 'free', nextBusy: next ? new Date(next.start) : null };
  },

  _render(name, status) {
    if (!this._el) return;
    const now = new Date();
    let badge = '', detail = '';

    if (status.state === 'occupied') {
      badge = '<span class="stip-badge occupied">● Đang có người</span>';
      if (status.freeAt) {
        const mins    = Math.ceil((status.freeAt - now) / 60_000);
        const durTxt  = Utils.fmtDuration(mins);
        const timeTxt = status.freeAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        detail = `<span class="stip-detail">Còn <strong>${durTxt}</strong> nữa trống</span>
                  <span class="stip-free-at">Trống lúc ${timeTxt}</span>`;
      } else {
        detail = '<span class="stip-detail">Chưa rõ giờ trống</span>';
      }
    } else {
      badge = '<span class="stip-badge free">✓ Còn trống</span>';
      if (status.nextBusy) {
        const mins    = Math.ceil((status.nextBusy - now) / 60_000);
        const timeTxt = status.nextBusy.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        detail = mins < 60
          ? `<span class="stip-detail warn">Sẽ có người sau <strong>${mins} phút</strong></span>`
          : `<span class="stip-detail">Có người vào lúc <strong>${timeTxt}</strong></span>`;
      } else {
        detail = '<span class="stip-detail muted">Không có lịch đặt</span>';
      }
    }

    this._el.innerHTML = `
      <div class="stip-name">${name}</div>
      ${badge}
      <div class="stip-details">${detail}</div>
      <div class="stip-hint">Click để đặt chỗ</div>`;
  },
};

// ─────────────────────────────────────────────
// SEAT BOOKING POPUP  (timeline picker)
// ─────────────────────────────────────────────
const SeatPopup = {
  _s: null,
  H0: 7, H1: 22,

  async show(obj, el) {
    this._close();
    const today = new Date().toISOString().split('T')[0];
    let allSlots = [];
    try { allSlots = await SeatTooltip._fetch(obj.id); } catch { }
    const { overlay, modal } = Utils.createSheet('stm-overlay', 'stm-modal', () => this._close());
    // start/end model: null = not set
    this._s = { modal, overlay, obj, el, selectedDate: today, start: null, end: null, allSlots };
    this._paint();
    Utils.openSheet(overlay, modal);
  },

  _paint() {
    const { modal, obj, selectedDate, start, end, allSlots } = this._s;
    const booked = this._bookedHours(allSlots, selectedDate);

    // Summary texts
    let selTxt, durTxt, btnDisabled;
    if (start === null) {
      selTxt = 'Chọn giờ bắt đầu'; durTxt = '—'; btnDisabled = true;
    } else if (end === null) {
      selTxt = `Từ ${this._hh(start)}:00 — chọn giờ kết thúc`; durTxt = '—'; btnDisabled = true;
    } else {
      selTxt = `${this._hh(start)}:00 – ${this._hh(end + 1)}:00`;
      durTxt = `${end - start + 1} giờ`;
      btnDisabled = false;
    }

    // Ruler ticks
    const ticks = Array.from({ length: this.H1 - this.H0 + 1 }, (_, i) =>
      `<div class="stm-ruler-tick">${this._hh(this.H0 + i)}:00</div>`).join('');

    // Cells
    const selHours = new Set(this._selectedHours());
    const cells = Array.from({ length: this.H1 - this.H0 }, (_, i) => {
      const h = this.H0 + i;
      let cls;
      if (booked.has(h))                                  cls = 'booked';
      else if (h === start && end === null)               cls = 'selecting-start';
      else if (selHours.has(h))                           cls = 'selected';
      else                                                cls = 'free';
      return `<div class="stm-cell ${cls}" data-hour="${h}" onclick="SeatPopup._click(${h})"></div>`;
    }).join('');

    modal.innerHTML = `
      <div class="stm-handle"></div>
      <div class="stm-header">
        <button class="stm-back" onclick="SeatPopup._close()">‹</button>
        <h3 class="stm-title">Đặt lịch — ${obj.name}</h3>
      </div>
      <div class="stm-date-row">
        <input type="date" class="stm-date-input"
          value="${selectedDate}" min="${new Date().toISOString().split('T')[0]}"
          onchange="SeatPopup._changeDate(this.value)" />
      </div>
      <div class="stm-legend">
        <div class="stm-legend-item"><span class="stm-dot free"></span>Trống</div>
        <div class="stm-legend-item"><span class="stm-dot booked"></span>Đã đặt</div>
        <div class="stm-legend-item"><span class="stm-dot selected"></span>Đang chọn</div>
      </div>
      <div class="stm-timeline-wrap">
        <div class="stm-ruler">
          <div class="stm-row-label"></div>
          <div class="stm-ruler-hours">${ticks}</div>
        </div>
        <div class="stm-row">
          <div class="stm-row-label">${obj.name}</div>
          <div class="stm-row-cells" id="stm-cells">${cells}</div>
        </div>
      </div>
      <div class="stm-summary">
        <div class="stm-summary-info">
          <span class="stm-summary-label">Thời gian chọn</span>
          <span class="stm-summary-val" id="stm-sel-text">${selTxt}</span>
        </div>
        <div class="stm-summary-dur"><span id="stm-dur-text">${durTxt}</span></div>
      </div>
      <div class="stm-footer">
        <button class="stm-btn-confirm" onclick="SeatPopup._confirm()" ${btnDisabled ? 'disabled' : ''}>
          XÁC NHẬN ĐẶT CHỖ
        </button>
      </div>`;
  },

  // Hours in [start, start+1, ..., end]
  _selectedHours() {
    const { start, end } = this._s;
    if (start === null) return [];
    if (end === null)   return [start];
    const hrs = [];
    for (let h = start; h <= end; h++) hrs.push(h);
    return hrs;
  },

  // Booked hour set for a date
  _bookedHours(slots, dateStr) {
    const booked = new Set();
    const dStart = new Date(dateStr + 'T00:00:00');
    const dEnd   = new Date(dateStr + 'T23:59:59');
    const FAR    = new Date(8_640_000_000_000_000);
    for (const s of slots) {
      if (!s.start) continue;
      const sS = new Date(s.start);
      const sE = s.end ? new Date(s.end) : FAR;
      if (sS > dEnd || sE < dStart) continue;
      for (let h = this.H0; h < this.H1; h++) {
        const hS = new Date(`${dateStr}T${this._hh(h)}:00:00`);
        const hE = new Date(`${dateStr}T${this._hh(h + 1)}:00:00`);
        if (sS < hE && sE > hS) booked.add(h);
      }
    }
    return booked;
  },

  // Flight-style click: 1st click = start, 2nd click = end, 3rd click = reset
  _click(h) {
    const { allSlots, selectedDate } = this._s;
    const booked = this._bookedHours(allSlots, selectedDate);
    if (booked.has(h)) return;

    const { start, end } = this._s;

    if (start === null) {
      // No selection → set start
      this._s.start = h;
      this._s.end   = null;

    } else if (end === null) {
      // Have start, waiting for end
      if (h === start) {
        // Clicked same → reset
        this._s.start = null;
      } else if (h < start) {
        // Before start → treat as new start, reset end
        this._s.start = h;
      } else {
        // After start → validate range has no booked cells
        let blocked = false;
        for (let hh = start; hh <= h; hh++) {
          if (booked.has(hh)) { blocked = true; break; }
        }
        if (blocked) {
          this._hint('Khoảng giờ này có chỗ đã được đặt');
          return;
        }
        this._s.end = h;
      }

    } else {
      // Already complete → restart with new start
      this._s.start = h;
      this._s.end   = null;
    }

    this._refreshTimeline();
  },

  // Partial update: cells + summary
  _refreshTimeline() {
    const { allSlots, selectedDate, start, end } = this._s;
    const booked  = this._bookedHours(allSlots, selectedDate);
    const selHours = new Set(this._selectedHours());

    document.getElementById('stm-cells')?.querySelectorAll('.stm-cell').forEach(cell => {
      const h = +cell.dataset.hour;
      let cls;
      if (booked.has(h))                  cls = 'booked';
      else if (h === start && end === null) cls = 'selecting-start';
      else if (selHours.has(h))           cls = 'selected';
      else                                cls = 'free';
      cell.className = `stm-cell ${cls}`;
    });

    let selTxt, durTxt;
    if (start === null) {
      selTxt = 'Chọn giờ bắt đầu'; durTxt = '—';
    } else if (end === null) {
      selTxt = `Từ ${this._hh(start)}:00 — chọn giờ kết thúc`; durTxt = '—';
    } else {
      selTxt = `${this._hh(start)}:00 – ${this._hh(end + 1)}:00`;
      durTxt = `${end - start + 1} giờ`;
    }

    const selEl = document.getElementById('stm-sel-text');
    if (selEl) selEl.textContent = selTxt;
    const durEl = document.getElementById('stm-dur-text');
    if (durEl) durEl.textContent = durTxt;
    const btn = document.querySelector('.stm-btn-confirm');
    if (btn) btn.disabled = start === null || end === null;
  },

  _hint(msg) {
    if (document.getElementById('stm-hint')) return;
    const el = document.createElement('div');
    el.id = 'stm-hint'; el.className = 'stm-hint-toast';
    el.textContent = msg;
    this._s.modal.style.position = 'relative';
    this._s.modal.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); }, 1800);
  },

  _changeDate(date) {
    this._s.selectedDate = date;
    this._s.start = null;
    this._s.end   = null;
    this._paint();
  },

  async _confirm() {
    const { obj, el, selectedDate, start, end } = this._s;
    if (start === null || end === null) return;

    const sorted  = this._selectedHours();
    const timeStr = `${this._hh(start)}:00 – ${this._hh(end + 1)}:00`;
    const btn     = document.querySelector('.stm-btn-confirm');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang đặt...'; }

    try {
      const res = await Utils.post('/book-seat', { seatId: obj.id, date: selectedDate, hours: sorted });
      if (res.success) {
        LayoutRenderer.selectSeat(el, obj);
        SeatTooltip.invalidate(obj.id);
        this._close();
        Utils.showToast(`Đã đặt ${obj.name} · ${timeStr}`, 'success');
        Booking.loadMyBookings();
      } else {
        const msgs = {
          TimeConflict:  'Thời gian đã bị đặt, vui lòng chọn giờ khác',
          UserNotFound:  'Không tìm thấy tài khoản',
          BookingFailed: 'Đặt chỗ thất bại, thử lại sau',
          MissingFields: 'Thiếu thông tin đặt chỗ',
        };
        Utils.showToast(msgs[res.error] || 'Đặt chỗ thất bại', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'XÁC NHẬN ĐẶT CHỖ'; }
      }
    } catch {
      Utils.showToast('Lỗi kết nối server', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'XÁC NHẬN ĐẶT CHỖ'; }
    }
  },

  _close() {
    if (!this._s) return;
    Utils.closeSheet(this._s.overlay, this._s.modal);
    this._s = null;
  },

  _hh: h => String(h).padStart(2, '0'),
};

const Booking = {
  async loadMyBookings() {
    try { AppState.myBookings = await Utils.fetchJSON('/my-bookings'); }
    catch(e) { console.error('loadMyBookings:', e); }
  },

  async cancel(bookingId) {
    try {
      const res = await Utils.post('/cancel-my-booking', { id: bookingId });
      if (res.success) {
        const hit = AppState.myBookings.find(b => b.bookingId === bookingId);
        if (hit) SeatTooltip.invalidate(hit.seatId);
        Utils.showToast('Đã hủy đặt chỗ!', 'success');
        await this.loadMyBookings();
        Modal.openManage('seats');
      } else {
        Utils.showToast('Hủy thất bại', 'error');
      }
    } catch {
      Utils.showToast('Lỗi kết nối server', 'error');
    }
  },
};

// ─────────────────────────────────────────────
// BOOK BORROW POPUP
// ─────────────────────────────────────────────
const BookPopup = {
  _s: null,
  MAX_DAYS: 90,
  PRESETS: [
    { label: '3 ngày', days: 3  },
    { label: '1 tuần', days: 7  },
    { label: '2 tuần', days: 14 },
    { label: '1 tháng', days: 30 },
  ],

  show(book) {
    this._close();
    const { overlay, modal } = Utils.createSheet('bpop-overlay', 'bpop-modal', () => this._close());
    this._s = { overlay, modal, book, days: 14 };
    this._paint();
    Utils.openSheet(overlay, modal);
  },

  _paint() {
    const { modal, book, days } = this._s;
    const color    = Books.COLORS[AppState.books.findIndex(b => b.id === book.id) % 8] || '#EAF3DE';
    const dueTxt   = this._fmtDue(days);
    const presetBtns = this.PRESETS.map(p =>
      `<button class="bpop-preset${p.days === days ? ' active' : ''}"
        onclick="BookPopup._preset(${p.days})">${p.label}</button>`).join('');

    modal.innerHTML = `
      <div class="bpop-handle"></div>
      <div class="bpop-book-row">
        <div class="bpop-cover" style="background:${color}">📚</div>
        <div class="bpop-book-info">
          <div class="bpop-book-title">${book.title}</div>
          <div class="bpop-book-author">${book.author}</div>
          <span class="bpop-avail-badge">Còn sách</span>
        </div>
      </div>
      <div class="bpop-divider"></div>
      <div class="bpop-section-label">Thời hạn mượn</div>
      <div class="bpop-presets">${presetBtns}</div>
      <div class="bpop-custom-row">
        <span class="bpop-custom-label">Hoặc nhập số ngày:</span>
        <div class="bpop-stepper">
          <button class="bpop-step-btn" onclick="BookPopup._step(-1)">−</button>
          <input class="bpop-step-input" type="number" id="bpop-days"
            value="${days}" min="1" max="${this.MAX_DAYS}"
            oninput="BookPopup._input(this.value)" />
          <button class="bpop-step-btn" onclick="BookPopup._step(1)">+</button>
        </div>
        <span class="bpop-custom-unit">ngày</span>
      </div>
      <div class="bpop-due-box" id="bpop-due-box">
        <div class="bpop-due-label">Hạn trả sách</div>
        <div class="bpop-due-date" id="bpop-due-date">${dueTxt}</div>
        <div class="bpop-due-note">Vui lòng trả sách trước hoặc đúng ngày trên</div>
      </div>
      <div class="bpop-notice">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.5v.5"/>
        </svg>
        Bạn có thể mượn tối đa 3 quyển cùng lúc
      </div>
      <div class="bpop-footer">
        <button class="bpop-btn-cancel" onclick="BookPopup._close()">Hủy</button>
        <button class="bpop-btn-confirm" id="bpop-ok" onclick="BookPopup._confirm()">Xác nhận mượn</button>
      </div>`;
  },

  _preset(days) {
    this._setDays(days);
  },

  _step(delta) {
    this._setDays(this._s.days + delta);
  },

  _input(val) {
    this._setDays(parseInt(val) || 1);
  },

  _setDays(days) {
    days = Math.max(1, Math.min(this.MAX_DAYS, days));
    this._s.days = days;

    // Update input
    const inp = document.getElementById('bpop-days');
    if (inp) inp.value = days;

    // Update preset active states
    document.querySelectorAll('.bpop-preset').forEach(btn => {
      const match = this.PRESETS.find(p => p.days === days);
      btn.classList.toggle('active', !!match && btn.textContent.trim() === match.label);
    });

    // Update due date with pulse
    const el  = document.getElementById('bpop-due-date');
    if (el) el.textContent = this._fmtDue(days);
    const box = document.getElementById('bpop-due-box');
    if (box) { box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse'); }
  },

  _fmtDue(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  async _confirm() {
    const { book, days } = this._s;
    const btn = document.getElementById('bpop-ok');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

    try {
      const res = await Utils.post('/borrow-book', { bookId: book.id, dueDays: days });
      if (res.success) {
        AppState.myBorrows = await Utils.fetchJSON('/my-borrows');
        // Optimistic local update — avoid full re-fetch
        const lb = AppState.books.find(b => b.id === book.id);
        if (lb) lb.status = false;
        Books.render();
        this._close();
        Utils.showToast(`Đã mượn "${book.title}" — hạn trả ${res.due}`, 'success');
      } else {
        const msgs = {
          BorrowLimit:     'Bạn đang mượn tối đa 3 quyển',
          BorrowFailed:    'Mượn sách thất bại',
          BookUnavailable: 'Sách hiện không khả dụng',
        };
        Utils.showToast(msgs[res.error] || 'Mượn sách thất bại', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận mượn'; }
      }
    } catch {
      Utils.showToast('Lỗi kết nối server', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận mượn'; }
    }
  },

  _close() {
    if (!this._s) return;
    Utils.closeSheet(this._s.overlay, this._s.modal);
    this._s = null;
  },
};

// ─────────────────────────────────────────────
// RETURN CONFIRM SHEET
// ─────────────────────────────────────────────
const ReturnConfirm = {
  _el: null,

  show(borrow) {
    this._dismiss();
    const sheet   = document.createElement('div');
    sheet.className = 'rconf-sheet';
    const today   = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const over    = borrow.overdue;

    const warnSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const checkSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M4 4h12c1 0 2 .9 2 2v13c0 1-.9 2-2 2H4"/><path d="M4 4A2 2 0 0 0 2 6v13c0 1 .9 2 2 2"/>
      <path d="M9 12l2 2 4-4"/></svg>`;

    sheet.innerHTML = `
      <div class="rconf-handle"></div>
      <div class="rconf-icon${over ? ' overdue' : ''}">${over ? warnSvg : checkSvg}</div>
      <h3 class="rconf-title">Xác nhận trả sách</h3>
      <div class="rconf-book-name">${borrow.title}</div>
      <div class="rconf-author">${borrow.author}</div>
      <div class="rconf-info-grid">
        <div class="rconf-info-row">
          <span class="rconf-info-label">Hạn trả</span>
          <span class="rconf-info-val${over ? ' overdue-text' : ''}">${borrow.due}</span>
        </div>
        <div class="rconf-info-row">
          <span class="rconf-info-label">Trả hôm nay</span>
          <span class="rconf-info-val">${today}</span>
        </div>
        ${over ? `<div class="rconf-overdue-warn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          Sách đã quá hạn. Vui lòng liên hệ thủ thư nếu cần hỗ trợ.
        </div>` : ''}
      </div>
      <div class="rconf-footer">
        <button class="rconf-btn-cancel" onclick="ReturnConfirm._dismiss()">Hủy</button>
        <button class="rconf-btn-confirm" id="rconf-ok" onclick="ReturnConfirm._submit(${borrow.borrowId})">
          Xác nhận trả
        </button>
      </div>`;

    document.body.appendChild(sheet);
    this._el = sheet;
    requestAnimationFrame(() => sheet.classList.add('open'));
  },

  async _submit(borrowId) {
    const btn = document.getElementById('rconf-ok');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

    try {
      const res = await Utils.post('/return-book', { borrowId });
      if (res.success) {
        this._dismiss();
        // Parallel refresh
        [AppState.myBorrows, AppState.books] = await Promise.all([
          Utils.fetchJSON('/my-borrows'),
          Utils.fetchJSON('/get-booklist'),
        ]);
        Books.render();
        Utils.showToast('Đã trả sách!', 'success');
        Modal.openManage('books');
      } else {
        Utils.showToast('Trả sách thất bại', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận trả'; }
      }
    } catch {
      Utils.showToast('Lỗi kết nối server', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận trả'; }
    }
  },

  _dismiss() {
    if (!this._el) return;
    this._el.classList.remove('open');
    const el = this._el;
    this._el = null;
    setTimeout(() => el.remove(), 280);
  },
};

// ─────────────────────────────────────────────
// BOOKS
// ─────────────────────────────────────────────
const Books = {
  COLORS: ['#EAF3DE','#E6F1FB','#FAEEDA','#FBEAF0','#E1F5EE','#FAECE7','#EEEDFE','#F3ECE7'],
  MAX: 3,

  async load() {
    try {
      AppState.books = await Utils.fetchJSON('/get-booklist');
      this.render();
    } catch(e) { console.error('load books:', e); }
  },

  render() {
    const grid  = document.getElementById('books-grid');
    if (!grid) return;
    const active   = AppState.myBorrows.length;
    const canBorrow = active < this.MAX;

    grid.innerHTML = AppState.books.map((book, i) => {
      const color    = this.COLORS[i % this.COLORS.length];
      const initials = book.title.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
      const isMine   = AppState.myBorrows.some(b => b.bookId === book.id);
      const avail    = book.status && !isMine;
      const disabled = !avail || !canBorrow;
      const label    = isMine ? 'Đang mượn' : !book.status ? 'Hết sách'
                     : !canBorrow ? 'Đã đủ 3 quyển' : 'Mượn sách';
      return `
        <div class="book-card" data-title="${book.title.toLowerCase()}" data-author="${book.author.toLowerCase()}">
          <div class="book-cover" style="background:${color}">
            <span class="book-cover-initials">${initials}</span>
            ${!book.status ? '<div class="book-cover-unavail">Hết</div>' : ''}
          </div>
          <div class="book-info">
            <div class="book-title">${book.title}</div>
            <div class="book-author">${book.author}</div>
            <div class="book-meta-row">
              <span class="book-status ${avail ? 'avail' : 'out'}">
                ${isMine ? 'Đang mượn' : book.status ? 'Còn sách' : 'Hết sách'}
              </span>
              ${book.borrowedCount > 0
                ? `<span class="book-borrow-count">${book.borrowedCount} lượt</span>` : ''}
            </div>
            <button class="btn-borrow${disabled ? ' disabled' : ''}"
              ${disabled ? 'disabled' : ''} onclick="Books.openBorrow(${book.id})">
              ${label}
            </button>
          </div>
        </div>`;
    }).join('');

    this._quota(active);
  },

  _quota(active) {
    let bar = document.getElementById('borrow-quota-bar');
    const grid = document.getElementById('books-grid');
    if (!grid) return;
    if (!bar) {
      bar = Object.assign(document.createElement('div'), { id: 'borrow-quota-bar', className: 'borrow-quota-bar' });
      grid.parentElement.insertBefore(bar, grid);
    }
    const pct   = Math.round((active / this.MAX) * 100);
    const color = active >= this.MAX ? '#C0392B' : active >= 2 ? '#C8A96E' : '#2D5A3D';
    bar.innerHTML = `
      <div class="bqb-label">
        <span>Sách đang mượn</span>
        <span class="bqb-count" style="color:${color}">${active} / ${this.MAX} quyển</span>
      </div>
      <div class="bqb-track"><div class="bqb-fill" style="width:${pct}%;background:${color}"></div></div>`;
  },

  openBorrow(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (book?.status) BookPopup.show(book);
  },

  confirmReturn(borrowId) {
    const borrow = AppState.myBorrows.find(b => b.borrowId === borrowId);
    if (borrow) ReturnConfirm.show(borrow);
  },

  filter() {
    const q = document.getElementById('search-input')?.value.toLowerCase() || '';
    document.querySelectorAll('.book-card').forEach(card => {
      card.style.display =
        card.dataset.title.includes(q) || card.dataset.author.includes(q) ? '' : 'none';
    });
  },
};

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
const Navigation = {
  switchPage(page) {
    document.querySelectorAll('.page-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    document.getElementById('nav-seat')?.classList.toggle('active', page === 'seat');
    document.getElementById('nav-book')?.classList.toggle('active', page === 'book');
    document.querySelectorAll('.tab-bar-item').forEach(el => el.classList.remove('active'));
    document.getElementById({ seat: 'tab-seat', book: 'tab-book' }[page])?.classList.add('active');
  },
  toggleDropdown()  { document.getElementById('dropdown').classList.toggle('open'); },
  closeDropdown()   { document.getElementById('dropdown').classList.remove('open'); },
};

// ─────────────────────────────────────────────
// MODAL  (manage sheets: seats / books / profile)
// ─────────────────────────────────────────────
const Modal = {
  async openManage(type) {
    Navigation.closeDropdown();

    // Refresh relevant data
    if (type === 'seats')       await Booking.loadMyBookings();
    else if (type === 'books')  { try { AppState.myBorrows = await Utils.fetchJSON('/my-borrows'); } catch {} }

    const overlay = document.getElementById('modal-overlay');
    const body    = document.getElementById('modal-body');
    const titleEl = document.getElementById('modal-title-text');
    const cfg     = { seats: ['Chỗ ngồi đã đặt', this._seats()], books: ['Sách đang mượn', this._books()], profile: ['Sửa thông tin', this._profile()] }[type];
    if (!cfg) return;
    [titleEl.textContent, body.innerHTML] = cfg;
    overlay.classList.add('open');
  },

  _seats() {
    const bs = AppState.myBookings;
    if (!bs.length)
      return '<p style="color:var(--text-3);text-align:center;padding:2rem">Bạn chưa có đặt chỗ nào</p>';
    return bs.map(b => `
      <div class="manage-item">
        <div class="manage-info">
          <strong>${b.seatName}</strong>
          <span>${b.startFmt} → ${b.endFmt}</span>
          <span style="margin-top:2px">${b.active
            ? '<span style="color:#C0392B;font-size:11px;font-weight:600">● Đang thuê</span>'
            : '<span style="color:#27AE60;font-size:11px;font-weight:600">✓ Đã kết thúc</span>'}</span>
        </div>
        ${b.active ? `<button class="btn-cancel" onclick="Booking.cancel(${b.bookingId})">Hủy</button>` : ''}
      </div>`).join('');
  },

  _books() {
    const bs  = AppState.myBorrows;
    const MAX = Books.MAX;
    const pct = Math.round((bs.length / MAX) * 100);
    const col = bs.length >= MAX ? '#C0392B' : bs.length >= 2 ? '#C8A96E' : '#2D5A3D';

    const header = `
      <div class="modal-borrow-header">
        <div class="mbh-quota">
          <span class="mbh-label">Đang mượn</span>
          <span class="mbh-val" style="color:${col}">${bs.length}/${MAX} quyển</span>
        </div>
        <div class="mbh-track"><div class="mbh-fill" style="width:${pct}%;background:${col}"></div></div>
      </div>`;

    if (!bs.length)
      return header + '<p style="color:var(--text-3);text-align:center;padding:1.5rem">Bạn chưa mượn sách nào</p>';

    return header + bs.map(b => `
      <div class="manage-item${b.overdue ? ' overdue-item' : ''}">
        <div class="manage-info">
          <strong>${b.title}</strong>
          <span class="manage-author">${b.author}</span>
          ${b.overdue
            ? `<span class="borrow-due overdue">⚠ Quá hạn — ${b.due}</span>`
            : `<span class="borrow-due">Hạn trả: <strong>${b.due}</strong></span>`}
        </div>
        <button class="btn-cancel${b.overdue ? ' btn-return-overdue' : ''}"
          onclick="Books.confirmReturn(${b.borrowId})">Trả sách</button>
      </div>`).join('');
  },

  _profile() {
    return `
      <div class="form-group">
        <label>Họ và tên</label>
        <input type="text" class="input-field" id="user-name" value="${CURRENT_USER.name}" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" class="input-field" value="${CURRENT_USER.email}" readonly />
      </div>
      <div class="form-group">
        <label>Mật khẩu mới</label>
        <input type="password" class="input-field" id="user-password" placeholder="Để trống nếu không đổi" />
      </div>
      <button class="btn-book" onclick="Profile.save()">Lưu thay đổi</button>`;
  },

  close() { document.getElementById('modal-overlay').classList.remove('open'); },
};

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────
const Profile = {
  async save() {
    const name     = document.getElementById('user-name')?.value.trim();
    const password = document.getElementById('user-password')?.value || '';
    if (!name) return Utils.showToast('Vui lòng nhập họ tên', 'error');
    try {
      const res = await Utils.post('/update-profile', { name, password });
      if (res.success) {
        CURRENT_USER.name = name;
        const av = document.getElementById('avatar-btn');
        if (av) av.textContent = name[0].toUpperCase();
        Utils.showToast('Cập nhật thành công!', 'success');
        Modal.close();
      } else {
        Utils.showToast('Cập nhật thất bại', 'error');
      }
    } catch { Utils.showToast('Lỗi kết nối server', 'error'); }
  },
};

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
const Auth = {
  async logout() {
    Navigation.closeDropdown();
    await fetch('/logout');
    location.href = '/';
  },
};

// ─────────────────────────────────────────────
// GLOBAL SHORTHANDS  (called from HTML onclick)
// ─────────────────────────────────────────────
const switchPage     = p => Navigation.switchPage(p);
const toggleDropdown = () => Navigation.toggleDropdown();
const openManage     = t => Modal.openManage(t);
const closeModal     = () => Modal.close();
const doLogout       = () => Auth.logout();
const filterBooks    = () => Books.filter();

document.addEventListener('click', e => {
  if (!e.target.closest('.nav-right')) Navigation.closeDropdown();
});

// ─────────────────────────────────────────────
// INIT  — fetch in parallel, render once ready
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Fire layout + book list + user data concurrently
  const [, , borrows] = await Promise.allSettled([
    LayoutRenderer.init(),                // starts its own async chain
    Utils.fetchJSON('/get-booklist').then(d => { AppState.books = d; }),
    Utils.fetchJSON('/my-borrows'),
    Booking.loadMyBookings(),
  ]);

  // myBorrows must be set BEFORE first Books.render() so quota is accurate
  if (borrows.status === 'fulfilled') AppState.myBorrows = borrows.value;
  Books.render();

});