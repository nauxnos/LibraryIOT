// ===== STATE =====
const AppState = {
  selectedSeat: null,
  myBookings: [],
  myBorrows: [],
  books: [],
  layoutData: null,
  bookedSeatIds: new Set() // Track booked seats from server
};

// ===== UTILS =====
const Utils = {
  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  },

  async fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};

// ===== LAYOUT RENDERER (DIV-BASED) =====
const LayoutRenderer = {
  container: null,

  init() {
    this.container = document.getElementById('layout-container');
    if (!this.container) return console.error('layout-container not found');
    this.loadAndRender();
  },

  async loadAndRender() {
    try {
      AppState.layoutData = await Utils.fetchJSON('/get-layout');
      this.render();
    } catch (e) {
      console.error('Failed to load layout:', e);
      this.container.innerHTML = '<p style="color:#999;text-align:center;padding:2rem">Layout không khả dụng</p>';
    }
  },

  render() {
    const data = AppState.layoutData;
    if (!data?.objects) return;

    const { width = 800, height = 500 } = data.canvasSize || {};
    this.container.style.cssText = `position:relative;width:${width}px;height:${height}px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden`;
    this.container.innerHTML = '';

    // Draw grid background via CSS
    this.container.style.backgroundImage =
      'linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)';
    this.container.style.backgroundSize = '40px 40px';

    data.objects.forEach(obj => this._createEl(obj));
  },

  _createEl(obj) {
    const el = document.createElement('div');
    el.dataset.id = obj.id;
    el.dataset.type = obj.type;
    el.dataset.name = obj.name;

    // Base styles
    const isTable = obj.type === 'table';
    const isCircle = obj.shape === 'circle';

    const left = isCircle ? obj.x - obj.radius : obj.x;
    const top  = isCircle ? obj.y - obj.radius : obj.y;
    const w    = isCircle ? obj.radius * 2 : obj.width;
    const h    = isCircle ? obj.radius * 2 : obj.height;

    Object.assign(el.style, {
      position: 'absolute',
      left: left + 'px',
      top: top + 'px',
      width: w + 'px',
      height: h + 'px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontFamily: '"DM Sans", sans-serif',
      fontWeight: '500',
      userSelect: 'none',
      boxSizing: 'border-box',
      transition: 'all 0.15s ease',
      borderRadius: obj.shape === 'circle' ? '50%'
                  : obj.shape === 'roundrect' ? '12px' : '4px',
      background: isTable ? '#D4C9A8' : '#fff',
      border: isTable ? '2px solid #A89E80' : '2px solid #6B9A7D',
      color: isTable ? '#6B6860' : '#2D5A3D',
      cursor: isTable ? 'default' : 'pointer',
      zIndex: isTable ? 1 : 2,
      textAlign: 'center',
      lineHeight: '1.2',
      padding: '2px'
    });

    el.textContent = obj.name;

    if (obj.type === 'seat') {
      this._makeSeatInteractive(el, obj);
    }

    this.container.appendChild(el);
  },

  _makeSeatInteractive(el, obj) {
    el.addEventListener('mouseenter', () => {
      if (el.dataset.state === 'taken') return;
      if (el.dataset.state !== 'selected') {
        el.style.background = 'rgba(45,90,61,0.12)';
        el.style.borderColor = '#2D5A3D';
        el.style.transform = 'scale(1.06)';
      }
    });

    el.addEventListener('mouseleave', () => {
      if (el.dataset.state === 'taken' || el.dataset.state === 'selected') return;
      el.style.background = '#fff';
      el.style.borderColor = '#6B9A7D';
      el.style.transform = '';
    });

    el.addEventListener('click', () => {
      // Always show schedule popup on click
      SeatPopup.show(obj, el);
    });
  },

  _selectSeat(el, obj) {
    // Deselect previous
    if (AppState.selectedSeat) {
      const prev = this.container.querySelector(`[data-id="${AppState.selectedSeat.id}"]`);
      if (prev) {
        prev.dataset.state = '';
        Object.assign(prev.style, {
          background: '#fff',
          borderColor: '#6B9A7D',
          color: '#2D5A3D',
          transform: ''
        });
      }
    }

    // Select new
    AppState.selectedSeat = obj;
    el.dataset.state = 'selected';
    Object.assign(el.style, {
      background: '#2D5A3D',
      borderColor: '#2D5A3D',
      color: '#fff',
      transform: 'scale(1.08)',
      boxShadow: '0 4px 12px rgba(45,90,61,0.3)'
    });

    document.getElementById('selected-info').textContent =
      `Đã chọn: ${obj.name} — Khu đọc sách yên tĩnh`;
    Utils.showToast(`Đã chọn ${obj.name}`);
  },

  markSeatTaken(seatId) {
    const el = this.container?.querySelector(`[data-id="${seatId}"]`);
    if (!el || el.dataset.type !== 'seat') return;
    el.dataset.state = 'taken';
    Object.assign(el.style, {
      background: '#F1EDE3',
      borderColor: 'transparent',
      color: '#BDB8AE',
      cursor: 'not-allowed'
    });
  }
};


