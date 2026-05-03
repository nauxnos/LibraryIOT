// ===== STATE =====
const AppState = {
  adminBooks: [],
  adminAccounts: [],
  layoutObjects: [],
  canvas: null,
  ctx: null,

  // Editor
  currentShape: 'rect',
  currentType: 'table',
  currentTool: 'select',
  snapGrid: 10,

  // Drawing / dragging
  isDrawing: false,
  isDragging: false,
  selectedObject: null,
  startX: 0, startY: 0,
  dragOffsetX: 0, dragOffsetY: 0,

  editingBookId: null
};

// ===== UTILS =====
const Utils = {
  showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.className = 'toast', 300);
    }, 3000);
  },

  async fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }
};

// ===== AUTH =====
const Auth = {
  async logout() {
    await fetch('/logout');
    window.location.href = '/';
  }
};

// ===== NAVIGATION =====
const Navigation = {
  showSection(section, triggerEl) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    triggerEl?.closest('.nav-item')?.classList.add('active');

    const actions = {
      layout:    () => setTimeout(() => Canvas.init(), 100),
      books:     () => Books.loadList(),
      accounts:  () => Accounts.loadList(),
      dashboard: () => Dashboard.updateStats(),
      schedule:  () => Schedule.load()
    };
    actions[section]?.();
  }
};

// ===== DASHBOARD =====
const Dashboard = {
  async updateStats() {
    try {
      const accounts = await Utils.fetchJSON('/get-accountlist');
      document.getElementById('stat-users').textContent = accounts.length;
      document.getElementById('stat-bookings').textContent = accounts.filter(a => a.bookings === 'Đã đặt').length;
      document.getElementById('stat-books').textContent = accounts.filter(a => a.borrows === 'Đã mượn').length;
    } catch (e) {
      console.error('Stats error:', e);
    }
  }
};

