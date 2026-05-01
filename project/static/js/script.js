// ===== STATE MANAGEMENT =====
const AppState = {
  selectedSeat: null,
  userName: '',
  myBookings: [],
  myBorrows: [],
  books: [],
  layoutData: null
};

// ===== UTILITY FUNCTIONS =====
const Utils = {
  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  },

  async fetchJSON(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      return await response.json();
    } catch (error) {
      console.error('Fetch error:', error);
      this.showToast('Lỗi kết nối server');
      throw error;
    }
  }
};

// ===== CANVAS LAYOUT RENDERER =====
const LayoutRenderer = {
  canvas: null,
  ctx: null,

  init() {
    this.canvas = document.getElementById('layout-canvas');
    if (!this.canvas) {
      console.error('Canvas not found');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.loadAndRender();
  },

  async loadAndRender() {
    try {
      // Load layout from server
      const response = await fetch('/get-layout');
      console.log(response);
      AppState.layoutData = await response.json();
      
      console.log('Layout loaded:', AppState.layoutData);
      this.render();
    } catch (error) {
      console.error('Failed to load layout:', error);
      // Fallback to default layout
      this.renderDefaultLayout();
    }
  },

  render() {
    if (!AppState.layoutData || !AppState.layoutData.objects) {
      console.error('No layout data to render');
      return;
    }

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional, for visual reference)
    this.drawGrid();

    // Draw all objects
    AppState.layoutData.objects.forEach(obj => {
      this.drawObject(obj);
    });
  },

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  },

  drawObject(obj) {
    const { ctx } = this;

    // Set colors based on type
    if (obj.type === 'table') {
      ctx.fillStyle = '#D4C9A8';
      ctx.strokeStyle = '#A89E80';
    } else if (obj.type === 'seat') {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#2D5A3D';
    }

    ctx.lineWidth = 2;

    // Draw shape
    switch (obj.shape) {
      case 'rect':
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'roundrect':
        this.roundRect(ctx, obj.x, obj.y, obj.width, obj.height, 12, true, true);
        break;
    }

    // Draw label
    this.drawLabel(obj);

    // Add click interaction for seats
    if (obj.type === 'seat') {
      this.makeClickable(obj);
    }
  },

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  },

  drawLabel(obj) {
    const { ctx } = this;

    ctx.fillStyle = obj.type === 'table' ? '#6B6860' : '#2D5A3D';
    ctx.font = '12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelX = obj.shape === 'circle' ? obj.x : obj.x + obj.width / 2;
    const labelY = obj.shape === 'circle' ? obj.y : obj.y + obj.height / 2;

    ctx.fillText(obj.name, labelX, labelY);
  },

  makeClickable(obj) {
    // Add event listener to canvas for seat selection
    if (!this.canvas._hasClickListener) {
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.canvas._hasClickListener = true;
      this.canvas.style.cursor = 'pointer';
    }
  },

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on a seat
    const clickedSeat = this.findSeatAt(x, y);
    if (clickedSeat) {
      this.selectSeat(clickedSeat);
    }
  },

  findSeatAt(x, y) {
    if (!AppState.layoutData || !AppState.layoutData.objects) return null;

    for (let obj of AppState.layoutData.objects) {
      if (obj.type !== 'seat') continue;

      let isInside = false;

      if (obj.shape === 'circle') {
        const dist = Math.hypot(x - obj.x, y - obj.y);
        isInside = dist <= obj.radius;
      } else {
        // rect or roundrect
        isInside = x >= obj.x && x <= obj.x + obj.width &&
                   y >= obj.y && y <= obj.y + obj.height;
      }

      if (isInside) return obj;
    }

    return null;
  },

  selectSeat(seatObj) {
    // Update selected seat
    AppState.selectedSeat = seatObj;

    // Re-render with selection
    this.render();

    // Highlight selected seat
    const { ctx } = this;
    ctx.strokeStyle = '#C8A96E';
    ctx.lineWidth = 4;

    if (seatObj.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(seatObj.x, seatObj.y, seatObj.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(seatObj.x, seatObj.y, seatObj.width, seatObj.height);
    }

    // Update UI
    document.getElementById('selected-info').textContent = 
      `Đã chọn: ${seatObj.name} — Khu đọc sách yên tĩnh`;

    Utils.showToast(`Đã chọn ${seatObj.name}`);
  },

  renderDefaultLayout() {
    // Fallback layout if JSON fails to load
    const { ctx, canvas } = this;
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#666';
    ctx.font = '16px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Layout không khả dụng', canvas.width / 2, canvas.height / 2);
  }
};