// ===== SEAT SCHEDULE POPUP (Timeline modal) =====
const SeatPopup = {
  _state: null,   // { modal, overlay, obj, el, selectedDate, selectedSlots, allSlots }

  // Hours shown on timeline: 7:00 → 22:00
  HOUR_START: 7,
  HOUR_END: 22,

  async show(seatObj, seatEl) {
    this._close();

    // Default date = today
    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch existing bookings for this seat
    let allSlots = [];
    try {
      allSlots = await Utils.fetchJSON(`/get-seat-schedule?seat_id=${seatObj.id}`);
    } catch (e) { console.error(e); }

    // Create overlay + modal
    const overlay = document.createElement('div');
    overlay.className = 'stm-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) this._close(); });

    const modal = document.createElement('div');
    modal.className = 'stm-modal';

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    this._state = { modal, overlay, obj: seatObj, el: seatEl, selectedDate: todayStr, selectedSlots: new Set(), allSlots };

    this._renderModal();

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      modal.classList.add('open');
    });
  },

  _renderModal() {
    const { modal, obj, selectedDate, selectedSlots, allSlots } = this._state;

    const bookedHours = this._getBookedHours(allSlots, selectedDate);
    const totalHours = this.HOUR_END - this.HOUR_START;

    // Build timeline rows — one row = one seat (here just this seat)
    const seatRow = this._buildTimelineRow(obj.name, bookedHours, selectedSlots);

    // Selected range display
    const sortedSlots = [...selectedSlots].sort((a,b) => a-b);
    const selText = sortedSlots.length
      ? `${String(sortedSlots[0]).padStart(2,'0')}:00 – ${String(sortedSlots[sortedSlots.length-1]+1).padStart(2,'0')}:00`
      : 'Chưa chọn giờ';

    modal.innerHTML = `
      <div class="stm-handle"></div>

      <!-- Header -->
      <div class="stm-header">
        <button class="stm-back" onclick="SeatPopup._close()">‹</button>
        <h3 class="stm-title">Đặt lịch — ${obj.name}</h3>
      </div>

      <!-- Date picker -->
      <div class="stm-date-row">
        <input type="date" class="stm-date-input" id="stm-date"
          value="${selectedDate}"
          min="${new Date().toISOString().split('T')[0]}"
          onchange="SeatPopup._onDateChange(this.value)" />
      </div>

      <!-- Legend -->
      <div class="stm-legend">
        <div class="stm-legend-item"><span class="stm-dot free"></span>Trống</div>
        <div class="stm-legend-item"><span class="stm-dot booked"></span>Đã đặt</div>
        <div class="stm-legend-item"><span class="stm-dot selected"></span>Đang chọn</div>
      </div>

      <!-- Timeline -->
      <div class="stm-timeline-wrap">
        <!-- Hour ruler -->
        <div class="stm-ruler">
          <div class="stm-row-label"></div>
          <div class="stm-ruler-hours">
            ${Array.from({length: totalHours + 1}, (_,i) => {
              const h = this.HOUR_START + i;
              return `<div class="stm-ruler-tick">${String(h).padStart(2,'0')}:00</div>`;
            }).join('')}
          </div>
        </div>
        <!-- Seat row -->
        ${seatRow}
      </div>

      <!-- Selected summary -->
      <div class="stm-summary">
        <div class="stm-summary-info">
          <span class="stm-summary-label">Thời gian chọn</span>
          <span class="stm-summary-val" id="stm-sel-text">${selText}</span>
        </div>
        <div class="stm-summary-dur">
          <span>${sortedSlots.length} giờ</span>
        </div>
      </div>

      <!-- CTA -->
      <div class="stm-footer">
        <button class="stm-btn-confirm" onclick="SeatPopup._confirm()" ${selectedSlots.size === 0 ? 'disabled' : ''}>
          TIẾP THEO
        </button>
      </div>
    `;

    // Attach drag-select on timeline cells
    this._attachDragSelect();
  },

  _buildTimelineRow(seatName, bookedHours, selectedSlots) {
    const totalHours = this.HOUR_END - this.HOUR_START;
    const cells = Array.from({length: totalHours}, (_, i) => {
      const h = this.HOUR_START + i;
      const isBooked   = bookedHours.has(h);
      const isSelected = selectedSlots.has(h);
      let cls = 'stm-cell free';
      if (isBooked)   cls = 'stm-cell booked';
      if (isSelected) cls = 'stm-cell selected';
      return `<div class="${cls}" data-hour="${h}" ${isBooked ? '' : `onclick="SeatPopup._toggleHour(${h})"`}></div>`;
    }).join('');

    return `
      <div class="stm-row">
        <div class="stm-row-label">${seatName}</div>
        <div class="stm-row-cells" id="stm-cells">${cells}</div>
      </div>`;
  },

  _getBookedHours(allSlots, dateStr) {
    const booked = new Set();
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd   = new Date(dateStr + 'T23:59:59');

    allSlots.forEach(s => {
      const start = s.start ? new Date(s.start) : null;
      const end   = s.end   ? new Date(s.end)   : null;
      if (!start) return;
      const bEnd = end || new Date(8640000000000000);
      if (start > dayEnd || bEnd < dayStart) return;

      // Mark each overlapping hour
      for (let h = this.HOUR_START; h < this.HOUR_END; h++) {
        const slotStart = new Date(dateStr + `T${String(h).padStart(2,'0')}:00:00`);
        const slotEnd   = new Date(dateStr + `T${String(h+1).padStart(2,'0')}:00:00`);
        if (start < slotEnd && bEnd > slotStart) booked.add(h);
      }
    });
    return booked;
  },

  _toggleHour(h) {
    const { selectedSlots, allSlots, selectedDate } = this._state;
    const bookedHours = this._getBookedHours(allSlots, selectedDate);
    if (bookedHours.has(h)) return;

    if (selectedSlots.has(h)) selectedSlots.delete(h);
    else selectedSlots.add(h);

    // Re-render only the cells + summary (fast update)
    this._updateCells();
    this._updateSummary();
  },

  _updateCells() {
    const { selectedSlots, allSlots, selectedDate } = this._state;
    const bookedHours = this._getBookedHours(allSlots, selectedDate);
    const container = document.getElementById('stm-cells');
    if (!container) return;
    container.querySelectorAll('.stm-cell').forEach(cell => {
      const h = parseInt(cell.dataset.hour);
      cell.className = 'stm-cell ' + (bookedHours.has(h) ? 'booked' : selectedSlots.has(h) ? 'selected' : 'free');
    });
  },

  _updateSummary() {
    const { selectedSlots } = this._state;
    const sorted = [...selectedSlots].sort((a,b) => a-b);
    const selText = sorted.length
      ? `${String(sorted[0]).padStart(2,'0')}:00 – ${String(sorted[sorted.length-1]+1).padStart(2,'0')}:00`
      : 'Chưa chọn giờ';
    const el = document.getElementById('stm-sel-text');
    if (el) el.textContent = selText;

    // Update duration display
    const durEl = document.querySelector('.stm-summary-dur span');
    if (durEl) durEl.textContent = `${sorted.length} giờ`;

    // Enable/disable confirm btn
    const btn = document.querySelector('.stm-btn-confirm');
    if (btn) btn.disabled = sorted.length === 0;
  },

  _onDateChange(newDate) {
    this._state.selectedDate = newDate;
    this._state.selectedSlots = new Set();
    this._renderModal();
  },

  _attachDragSelect() {
    const container = document.getElementById('stm-cells');
    if (!container) return;
    let dragging = false;
    let dragMode = null; // 'add' | 'remove'

    const getHour = el => parseInt(el.dataset.hour);

    container.addEventListener('mousedown', e => {
      const cell = e.target.closest('.stm-cell');
      if (!cell || cell.classList.contains('booked')) return;
      dragging = true;
      const h = getHour(cell);
      dragMode = this._state.selectedSlots.has(h) ? 'remove' : 'add';
      this._applyDrag(h, dragMode);
      e.preventDefault();
    });

    container.addEventListener('mouseover', e => {
      if (!dragging) return;
      const cell = e.target.closest('.stm-cell');
      if (!cell || cell.classList.contains('booked')) return;
      this._applyDrag(getHour(cell), dragMode);
    });

    document.addEventListener('mouseup', () => { dragging = false; }, { once: false });

    // Touch support
    container.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.stm-cell');
      if (!cell || cell.classList.contains('booked')) return;
      dragging = true;
      const h = getHour(cell);
      dragMode = this._state.selectedSlots.has(h) ? 'remove' : 'add';
      this._applyDrag(h, dragMode);
    }, { passive: true });

    container.addEventListener('touchmove', e => {
      if (!dragging) return;
      const touch = e.touches[0];
      const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.stm-cell');
      if (!cell || cell.classList.contains('booked')) return;
      this._applyDrag(getHour(cell), dragMode);
    }, { passive: true });

    container.addEventListener('touchend', () => { dragging = false; });
  },

  _applyDrag(h, mode) {
    if (mode === 'add') this._state.selectedSlots.add(h);
    else this._state.selectedSlots.delete(h);
    this._updateCells();
    this._updateSummary();
  },

  _confirm() {
    const { obj, el, selectedDate, selectedSlots } = this._state;
    if (selectedSlots.size === 0) return;

    const sorted = [...selectedSlots].sort((a,b) => a-b);
    const timeStr = `${String(sorted[0]).padStart(2,'0')}:00 – ${String(sorted[sorted.length-1]+1).padStart(2,'0')}:00`;

    // Select the seat + store booking info
    AppState.selectedSeat = obj;
    AppState.pendingBooking = { date: selectedDate, timeStr, hours: sorted };

    // Update UI info text
    const info = document.getElementById('selected-info');
    if (info) info.textContent = `${obj.name} — ${selectedDate.split('-').reverse().join('/')} · ${timeStr}`;

    // Highlight seat as selected
    LayoutRenderer._selectSeat(el, obj);

    this._close();
    Utils.showToast(`Đã chọn ${obj.name} · ${timeStr}`);
  },

  _close() {
    if (!this._state) return;
    const { modal, overlay } = this._state;
    modal.classList.remove('open');
    overlay.classList.remove('open');
    setTimeout(() => { modal.remove(); overlay.remove(); }, 300);
    this._state = null;
  }
};