// ===== CANVAS EDITOR =====
const Canvas = {
  async init() {
    AppState.canvas = document.getElementById('layout-canvas');
    if (!AppState.canvas) return;
    AppState.ctx = AppState.canvas.getContext('2d');
    await this.loadLayout();
    this.draw();
    this._attachEvents();
  },

  _attachEvents() {
    const c = AppState.canvas;
    // Remove old listeners by replacing element (simple approach)
    const clone = c.cloneNode(true);
    c.parentNode.replaceChild(clone, c);
    AppState.canvas = clone;
    AppState.ctx = clone.getContext('2d');

    clone.addEventListener('mousedown', e => this._onMouseDown(e));
    clone.addEventListener('mousemove', e => this._onMouseMove(e));
    clone.addEventListener('mouseup',   e => this._onMouseUp(e));
  },

  draw() {
    const { ctx, canvas } = AppState;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._drawGrid();
    this._drawObjects();
  },

  _drawGrid() {
    const { ctx, canvas, snapGrid } = AppState;

    ctx.strokeStyle = '#F0F0F0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    if (snapGrid > 1) {
      ctx.strokeStyle = '#E8E8E8';
      ctx.setLineDash([1, 3]);
      for (let x = 0; x <= canvas.width; x += snapGrid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      for (let y = 0; y <= canvas.height; y += snapGrid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
      ctx.setLineDash([]);
    }
  },

  _drawObjects() {
    AppState.layoutObjects.forEach(obj => {
      const sel = obj === AppState.selectedObject;
      AppState.ctx.fillStyle   = obj.type === 'table' ? '#D4C9A8' : '#FFFFFF';
      AppState.ctx.strokeStyle = sel ? '#2D5A3D' : (obj.type === 'table' ? '#A89E80' : '#6B9A7D');
      AppState.ctx.lineWidth   = sel ? 3 : 2;
      this._drawShape(obj);
      this._drawLabel(obj, sel);
      if (sel) this._drawHandles(obj);
    });
  },

  _drawShape(obj) {
    const { ctx } = AppState;
    if (obj.shape === 'rect') {
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    } else if (obj.shape === 'circle') {
      ctx.beginPath(); ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else if (obj.shape === 'roundrect') {
      this._roundRect(obj.x, obj.y, obj.width, obj.height, 12);
    }
  },

  _roundRect(x, y, w, h, r) {
    const ctx = AppState.ctx;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  },

  _drawLabel(obj, sel) {
    const { ctx } = AppState;
    ctx.fillStyle = obj.type === 'table' ? '#6B6860' : '#2D5A3D';
    ctx.font = sel ? 'bold 12px DM Sans' : '11px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lx = obj.shape === 'circle' ? obj.x : obj.x + obj.width/2;
    const ly = obj.shape === 'circle' ? obj.y : obj.y + obj.height/2;
    ctx.fillText(obj.name, lx, ly);
  },

  _drawHandles(obj) {
    const { ctx } = AppState;
    const s = 6;
    ctx.fillStyle = '#2D5A3D';
    const pts = obj.shape === 'circle'
      ? [[obj.x, obj.y - obj.radius],[obj.x + obj.radius, obj.y],[obj.x, obj.y + obj.radius],[obj.x - obj.radius, obj.y]]
      : [[obj.x, obj.y],[obj.x+obj.width, obj.y],[obj.x, obj.y+obj.height],[obj.x+obj.width, obj.y+obj.height]];
    pts.forEach(([hx,hy]) => ctx.fillRect(hx-s/2, hy-s/2, s, s));
  },

  _snap(v) { return Math.round(v / AppState.snapGrid) * AppState.snapGrid; },

  _getPos(e) {
    const r = AppState.canvas.getBoundingClientRect();
    return { x: this._snap(e.clientX - r.left), y: this._snap(e.clientY - r.top) };
  },

  _getObjAt(x, y) {
    const objs = AppState.layoutObjects;
    for (let i = objs.length-1; i >= 0; i--) {
      const o = objs[i];
      if (o.shape === 'circle') {
        if (Math.hypot(x-o.x, y-o.y) <= o.radius) return o;
      } else {
        if (x>=o.x && x<=o.x+o.width && y>=o.y && y<=o.y+o.height) return o;
      }
    }
    return null;
  },

  _onMouseDown(e) {
    const pos = this._getPos(e);
    AppState.startX = pos.x; AppState.startY = pos.y;

    if (AppState.currentTool === 'select') {
      const obj = this._getObjAt(pos.x, pos.y);
      if (obj) {
        AppState.selectedObject = obj;
        AppState.isDragging = true;
        AppState.dragOffsetX = pos.x - obj.x;
        AppState.dragOffsetY = pos.y - obj.y;
        this.draw();
      } else {
        AppState.isDrawing = true;
      }
    } else if (AppState.currentTool === 'delete') {
      this._deleteAt(pos.x, pos.y);
    }
  },

  _onMouseMove(e) {
    const pos = this._getPos(e);
    if (AppState.isDragging && AppState.selectedObject) {
      AppState.selectedObject.x = pos.x - AppState.dragOffsetX;
      AppState.selectedObject.y = pos.y - AppState.dragOffsetY;
      this.draw(); return;
    }
    if (!AppState.isDrawing || AppState.currentTool === 'delete') return;
    this.draw();
    this._drawPreview(pos);
  },

  _onMouseUp(e) {
    if (AppState.isDragging) {
      AppState.isDragging = false;
      this._updateList(); return;
    }
    if (!AppState.isDrawing || AppState.currentTool === 'delete') {
      AppState.isDrawing = false; this.draw(); return;
    }
    const pos = this._getPos(e);
    this._createObject(pos);
    AppState.isDrawing = false;
  },

  _drawPreview(pos) {
    const { ctx, startX, startY, currentShape } = AppState;
    const w = pos.x - startX, h = pos.y - startY;
    ctx.strokeStyle = '#2D5A3D';
    ctx.fillStyle = 'rgba(45,90,61,0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (currentShape === 'rect') {
      ctx.strokeRect(startX, startY, w, h); ctx.fillRect(startX, startY, w, h);
    } else if (currentShape === 'circle') {
      const r = Math.hypot(w, h)/2;
      ctx.beginPath(); ctx.arc(startX+w/2, startY+h/2, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    } else {
      this._roundRect(startX, startY, w, h, 12);
    }

    ctx.setLineDash([]);
    ctx.fillStyle = '#2D5A3D';
    ctx.font = 'bold 11px DM Sans';
    ctx.fillText(`${Math.abs(w)}×${Math.abs(h)}px`, pos.x+8, pos.y-8);
  },

  _createObject(endPos) {
    const { startX, startY, currentShape, currentType, layoutObjects, snapGrid } = AppState;
    const w = endPos.x - startX, h = endPos.y - startY;
    if (Math.abs(w) < snapGrid*2 || Math.abs(h) < snapGrid*2) { this.draw(); return; }

    const typeLabel = currentType === 'table' ? 'Bàn' : 'Ghế';
    const count = layoutObjects.filter(o => o.type === currentType).length + 1;

    const obj = {
      id: Date.now(), shape: currentShape, type: currentType,
      x: Math.min(startX, endPos.x), y: Math.min(startY, endPos.y),
      width: Math.abs(w), height: Math.abs(h),
      name: `${typeLabel}-${count}`
    };

    if (currentShape === 'circle') {
      obj.radius = Math.hypot(w, h)/2;
      obj.x = startX + w/2; obj.y = startY + h/2;
    }

    AppState.layoutObjects.push(obj);
    this.draw();
    this._updateList();
    Utils.showToast(`Đã thêm ${obj.name}`);
  },

  _deleteAt(x, y) {
    const obj = this._getObjAt(x, y);
    if (!obj) return;
    AppState.layoutObjects = AppState.layoutObjects.filter(o => o !== obj);
    AppState.selectedObject = null;
    this.draw(); this._updateList();
    Utils.showToast(`Đã xóa ${obj.name}`);
  },

  _updateList() {
    const list = document.getElementById('objects-list');
    if (!list) return;

    // Cập nhật counter
    const counter = document.getElementById('objects-count');
    if (counter) counter.textContent = `${AppState.layoutObjects.length} đối tượng`;

    if (!AppState.layoutObjects.length) {
      list.innerHTML = '<p style="color:#999;font-size:13px;padding:1rem 0;text-align:center">Chưa có đối tượng nào<br><small>Chọn hình dạng và loại, sau đó vẽ trên canvas</small></p>';
      return;
    }

    list.innerHTML = AppState.layoutObjects.map(obj => {
      const sel = obj === AppState.selectedObject;
      const shapeLabel = { rect: 'Vuông', circle: 'Tròn', roundrect: 'Bo góc' }[obj.shape] || obj.shape;
      const sizeInfo = obj.shape === 'circle'
        ? `⭕ r=${Math.round(obj.radius)}`
        : `📏 ${obj.width}×${obj.height}`;
      return `
        <div style="padding:10px;background:${sel?'#E8F2EB':'#f5f5f5'};border:2px solid ${sel?'#2D5A3D':'transparent'};border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="Canvas.selectById(${obj.id})">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-weight:500;font-size:13px">${obj.type==='table'?'📊':'💺'} ${obj.name}</span>
            <button onclick="event.stopPropagation();Canvas.deleteById(${obj.id})" style="background:#FCEBEB;color:#A32D2D;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:500">Xóa</button>
          </div>
          <div style="font-size:11px;color:#6B6860;display:flex;gap:12px;flex-wrap:wrap">
            <span>📐 ${shapeLabel}</span><span>📍 (${obj.x}, ${obj.y})</span><span>${sizeInfo}</span>
          </div>
          <input type="text" value="${obj.name}" onchange="Canvas.rename(${obj.id},this.value)" onclick="event.stopPropagation()"
            style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" placeholder="Tên..."/>
          <input type="text" onclick="event.stopPropagation()" style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" placeholder="Trigger Pin"/>
          <input type="text" onclick="event.stopPropagation()" style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" placeholder="Echo Pin"/>
        </div>`;
    }).join('');
  },

  selectById(id) {
    AppState.selectedObject = AppState.layoutObjects.find(o => o.id === id) || null;
    this.draw(); this._updateList();
  },

  deleteById(id) {
    const obj = AppState.layoutObjects.find(o => o.id === id);
    AppState.layoutObjects = AppState.layoutObjects.filter(o => o.id !== id);
    AppState.selectedObject = null;
    this.draw(); this._updateList();
    if (obj) Utils.showToast(`Đã xóa ${obj.name}`);
  },

  rename(id, name) {
    const obj = AppState.layoutObjects.find(o => o.id === id);
    if (obj) { obj.name = name.trim() || obj.name; this.draw(); }
  },

  selectShape(shape) {
    AppState.currentShape = shape;
    document.querySelectorAll('[data-shape]').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-shape="${shape}"]`)?.classList.add('active');
  },

  selectType(type) {
    AppState.currentType = type;
    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-type="${type}"]`)?.classList.add('active');
  },

  selectTool(tool) {
    AppState.currentTool = tool;
    AppState.selectedObject = null;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
    if (AppState.canvas) {
      AppState.canvas.style.cursor = { delete: 'not-allowed', select: 'default' }[tool] || 'crosshair';
    }
    this.draw();
  },

  updateSnap() {
    AppState.snapGrid = parseInt(document.getElementById('snap-grid').value);
    this.draw();
    Utils.showToast(`Snap: ${AppState.snapGrid}px`);
  },

  async save() {
    const data = {
      objects: AppState.layoutObjects,
      snapGrid: AppState.snapGrid,
      canvasSize: { width: AppState.canvas.width, height: AppState.canvas.height }
    };
    localStorage.setItem('libraryLayout', JSON.stringify(data));
    try {
      await Utils.fetchJSON('/save-layout', { method: 'POST', body: JSON.stringify(data) });
      Utils.showToast('Đã lưu layout!', 'success');
    } catch (e) {
      Utils.showToast('Lỗi khi lưu', 'error');
    }
  },

  async loadLayout() {
    // Ưu tiên load từ server (layout.json), fallback về localStorage
    try {
      const data = await Utils.fetchJSON('/get-layout');
      AppState.layoutObjects = data.objects || [];
      AppState.snapGrid = data.snapGrid || 10;
      // Đồng bộ localStorage với dữ liệu server
      localStorage.setItem('libraryLayout', JSON.stringify(data));
      this._updateList();
      Utils.showToast('Đã tải layout từ server', 'success');
    } catch (e) {
      console.warn('Không thể tải layout từ server, dùng bản cục bộ:', e);
      try {
        const saved = localStorage.getItem('libraryLayout');
        if (!saved) return;
        const data = JSON.parse(saved);
        AppState.layoutObjects = data.objects || [];
        AppState.snapGrid = data.snapGrid || 10;
        this._updateList();
        Utils.showToast('Đã tải layout từ bộ nhớ cục bộ', 'info');
      } catch (e2) {
        console.error('Load layout error:', e2);
      }
    }
  }
};