// ===== BOOKING FUNCTIONS =====
const Booking = {
  async confirm() {
    if (!AppState.selectedSeat) {
      Utils.showToast('Vui lòng chọn chỗ ngồi');
      return;
    }

    const date = document.getElementById('book-date').value;
    const time = document.getElementById('book-time').value;

    if (!date) {
      Utils.showToast('Vui lòng chọn ngày');
      return;
    }

    // TODO: Send to server
    Utils.showToast(`Đặt ${AppState.selectedSeat.name} thành công!`);
    
    AppState.myBookings.push({
      seat: AppState.selectedSeat.name,
      date: date.split('-').reverse().join('/'),
      time: time
    });

    // Reset selection
    AppState.selectedSeat = null;
    LayoutRenderer.render();
    document.getElementById('selected-info').textContent = 
      'Vui lòng chọn một chỗ ngồi từ sơ đồ';
  },

  cancel(seatName) {
    const index = AppState.myBookings.findIndex(b => b.seat === seatName);
    if (index > -1) {
      AppState.myBookings.splice(index, 1);
      Modal.openManage('seats');
      Utils.showToast(`Đã hủy chỗ ${seatName}`);
    }
  }
};

// ===== BOOKS MANAGEMENT =====
const Books = {
  async load() {
    try {
      AppState.books = await Utils.fetchJSON('/get-booklist');
      this.render();
    } catch (error) {
      console.error('Failed to load books:', error);
    }
  },

  render() {
    const grid = document.getElementById('books-grid');
    if (!grid) return;

    grid.innerHTML = '';

    AppState.books.forEach((book, i) => {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.dataset.title = book.title.toLowerCase();
      card.dataset.author = book.author.toLowerCase();

      const colors = ['#EAF3DE', '#E6F1FB', '#FAEEDA', '#FBEAF0', 
                     '#E1F5EE', '#FAECE7', '#EEEDFE', '#EAF3DE'];

      card.innerHTML = `
        <div class="book-cover" style="background:${colors[i % 8]}">📚</div>
        <div class="book-info">
          <div class="book-title">${book.title}</div>
          <div class="book-author">${book.author}</div>
          <span class="book-status ${book.status ? 'avail' : 'out'}">
            ${book.status ? 'Còn sách' : 'Đã mượn hết'}
          </span>
          <button class="btn-borrow" 
                  ${book.status ? '' : 'disabled'} 
                  onclick="Books.borrow(${book.id})">
            ${book.status ? 'Mượn sách' : 'Không khả dụng'}
          </button>
        </div>
      `;

      grid.appendChild(card);
    });
  },

  async borrow(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book || !book.status) return;

    // TODO: Send to server
    book.status = false;
    
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const dueStr = due.toLocaleDateString('vi-VN');

    AppState.myBorrows.push({
      title: book.title,
      author: book.author,
      due: dueStr
    });

    this.render();
    Utils.showToast(`Đã mượn "${book.title}" — hạn trả ${dueStr}`);
  },

  return(title) {
    const index = AppState.myBorrows.findIndex(b => b.title === title);
    if (index > -1) {
      AppState.myBorrows.splice(index, 1);
      
      const book = AppState.books.find(b => b.title === title);
      if (book) {
        book.status = true;
        this.render();
      }
      
      Modal.openManage('books');
      Utils.showToast(`Đã trả "${title}" thành công!`);
    }
  },

  filter() {
    const query = document.getElementById('search-input').value.toLowerCase();
    document.querySelectorAll('.book-card').forEach(card => {
      const matchesTitle = card.dataset.title.includes(query);
      const matchesAuthor = card.dataset.author.includes(query);
      card.style.display = (matchesTitle || matchesAuthor) ? '' : 'none';
    });
  }
};

