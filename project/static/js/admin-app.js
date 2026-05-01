// ===== STATE MANAGEMENT =====
const AppState = {
  adminBooks: [],
  adminAccounts: [],
  layoutObjects: [],
  canvas: null,
  ctx: null,
  
  // Editor state
  currentShape: 'rect',
  currentType: 'table',
  currentTool: 'select',
  snapGrid: 10,
  
  // Drawing state
  isDrawing: false,
  isDragging: false,
  selectedObject: null,
  startX: 0,
  startY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  
  // Edit state
  editingBookId: null
};

// ===== UTILITY FUNCTIONS =====

const Utils = {
  showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.className = 'toast', 300);
    }, 3000);
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
      this.showToast('Lỗi kết nối server', 'error');
      throw error;
    }
  },
  
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};

// ===== AUTH MANAGEMENT =====

const Auth = {
  async logout() {
    try {
      await fetch("/logout");
      window.location.href = "/";
    } catch (error) {
      console.error('Logout error:', error);
      Utils.showToast('Lỗi khi đăng xuất', 'error');
    }
  }
};

// ===== NAVIGATION =====

const Navigation = {
  showSection(section) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => 
      s.classList.remove('active')
    );
    
    // Show selected section
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => 
      n.classList.remove('active')
    );
    event.target.closest('.nav-item')?.classList.add('active');
    
    // Initialize section-specific functionality
    switch(section) {
      case 'layout':
        setTimeout(() => Canvas.init(), 100);
        break;
      case 'books':
        Books.loadList();
        break;
      case 'accounts':
        Accounts.loadList();
        break;
      case 'dashboard':
        Dashboard.updateStats();
        break;
    }
  }
};

// ===== DASHBOARD =====

const Dashboard = {
  async updateStats() {
    try {
      const accounts = await Utils.fetchJSON('/get-accountlist');
      
      document.getElementById('stat-users').textContent = accounts.length;
      
      const bookings = accounts.filter(a => a.bookings === 'Đã đặt').length;
      document.getElementById('stat-bookings').textContent = bookings;
      
      const borrows = accounts.filter(a => a.borrows === 'Đã mượn').length;
      document.getElementById('stat-books').textContent = borrows;
    } catch (error) {
      console.error('Stats update error:', error);
    }
  }
};

// ===== CANVAS EDITOR =====