// ===== BOOKING =====
const Booking = {
  async confirm() {
    if (!AppState.selectedSeat) return Utils.showToast('Vui lòng chọn chỗ ngồi');

    const date = document.getElementById('book-date').value;
    if (!date) return Utils.showToast('Vui lòng chọn ngày');
    const time = document.getElementById('book-time').value;

    // TODO: POST to /book-seat with seat id, date, time
    Utils.showToast(`Đặt ${AppState.selectedSeat.name} thành công!`);

    AppState.myBookings.push({
      id: AppState.selectedSeat.id,
      seat: AppState.selectedSeat.name,
      date: date.split('-').reverse().join('/'),
      time
    });

    // Mark as taken in UI
    LayoutRenderer.markSeatTaken(AppState.selectedSeat.id);
    AppState.selectedSeat = null;
    document.getElementById('selected-info').textContent = 'Vui lòng chọn một chỗ ngồi từ sơ đồ';
  },

  cancel(seatName) {
    const idx = AppState.myBookings.findIndex(b => b.seat === seatName);
    if (idx === -1) return;

    const booking = AppState.myBookings.splice(idx, 1)[0];

    // Restore seat in UI
    const el = LayoutRenderer.container?.querySelector(`[data-id="${booking.id}"]`);
    if (el) {
      el.dataset.state = '';
      Object.assign(el.style, {
        background: '#fff',
        borderColor: '#6B9A7D',
        color: '#2D5A3D',
        cursor: 'pointer'
      });
    }

    Modal.openManage('seats');
    Utils.showToast(`Đã hủy chỗ ${seatName}`);
  }
};