// ===== NAVIGATION =====
const Navigation = {
  switchPage(page) {
    document.querySelectorAll('.page-content').forEach(c => 
      c.classList.remove('active')
    );
    document.getElementById(`page-${page}`).classList.add('active');

    document.getElementById('nav-seat').classList.toggle('active', page === 'seat');
    document.getElementById('nav-book').classList.toggle('active', page === 'book');
  },

  toggleDropdown() {
    document.getElementById('dropdown').classList.toggle('open');
  },

  closeDropdown() {
    document.getElementById('dropdown').classList.remove('open');
  }
};

// ===== MODAL MANAGEMENT =====
const Modal = {
  openManage(type) {
    Navigation.closeDropdown();

    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    const title = document.getElementById('modal-title-text');

    switch(type) {
      case 'seats':
        title.textContent = 'Chỗ ngồi đã đặt';
        body.innerHTML = this.renderSeats();
        break;
      case 'books':
        title.textContent = 'Sách đang mượn';
        body.innerHTML = this.renderBooks();
        break;
      case 'profile':
        title.textContent = 'Sửa thông tin';
        body.innerHTML = this.renderProfile();
        break;
    }

    overlay.classList.add('open');
  },

  renderSeats() {
    if (!AppState.myBookings.length) {
      return '<p style="color:var(--muted);text-align:center;padding:2rem">Bạn chưa có đặt chỗ nào</p>';
    }

    return AppState.myBookings.map(b => `
      <div class="manage-item">
        <div class="manage-info">
          <strong>Chỗ ${b.seat}</strong>
          <span>${b.date} · ${b.time}</span>
        </div>
        <button class="btn-cancel" onclick="Booking.cancel('${b.seat}')">Hủy</button>
      </div>
    `).join('');
  },

  renderBooks() {
    if (!AppState.myBorrows.length) {
      return '<p style="color:var(--muted);text-align:center;padding:2rem">Bạn chưa mượn sách nào</p>';
    }

    return AppState.myBorrows.map(b => `
      <div class="manage-item">
        <div class="manage-info">
          <strong>${b.title}</strong>
          <span>${b.author} · Hạn trả: ${b.due}</span>
        </div>
        <button class="btn-cancel" onclick="Books.return('${b.title}')">Trả sách</button>
      </div>
    `).join('');
  },

  renderProfile() {
    return `
      <div class="form-group">
        <label>Họ và tên</label>
        <input type="text" class="input-field" id="user-name" value="${CURRENT_USER.name}" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" class="input-field" id="user-email" value="${CURRENT_USER.email}" readonly />
      </div>
      <div class="form-group">
        <label>Mật khẩu mới</label>
        <input type="password" class="input-field" id="user-password" placeholder="Để trống nếu không đổi" />
      </div>
      <button class="btn-book" onclick="Profile.save()">Lưu thay đổi</button>
    `;
  },

  close() {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

// ===== PROFILE MANAGEMENT =====
const Profile = {
  async save() {
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-password').value;

    try {
      const result = await Utils.fetchJSON('/update-profile', {
        method: 'POST',
        body: JSON.stringify({ name, email: CURRENT_USER.email, password })
      });

      if (result.success) {
        CURRENT_USER.name = name;
        Utils.showToast('Cập nhật thông tin thành công!');
        Modal.close();
      } else {
        Utils.showToast('Cập nhật thông tin thất bại');
      }
    } catch (error) {
      console.error('Profile update error:', error);
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

// ===== GLOBAL FUNCTIONS (for HTML onclick) =====
function switchPage(page) { Navigation.switchPage(page); }
function toggleDropdown() { Navigation.toggleDropdown(); }
function openManage(type) { Modal.openManage(type); }
function closeModal() { Modal.close(); }
async function doLogout() { await Auth.logout(); }
function confirmBooking() { Booking.confirm(); }
function filterBooks() { Books.filter(); }

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-right')) {
    Navigation.closeDropdown();
  }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing dashboard...');
  
  // Initialize layout renderer
  LayoutRenderer.init();
  
  // Load books
  Books.load();
  
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('book-date');
  if (dateInput) {
    dateInput.value = today;
  }
  
  console.log('Dashboard initialized');
});