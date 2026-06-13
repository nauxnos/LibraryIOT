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

  escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[ch]);
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

  // ─── Entry ────────────────────────────────────────────────────────────────
  async show(obj, el) {
    this._close();
    const { overlay, modal } = Utils.createSheet('stm-overlay', 'stm-modal', () => this._close());

    // Fetch slot data (reuse tooltip cache)
    let allSlots = [];
    try { allSlots = await SeatTooltip._fetch(obj.id); } catch {}

    this._s = {
      modal, overlay, obj, el,
      allSlots,
      view: 'calendar',                        // 'calendar' | 'timeline'
      viewDate: (() => { const d = new Date(); d.setDate(1); return d; })(),
      // timeline state
      selectedDate: new Date().toISOString().split('T')[0],
      start: null, end: null,
    };

    this._paintCalendar();
    Utils.openSheet(overlay, modal);
  },

  // ─── CALENDAR VIEW ────────────────────────────────────────────────────────
  _paintCalendar() {
    const { modal, obj, viewDate, allSlots } = this._s;
    const today    = new Date();
    const todayStr = this._iso(today);
    const yr       = viewDate.getFullYear();
    const mo       = viewDate.getMonth();
    const monthName = viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    // Grid: Monday-first, 42 cells
    const firstDay  = new Date(yr, mo, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - ((firstDay.getDay() + 6) % 7));
    const dates = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
    });

    // Pre-index bookings by day
    const byDay = this._slotsByDay(allSlots);
    const DOW   = ['T2','T3','T4','T5','T6','T7','CN'];

    const cells = dates.map(d => {
      const ds      = this._iso(d);
      const isCur   = d.getMonth() === mo;
      const isToday = ds === todayStr;
      const isPast  = ds < todayStr;
      const slots   = byDay[ds] || [];

      // Up to 2 time pills (no names)
      const pills = slots.slice(0, 2).map(s => {
        const t0 = s.start ? new Date(s.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '?';
        const t1 = s.end   ? new Date(s.end  ).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '?';
        return `<div class="scal-pill">${t0}–${t1}</div>`;
      }).join('');
      const more = slots.length > 2 ? `<div class="scal-pill scal-pill-more">+${slots.length - 2}</div>` : '';

      const cls = [
        'scal-cell',
        !isCur  ? 'scal-other' : '',
        isToday ? 'scal-today' : '',
        isPast  ? 'scal-past'  : '',
        slots.length ? 'scal-has-event' : '',
      ].filter(Boolean).join(' ');

      const clickable = isCur && !isPast;
      return `<div class="${cls}" ${clickable ? `onclick="SeatPopup._pickDay('${ds}')"` : ''}>
        <div class="scal-num${isToday ? ' scal-num-today' : ''}">${d.getDate()}</div>
        <div class="scal-pills">${pills}${more}</div>
      </div>`;
    }).join('');

    modal.innerHTML = `
      <div class="stm-handle"></div>
      <div class="stm-header">
        <button class="stm-back" onclick="SeatPopup._close()">‹</button>
        <h3 class="stm-title">${obj.name} — Lịch đặt chỗ</h3>
      </div>

      <div class="scal-nav-bar">
        <button class="scal-nav-btn" onclick="SeatPopup._calPrev()">‹</button>
        <span class="scal-nav-title">${monthName}</span>
        <button class="scal-nav-btn" onclick="SeatPopup._calNext()">›</button>
      </div>

      <div class="scal-legend">
        <span class="scal-legend-item"><span class="scal-ldot scal-ldot-booked"></span>Giờ đã đặt</span>
        <span class="scal-legend-item"><span class="scal-ldot scal-ldot-free"></span>Còn trống</span>
        <span class="scal-legend-hint">Nhấn ngày để đặt theo giờ</span>
      </div>

      <div class="scal-wrap">
        <div class="scal-dow-row">${DOW.map(d => `<div class="scal-dow">${d}</div>`).join('')}</div>
        <div class="scal-grid">${cells}</div>
      </div>`;
  },

  _calPrev() { this._s.viewDate.setMonth(this._s.viewDate.getMonth() - 1); this._paintCalendar(); },
  _calNext() { this._s.viewDate.setMonth(this._s.viewDate.getMonth() + 1); this._paintCalendar(); },

  // User tapped a day → switch to timeline
  _pickDay(dateStr) {
    this._s.view         = 'timeline';
    this._s.selectedDate = dateStr;
    this._s.start        = null;
    this._s.end          = null;
    this._paintTimeline();
  },

  // ─── TIMELINE VIEW ────────────────────────────────────────────────────────
  _paintTimeline() {
    const { modal, obj, selectedDate, start, end, allSlots } = this._s;
    const booked = this._bookedHours(allSlots, selectedDate);

    let selTxt, durTxt, btnDisabled;
    if (start === null)     { selTxt = 'Chọn giờ bắt đầu'; durTxt = '—'; btnDisabled = true; }
    else if (end === null)  { selTxt = `Từ ${this._hh(start)}:00 — chọn giờ kết thúc`; durTxt = '—'; btnDisabled = true; }
    else                    { selTxt = `${this._hh(start)}:00 – ${this._hh(end+1)}:00`; durTxt = `${end-start+1} giờ`; btnDisabled = false; }

    const ticks    = Array.from({ length: this.H1 - this.H0 + 1 }, (_, i) =>
      `<div class="stm-ruler-tick">${this._hh(this.H0 + i)}:00</div>`).join('');
    const selHours = new Set(this._selectedHours());
    const cells    = Array.from({ length: this.H1 - this.H0 }, (_, i) => {
      const h = this.H0 + i;
      let cls = booked.has(h) ? 'booked' : h === start && end === null ? 'selecting-start' : selHours.has(h) ? 'selected' : 'free';
      return `<div class="stm-cell ${cls}" data-hour="${h}" onclick="SeatPopup._click(${h})"></div>`;
    }).join('');

    const dateFmt = new Date(selectedDate + 'T12:00:00').toLocaleDateString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit'
    });

    modal.innerHTML = `
      <div class="stm-handle"></div>
      <div class="stm-header">
        <button class="stm-back" onclick="SeatPopup._backToCalendar()">‹</button>
        <h3 class="stm-title">${obj.name} — ${dateFmt}</h3>
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

  _backToCalendar() {
    this._s.view  = 'calendar';
    this._s.start = null;
    this._s.end   = null;
    this._paintCalendar();
  },

  // ─── HELPERS (shared) ─────────────────────────────────────────────────────

  // Build { "YYYY-MM-DD": [slot, ...] } for calendar dots
  _slotsByDay(slots) {
    const map = {};
    const FAR = new Date(8_640_000_000_000_000);
    for (const s of slots) {
      if (!s.start) continue;
      const sS  = new Date(s.start);
      const sE  = s.end ? new Date(s.end) : FAR;
      const cur = new Date(sS); cur.setHours(0, 0, 0, 0);
      const end = new Date(sE); end.setHours(0, 0, 0, 0);
      for (let i = 0; i < 90; i++) {
        const key = this._iso(cur);
        (map[key] = map[key] || []).push(s);
        cur.setDate(cur.getDate() + 1);
        if (cur > end) break;
      }
    }
    return map;
  },

  _bookedHours(slots, dateStr) {
    const booked = new Set();
    const dS = new Date(dateStr + 'T00:00:00');
    const dE = new Date(dateStr + 'T23:59:59');
    const FAR = new Date(8_640_000_000_000_000);
    for (const s of slots) {
      if (!s.start) continue;
      const sS = new Date(s.start);
      const sE = s.end ? new Date(s.end) : FAR;
      if (sS > dE || sE < dS) continue;
      for (let h = this.H0; h < this.H1; h++) {
        const hS = new Date(`${dateStr}T${this._hh(h)}:00:00`);
        const hE = new Date(`${dateStr}T${this._hh(h+1)}:00:00`);
        if (sS < hE && sE > hS) booked.add(h);
      }
    }
    return booked;
  },

  _selectedHours() {
    const { start, end } = this._s;
    if (start === null) return [];
    if (end   === null) return [start];
    const hrs = []; for (let h = start; h <= end; h++) hrs.push(h); return hrs;
  },

  // Flight-style: 1st click = start, 2nd = end, 3rd = reset
  _click(h) {
    const { allSlots, selectedDate } = this._s;
    const booked = this._bookedHours(allSlots, selectedDate);
    if (booked.has(h)) return;
    const { start, end } = this._s;

    if (start === null) {
      this._s.start = h; this._s.end = null;
    } else if (end === null) {
      if (h === start)      { this._s.start = null; }
      else if (h < start)   { this._s.start = h; }
      else {
        let blocked = false;
        for (let hh = start; hh <= h; hh++) if (booked.has(hh)) { blocked = true; break; }
        if (blocked) { this._hint('Khoảng giờ này có chỗ đã được đặt'); return; }
        this._s.end = h;
      }
    } else {
      this._s.start = h; this._s.end = null;
    }
    this._refreshTimeline();
  },

  _refreshTimeline() {
    const { allSlots, selectedDate, start, end } = this._s;
    const booked   = this._bookedHours(allSlots, selectedDate);
    const selHours = new Set(this._selectedHours());

    document.getElementById('stm-cells')?.querySelectorAll('.stm-cell').forEach(cell => {
      const h = +cell.dataset.hour;
      cell.className = `stm-cell ${
        booked.has(h)                  ? 'booked' :
        h === start && end === null    ? 'selecting-start' :
        selHours.has(h)                ? 'selected' : 'free'}`;
    });

    let selTxt, durTxt;
    if (start === null)    { selTxt = 'Chọn giờ bắt đầu'; durTxt = '—'; }
    else if (end === null) { selTxt = `Từ ${this._hh(start)}:00 — chọn giờ kết thúc`; durTxt = '—'; }
    else                   { selTxt = `${this._hh(start)}:00 – ${this._hh(end+1)}:00`; durTxt = `${end-start+1} giờ`; }

    const s = document.getElementById('stm-sel-text'); if (s) s.textContent = selTxt;
    const d = document.getElementById('stm-dur-text'); if (d) d.textContent = durTxt;
    const btn = document.querySelector('.stm-btn-confirm');
    if (btn) btn.disabled = start === null || end === null;
  },

  _hint(msg) {
    if (document.getElementById('stm-hint')) return;
    const el = Object.assign(document.createElement('div'), { id: 'stm-hint', className: 'stm-hint-toast', textContent: msg });
    this._s.modal.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); }, 1800);
  },

  async _confirm() {
    const { obj, el, selectedDate, start, end } = this._s;
    if (start === null || end === null) return;
    const sorted  = this._selectedHours();
    const timeStr = `${this._hh(start)}:00 – ${this._hh(end+1)}:00`;
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
        const msgs = { TimeConflict: 'Thời gian đã bị đặt, vui lòng chọn giờ khác', UserNotFound: 'Không tìm thấy tài khoản', BookingFailed: 'Đặt chỗ thất bại, thử lại sau', MissingFields: 'Thiếu thông tin đặt chỗ' };
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

  // Helpers
  _iso: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
  _hh:  h => String(h).padStart(2, '0'),
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

  // ─── Entry ────────────────────────────────────────────────────────────────
  show(book) {
    this._close();
    const { overlay, modal } = Utils.createSheet('bpop-overlay', 'bpop-modal', () => this._close());
    const today = new Date(); today.setHours(0, 0, 0, 0);
    this._s = {
      overlay, modal, book,
      view: 'calendar',
      viewDate: (() => { const d = new Date(); d.setDate(1); return d; })(),
      today,
      dueDate: null,   // Date object set when user picks a day
    };
    this._paintCalendar();
    Utils.openSheet(overlay, modal);
  },

  // ─── CALENDAR VIEW ────────────────────────────────────────────────────────
  _paintCalendar() {
    const { modal, book, viewDate, today, dueDate } = this._s;
    const color     = Books.COLORS[AppState.books.findIndex(b => b.id === book.id) % 8] || '#EAF3DE';
    const todayStr  = this._iso(today);
    const yr        = viewDate.getFullYear();
    const mo        = viewDate.getMonth();
    const monthName = viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    // Grid Mon-first
    const firstDay  = new Date(yr, mo, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - ((firstDay.getDay() + 6) % 7));
    const dates = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d;
    });

    // Max due = today + MAX_DAYS
    const maxDue = new Date(today); maxDue.setDate(today.getDate() + this.MAX_DAYS);
    const maxDueStr = this._iso(maxDue);
    const minDueStr = (() => { const d = new Date(today); d.setDate(today.getDate() + 1); return this._iso(d); })();

    const selectedStr = dueDate ? this._iso(dueDate) : null;
    const DOW = ['T2','T3','T4','T5','T6','T7','CN'];

    const cells = dates.map(d => {
      const ds     = this._iso(d);
      const isCur  = d.getMonth() === mo;
      const isPast = ds <= todayStr;                      // today itself = not selectable (borrow day)
      const isFar  = ds > maxDueStr;
      const isSel  = ds === selectedStr;
      const inRange = ds >= minDueStr && ds <= maxDueStr;
      const isToday = ds === todayStr;

      // "between" = strictly after today AND before selected due date
      const isBetween  = !!selectedStr && ds > todayStr && ds < selectedStr && isCur;
      // today gets a right-side fade when a due date is selected
      const todayRange = !!selectedStr && isToday;

      const cls = [
        'bcal-cell',
        !isCur           ? 'bcal-other'    : '',
        isPast || isFar  ? 'bcal-disabled' : '',
        isToday          ? 'bcal-today'    : '',
        todayRange       ? 'bcal-has-range': '',
        isSel            ? 'bcal-selected' : '',
        isBetween        ? 'bcal-between'  : '',
      ].filter(Boolean).join(' ');

      const clickable = isCur && !isPast && !isFar;
      const numCls    = isToday ? 'bcal-num bcal-num-today' : 'bcal-num';

      // Days-delta label for future dates in range
      let deltaLabel = '';
      if (isCur && !isPast && !isFar && !isToday) {
        const delta = Math.round((d - today) / 86_400_000);
        deltaLabel  = `<div class="bcal-delta">${delta}n</div>`;
      }

      return `<div class="${cls}" ${clickable ? `onclick="BookPopup._pickDay('${ds}')"` : ''}>
        <div class="${numCls}">${d.getDate()}</div>
        ${deltaLabel}
      </div>`;
    }).join('');

    // Summary bar at bottom
    const borrowTxt = today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const dueTxt    = dueDate
      ? dueDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '— chưa chọn';
    const days      = dueDate ? Math.round((dueDate - today) / 86_400_000) : 0;
    const btnDisabled = !dueDate;

    modal.innerHTML = `
      <div class="bpop-handle"></div>

      <!-- Book header (compact) -->
      <div class="bcal-book-row">
        <div class="bpop-cover bcal-cover-sm" style="background:${color}">📚</div>
        <div class="bcal-book-meta">
          <div class="bcal-book-title">${book.title}</div>
          <div class="bcal-book-author">${book.author}</div>
        </div>
        <button class="bcal-close-btn" onclick="BookPopup._close()">✕</button>
      </div>

      <!-- Calendar nav -->
      <div class="scal-nav-bar" style="background:#FBF7F0;border-color:rgba(200,169,110,.15)">
        <button class="scal-nav-btn bcal-nav-btn" onclick="BookPopup._calPrev()">‹</button>
        <span class="scal-nav-title" style="color:#8B6F00">${monthName}</span>
        <button class="scal-nav-btn bcal-nav-btn" onclick="BookPopup._calNext()">›</button>
      </div>

      <!-- Legend -->
      <div class="bcal-legend">
        <span class="bcal-legend-item"><span class="bcal-ldot bcal-ldot-today"></span>Hôm nay (ngày mượn)</span>
        <span class="bcal-legend-item"><span class="bcal-ldot bcal-ldot-sel"></span>Ngày trả đã chọn</span>
        <span class="bcal-legend-hint">Nhấn ngày để chọn hạn trả</span>
      </div>

      <!-- DOW + grid -->
      <div class="scal-wrap bcal-wrap">
        <div class="scal-dow-row bcal-dow-row">${DOW.map(d => `<div class="scal-dow bcal-dow">${d}</div>`).join('')}</div>
        <div class="scal-grid bcal-grid" id="bcal-grid">${cells}</div>
      </div>

      <!-- Summary / confirm bar -->
      <div class="bcal-confirm-bar">
        <div class="bcal-confirm-info">
          <div class="bcal-row-dates">
            <div class="bcal-date-item">
              <span class="bcal-date-label">Ngày mượn</span>
              <span class="bcal-date-val">${borrowTxt}</span>
            </div>
            <div class="bcal-arrow">→</div>
            <div class="bcal-date-item">
              <span class="bcal-date-label">Hạn trả</span>
              <span class="bcal-date-val ${dueDate ? 'bcal-due-set' : 'bcal-due-empty'}">${dueTxt}</span>
            </div>
            ${dueDate ? `<div class="bcal-days-badge">${days} ngày</div>` : ''}
          </div>
          <div class="bcal-limit-note">Tối đa ${this.MAX_DAYS} ngày · Tối đa 3 quyển cùng lúc</div>
        </div>
        <button class="bpop-btn-confirm bcal-confirm-btn" id="bpop-ok"
          onclick="BookPopup._confirm()" ${btnDisabled ? 'disabled' : ''}>
          Xác nhận mượn
        </button>
      </div>`;
  },

  _calPrev() { this._s.viewDate.setMonth(this._s.viewDate.getMonth() - 1); this._paintCalendar(); },
  _calNext() { this._s.viewDate.setMonth(this._s.viewDate.getMonth() + 1); this._paintCalendar(); },

  // User picked a due-date
  _pickDay(dateStr) {
    this._s.dueDate = new Date(dateStr + 'T12:00:00');
    this._paintCalendar();
  },

  // ─── CONFIRM ──────────────────────────────────────────────────────────────
  async _confirm() {
    const { book, today, dueDate } = this._s;
    if (!dueDate) return;
    const days = Math.round((dueDate - today) / 86_400_000);
    if (days < 1 || days > this.MAX_DAYS) return;

    const btn = document.getElementById('bpop-ok');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang xử lý...'; }

    try {
      const res = await Utils.post('/borrow-book', { bookId: book.id, dueDays: days });
      if (res.success) {
        AppState.myBorrows = await Utils.fetchJSON('/my-borrows');
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

  _iso: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
};

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
    const borrowInfo = AppState.myBorrows.find(b => b.borrowId === borrowId);

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
        if (borrowInfo) BookRating.prompt(borrowInfo);
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
const TopBorrowedBooks = {
  period: 'week',
  labels: { week: '1 tuần', month: '1 tháng', all: 'Từ trước đến nay' },

  async init() {
    this._ensureMount();
    await this.load('week');
  },

  _ensureMount() {
    if (document.getElementById('top-borrowed-wrap')) return;
    const grid = document.getElementById('books-grid');
    if (!grid) return;
    const wrap = document.createElement('div');
    wrap.id = 'top-borrowed-wrap';
    wrap.className = 'top-borrowed-wrap';
    grid.parentElement.insertBefore(wrap, grid);
  },

  async load(period) {
    this.period = period;
    this._ensureMount();
    const wrap = document.getElementById('top-borrowed-wrap');
    if (!wrap) return;
    wrap.innerHTML = this._shell('<div class="top-borrowed-empty">Đang tải...</div>');
    try {
      const items = await Utils.fetchJSON(`/get-top-borrowed-books?period=${period}`);
      wrap.innerHTML = this._shell(this._list(items));
    } catch {
      wrap.innerHTML = this._shell('<div class="top-borrowed-empty">Không tải được top sách</div>');
    }
  },

  _shell(content) {
    return `
      <div class="top-borrowed-head">
        <div>
          <h3>Sách được mượn nhiều</h3>
          <p>${this.labels[this.period]}</p>
        </div>
        <div class="top-borrowed-tabs">
          ${['week', 'month', 'all'].map(p => `
            <button class="${this.period === p ? 'active' : ''}" onclick="TopBorrowedBooks.load('${p}')">${this.labels[p]}</button>
          `).join('')}
        </div>
      </div>
      <div class="top-borrowed-list">${content}</div>`;
  },

  _list(items) {
    if (!items.length) return '<div class="top-borrowed-empty">Chưa có lượt mượn trong khoảng này</div>';
    return items.map((book, idx) => `
      <div class="top-borrowed-item" onclick="Books.openDetail(${book.id})">
        <div class="top-borrowed-rank">${idx + 1}</div>
        <div class="top-borrowed-info">
          <strong>${Utils.escapeHTML(book.title)}</strong>
          <span>${Utils.escapeHTML(book.author)}</span>
        </div>
        <div class="top-borrowed-count">
          <strong>${book.periodBorrowCount}</strong>
          <span>lượt</span>
        </div>
      </div>`).join('');
  },
};

const Books = {
  COLORS: ['#EAF3DE','#E6F1FB','#FAEEDA','#FBEAF0','#E1F5EE','#FAECE7','#EEEDFE','#F3ECE7'],
  MAX: 3,

  async load() {
    try {
      AppState.books = await Utils.fetchJSON('/get-booklist-with-categories');
      await this._loadRatings();
      CategoryFilter.init();   // cập nhật chip lọc theo chủ đề
      this.render();
      TopBorrowedBooks.init();
    } catch(e) { console.error('load books:', e); }
  },

  async _loadRatings() {
    try {
      const ratings = await Utils.fetchJSON('/get-all-ratings');
      // Key bằng string để tránh type mismatch khi lookup
      const map = Object.fromEntries(ratings.map(r => [String(r.bookId), r]));
      AppState.books.forEach(b => {
        const r = map[String(b.id)];
        b.avgStars    = r?.avgStars    || 0;
        b.ratingCount = r?.ratingCount || 0;
      });
    } catch { /* ratings optional — bảng có thể chưa tồn tại */ }
  },

  async showRatings(bookId, event) {
    event?.stopPropagation();
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    try {
      const data = await Utils.fetchJSON(`/get-book-ratings?book_id=${bookId}`);
      BookRatingView.show(book, data);
    } catch { Utils.showToast('Lỗi tải đánh giá', 'error'); }
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
        <div class="book-card" data-title="${book.title.toLowerCase()}" data-author="${book.author.toLowerCase()}" data-book-id="${book.id}" onclick="Books.openDetail(${book.id})">
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
            ${book.avgStars ? `<div class="book-rating-row" onclick="event.stopPropagation(); Books.showRatings(${book.id}, event)">
              <span class="book-stars">${'★'.repeat(Math.round(book.avgStars))}${'☆'.repeat(5 - Math.round(book.avgStars))}</span>
              <span class="book-rating-num">${book.avgStars.toFixed(1)}</span>
              <span class="book-rating-count">(${book.ratingCount})</span>
            </div>` : ''}
            <button class="btn-borrow${disabled ? ' disabled' : ''}"
              ${disabled ? 'disabled' : ''} onclick="event.stopPropagation(); Books.openBorrow(${book.id})">
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
    if (book?.status) RfidBorrow.start(book);
  },

  async openDetail(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    let ratingsData = { avg: 0, count: 0, reviews: [], myRating: null };
    try { ratingsData = await Utils.fetchJSON(`/get-book-ratings?book_id=${bookId}`); } catch {}
    BookDetail.show(book, ratingsData);
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
// BOOK RATING  — hiện sau khi trả sách
// ─────────────────────────────────────────────
const BookRating = {
  _s: null,

  // Gọi sau khi trả sách thành công
  prompt(borrow) {
    // Đợi 400ms để sheet trả sách đóng xong
    setTimeout(() => this._show(borrow), 400);
  },

  _show(borrow) {
    const sheet = document.createElement('div');
    sheet.className = 'rconf-sheet rating-sheet';
    sheet.innerHTML = `
      <div class="rconf-handle"></div>
      <div class="rating-icon">⭐</div>
      <h3 class="rconf-title">Đánh giá sách</h3>
      <div class="rconf-book-name">${borrow.title}</div>
      <div class="rconf-author">${borrow.author}</div>
      <div class="rating-stars" id="rating-stars">
        ${[1,2,3,4,5].map(i =>
          `<button class="star-btn" data-star="${i}" onclick="BookRating._setStar(${i})">★</button>`
        ).join('')}
      </div>
      <div class="rating-hint" id="rating-hint">Nhấn sao để đánh giá</div>
      <textarea class="rating-comment" id="rating-comment"
        placeholder="Nhận xét của bạn (không bắt buộc)..." rows="3"></textarea>
      <div class="rconf-footer">
        <button class="rconf-btn-cancel" onclick="BookRating._dismiss()">Bỏ qua</button>
        <button class="rconf-btn-confirm" id="rating-ok" disabled
          onclick="BookRating._submit(${borrow.bookId})">Gửi đánh giá</button>
      </div>`;
    document.body.appendChild(sheet);
    this._s = { sheet, star: 0, bookId: borrow.bookId };
    requestAnimationFrame(() => sheet.classList.add('open'));
  },

  _setStar(n) {
    if (!this._s) return;
    this._s.star = n;
    const LABELS = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'];
    document.querySelectorAll('.bdl-star-btn').forEach(btn => {
      btn.classList.toggle('lit', +btn.dataset.n <= n);
    });
    const hint = document.getElementById('bdl-star-hint');
    if (hint) {
      hint.textContent = LABELS[n];
      hint.classList.add('chosen');
    }
    const btn = document.getElementById('bdl-submit');
    if (btn) btn.disabled = false;
  },

  async _submit(bookId) {
    const { star } = this._s;
    if (!star) return;
    const comment = document.getElementById('rating-comment')?.value.trim() || '';
    const btn = document.getElementById('rating-ok');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }
    try {
      await Utils.post('/rate-book', { bookId, stars: star, comment });
      this._dismiss();
      Utils.showToast('Cảm ơn đánh giá của bạn! ⭐', 'success');
    } catch {
      if (btn) { btn.disabled = false; btn.textContent = 'Gửi đánh giá'; }
    }
  },

  _dismiss() {
    if (!this._s) return;
    this._s.sheet.classList.remove('open');
    const s = this._s.sheet;
    this._s = null;
    setTimeout(() => s.remove(), 280);
  },
};

// ─────────────────────────────────────────────
// CATEGORY FILTER  — chip lọc trên trang sách
// ─────────────────────────────────────────────
const CategoryFilter = {
  _cats: [],
  _active: null,   // null = all

  async init() {
    try {
      this._cats = await Utils.fetchJSON('/get-categories');
      this._render();
    } catch { /* silent */ }
  },

  _render() {
    // Tìm hoặc tạo container chip
    let wrap = document.getElementById('category-filter-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'category-filter-wrap';
      wrap.className = 'cat-filter-wrap';
      const grid = document.getElementById('books-grid');
      if (grid) grid.parentElement.insertBefore(wrap, grid);
    }
    if (!this._cats.length) { wrap.innerHTML = ''; return; }

    wrap.innerHTML = [
      { id: null, name: 'Tất cả', bookCount: AppState.books.length },
      ...this._cats,
    ].map(c => `
      <button class="cat-chip${this._active === c.id ? ' active' : ''}"
        onclick="CategoryFilter.setActive(${c.id})">
        ${c.name}
        <span class="cat-chip-count">${c.bookCount ?? ''}</span>
      </button>`
    ).join('');
  },

  setActive(id) {
    this._active = id;
    this._render();
    this._applyFilter();
  },

  _applyFilter() {
    if (this._active === null) {
      // Show all
      document.querySelectorAll('.book-card').forEach(c => c.style.display = '');
      return;
    }
    const cat = this._cats.find(c => c.id === this._active);
    if (!cat) return;
    // Get book IDs in this category from loaded books data
    document.querySelectorAll('.book-card').forEach(card => {
      const id = +card.dataset.bookId;
      const book = AppState.books.find(b => b.id === id);
      const inCat = book?.categories?.includes(this._active);
      card.style.display = inCat ? '' : 'none';
    });
  },

  async reload() {
    try { this._cats = await Utils.fetchJSON('/get-categories'); this._render(); } catch {}
  },
};

// ─────────────────────────────────────────────
// SENSOR PRESENCE  — polls /get-seat-presence every 2s
// Colors seats that are physically occupied by a person
// ─────────────────────────────────────────────
const SensorPresence = {
  _timer:    null,
  _state:    {},    // { seatId: {occupied, distance, threshold, updated_at} }
  INTERVAL:  2000,  // ms

  start() {
    this.poll();
    this._timer = setInterval(() => this.poll(), this.INTERVAL);
  },

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  },

  async poll() {
    try {
      const data = await Utils.fetchJSON('/get-seat-presence');
      this._state = data;
      this._applyToLayout();
    } catch { /* silent — server may not have sensor data yet */ }
  },

  _applyToLayout() {
    const container = LayoutRenderer.container;
    if (!container) return;

    container.querySelectorAll('[data-type="seat"]').forEach(el => {
      const id      = +el.dataset.id;
      const info    = this._state[id];
      const present = info?.occupied === true;

      // Don't override "selected" state
      if (el.dataset.state === 'selected') return;

      if (present) {
        el.dataset.state = 'sensor';
        Object.assign(el.style, {
          background:  '#FF6B35',          // vivid orange — clearly different from booking
          borderColor: '#E55A28',
          color:       '#fff',
          cursor:      'pointer',
          boxShadow:   '0 0 0 3px rgba(255,107,53,.25)',
        });
        // Pulse animation via CSS class
        el.classList.add('sensor-occupied');
      } else {
        if (el.dataset.state === 'sensor') {
          // Restore to default or taken depending on booking state
          el.dataset.state = '';
          el.classList.remove('sensor-occupied');
          LayoutRenderer._applyStyle(el, 'default');
          el.style.boxShadow = '';
        }
      }
    });
  },

  // Check if a seat is physically occupied (used by SeatPopup warning)
  isOccupied(seatId) {
    return this._state[seatId]?.occupied === true;
  },
};


// ─────────────────────────────────────────────
// BOOK DETAIL  — trang chi tiết sách
// Click vào card → sheet đầy đủ:
//   cover | tên | tác giả | trạng thái | nút mượn
//   đánh giá tổng | danh sách reviews | form viết review
// ─────────────────────────────────────────────
const BookDetail = {
  _s: null,

  show(book, ratingsData) {
    this._close();
    const { overlay, modal } = Utils.createSheet('bdl-overlay', 'bdl-modal', () => this._close());
    this._s = { overlay, modal, book, ratingsData };
    this._paint();
    Utils.openSheet(overlay, modal);
  },

  _paint() {
    const { modal, book, ratingsData } = this._s;
    const color    = Books.COLORS[AppState.books.findIndex(b => b.id === book.id) % 8] || '#EAF3DE';
    const initials = book.title.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
    const isMine   = AppState.myBorrows.some(b => b.bookId === book.id);
    const avail    = book.status && !isMine;
    const canBorrow = AppState.myBorrows.length < Books.MAX;
    const disabled  = !avail || !canBorrow;
    const btnLabel  = isMine ? 'Đang mượn'
                    : !book.status ? 'Hết sách'
                    : !canBorrow ? 'Đã đủ 3 quyển'
                    : 'Mượn sách';

    const stars = n => '★'.repeat(Math.max(0, n)) + '☆'.repeat(Math.max(0, 5 - n));
    const { avg = 0, count = 0, reviews = [], myRating = null } = ratingsData;

    /* ── Rating bars ── */
    const dist = [5, 4, 3, 2, 1].map(n => {
      const cnt = reviews.filter(r => r.stars === n).length;
      const pct = count ? Math.round((cnt / count) * 100) : 0;
      return `<div class="bdl-bar-row">
        <span class="bdl-bar-label">${stars(n)}</span>
        <div class="bdl-bar-track"><div class="bdl-bar-fill" style="width:${pct}%"></div></div>
        <span class="bdl-bar-cnt">${cnt}</span>
      </div>`;
    }).join('');

    /* ── Reviews ── */
    const reviewsHtml = reviews.length
      ? reviews.map(r => `
        <div class="bdl-review">
          <div class="bdl-rev-head">
            <div class="bdl-avatar">${(r.userName || '?')[0].toUpperCase()}</div>
            <div class="bdl-rev-meta">
              <span class="bdl-rev-name">${r.userName || 'Ẩn danh'}</span>
              <span class="bdl-rev-stars">${stars(r.stars)}</span>
            </div>
            <span class="bdl-rev-date">${r.date?.slice(0, 10) || ''}</span>
          </div>
          ${r.comment ? `<div class="bdl-rev-text">${r.comment}</div>` : ''}
        </div>`).join('')
      : '<p class="bdl-no-reviews">Chưa có đánh giá nào.<br>Hãy là người đầu tiên!</p>';

    /* ── Write / show my review ── */
    const reviewBlock = myRating
      ? `<div class="bdl-my-box">
          <div class="bdl-section-label">Đánh giá của bạn</div>
          <div class="bdl-my-stars">${stars(myRating.stars)}</div>
          ${myRating.comment ? `<div class="bdl-my-comment">"${myRating.comment}"</div>` : ''}
        </div>`
      : `<div class="bdl-write-section">
          <div class="bdl-section-label">Viết đánh giá</div>
          <div class="bdl-stars-row" id="bdl-stars-row">
            ${[1,2,3,4,5].map(i =>
              `<button class="bdl-star-btn" data-n="${i}" onclick="BookDetail._setStar(${i})">★</button>`
            ).join('')}
          </div>
          <div class="bdl-star-hint" id="bdl-star-hint">Chọn số sao</div>
          <textarea class="bdl-comment-input" id="bdl-comment"
            placeholder="Nhận xét của bạn (tuỳ chọn)..." rows="3"></textarea>
          <button class="bdl-submit-btn" id="bdl-submit" disabled
            onclick="BookDetail._submitRating(${book.id})">Gửi đánh giá</button>
        </div>`;

    /* ── Badges ── */
    const statusClass = isMine ? 'bdl-badge-mine' : avail ? 'bdl-badge-avail' : 'bdl-badge-out';
    const statusLabel = isMine ? 'Đang mượn' : book.status ? 'Còn sách' : 'Hết sách';
    const badgesHtml  = `
      <span class="bdl-badge ${statusClass}">${statusLabel}</span>
      ${book.borrowedCount > 0
        ? `<span class="bdl-badge bdl-badge-count">${book.borrowedCount} lượt mượn</span>` : ''}
      ${avg > 0
        ? `<span class="bdl-badge bdl-badge-stars">${stars(Math.round(avg))} ${avg.toFixed(1)}</span>` : ''}`;

    /* ── Rating summary card ── */
    const ratingCard = count > 0 ? `
      <div class="bdl-rating-card">
        <div class="bdl-score-col">
          <span class="bdl-score-num">${avg.toFixed(1)}</span>
          <span class="bdl-score-stars">${stars(Math.round(avg))}</span>
          <span class="bdl-score-total">${count} đánh giá</span>
        </div>
        <div class="bdl-divider-v"></div>
        <div class="bdl-bars">${dist}</div>
      </div>` : '';

    /* ── Render ── */
    modal.innerHTML = `
      <div class="bdl-handle"></div>

      <div class="bdl-hero" style="background:${color}">
        <button class="bdl-close" onclick="BookDetail._close()" aria-label="Đóng">✕</button>
        <div class="bdl-cover-initials">${initials}</div>
      </div>

      <div class="bdl-info-section">
        <h2 class="bdl-title">${book.title}</h2>
        <p class="bdl-author">${book.author}</p>
        <div class="bdl-badges">${badgesHtml}</div>
        <button class="bdl-borrow-btn"
          ${disabled ? 'disabled' : ''}
          onclick="BookDetail._borrow()">
          ${btnLabel}
        </button>
      </div>

      <div class="bdl-section">
        <div class="bdl-section-label">Đánh giá &amp; Nhận xét</div>
        ${ratingCard}
        ${reviewBlock}
        <div class="bdl-reviews">${reviewsHtml}</div>
      </div>`;
  },

  _setStar(n) {
    if (!this._s) return;
    this._s.star = n;
    const LABELS = ['','Rất tệ','Tệ','Bình thường','Tốt','Xuất sắc'];
    document.querySelectorAll('.bdl-star-btn').forEach(btn => {
      btn.classList.toggle('active', +btn.dataset.n <= n);
    });
    const hint = document.getElementById('bdl-star-hint');
    if (hint) hint.textContent = LABELS[n];
    const btn = document.getElementById('bdl-submit');
    if (btn) btn.disabled = false;
  },

  async _submitRating(bookId) {
    const star    = this._s?.star;
    if (!star) return;
    const comment = document.getElementById('bdl-comment')?.value.trim() || '';
    const btn     = document.getElementById('bdl-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }
    try {
      const res = await Utils.post('/rate-book', { bookId, stars: star, comment });
      if (res.success) {
        Utils.showToast('Đã gửi đánh giá! ⭐', 'success');
        // Reload ratings and repaint
        const data = await Utils.fetchJSON(`/get-book-ratings?book_id=${bookId}`);
        this._s.ratingsData = data;
        // Also update AppState
        const book = AppState.books.find(b => b.id === bookId);
        if (book) { book.avgStars = data.avg; book.ratingCount = data.count; }
        Books.render();
        this._paint();
      } else {
        Utils.showToast('Lỗi gửi đánh giá', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Gửi đánh giá'; }
      }
    } catch {
      Utils.showToast('Lỗi kết nối', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Gửi đánh giá'; }
    }
  },

  _borrow() {
    const { book } = this._s;
    if (!book?.status) return;
    this._close();
    setTimeout(() => RfidBorrow.start(book), 200);
  },

  _close() {
    if (!this._s) return;
    Utils.closeSheet(this._s.overlay, this._s.modal);
    this._s = null;
  },
};


// ─────────────────────────────────────────────
// BOOK RATING VIEW  — xem đánh giá của 1 quyển
// ─────────────────────────────────────────────
const BookRatingView = {
  show(book, data) {
    const { overlay, modal } = Utils.createSheet('bpop-overlay', 'bpop-modal', () => this._close());
    this._overlay = overlay;

    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    const myRating = data.myRating;

    const reviewsHtml = data.reviews.length
      ? data.reviews.map(r => `
          <div class="brv-review">
            <div class="brv-review-head">
              <span class="brv-reviewer">${r.userName}</span>
              <span class="brv-review-stars">${stars(r.stars)}</span>
              <span class="brv-review-date">${r.date?.slice(0,10) || ''}</span>
            </div>
            ${r.comment ? `<div class="brv-comment">${r.comment}</div>` : ''}
          </div>`).join('')
      : '<p class="brv-empty">Chưa có đánh giá nào</p>';

    modal.innerHTML = `
      <div class="bpop-handle"></div>
      <div class="brv-header">
        <div class="brv-title">${book.title}</div>
        <div class="brv-author">${book.author}</div>
        <div class="brv-summary">
          <span class="brv-avg-stars">${stars(Math.round(data.avg))}</span>
          <span class="brv-avg-num">${data.avg.toFixed(1)}</span>
          <span class="brv-count">${data.count} đánh giá</span>
        </div>
      </div>

      ${myRating ? `
        <div class="brv-my-rating">
          <span class="brv-my-label">Đánh giá của bạn:</span>
          <span class="brv-my-stars">${stars(myRating.stars)}</span>
          ${myRating.comment ? `<span class="brv-my-comment">"${myRating.comment}"</span>` : ''}
        </div>` : ''}

      <div class="brv-reviews-label">Tất cả đánh giá</div>
      <div class="brv-reviews">${reviewsHtml}</div>

      <div class="brv-footer">
        <button class="rconf-btn-cancel" onclick="BookRatingView._close()">Đóng</button>
      </div>`;

    Utils.openSheet(overlay, modal);
  },

  _close() {
    if (!this._overlay) return;
    Utils.closeSheet(this._overlay, this._overlay.querySelector('.bpop-modal'));
    this._overlay = null;
  },
};


// ─────────────────────────────────────────────
// RFID BORROW  — pending + polling
// ─────────────────────────────────────────────
const RfidBorrow = {
  _timer:  null,
  _bookId: null,
  _modal:  null,
  _overlay: null,

  async start(book) {
    // Gọi /start-borrow trước
    let res;
    try {
      res = await Utils.post('/start-borrow', { bookId: book.id });
    } catch {
      Utils.showToast('Lỗi kết nối server', 'error'); return;
    }
    if (!res.success) {
      const msgs = {
        BorrowLimit:    'Bạn đang mượn tối đa 3 quyển',
        BookUnavailable:'Sách hiện không khả dụng',
        UserNotFound:   'Không tìm thấy tài khoản',
      };
      Utils.showToast(msgs[res.error] || 'Không thể mượn sách', 'error');
      return;
    }

    this._bookId = book.id;
    this._showSheet(book, res.expires);
    this._poll();
  },

  _showSheet(book, expires) {
    const { overlay, modal } = Utils.createSheet('rfid-overlay', 'rfid-modal', () => this.cancel());
    this._overlay = overlay;
    this._modal   = modal;

    const color    = Books.COLORS[AppState.books.findIndex(b => b.id === book.id) % 8] || '#EAF3DE';
    const initials = book.title.split(' ').slice(0,2).map(w => w[0]?.toUpperCase()||'').join('');

    modal.innerHTML = `
      <div class="rfid-handle"></div>
      <div class="rfid-cover" style="background:${color}">
        <span class="rfid-cover-init">${initials}</span>
      </div>
      <div class="rfid-body">
        <div class="rfid-book-title">${book.title}</div>
        <div class="rfid-book-author">${book.author}</div>

        <div class="rfid-state" id="rfid-state">
          <div class="rfid-spinner"></div>
          <div class="rfid-state-text">Đặt sách lên đầu đọc RFID</div>
          <div class="rfid-countdown" id="rfid-countdown"></div>
        </div>
      </div>
      <div class="rfid-footer">
        <button class="rfid-cancel-btn" onclick="RfidBorrow.cancel()">Hủy</button>
      </div>`;

    Utils.openSheet(overlay, modal);
    this._startCountdown(expires);
  },

  _startCountdown(expires) {
    const el = document.getElementById('rfid-countdown');
    const tick = () => {
      if (!el || !document.body.contains(el)) return;
      const left = Math.max(0, expires - Math.floor(Date.now() / 1000));
      el.textContent = `Còn ${left}s`;
      if (left > 0) setTimeout(tick, 1000);
    };
    tick();
  },

  _poll() {
    this._timer = setInterval(async () => {
      if (!this._bookId) return this._stopPoll();
      try {
        const res = await Utils.fetchJSON(`/borrow-status?book_id=${this._bookId}`);

        if (res.status === 'done') {
          this._stopPoll();
          if (res.success) {
            this._showSuccess(res);
          } else {
            this._close();
            Utils.showToast(res.message || 'Mượn thất bại', 'error');
          }
        } else if (res.status === 'timeout' || res.status === 'idle') {
          this._stopPoll();
          this._showTimeout();
        }
      } catch { /* silent */ }
    }, 2000);
  },

  _showSuccess(res) {
    const el = document.getElementById('rfid-state');
    if (!el) return;
    el.innerHTML = `
      <div class="rfid-success-icon">✓</div>
      <div class="rfid-state-text rfid-success-text">Xác nhận thành công!</div>
      <div class="rfid-due-text">Hạn trả: <strong>${res.due}</strong></div>`;
    // Refresh books + đóng sau 2.5s
    setTimeout(async () => {
      AppState.myBorrows = await Utils.fetchJSON('/my-borrows').catch(() => AppState.myBorrows);
      const lb = AppState.books.find(b => b.id === this._bookId);
      if (lb) lb.status = false;
      Books.render();
      this._close();
      Utils.showToast(`Đã mượn — hạn trả ${res.due}`, 'success');
    }, 2500);
  },

  _showTimeout() {
    const el = document.getElementById('rfid-state');
    if (!el) return;
    el.innerHTML = `
      <div class="rfid-timeout-icon">⏱</div>
      <div class="rfid-state-text rfid-timeout-text">Hết thời gian chờ</div>
      <div style="font-size:12px;color:var(--text-3);margin-top:4px">Vui lòng thử lại</div>`;
    setTimeout(() => this._close(), 2000);
  },

  async cancel() {
    this._stopPoll();
    if (this._bookId) {
      await Utils.post('/cancel-pending-borrow', { bookId: this._bookId }).catch(() => {});
    }
    this._close();
  },

  _stopPoll() {
    clearInterval(this._timer);
    this._timer = null;
  },

  _close() {
    if (!this._overlay) return;
    Utils.closeSheet(this._overlay, this._modal);
    this._overlay = null;
    this._modal   = null;
    this._bookId  = null;
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
  // Fire layout + borrows + user data concurrently
  const [, , borrows] = await Promise.allSettled([
    LayoutRenderer.init(),
    Books.load(),                // fetches books + categories + ratings → render
    Utils.fetchJSON('/my-borrows'),
    Booking.loadMyBookings(),
  ]);

  // myBorrows must be set BEFORE quota bar is accurate
  if (borrows.status === 'fulfilled') AppState.myBorrows = borrows.value;
  // Re-render with accurate borrow quota (Books.load already rendered once,
  // this second call ensures quota bar reflects the fetched borrows)
  Books.render();

  // Start IoT sensor polling
  SensorPresence.start();
});