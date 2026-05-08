// ─────────────────────────────────────────────
// STATE  — two separate namespaces to avoid
//          canvas editor bleeding into admin UI
// ─────────────────────────────────────────────
const AppState = {
  adminBooks:    [],
  adminAccounts: [],
  editingBookId: null,
};

const CanvasState = {
  canvas: null, ctx: null,
  objects: [],
  shape: 'rect', type: 'table', tool: 'select', snap: 10,
  drawing: false, dragging: false,
  selected: null,
  startX: 0, startY: 0, offX: 0, offY: 0,
  // AbortController for event cleanup
  _ac: null,
};

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
const Utils = {
  showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast show ${type}`;
    clearTimeout(this._tid);
    this._tid = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.className = 'toast', 300); }, 3000);
  },

  async fetchJSON(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  post(url, body) {
    return this.fetchJSON(url, { method: 'POST', body: JSON.stringify(body) });
  },

  debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  },

  fmtDatetime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  },

  // "YYYY-MM-DD" from a Date in local time
  isoDay: d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
};

// ─────────────────────────────────────────────
// AUTH / NAVIGATION
// ─────────────────────────────────────────────
const Auth = { async logout() { await fetch('/logout'); location.href = '/'; } };

const Navigation = {
  showSection(section, triggerEl) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    triggerEl?.closest('.nav-item')?.classList.add('active');
    ({ layout: () => setTimeout(() => Canvas.init(), 100),
       books:   () => Books.loadList(),
       accounts:() => Accounts.loadList(),
       dashboard:() => Dashboard.refresh(),
       schedule: () => Schedule.load(),
    })[section]?.();
  },
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
const Dashboard = {
  async refresh() {
    try {
      const [accounts, schedule, books] = await Promise.all([
        Utils.fetchJSON('/get-accountlist'),
        Utils.fetchJSON('/get-schedule'),
        Utils.fetchJSON('/get-booklist'),
      ]);
      this._set('stat-users',    accounts.length);
      this._set('stat-bookings', schedule.filter(b => b.active).length);
      this._set('stat-books',    books.filter(b => !b.status).length);
      this._set('stat-seats',    CanvasState.objects.filter(o => o.type === 'seat').length || '—');
    } catch(e) { console.error('Dashboard:', e); }
  },
  _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; },
};

// ─────────────────────────────────────────────
// CANVAS EDITOR
// ─────────────────────────────────────────────
const Canvas = {
  async init() {
    const el = document.getElementById('layout-canvas');
    if (!el) return;
    // Abort previous listeners cleanly
    CanvasState._ac?.abort();
    CanvasState._ac = new AbortController();
    const { signal } = CanvasState._ac;

    CanvasState.canvas = el;
    CanvasState.ctx    = el.getContext('2d');

    el.addEventListener('mousedown', e => this._down(e),  { signal });
    el.addEventListener('mousemove', e => this._move(e),  { signal });
    el.addEventListener('mouseup',   e => this._up(e),    { signal });

    await this._loadLayout();
    this.draw();
  },

  draw() {
    const { ctx, canvas } = CanvasState;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._grid();
    this._objects();
  },

  // ── Grid — batch all lines into two paths ─────────────────────────────────
  _grid() {
    const { ctx, canvas, snap } = CanvasState;

    // Major grid (40px)
    ctx.beginPath();
    ctx.strokeStyle = '#F0F0F0'; ctx.lineWidth = 1; ctx.setLineDash([]);
    for (let x = 0; x <= canvas.width;  x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = 0; y <= canvas.height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    // Snap grid (dashed)
    if (snap > 1 && snap !== 40) {
      ctx.beginPath();
      ctx.strokeStyle = '#E8E8E8'; ctx.setLineDash([1, 3]);
      for (let x = 0; x <= canvas.width;  x += snap) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
      for (let y = 0; y <= canvas.height; y += snap) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  },

  _objects() {
    const { ctx, objects, selected } = CanvasState;
    for (const obj of objects) {
      const sel = obj === selected;
      ctx.fillStyle   = obj.type === 'table' ? '#D4C9A8' : '#FFFFFF';
      ctx.strokeStyle = sel ? '#2D5A3D' : obj.type === 'table' ? '#A89E80' : '#6B9A7D';
      ctx.lineWidth   = sel ? 3 : 2;
      this._shape(obj);
      this._label(obj, sel);
      if (sel) this._handles(obj);
    }
  },

  _shape(obj) {
    const { ctx } = CanvasState;
    if (obj.shape === 'circle') {
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (obj.shape === 'roundrect') {
      this._rrect(obj.x, obj.y, obj.width, obj.height, 12);
    } else {
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    }
  },

  _rrect(x, y, w, h, r) {
    const c = CanvasState.ctx;
    c.beginPath();
    c.moveTo(x+r, y); c.lineTo(x+w-r, y); c.quadraticCurveTo(x+w, y, x+w, y+r);
    c.lineTo(x+w, y+h-r); c.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    c.lineTo(x+r, y+h); c.quadraticCurveTo(x, y+h, x, y+h-r);
    c.lineTo(x, y+r); c.quadraticCurveTo(x, y, x+r, y);
    c.closePath(); c.fill(); c.stroke();
  },

  _label(obj, sel) {
    const { ctx } = CanvasState;
    ctx.fillStyle   = obj.type === 'table' ? '#6B6860' : '#2D5A3D';
    ctx.font        = sel ? 'bold 12px DM Sans' : '11px DM Sans';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    const cx = obj.shape === 'circle' ? obj.x : obj.x + obj.width  / 2;
    const cy = obj.shape === 'circle' ? obj.y : obj.y + obj.height / 2;
    ctx.fillText(obj.name, cx, cy);
  },

  _handles(obj) {
    const { ctx } = CanvasState; const s = 6;
    ctx.fillStyle = '#2D5A3D';
    const pts = obj.shape === 'circle'
      ? [[obj.x, obj.y-obj.radius],[obj.x+obj.radius, obj.y],[obj.x, obj.y+obj.radius],[obj.x-obj.radius, obj.y]]
      : [[obj.x, obj.y],[obj.x+obj.width, obj.y],[obj.x, obj.y+obj.height],[obj.x+obj.width, obj.y+obj.height]];
    for (const [hx, hy] of pts) ctx.fillRect(hx-s/2, hy-s/2, s, s);
  },

  // ── Interaction ────────────────────────────────────────────────────────────
  _snap(v) { return Math.round(v / CanvasState.snap) * CanvasState.snap; },
  _pos(e)  {
    const r = CanvasState.canvas.getBoundingClientRect();
    return { x: this._snap(e.clientX - r.left), y: this._snap(e.clientY - r.top) };
  },

  _hit(x, y) {
    const { objects } = CanvasState;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.shape === 'circle' ? Math.hypot(x-o.x, y-o.y) <= o.radius
                               : x >= o.x && x <= o.x+o.width && y >= o.y && y <= o.y+o.height)
        return o;
    }
    return null;
  },

  _down(e) {
    const p = this._pos(e);
    Object.assign(CanvasState, { startX: p.x, startY: p.y });
    if (CanvasState.tool === 'select') {
      const obj = this._hit(p.x, p.y);
      if (obj) Object.assign(CanvasState, { selected: obj, dragging: true, offX: p.x-obj.x, offY: p.y-obj.y });
      else     CanvasState.drawing = true;
    } else if (CanvasState.tool === 'delete') {
      this._del(p.x, p.y);
    }
    this.draw();
  },

  _move(e) {
    const p = this._pos(e);
    if (CanvasState.dragging && CanvasState.selected) {
      Object.assign(CanvasState.selected, { x: p.x - CanvasState.offX, y: p.y - CanvasState.offY });
      this.draw();
    } else if (CanvasState.drawing) {
      this.draw(); this._preview(p);
    }
  },

  _up(e) {
    if (CanvasState.dragging) {
      CanvasState.dragging = false;
      this._updateList();
    } else if (CanvasState.drawing) {
      CanvasState.drawing = false;
      this._create(this._pos(e));
    }
  },

  _preview(pos) {
    const { ctx, startX, startY, shape } = CanvasState;
    const w = pos.x - startX, h = pos.y - startY;
    ctx.strokeStyle = '#2D5A3D'; ctx.fillStyle = 'rgba(45,90,61,.1)';
    ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    if (shape === 'circle') {
      const r = Math.hypot(w, h) / 2;
      ctx.beginPath(); ctx.arc(startX+w/2, startY+h/2, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else if (shape === 'roundrect') {
      this._rrect(startX, startY, w, h, 12);
    } else {
      ctx.strokeRect(startX, startY, w, h); ctx.fillRect(startX, startY, w, h);
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#2D5A3D'; ctx.font = 'bold 11px DM Sans'; ctx.textAlign = 'left';
    ctx.fillText(`${Math.abs(w)}×${Math.abs(h)}px`, pos.x+8, pos.y-8);
  },

  _create(end) {
    const { startX, startY, shape, type, objects, snap } = CanvasState;
    const w = end.x - startX, h = end.y - startY;
    if (Math.abs(w) < snap*2 || Math.abs(h) < snap*2) return this.draw();
    const label = type === 'table' ? 'Bàn' : 'Ghế';
    const n     = objects.filter(o => o.type === type).length + 1;
    const obj   = {
      id: Date.now(), shape, type,
      x: Math.min(startX, end.x), y: Math.min(startY, end.y),
      width: Math.abs(w), height: Math.abs(h),
      name: `${label}-${n}`,
    };
    if (shape === 'circle') Object.assign(obj, { radius: Math.hypot(w,h)/2, x: startX+w/2, y: startY+h/2 });
    objects.push(obj);
    this.draw(); this._updateList();
    Utils.showToast(`Đã thêm ${obj.name}`);
  },

  _del(x, y) {
    const obj = this._hit(x, y);
    if (!obj) return;
    CanvasState.objects  = CanvasState.objects.filter(o => o !== obj);
    CanvasState.selected = null;
    this.draw(); this._updateList();
    Utils.showToast(`Đã xóa ${obj.name}`);
  },

  // ── Object list panel ─────────────────────────────────────────────────────
  _updateList() {
    const list    = document.getElementById('objects-list');
    const counter = document.getElementById('objects-count');
    if (!list) return;
    const { objects, selected } = CanvasState;
    if (counter) counter.textContent = `${objects.length} đối tượng`;

    if (!objects.length) {
      list.innerHTML = '<p class="obj-empty">Chưa có đối tượng nào<br><small>Chọn hình dạng và loại, sau đó vẽ trên canvas</small></p>';
      return;
    }

    const SHAPE_LABEL = { rect: 'Vuông', circle: 'Tròn', roundrect: 'Bo góc' };
    list.innerHTML = objects.map(obj => {
      const sel      = obj === selected;
      const sizeInfo = obj.shape === 'circle' ? `r=${Math.round(obj.radius)}` : `${obj.width}×${obj.height}`;
      return `
        <div class="obj-item${sel ? ' selected' : ''}" onclick="Canvas.selectById(${obj.id})">
          <div class="obj-item-head">
            <span class="obj-item-name">${obj.type === 'table' ? '📊' : '💺'} ${obj.name}</span>
            <button class="obj-del-btn" onclick="event.stopPropagation();Canvas.deleteById(${obj.id})">Xóa</button>
          </div>
          <div class="obj-item-meta">
            <span>${SHAPE_LABEL[obj.shape] || obj.shape}</span>
            <span>(${obj.x}, ${obj.y})</span>
            <span>${sizeInfo}</span>
          </div>
          <input class="obj-name-input" type="text" value="${obj.name}" placeholder="Tên..."
            onclick="event.stopPropagation()"
            onchange="Canvas.rename(${obj.id}, this.value)" />
        </div>`;
    }).join('');
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  selectById(id) {
    CanvasState.selected = CanvasState.objects.find(o => o.id === id) || null;
    this.draw(); this._updateList();
  },

  deleteById(id) {
    const obj = CanvasState.objects.find(o => o.id === id);
    CanvasState.objects  = CanvasState.objects.filter(o => o.id !== id);
    CanvasState.selected = null;
    this.draw(); this._updateList();
    if (obj) Utils.showToast(`Đã xóa ${obj.name}`);
  },

  rename(id, name) {
    const obj = CanvasState.objects.find(o => o.id === id);
    if (obj) { obj.name = name.trim() || obj.name; this.draw(); }
  },

  setShape(shape) {
    CanvasState.shape = shape;
    this._activateBtn('[data-shape]', `[data-shape="${shape}"]`);
  },

  setType(type) {
    CanvasState.type = type;
    this._activateBtn('[data-type]', `[data-type="${type}"]`);
  },

  setTool(tool) {
    CanvasState.tool     = tool;
    CanvasState.selected = null;
    this._activateBtn('[data-tool]', `[data-tool="${tool}"]`);
    if (CanvasState.canvas)
      CanvasState.canvas.style.cursor = { delete: 'not-allowed', select: 'default' }[tool] || 'crosshair';
    this.draw();
  },

  updateSnap() {
    CanvasState.snap = parseInt(document.getElementById('snap-grid').value);
    this.draw();
    Utils.showToast(`Snap: ${CanvasState.snap}px`);
  },

  _activateBtn(allSel, activeSel) {
    document.querySelectorAll(allSel).forEach(b => b.classList.remove('active'));
    document.querySelector(activeSel)?.classList.add('active');
  },

  async save() {
    const { objects, snap, canvas } = CanvasState;
    try {
      await Utils.post('/save-layout', { objects, snapGrid: snap, canvasSize: { width: canvas.width, height: canvas.height } });
      Utils.showToast('Đã lưu layout!', 'success');
      Dashboard.refresh();
    } catch { Utils.showToast('Lỗi khi lưu', 'error'); }
  },

  async _loadLayout() {
    try {
      const data = await Utils.fetchJSON('/get-layout');
      CanvasState.objects = data.objects || [];
      CanvasState.snap    = data.snapGrid || 10;
      this._updateList();
    } catch { /* no layout yet */ }
  },
};

// ─────────────────────────────────────────────
// SCHEDULE  — pre-index bookings by date for O(1) day lookup
// ─────────────────────────────────────────────
const Schedule = {
  _data:    [],
  _byDay:   {},   // "YYYY-MM-DD" -> booking[]  (pre-computed)
  _viewDate: new Date(),

  async load() {
    try {
      this._data = await Utils.fetchJSON('/get-schedule');
    } catch(e) {
      console.error('Schedule load:', e);
      Utils.showToast('Lỗi tải lịch đặt', 'error');
    }
    this._index();
    this._viewDate = new Date(); this._viewDate.setDate(1);
    this._render();
  },

  // Pre-build a map dateStr -> bookings[] so render is O(1) per cell
  _index() {
    const map = {};
    const FAR = new Date(8_640_000_000_000_000);
    for (const b of this._data) {
      if (!b.start) continue;
      const s = new Date(b.start);
      const e = b.end ? new Date(b.end) : FAR;
      // Walk days from s to e (max 90 days to be safe)
      const cur = new Date(s); cur.setHours(0,0,0,0);
      const eDateOnly = new Date(e); eDateOnly.setHours(0,0,0,0);
      for (let i = 0; i < 90; i++) {
        const key = Utils.isoDay(cur);
        (map[key] = map[key] || []).push(b);
        cur.setDate(cur.getDate() + 1);
        if (cur > eDateOnly) break;
      }
    }
    this._byDay = map;
  },

  _forDay: ds => Schedule._byDay[ds] || [],

  prevMonth() { this._viewDate.setMonth(this._viewDate.getMonth() - 1); this._render(); },
  nextMonth() { this._viewDate.setMonth(this._viewDate.getMonth() + 1); this._render(); },
  goToday()   { this._viewDate = new Date(); this._viewDate.setDate(1); this._render(); },

  openDay(dateStr) {
    const bs = this._forDay(dateStr);
    const d  = new Date(dateStr);
    const panel = document.getElementById('sch-detail-panel');
    if (!panel) return;

    const label = d.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    const items = bs.length
      ? bs.map(b => {
          const c = this._color(b);
          return `<div class="sch-detail-item" style="border-left:3px solid ${c.border}">
            <div class="sch-detail-seat">${b.seatName}</div>
            <div class="sch-detail-user"><strong>${b.userName}</strong><span>${b.email}</span></div>
            <div class="sch-detail-times">
              <span>▶ ${Utils.fmtDatetime(b.start)}</span>
              <span>■ ${b.active ? '<em style="color:var(--danger)">Đang thuê</em>' : Utils.fmtDatetime(b.end)}</span>
            </div>
            ${b.active ? `<button class="sch-cancel-btn" onclick="Schedule.cancelBooking(${b.bookingId},'${b.seatName}','${b.userName}')">Hủy đặt</button>` : ''}
          </div>`;
        }).join('')
      : '<p style="padding:1.5rem 0;text-align:center;color:var(--text-3)">Không có đặt chỗ ngày này</p>';

    panel.innerHTML = `
      <div class="sch-detail-header">
        <div>
          <div class="sch-detail-title">${label}</div>
          <div class="sch-detail-count">${bs.length} đặt chỗ · ${bs.filter(b => b.active).length} đang thuê</div>
        </div>
        <button class="sch-detail-close" onclick="Schedule._closeDetail()">✕</button>
      </div>
      <div class="sch-detail-list">${items}</div>`;
  },

  _closeDetail() {
    const p = document.getElementById('sch-detail-panel');
    if (p) p.innerHTML = `<div class="sch-detail-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
      <p>Chọn một ngày để xem chi tiết</p></div>`;
  },

  async cancelBooking(id, seatName, userName) {
    if (!confirm(`Hủy đặt chỗ "${seatName}" của "${userName}"?`)) return;
    try {
      const res = await Utils.post('/cancel-booking', { id });
      if (res.success) { await this.load(); Utils.showToast('Đã hủy đặt chỗ!', 'success'); }
      else Utils.showToast('Lỗi khi hủy', 'error');
    } catch(e) { console.error(e); }
  },

  _color: b => b.active
    ? { bg:'rgba(192,57,43,.12)', border:'rgba(192,57,43,.35)', text:'#a93226' }
    : { bg:'var(--green-dim)',    border:'var(--green-border)',  text:'var(--green)' },

  _render() {
    const wrap = document.getElementById('schedule-wrap');
    if (!wrap) return;

    const today      = new Date();
    const todayStr   = Utils.isoDay(today);
    const yr         = this._viewDate.getFullYear();
    const mo         = this._viewDate.getMonth();
    const monthName  = this._viewDate.toLocaleDateString('vi-VN', { month:'long', year:'numeric' });

    // Grid start = Monday of the week containing 1st of month
    const firstDay  = new Date(yr, mo, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(1 - ((firstDay.getDay() + 6) % 7));

    // Build 42-cell date array once, shared by mini + main calendar
    const gridDates = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });

    const DOW_SHORT = ['T2','T3','T4','T5','T6','T7','CN'];
    const DOW_FULL  = ['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'];

    const miniCells = gridDates.map(d => {
      const ds = Utils.isoDay(d);
      const cls = [
        'sch-mini-day',
        ds === todayStr            ? 'today'       : '',
        d.getMonth() !== mo        ? 'other-month'  : '',
        this._forDay(ds).length    ? 'has-event'    : '',
      ].filter(Boolean).join(' ');
      return `<div class="${cls}" onclick="Schedule.openDay('${ds}')">${d.getDate()}</div>`;
    }).join('');

    const MAX_SHOW  = 3;
    const mainCells = gridDates.map(d => {
      const ds       = Utils.isoDay(d);
      const isToday  = ds === todayStr;
      const isCur    = d.getMonth() === mo;
      const bs       = this._forDay(ds);
      const shown    = bs.slice(0, MAX_SHOW);
      const extra    = bs.length - MAX_SHOW;

      const evts = shown.map(b => {
        const c = this._color(b);
        const t = b.start ? new Date(b.start).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }) : '';
        return `<div class="sch-event" style="background:${c.bg};border-left:3px solid ${c.border};color:${c.text}"
          onclick="event.stopPropagation();Schedule.openDay('${ds}')"
          title="${b.seatName} — ${b.userName}">
          <span class="sch-event-time">${t}</span>${b.seatName}: ${b.userName}
        </div>`;
      }).join('');

      return `<div class="sch-cal-cell${isToday?' today':''}${!isCur?' other-month':''}" onclick="Schedule.openDay('${ds}')">
        <div class="sch-cell-date${isToday?' today-badge':''}">${d.getDate()}</div>
        <div class="sch-cell-events">${evts}${extra > 0 ? `<div class="sch-more" onclick="event.stopPropagation();Schedule.openDay('${ds}')">+${extra} khác</div>` : ''}</div>
      </div>`;
    }).join('');

    const activeCount = this._data.filter(b => b.active).length;

    wrap.innerHTML = `
      <div class="sch-layout">
        <div class="sch-sidebar">
          <div class="sch-mini-cal">
            <div class="sch-mini-header">
              <button class="sch-mini-nav" onclick="Schedule.prevMonth()">‹</button>
              <span>${monthName}</span>
              <button class="sch-mini-nav" onclick="Schedule.nextMonth()">›</button>
            </div>
            <div class="sch-mini-grid">
              ${DOW_SHORT.map(d => `<div class="sch-mini-dow">${d}</div>`).join('')}
              ${miniCells}
            </div>
          </div>
          <div class="sch-legend">
            <div class="sch-legend-item"><span class="sch-legend-dot" style="background:rgba(192,57,43,.6)"></span><span>Đang thuê</span></div>
            <div class="sch-legend-item"><span class="sch-legend-dot" style="background:var(--green)"></span><span>Đã trả</span></div>
          </div>
        </div>
        <div class="sch-main">
          <div class="sch-topbar">
            <button class="sch-nav-btn" onclick="Schedule.goToday()">Hôm nay</button>
            <button class="sch-nav-btn sch-nav-icon" onclick="Schedule.prevMonth()">‹</button>
            <button class="sch-nav-btn sch-nav-icon" onclick="Schedule.nextMonth()">›</button>
            <h2 class="sch-month-title">${monthName}</h2>
            <div style="margin-left:auto;display:flex;gap:12px;align-items:center">
              <span style="font-size:var(--text-xs);color:var(--text-3)">${this._data.length} lượt đặt</span>
              <span style="font-size:var(--text-xs);color:#a93226;font-weight:500">${activeCount} đang thuê</span>
            </div>
          </div>
          <div class="sch-dow-header">${DOW_FULL.map(d => `<div>${d}</div>`).join('')}</div>
          <div class="sch-cal-grid">${mainCells}</div>
        </div>
        <div class="sch-detail-panel" id="sch-detail-panel">
          <div class="sch-detail-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.2"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>
            <p>Chọn một ngày để xem chi tiết</p>
          </div>
        </div>
      </div>`;
  },
};

// ─────────────────────────────────────────────
// BOOKS  (admin)
// ─────────────────────────────────────────────
const Books = {
  async loadList() {
    try {
      AppState.adminBooks = await Utils.fetchJSON('/get-booklist');
      this._render();
    } catch(e) { console.error('loadList:', e); }
  },

  _render() {
    const tbody = document.getElementById('books-table-body');
    if (!tbody) return;
    tbody.innerHTML = AppState.adminBooks.map(b => `
      <tr>
        <td>${b.id}</td>
        <td><strong>${b.title}</strong></td>
        <td>${b.author}</td>
        <td><span class="badge ${b.status ? 'success' : 'danger'}">${b.status ? 'Có thể mượn' : 'Đang được mượn'}</span></td>
        <td>${b.borrowedCount} lượt</td>
        <td>
          <button class="action-btn edit"   onclick="Books.edit(${b.id})">✏️ Sửa</button>
          <button class="action-btn delete" onclick="Books.delete(${b.id})">🗑️ Xóa</button>
        </td>
      </tr>`).join('');
  },

  // Unified open/edit modal
  _openModal(book = null) {
    AppState.editingBookId = book?.id ?? null;
    document.getElementById('book-modal-title').textContent = book ? 'Sửa Thông Tin Sách' : 'Thêm Sách Mới';
    document.getElementById('book-id').value     = book?.id     ?? '';
    document.getElementById('book-title').value  = book?.title  ?? '';
    document.getElementById('book-author').value = book?.author ?? '';
    document.getElementById('book-id').disabled  = !!book; // can't change ID on edit
    document.getElementById('book-modal').classList.add('active');
  },

  openModal() { this._openModal(); },
  edit(id)    { this._openModal(AppState.adminBooks.find(b => b.id === id)); },
  closeModal(){ document.getElementById('book-id').disabled = false; document.getElementById('book-modal').classList.remove('active'); },

  filter: Utils.debounce(function() {
    const q = document.getElementById('book-search').value.toLowerCase();
    document.querySelectorAll('#books-table-body tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }, 300),

  async delete(id) {
    if (!confirm('Bạn có chắc muốn xóa sách này?')) return;
    try {
      const res = await Utils.post('/delete-book', { id });
      if (res.success) { await this.loadList(); Utils.showToast('Đã xóa sách!', 'success'); }
      else Utils.showToast('Lỗi khi xóa', 'error');
    } catch(e) { console.error(e); }
  },

  async save() {
    const id     = document.getElementById('book-id').value.trim();
    const title  = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    if (!id || !title || !author) return Utils.showToast('Vui lòng điền đầy đủ', 'error');

    const isNew = AppState.editingBookId === null;
    const body  = isNew ? { id, title, author } : { id: AppState.editingBookId, title, author };
    try {
      const res = await Utils.post(isNew ? '/add-book' : '/edit-book', body);
      if (res.success) {
        await this.loadList();
        this.closeModal();
        Utils.showToast(isNew ? 'Đã thêm sách mới!' : 'Đã cập nhật sách!', 'success');
      } else Utils.showToast('Lỗi khi lưu sách', 'error');
    } catch(e) { console.error(e); }
  },
};

// ─────────────────────────────────────────────
// ACCOUNTS  (admin)
// ─────────────────────────────────────────────
const Accounts = {
  async loadList() {
    try {
      AppState.adminAccounts = await Utils.fetchJSON('/get-accountlist');
      this._render();
      Dashboard.refresh();
    } catch(e) { console.error('loadList:', e); }
  },

  _render() {
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) return;
    tbody.innerHTML = AppState.adminAccounts.map(a => `
      <tr>
        <td>#${a.id}</td>
        <td><strong>${a.name}</strong></td>
        <td>${a.email}</td>
        <td>${a.created}</td>
        <td><span class="badge ${a.bookings === 'Đã đặt' ? 'warning' : 'info'}">${a.bookings}</span></td>
        <td><span class="badge ${a.borrows  === 'Đã mượn' ? 'warning' : 'info'}">${a.borrows}</span></td>
        <td><button class="action-btn delete" onclick="Accounts.delete(${a.id})">🗑️ Xóa</button></td>
      </tr>`).join('');
  },

  filter: Utils.debounce(function() {
    const q = document.getElementById('account-search').value.toLowerCase();
    document.querySelectorAll('#accounts-table-body tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }, 300),

  async delete(id) {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
    try {
      const res = await Utils.post('/delete-account', { id });
      if (res.success) { await this.loadList(); Utils.showToast('Đã xóa tài khoản!', 'success'); }
      else Utils.showToast('Lỗi khi xóa', 'error');
    } catch(e) { console.error(e); }
  },
};

// ─────────────────────────────────────────────
// PRICING  (localStorage — not persisted to DB)
// ─────────────────────────────────────────────
const Pricing = {
  LABELS: { morning: 'sáng', afternoon: 'chiều', evening: 'tối' },
  update(period) {
    const val = parseInt(document.getElementById(`price-${period}`)?.value);
    if (isNaN(val) || val < 0) return Utils.showToast('Giá không hợp lệ', 'error');
    localStorage.setItem(`price-${period}`, val);
    Utils.showToast(`Đã cập nhật giá khung ${this.LABELS[period]}!`, 'success');
  },
};

// ─────────────────────────────────────────────
// GLOBAL BINDINGS  (HTML onclick)
// ─────────────────────────────────────────────
const showSection    = (s) => Navigation.showSection(s, event?.target);
const adminLogout    = ()  => Auth.logout();
const selectShape    = (s) => Canvas.setShape(s);
const selectType     = (t) => Canvas.setType(t);
const selectTool     = (t) => Canvas.setTool(t);
const updateSnapGrid = ()  => Canvas.updateSnap();
const saveLayout     = ()  => Canvas.save();
const filterBooksAdmin = () => Books.filter();
const openBookModal  = ()  => Books.openModal();
const closeBookModal = ()  => Books.closeModal();
const saveBook       = ()  => Books.save();
const filterAccounts = ()  => Accounts.filter();
const updatePrice    = (p) => Pricing.update(p);

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) Books.closeModal();
});

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.refresh();
  Books.loadList();
  Accounts.loadList();
});