const Canvas = {
  init() {
    AppState.canvas = document.getElementById('layout-canvas');
    if (!AppState.canvas) return;
    
    AppState.ctx = AppState.canvas.getContext('2d');
    
    this.loadFromStorage();
    this.draw();
    this.attachEventListeners();
  },
  
  attachEventListeners() {
    const canvas = AppState.canvas;
    canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
  },
  
  draw() {
    const { ctx, canvas } = AppState;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    this.drawGrid();
    this.drawObjects();
  },
  
  drawGrid() {
    const { ctx, canvas, snapGrid } = AppState;
    
    // Main grid
    ctx.strokeStyle = '#F0F0F0';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Snap grid
    if (snapGrid > 1) {
      ctx.strokeStyle = '#E8E8E8';
      ctx.setLineDash([1, 3]);
      
      for (let x = 0; x <= canvas.width; x += snapGrid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvas.height; y += snapGrid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }
  },
  
  drawObjects() {
    const { ctx, layoutObjects, selectedObject } = AppState;
    
    layoutObjects.forEach(obj => {
      const isSelected = obj === selectedObject;
      
      // Set colors
      if (obj.type === 'table') {
        ctx.fillStyle = '#D4C9A8';
        ctx.strokeStyle = isSelected ? '#2D5A3D' : '#A89E80';
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = isSelected ? '#2D5A3D' : '#6B9A7D';
      }
      
      ctx.lineWidth = isSelected ? 3 : 2;
      
      // Draw shape
      this.drawShape(obj);
      
      // Draw label
      this.drawLabel(obj, isSelected);
      
      // Draw selection handles
      if (isSelected) {
        this.drawSelectionHandles(obj);
      }
    });
  },
  
  drawShape(obj) {
    const { ctx } = AppState;
    
    switch(obj.shape) {
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
  
  drawLabel(obj, isSelected) {
    const { ctx } = AppState;
    
    ctx.fillStyle = obj.type === 'table' ? '#6B6860' : '#2D5A3D';
    ctx.font = isSelected ? 'bold 12px DM Sans' : '11px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const labelX = obj.shape === 'circle' ? obj.x : obj.x + obj.width / 2;
    const labelY = obj.shape === 'circle' ? obj.y : obj.y + obj.height / 2;
    
    ctx.fillText(obj.name, labelX, labelY);
  },
  
  drawSelectionHandles(obj) {
    const { ctx } = AppState;
    const handleSize = 6;
    
    ctx.fillStyle = '#2D5A3D';
    
    if (obj.shape === 'circle') {
      const r = obj.radius;
      [[0, -r], [r, 0], [0, r], [-r, 0]].forEach(([dx, dy]) => {
        ctx.fillRect(
          obj.x + dx - handleSize/2,
          obj.y + dy - handleSize/2,
          handleSize,
          handleSize
        );
      });
    } else {
      [
        [obj.x, obj.y],
        [obj.x + obj.width, obj.y],
        [obj.x, obj.y + obj.height],
        [obj.x + obj.width, obj.y + obj.height]
      ].forEach(([hx, hy]) => {
        ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
      });
    }
  },
  
  snap(value) {
    const { snapGrid } = AppState;
    return Math.round(value / snapGrid) * snapGrid;
  },
  
  getMousePos(e) {
    const rect = AppState.canvas.getBoundingClientRect();
    return {
      x: this.snap(e.clientX - rect.left),
      y: this.snap(e.clientY - rect.top)
    };
  },
  
  handleMouseDown(e) {
    const pos = this.getMousePos(e);
    AppState.startX = pos.x;
    AppState.startY = pos.y;
    
    if (AppState.currentTool === 'select') {
      const obj = this.getObjectAt(pos.x, pos.y);
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
      this.deleteObjectAt(pos.x, pos.y);
    }
  },
  
  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (AppState.isDragging && AppState.selectedObject) {
      AppState.selectedObject.x = pos.x - AppState.dragOffsetX;
      AppState.selectedObject.y = pos.y - AppState.dragOffsetY;
      this.draw();
      return;
    }
    
    if (!AppState.isDrawing || AppState.currentTool === 'delete') return;
    
    this.draw();
    this.drawPreview(pos);
  },
  
  drawPreview(pos) {
    const { ctx, startX, startY, currentShape } = AppState;
    const width = pos.x - startX;
    const height = pos.y - startY;
    
    ctx.strokeStyle = '#2D5A3D';
    ctx.fillStyle = 'rgba(45, 90, 61, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    switch(currentShape) {
      case 'rect':
        ctx.strokeRect(startX, startY, width, height);
        ctx.fillRect(startX, startY, width, height);
        break;
        
      case 'circle':
        const radius = Math.hypot(width, height) / 2;
        const centerX = startX + width / 2;
        const centerY = startY + height / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'roundrect':
        this.roundRect(ctx, startX, startY, width, height, 12, true, true);
        break;
    }
    
    ctx.setLineDash([]);
    
    // Show dimensions
    ctx.fillStyle = '#2D5A3D';
    ctx.font = 'bold 11px DM Sans';
    ctx.fillText(`${Math.abs(width)}×${Math.abs(height)}px`, pos.x + 8, pos.y - 8);
  },
  
  handleMouseUp(e) {
    if (AppState.isDragging) {
      AppState.isDragging = false;
      this.updateObjectsList();
      return;
    }
    
    if (!AppState.isDrawing || AppState.currentTool === 'delete') {
      AppState.isDrawing = false;
      this.draw();
      return;
    }
    
    const pos = this.getMousePos(e);
    this.createObject(pos);
    AppState.isDrawing = false;
  },
  
  createObject(endPos) {
    const { startX, startY, currentShape, currentType, layoutObjects, snapGrid } = AppState;
    const width = endPos.x - startX;
    const height = endPos.y - startY;
    
    if (Math.abs(width) < snapGrid * 2 || Math.abs(height) < snapGrid * 2) {
      this.draw();
      return;
    }
    
    const obj = {
      id: Date.now(),
      shape: currentShape,
      type: currentType,
      x: Math.min(startX, endPos.x),
      y: Math.min(startY, endPos.y),
      width: Math.abs(width),
      height: Math.abs(height),
      name: `${currentType === 'table' ? 'Bàn' : 'Ghế'}-${layoutObjects.filter(o => o.type === currentType).length + 1}`
    };
    
    if (currentShape === 'circle') {
      obj.radius = Math.hypot(width, height) / 2;
      obj.x = startX + width / 2;
      obj.y = startY + height / 2;
    }
    
    AppState.layoutObjects.push(obj);
    this.draw();
    this.updateObjectsList();
    Utils.showToast(`Đã thêm ${obj.name}`);
  },
  
  getObjectAt(x, y) {
    const { layoutObjects } = AppState;
    
    for (let i = layoutObjects.length - 1; i >= 0; i--) {
      const obj = layoutObjects[i];
      
      if (obj.shape === 'circle') {
        const dist = Math.hypot(x - obj.x, y - obj.y);
        if (dist <= obj.radius) return obj;
      } else {
        if (x >= obj.x && x <= obj.x + obj.width && 
            y >= obj.y && y <= obj.y + obj.height) {
          return obj;
        }
      }
    }
    return null;
  },
  
  deleteObjectAt(x, y) {
    const obj = this.getObjectAt(x, y);
    if (obj) {
      AppState.layoutObjects = AppState.layoutObjects.filter(o => o !== obj);
      AppState.selectedObject = null;
      this.draw();
      this.updateObjectsList();
      Utils.showToast(`Đã xóa ${obj.name}`);
    }
  },
  
  selectObjectById(id) {
    AppState.selectedObject = AppState.layoutObjects.find(o => o.id === id);
    this.draw();
    this.updateObjectsList();
  },
  
  deleteObjectById(id) {
    const obj = AppState.layoutObjects.find(o => o.id === id);
    AppState.layoutObjects = AppState.layoutObjects.filter(o => o.id !== id);
    AppState.selectedObject = null;
    this.draw();
    this.updateObjectsList();
    if (obj) Utils.showToast(`Đã xóa ${obj.name}`);
  },
  
  renameObject(id, newName) {
    const obj = AppState.layoutObjects.find(o => o.id === id);
    if (obj) {
      obj.name = newName.trim() || obj.name;
      this.draw();
    }
  },
  
  updateObjectsList() {
    const list = document.getElementById('objects-list');
    if (!list) return;
    
    if (AppState.layoutObjects.length === 0) {
      list.innerHTML = '<p style="color:#999;font-size:13px;padding:1rem 0;text-align:center">Chưa có đối tượng nào<br><small>Chọn hình dạng và loại, sau đó vẽ trên canvas</small></p>';
      return;
    }
    
    list.innerHTML = AppState.layoutObjects.map(obj => `
      <div style="padding:10px;background:${obj === AppState.selectedObject ? '#E8F2EB' : '#f5f5f5'};border:2px solid ${obj === AppState.selectedObject ? '#2D5A3D' : 'transparent'};border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="Canvas.selectObjectById(${obj.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:500;font-size:13px">${obj.type === 'table' ? '📊' : '💺'} ${obj.name}</span>
          <button onclick="event.stopPropagation();Canvas.deleteObjectById(${obj.id})" style="background:#FCEBEB;color:#A32D2D;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:500">Xóa</button>
        </div>
        <div style="font-size:11px;color:#6B6860;display:flex;gap:12px;flex-wrap:wrap">
          <span>📐 ${obj.shape === 'circle' ? 'Tròn' : obj.shape === 'rect' ? 'Vuông' : 'Bo góc'}</span>
          <span>📍 (${obj.x}, ${obj.y})</span>
          ${obj.shape === 'circle' ? `<span>⭕ r=${Math.round(obj.radius)}</span>` : `<span>📏 ${obj.width}×${obj.height}</span>`}
        </div>
        <input type="text" value="${obj.name}" onchange="Canvas.renameObject(${obj.id}, this.value)" onclick="event.stopPropagation()"
          style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" 
          placeholder="Đặt tên..."/>
        <input type="text" onclick="event.stopPropagation()"
          style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" 
          placeholder="Trigger Pin"/>
        <input type="text" onclick="event.stopPropagation()"
          style="width:33%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" 
          placeholder="Echo Pin"/>
      </div>
    `).join('');
  },
  
  selectShape(shape) {
    AppState.currentShape = shape;
    document.querySelectorAll('[data-shape]').forEach(btn => 
      btn.classList.remove('active')
    );
    document.querySelector(`[data-shape="${shape}"]`)?.classList.add('active');
  },
  
  selectType(type) {
    AppState.currentType = type;
    document.querySelectorAll('[data-type]').forEach(btn => 
      btn.classList.remove('active')
    );
    document.querySelector(`[data-type="${type}"]`)?.classList.add('active');
  },
  
  selectTool(tool) {
    AppState.currentTool = tool;
    AppState.selectedObject = null;
    
    document.querySelectorAll('[data-tool]').forEach(btn => 
      btn.classList.remove('active')
    );
    document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
    
    if (AppState.canvas) {
      AppState.canvas.style.cursor = 
        tool === 'delete' ? 'not-allowed' : 
        tool === 'select' ? 'default' : 'crosshair';
    }
    this.draw();
  },
  
  updateSnapGrid() {
    AppState.snapGrid = parseInt(document.getElementById('snap-grid').value);
    this.draw();
    Utils.showToast(`Snap grid: ${AppState.snapGrid}px`);
  },
  
  async save() {
    const data = {
      objects: AppState.layoutObjects,
      snapGrid: AppState.snapGrid,
      canvasSize: { 
        width: AppState.canvas.width, 
        height: AppState.canvas.height 
      }
    };
    
    localStorage.setItem('libraryLayout', JSON.stringify(data));
    
    try {
      await Utils.fetchJSON('/save-layout', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      Utils.showToast('Đã lưu layout thành công!', 'success');
    } catch (error) {
      Utils.showToast('Lỗi khi lưu layout', 'error');
    }
  },
  
  loadFromStorage() {
    const saved = localStorage.getItem('libraryLayout');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        AppState.layoutObjects = data.objects || [];
        AppState.snapGrid = data.snapGrid || 10;
        this.updateObjectsList();
      } catch (error) {
        console.error('Error loading layout:', error);
      }
    }
  }
};