// ===== SCHEDULE =====
// ===== SCHEDULE (Outlook-style monthly calendar) =====
const Schedule = {
  _data:        [],
  _viewDate:    new Date(),   // first day of displayed month
  _selectedDay: null,         // Date | null — clicked day detail
  _detailBookings: [],        // bookings for selected day

  /* ── public API ── */
  async load() {
    try {
      this._data = await Utils.fetchJSON('/get-schedule');
    } catch (e) {
      console.error('Schedule load error:', e);
      Utils.showToast('Lỗi tải lịch đặt', 'error');
    }
    this._viewDate = new Date();
    this._viewDate.setDate(1);
    this._render();
  },

  prevMonth() { this._viewDate.setMonth(this._viewDate.getMonth() - 1); this._render(); },
  nextMonth() { this._viewDate.setMonth(this._viewDate.getMonth() + 1); this._render(); },
  goToday()   { this._viewDate = new Date(); this._viewDate.setDate(1); this._render(); },

  openDay(dateStr) {
    this._selectedDay = new Date(dateStr);
    const dayStart = new Date(dateStr);
    const dayEnd   = new Date(dateStr); dayEnd.setHours(23,59,59,999);
    this._detailBookings = this._data.filter(b => {
      const s = b.start ? new Date(b.start) : null;
      const e = b.end && b.end !== '—' ? new Date(b.end) : new Date(8640000000000000);
      return s && s <= dayEnd && e >= dayStart;
    });
    this._renderDetail();
  },

  async cancelBooking(id, seatName, userName) {
    if (!confirm(`Hủy đặt chỗ "${seatName}" của "${userName}"?`)) return;
    try {
      const res = await Utils.fetchJSON('/cancel-booking', { method: 'POST', body: JSON.stringify({ id }) });
      if (res.success) {
        await this.load();
        Utils.showToast('Đã hủy đặt chỗ!', 'success');
      } else {
        Utils.showToast('Lỗi khi hủy', 'error');
      }
    } catch (e) { console.error(e); }
  },

  /* ── helpers ── */
  _isoDay(d) {
    // returns "YYYY-MM-DD" in local time
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _fmtTime(iso) {
    if (!iso || iso === '—') return '—';
    try { return new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
    catch { return iso; }
  },

  _bookingsForDay(dateStr) {
    const dayStart = new Date(dateStr);
    const dayEnd   = new Date(dateStr); dayEnd.setHours(23,59,59,999);
    return this._data.filter(b => {
      const s = b.start ? new Date(b.start) : null;
      const e = b.end && b.end !== '—' ? new Date(b.end) : new Date(8640000000000000);
      return s && s <= dayEnd && e >= dayStart;
    });
  },

  _eventColor(b) {
    const active = !b.end || b.end === '—';
    return active
      ? { bg: 'rgba(192,57,43,.12)', border: 'rgba(192,57,43,.35)', text: '#a93226' }
      : { bg: 'var(--green-dim)',    border: 'var(--green-border)',  text: 'var(--green)' };
  },

  /* ── RENDER MAIN ── */
  _render() {
    const wrap = document.getElementById('schedule-wrap');
    if (!wrap) return;

    const today     = new Date();
    const todayStr  = this._isoDay(today);
    const yr        = this._viewDate.getFullYear();
    const mo        = this._viewDate.getMonth();
    const monthName = this._viewDate.toLocaleDateString('vi-VN',{month:'long',year:'numeric'});

    // Build 6-week grid (Mon–Sun)
    const firstDay = new Date(yr, mo, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
    const gridStart = new Date(firstDay); gridStart.setDate(1 - startDow);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      cells.push(d);
    }

    // Mini-calendar for sidebar
    const miniCells = [];
    const miniStart = new Date(firstDay); miniStart.setDate(1 - startDow);
    for (let i = 0; i < 42; i++) {
      const d = new Date(miniStart); d.setDate(miniStart.getDate() + i);
      miniCells.push(d);
    }

    const weekDays = ['T2','T3','T4','T5','T6','T7','CN'];
    const weekDaysFull = ['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'];

    // Build mini calendar HTML
    const miniHTML = `
      <div class="sch-mini-cal">
        <div class="sch-mini-header">
          <button class="sch-mini-nav" onclick="Schedule.prevMonth()">‹</button>
          <span>${monthName}</span>
          <button class="sch-mini-nav" onclick="Schedule.nextMonth()">›</button>
        </div>
        <div class="sch-mini-grid">
          ${weekDays.map(d=>`<div class="sch-mini-dow">${d}</div>`).join('')}
          ${miniCells.map(d => {
            const ds = this._isoDay(d);
            const isToday = ds === todayStr;
            const isCurMonth = d.getMonth() === mo;
            const hasBooking = this._bookingsForDay(ds).length > 0;
            return `<div class="sch-mini-day ${isToday?'today':''} ${!isCurMonth?'other-month':''} ${hasBooking?'has-event':''}"
              onclick="Schedule.openDay('${ds}')">${d.getDate()}</div>`;
          }).join('')}
        </div>
      </div>`;

    // Build main calendar cells
    const cellsHTML = cells.map(d => {
      const ds = this._isoDay(d);
      const isToday     = ds === todayStr;
      const isCurMonth  = d.getMonth() === mo;
      const bookings    = this._bookingsForDay(ds);
      const MAX_SHOW    = 3;
      const shown       = bookings.slice(0, MAX_SHOW);
      const extra       = bookings.length - MAX_SHOW;

      const eventsHTML = shown.map(b => {
        const c = this._eventColor(b);
        return `<div class="sch-event" style="background:${c.bg};border-left:3px solid ${c.border};color:${c.text}"
          onclick="event.stopPropagation();Schedule.openDay('${ds}')"
          title="${b.seatName} — ${b.userName}">
          <span class="sch-event-time">${b.start ? new Date(b.start).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : ''}</span>
          ${b.seatName}: ${b.userName}
        </div>`;
      }).join('');

      const moreHTML = extra > 0
        ? `<div class="sch-more" onclick="event.stopPropagation();Schedule.openDay('${ds}')">+${extra} khác</div>`
        : '';

      return `<div class="sch-cal-cell ${isToday?'today':''} ${!isCurMonth?'other-month':''}"
        onclick="Schedule.openDay('${ds}')">
        <div class="sch-cell-date ${isToday?'today-badge':''}">${d.getDate()}</div>
        <div class="sch-cell-events">${eventsHTML}${moreHTML}</div>
      </div>`;
    }).join('');

    wrap.innerHTML = `
      <div class="sch-layout">

        <!-- Sidebar -->
        <div class="sch-sidebar">
          ${miniHTML}
          <!-- Legend -->
          <div class="sch-legend">
            <div class="sch-legend-item">
              <span class="sch-legend-dot" style="background:rgba(192,57,43,.6)"></span>
              <span>Đang thuê</span>
            </div>
            <div class="sch-legend-item">
              <span class="sch-legend-dot" style="background:var(--green)"></span>
              <span>Đã trả</span>
            </div>
          </div>
        </div>

        <!-- Main calendar -->
        <div class="sch-main">
          <!-- Topbar -->
          <div class="sch-topbar">
            <button class="sch-nav-btn" onclick="Schedule.goToday()">Hôm nay</button>
            <button class="sch-nav-btn sch-nav-icon" onclick="Schedule.prevMonth()">‹</button>
            <button class="sch-nav-btn sch-nav-icon" onclick="Schedule.nextMonth()">›</button>
            <h2 class="sch-month-title">${monthName}</h2>
            <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
              <span style="font-size:var(--text-xs);color:var(--text-3)">${this._data.length} lượt đặt</span>
            </div>
          </div>

          <!-- Day-of-week header -->
          <div class="sch-dow-header">
            ${weekDaysFull.map(d=>`<div>${d}</div>`).join('')}
          </div>

          <!-- 6-week grid -->
          <div class="sch-cal-grid">${cellsHTML}</div>
        </div>

        <!-- Day detail panel -->
        <div class="sch-detail-panel" id="sch-detail-panel">
          <div class="sch-detail-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.2">
              <rect x="3" y="4" width="18" height="17" rx="2"/>
              <path d="M8 2v4M16 2v4M3 10h18"/>
            </svg>
            <p>Chọn một ngày để xem chi tiết</p>
          </div>
        </div>

      </div>`;
  },

  /* ── RENDER DAY DETAIL PANEL ── */
  _renderDetail() {
    const panel = document.getElementById('sch-detail-panel');
    if (!panel) return;

    const d = this._selectedDay;
    const label = d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const bs = this._detailBookings;

    const listHTML = bs.length ? bs.map(b => {
      const c      = this._eventColor(b);
      const active = !b.end || b.end === '—';
      return `<div class="sch-detail-item" style="border-left:3px solid ${c.border}">
        <div class="sch-detail-seat">${b.seatName}</div>
        <div class="sch-detail-user">
          <strong>${b.userName}</strong>
          <span>${b.email}</span>
        </div>
        <div class="sch-detail-times">
          <span>▶ ${this._fmtTime(b.start)}</span>
          <span>■ ${active ? '<em style="color:var(--danger)">Đang thuê</em>' : this._fmtTime(b.end)}</span>
        </div>
        ${active ? `<button class="sch-cancel-btn" onclick="Schedule.cancelBooking(${b.bookingId},'${b.seatName}','${b.userName}')">Hủy đặt</button>` : ''}
      </div>`;
    }).join('') : `<p style="padding:1.5rem 0;text-align:center;color:var(--text-3);font-size:var(--text-sm)">Không có đặt chỗ ngày này</p>`;

    panel.innerHTML = `
      <div class="sch-detail-header">
        <div>
          <div class="sch-detail-title">${label}</div>
          <div class="sch-detail-count">${bs.length} đặt chỗ</div>
        </div>
        <button class="sch-detail-close" onclick="document.getElementById('sch-detail-panel').innerHTML='<div class=sch-detail-placeholder><p>Chọn một ngày để xem chi tiết</p></div>'">✕</button>
      </div>
      <div class="sch-detail-list">${listHTML}</div>`;
  }
};


// ===== BOOKS =====
const Books = {
  async loadList() {
    try {
      AppState.adminBooks = await Utils.fetchJSON('/get-booklist');
      this._render();
    } catch (e) {
      console.error('Load books error:', e);
    }
  },

  _render() {
    const tbody = document.getElementById('books-table-body');
    if (!tbody) return;
    tbody.innerHTML = AppState.adminBooks.map(b => `
      <tr>
        <td>${b.id}</td>
        <td><strong>${b.title}</strong></td>
        <td>${b.author}</td>
        <td><span class="badge ${b.status ? 'success' : 'danger'}">${b.status ? 'Có thể mượn' : 'Không thể mượn'}</span></td>
        <td>${b.borrowedCount} lượt</td>
        <td>
          <button class="action-btn edit" onclick="Books.edit(${b.id})">✏️ Sửa</button>
          <button class="action-btn delete" onclick="Books.delete(${b.id})">🗑️ Xóa</button>
        </td>
      </tr>`).join('');
  },

  filter: Utils.debounce(function() {
    const q = document.getElementById('book-search').value.toLowerCase();
    document.querySelectorAll('#books-table-body tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }, 300),

  openModal() {
    AppState.editingBookId = null;
    document.getElementById('book-modal-title').textContent = 'Thêm Sách Mới';
    document.getElementById('book-id').value = '';
    document.getElementById('book-title').value = '';
    document.getElementById('book-author').value = '';
    document.getElementById('book-modal').classList.add('active');
  },

  closeModal() {
    document.getElementById('book-modal').classList.remove('active');
  },

  edit(id) {
    const book = AppState.adminBooks.find(b => b.id === id);
    if (!book) return;
    AppState.editingBookId = id;
    document.getElementById('book-modal-title').textContent = 'Sửa Thông Tin Sách';
    document.getElementById('book-id').value = id;
    document.getElementById('book-title').value = book.title;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-modal').classList.add('active');
  },

  async delete(id) {
    if (!confirm('Bạn có chắc muốn xóa sách này?')) return;
    try {
      const res = await Utils.fetchJSON('/delete-book', { method: 'POST', body: JSON.stringify({ id }) });
      if (res.success) { await this.loadList(); Utils.showToast('Đã xóa sách!', 'success'); }
      else Utils.showToast('Lỗi khi xóa', 'error');
    } catch (e) { console.error(e); }
  },

  async save() {
    const id    = document.getElementById('book-id').value.trim();
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();

    if (!id || !title || !author) return Utils.showToast('Vui lòng điền đầy đủ', 'error');

    const isNew = AppState.editingBookId === null;
    const url   = isNew ? '/add-book' : '/edit-book';
    const data  = isNew ? { id, title, author } : { id: AppState.editingBookId, title, author };

    try {
      const res = await Utils.fetchJSON(url, { method: 'POST', body: JSON.stringify(data) });
      if (res.success) {
        await this.loadList();
        this.closeModal();
        Utils.showToast(isNew ? 'Đã thêm sách mới!' : 'Đã cập nhật sách!', 'success');
      } else {
        Utils.showToast('Lỗi khi lưu sách', 'error');
      }
    } catch (e) { console.error(e); }
  }
};

// ===== ACCOUNTS =====
const Accounts = {
  async loadList() {
    try {
      AppState.adminAccounts = await Utils.fetchJSON('/get-accountlist');
      this._render();
      Dashboard.updateStats();
    } catch (e) {
      console.error('Load accounts error:', e);
    }
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
        <td>${a.bookings}</td>
        <td>${a.borrows}</td>
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
      const res = await Utils.fetchJSON('/delete-account', { method: 'POST', body: JSON.stringify({ id }) });
      if (res.success) { await this.loadList(); Utils.showToast('Đã xóa tài khoản!', 'success'); }
      else Utils.showToast('Lỗi khi xóa', 'error');
    } catch (e) { console.error(e); }
  }
};

// ===== PRICING =====
const Pricing = {
  update(period) {
    const val = parseInt(document.getElementById(`price-${period}`).value);
    if (isNaN(val) || val < 0) return Utils.showToast('Giá không hợp lệ', 'error');
    localStorage.setItem(`price-${period}`, val);
    const labels = { morning: 'sáng', afternoon: 'chiều', evening: 'tối' };
    Utils.showToast(`Đã cập nhật giá khung ${labels[period]}!`, 'success');
  }
};

// ===== GLOBAL BINDINGS (for HTML onclick) =====
function showSection(section) { Navigation.showSection(section, event?.target); }
function adminLogout()        { Auth.logout(); }
function selectShape(s)       { Canvas.selectShape(s); }
function selectType(t)        { Canvas.selectType(t); }
function selectTool(t)        { Canvas.selectTool(t); }
function updateSnapGrid()     { Canvas.updateSnap(); }
function saveLayout()         { Canvas.save(); }
function filterBooksAdmin()   { Books.filter(); }
function openBookModal()      { Books.openModal(); }
function closeBookModal()     { Books.closeModal(); }
function saveBook()           { Books.save(); }
function filterAccounts()     { Accounts.filter(); }
function scheduleFilter()      { Schedule._onFilter(); }
function scheduleClear()       { Schedule.clearFilter(); }
function updatePrice(p)       { Pricing.update(p); }

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) Books.closeModal();
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.updateStats();
  Books.loadList();
  Accounts.loadList();
});