// ===== BOOKS =====
const Books = {
  COLORS: ['#EAF3DE','#E6F1FB','#FAEEDA','#FBEAF0','#E1F5EE','#FAECE7','#EEEDFE','#F3ECE7'],

  async load() {
    try {
      AppState.books = await Utils.fetchJSON('/get-booklist');
      this.render();
    } catch (e) {
      console.error('Failed to load books:', e);
    }
  },

  render() {
    const grid = document.getElementById('books-grid');
    if (!grid) return;

    grid.innerHTML = AppState.books.map((book, i) => `
      <div class="book-card" data-title="${book.title.toLowerCase()}" data-author="${book.author.toLowerCase()}">
        <div class="book-cover" style="background:${this.COLORS[i % 8]}">📚</div>
        <div class="book-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <span class="book-status ${book.status ? 'avail' : 'out'}">
            ${book.status ? 'Còn sách' : 'Đã mượn hết'}
          </span>
          <button class="btn-borrow" ${book.status ? '' : 'disabled'} onclick="Books.borrow(${book.id})">
            ${book.status ? 'Mượn sách' : 'Không khả dụng'}
          </button>
        </div>
      </div>
    `).join('');
  },

  async borrow(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book?.status) return;

    // TODO: POST to /borrow-book
    book.status = false;

    const due = new Date();
    due.setDate(due.getDate() + 14);
    const dueStr = due.toLocaleDateString('vi-VN');

    AppState.myBorrows.push({ id: bookId, title: book.title, author: book.author, due: dueStr });
    this.render();
    Utils.showToast(`Đã mượn "${book.title}" — hạn trả ${dueStr}`);
  },

  return(title) {
    const idx = AppState.myBorrows.findIndex(b => b.title === title);
    if (idx === -1) return;

    AppState.myBorrows.splice(idx, 1);
    const book = AppState.books.find(b => b.title === title);
    if (book) { book.status = true; this.render(); }

    Modal.openManage('books');
    Utils.showToast(`Đã trả "${title}" thành công!`);
  },

  filter() {
    const q = document.getElementById('search-input').value.toLowerCase();
    document.querySelectorAll('.book-card').forEach(card => {
      card.style.display =
        (card.dataset.title.includes(q) || card.dataset.author.includes(q)) ? '' : 'none';
    });
  }
};