// ===== BOOKS MANAGEMENT =====

const Books = {
  async loadList() {
    try {
      AppState.adminBooks = await Utils.fetchJSON('/get-booklist');
      this.render();
    } catch (error) {
      console.error('Load books error:', error);
    }
  },
  
  render() {
    const tbody = document.getElementById('books-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = AppState.adminBooks.map(book => `
      <tr>
        <td>${book.id}</td>
        <td><strong>${book.title}</strong></td>
        <td>${book.author}</td>
        <td><span class="badge ${book.status ? 'success' : 'danger'}">${book.status ? 'Có thể mượn' : 'Không thể mượn'}</span></td>
        <td>${book.borrowedCount} lượt</td>
        <td>
          <button class="action-btn edit" onclick="Books.edit(${book.id})">✏️ Sửa</button>
          <button class="action-btn delete" onclick="Books.delete(${book.id})">🗑️ Xóa</button>
        </td>
      </tr>
    `).join('');
  },
  
  filter: Utils.debounce(function() {
    const query = document.getElementById('book-search').value.toLowerCase();
    const rows = document.querySelectorAll('#books-table-body tr');
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }, 300),
  
  openModal() {
    AppState.editingBookId = null;
    document.getElementById('book-modal-title').textContent = 'Thêm Sách Mới';
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
    document.getElementById('book-title').value = book.title;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-modal').classList.add('active');
  },
  
  async delete(id) {
    if (!confirm('Bạn có chắc muốn xóa sách này?')) return;
    
    try {
      const result = await Utils.fetchJSON('/delete-book', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      
      if (result.success) {
        await this.loadList();
        Utils.showToast('Đã xóa sách thành công!', 'success');
      } else {
        Utils.showToast('Lỗi khi xóa sách', 'error');
      }
    } catch (error) {
      console.error('Delete book error:', error);
    }
  },
  
  async save() {
    const id = document.getElementById('book-id').value.trim();
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    
    if (!id || !title || !author) {
      Utils.showToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    
    try {
      const url = AppState.editingBookId === null ? '/add-book' : '/edit-book';
      const data = AppState.editingBookId === null 
        ? { id, title, author }
        : { id: AppState.editingBookId, title, author };
      
      const result = await Utils.fetchJSON(url, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      if (result.success) {
        await this.loadList();
        this.closeModal();
        Utils.showToast(
          AppState.editingBookId === null ? 'Đã thêm sách mới!' : 'Đã cập nhật thông tin sách!',
          'success'
        );
      } else {
        Utils.showToast('Lỗi khi lưu sách', 'error');
      }
    } catch (error) {
      console.error('Save book error:', error);
    }
  }
};

// ===== ACCOUNTS MANAGEMENT =====

const Accounts = {
  async loadList() {
    try {
      AppState.adminAccounts = await Utils.fetchJSON('/get-accountlist');
      this.render();
      Dashboard.updateStats();
    } catch (error) {
      console.error('Load accounts error:', error);
    }
  },
  
  render() {
    const tbody = document.getElementById('accounts-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = AppState.adminAccounts.map(acc => `
      <tr>
        <td>#${acc.id}</td>
        <td><strong>${acc.name}</strong></td>
        <td>${acc.email}</td>
        <td>${acc.created}</td>
        <td>${acc.bookings}</td>
        <td>${acc.borrows}</td>
        <td>
          <button class="action-btn delete" onclick="Accounts.delete(${acc.id})">🗑️ Xóa</button>
        </td>
      </tr>
    `).join('');
  },
  
  filter: Utils.debounce(function() {
    const query = document.getElementById('account-search').value.toLowerCase();
    const rows = document.querySelectorAll('#accounts-table-body tr');
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  }, 300),
  
  async delete(id) {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
    
    try {
      const result = await Utils.fetchJSON('/delete-account', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      
      if (result.success) {
        await this.loadList();
        Utils.showToast('Đã xóa tài khoản!', 'success');
      } else {
        Utils.showToast('Lỗi khi xóa tài khoản', 'error');
      }
    } catch (error) {
      console.error('Delete account error:', error);
    }
  }
};

// ===== PRICING =====

const Pricing = {
  async update(period) {
    const input = document.getElementById(`price-${period}`);
    const value = parseInt(input.value);
    
    if (isNaN(value) || value < 0) {
      Utils.showToast('Giá không hợp lệ', 'error');
      return;
    }
    
    localStorage.setItem(`price-${period}`, value);
    
    const periodNames = {
      morning: 'sáng',
      afternoon: 'chiều',
      evening: 'tối'
    };
    
    Utils.showToast(`Đã cập nhật giá khung ${periodNames[period]}!`, 'success');
  }
};

// ===== GLOBAL FUNCTIONS (for HTML onclick) =====

function showSection(section) {
  Navigation.showSection(section);
}

async function adminLogout() {
  await Auth.logout();
}

function selectShape(shape) {
  Canvas.selectShape(shape);
}

function selectType(type) {
  Canvas.selectType(type);
}

function selectTool(tool) {
  Canvas.selectTool(tool);
}

function updateSnapGrid() {
  Canvas.updateSnapGrid();
}

function saveLayout() {
  Canvas.save();
}

function filterBooksAdmin() {
  Books.filter();
}

function openBookModal() {
  Books.openModal();
}

function closeBookModal() {
  Books.closeModal();
}

function editBook(id) {
  Books.edit(id);
}

function deleteBook(id) {
  Books.delete(id);
}

function saveBook() {
  Books.save();
}

function filterAccounts() {
  Accounts.filter();
}

function deleteAccount(id) {
  Accounts.delete(id);
}

function updatePrice(period) {
  Pricing.update(period);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    Books.closeModal();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.updateStats();
  Books.loadList();
  Accounts.loadList();
});