// ===== NAVIGATION =====
const Navigation = {
  switchPage(page) {
    document.querySelectorAll('.page-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
    // Navbar (desktop)
    document.getElementById('nav-seat').classList.toggle('active', page === 'seat');
    document.getElementById('nav-book').classList.toggle('active', page === 'book');
    // Tab bar (iOS/mobile)
    document.querySelectorAll('.tab-bar-item').forEach(el => el.classList.remove('active'));
    const tabMap = { seat: 'tab-seat', book: 'tab-book' };
    if (tabMap[page]) document.getElementById(tabMap[page])?.classList.add('active');
  },

  toggleDropdown() {
    document.getElementById('dropdown').classList.toggle('open');
  },

  closeDropdown() {
    document.getElementById('dropdown').classList.remove('open');
  }
};

// ===== MODAL =====
const Modal = {
  openManage(type) {
    Navigation.closeDropdown();
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const titleEl = document.getElementById('modal-title-text');

    const configs = {
      seats:   { title: 'Chỗ ngồi đã đặt',  html: this._renderSeats() },
      books:   { title: 'Sách đang mượn',    html: this._renderBooks() },
      profile: { title: 'Sửa thông tin',     html: this._renderProfile() }
    };

    const config = configs[type];
    if (!config) return;

    titleEl.textContent = config.title;
    body.innerHTML = config.html;
    overlay.classList.add('open');
  },

  _renderSeats() {
    if (!AppState.myBookings.length)
      return '<p style="color:var(--muted);text-align:center;padding:2rem">Bạn chưa có đặt chỗ nào</p>';
    return AppState.myBookings.map(b => `
      <div class="manage-item">
        <div class="manage-info">
          <strong>Chỗ ${b.seat}</strong>
          <span>${b.date} · ${b.time}</span>
        </div>
        <button class="btn-cancel" onclick="Booking.cancel('${b.seat}')">Hủy</button>
      </div>`).join('');
  },

  _renderBooks() {
    if (!AppState.myBorrows.length)
      return '<p style="color:var(--muted);text-align:center;padding:2rem">Bạn chưa mượn sách nào</p>';
    return AppState.myBorrows.map(b => `
      <div class="manage-item">
        <div class="manage-info">
          <strong>${b.title}</strong>
          <span>${b.author} · Hạn trả: ${b.due}</span>
        </div>
        <button class="btn-cancel" onclick="Books.return('${b.title}')">Trả sách</button>
      </div>`).join('');
  },

  _renderProfile() {
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

  close() {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

// ===== PROFILE =====
const Profile = {
  async save() {
    const name = document.getElementById('user-name').value.trim();
    const password = document.getElementById('user-password').value;
    if (!name) return Utils.showToast('Vui lòng nhập họ tên');

    try {
      const result = await Utils.fetchJSON('/update-profile', {
        method: 'POST',
        body: JSON.stringify({ name, password })
      });
      if (result.success) {
        CURRENT_USER.name = name;
        Utils.showToast('Cập nhật thành công!');
        Modal.close();
      } else {
        Utils.showToast('Cập nhật thất bại');
      }
    } catch (e) {
      console.error(e);
      Utils.showToast('Lỗi kết nối server');
    }
  }
};

// ===== AUTH =====
const Auth = {
  async logout() {
    Navigation.closeDropdown();
    await fetch('/logout');
    window.location.href = '/';
  }
};

// ===== GLOBAL SHORTHANDS =====
const switchPage     = p => Navigation.switchPage(p);
const toggleDropdown = () => Navigation.toggleDropdown();
const openManage     = t => Modal.openManage(t);
const closeModal     = () => Modal.close();
const doLogout       = () => Auth.logout();
const confirmBooking = () => Booking.confirm();
const filterBooks    = () => Books.filter();

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-right')) Navigation.closeDropdown();
});

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  LayoutRenderer.init();
  Books.load();

  const dateInput = document.getElementById('book-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
});