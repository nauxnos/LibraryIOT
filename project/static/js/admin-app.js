// Admin credentials (in production, use proper backend authentication)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Mock data
let adminBooks = [
];

let adminAccounts = [
];

// Layout editor variables
let layoutObjects = [];
let currentShape = 'rect'; // rect, circle, roundrect
let currentType = 'table';  // table, seat
let currentTool = 'select';  // select, delete
let snapGrid = 10;
let canvas, ctx;
let isDrawing = false;
let startX, startY;
let selectedObject = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let editingBookId = null;

/* ── AUTH ── */
function adminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  
  if (user === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password) {
    document.getElementById('admin-login').classList.remove('active');
    document.getElementById('admin-dashboard').classList.add('active');
    initDashboard();
    showToast('Đăng nhập thành công!', 'success');
  } else {
    showToast('Sai tên đăng nhập hoặc mật khẩu', 'error');
  }
}

async function adminLogout() {
  await fetch("/logout");
  window.location.href = "/";
}

/* ── NAVIGATION ── */
function showSection(section) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + section).classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  event.target.closest('.nav-item').classList.add('active');
  
  if (section === 'layout') {
    setTimeout(initCanvas, 100);
  }
  else if (section === 'books') {
    updateBookList();
  }
  else if (section === 'accounts') {
    updateAccountList();
  }
}

/* ── DASHBOARD ── */
function initDashboard() {
  updateStats();
  renderBooksTable();
  renderAccountsTable();
}

function updateStats() {
  document.getElementById('stat-users').textContent = adminAccounts.length;
  document.getElementById('stat-bookings').textContent = adminAccounts.reduce((sum, a) => sum + a.bookings, 0);
  document.getElementById('stat-books').textContent = adminAccounts.reduce((sum, a) => sum + a.borrows, 0);
}

// /* ── LAYOUT EDITOR ── */
// function initCanvas() {
//   canvas = document.getElementById('layout-canvas');
//   if (!canvas) return;
  
//   ctx = canvas.getContext('2d');
  
//   loadLayout();

//   // Draw grid
//   drawGrid();
  
//   // Draw existing objects
//   redrawCanvas();
  
//   canvas.addEventListener('mousedown', handleMouseDown);
//   canvas.addEventListener('mousemove', handleMouseMove);
//   canvas.addEventListener('mouseup', handleMouseUp);
// }

// function drawGrid() {
//   ctx.strokeStyle = '#F0F0F0';
//   ctx.lineWidth = 1;
  
//   for (let x = 0; x <= canvas.width; x += 40) {
//     ctx.beginPath();
//     ctx.moveTo(x, 0);
//     ctx.lineTo(x, canvas.height);
//     ctx.stroke();
//   }
  
//   for (let y = 0; y <= canvas.height; y += 40) {
//     ctx.beginPath();
//     ctx.moveTo(0, y);
//     ctx.lineTo(canvas.width, y);
//     ctx.stroke();
//   }
// }

// function handleMouseDown(e) {
//   const rect = canvas.getBoundingClientRect();
//   startX = e.clientX - rect.left;
//   startY = e.clientY - rect.top;
//   isDrawing = true;
  
//   if (currentTool === 'delete') {
//     deleteObjectAt(startX, startY);
//   }
// }

// function handleMouseMove(e) {
//   if (!isDrawing || currentTool === 'delete') return;
  
//   const rect = canvas.getBoundingClientRect();
//   const currentX = e.clientX - rect.left;
//   const currentY = e.clientY - rect.top;
  
//   redrawCanvas();
  
//   // Preview
//   ctx.strokeStyle = '#2D5A3D';
//   ctx.lineWidth = 2;
//   ctx.setLineDash([5, 5]);
  
//   if (currentTool === 'table') {
//     ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
//   } else if (currentTool === 'seat') {
//     const radius = Math.hypot(currentX - startX, currentY - startY);
//     ctx.beginPath();
//     ctx.arc(startX, startY, radius, 0, Math.PI * 2);
//     ctx.stroke();
//   }
  
//   ctx.setLineDash([]);
// }

// function handleMouseUp(e) {
//   if (!isDrawing || currentTool === 'delete') {
//     isDrawing = false;
//     return;
//   }
  
//   const rect = canvas.getBoundingClientRect();
//   const endX = e.clientX - rect.left;
//   const endY = e.clientY - rect.top;
  
//   const width = endX - startX;
//   const height = endY - startY;
  
//   if (Math.abs(width) < 10 || Math.abs(height) < 10) {
//     isDrawing = false;
//     return;
//   }
  
//   const obj = {
//     id: Date.now(),
//     type: currentTool,
//     x: Math.min(startX, endX),
//     y: Math.min(startY, endY),
//     width: Math.abs(width),
//     height: Math.abs(height),
//   };
  
//   if (currentTool === 'seat') {
//     obj.radius = Math.hypot(width, height);
//     obj.x = startX;
//     obj.y = startY;
//   }
  
//   layoutObjects.push(obj);
//   redrawCanvas();
//   updateObjectsList();
  
//   isDrawing = false;
// }

// function redrawCanvas() {
//   ctx.clearRect(0, 0, canvas.width, canvas.height);
//   drawGrid();
  
//   layoutObjects.forEach(obj => {
//     if (obj.type === 'table') {
//       ctx.fillStyle = '#D4C9A8';
//       ctx.strokeStyle = '#A89E80';
//       ctx.lineWidth = 2;
//       ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
//       ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
      
//       ctx.fillStyle = '#6B6860';
//       ctx.font = '12px DM Sans';
//       ctx.textAlign = 'center';
//       ctx.fillText('Bàn', obj.x + obj.width / 2, obj.y + obj.height / 2 + 4);
//     } else if (obj.type === 'seat') {
//       ctx.fillStyle = '#FFFFFF';
//       ctx.strokeStyle = '#2D5A3D';
//       ctx.lineWidth = 2;
//       ctx.beginPath();
//       ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
//       ctx.fill();
//       ctx.stroke();
      
//       ctx.fillStyle = '#2D5A3D';
//       ctx.font = '10px DM Sans';
//       ctx.textAlign = 'center';
//       ctx.fillText('Ghế', obj.x, obj.y + 3);
//     }
//   });
// }

// function deleteObjectAt(x, y) {
//   const index = layoutObjects.findIndex(obj => {
//     if (obj.type === 'table') {
//       return x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height;
//     } else if (obj.type === 'seat') {
//       const dist = Math.hypot(x - obj.x, y - obj.y);
//       return dist <= obj.radius;
//     }
//     return false;
//   });
  
//   if (index > -1) {
//     layoutObjects.splice(index, 1);
//     redrawCanvas();
//     updateObjectsList();
//     showToast('Đã xóa đối tượng');
//   }
// }

// function updateObjectsList() {
//   const list = document.getElementById('objects-list');
//   if (!list) return;
  
//   if (layoutObjects.length === 0) {
//     list.innerHTML = '<p style="color:#999;font-size:13px;padding:1rem 0;text-align:center">Chưa có đối tượng nào</p>';
//     return;
//   }
  
//   list.innerHTML = layoutObjects.map((obj, i) => `
//     <div style="padding:8px;background:#f5f5f5;border-radius:6px;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
//       <span>${obj.type === 'table' ? '📊 Bàn' : '💺 Ghế'} #${i + 1}</span>
//       <div style="display:flex;gap:6px">
//         <button onclick="configObject(${obj.id})"
//           style="background:#E8F0FE;color:#1A73E8;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer">
//           Config
//         </button>
//         <button onclick="deleteObjectById(${obj.id})"
//           style="background:#FCEBEB;color:#A32D2D;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer">
//           Xóa
//         </button>
//       </div>
//     </div>
//   `).join('');
// }

// function deleteObjectById(id) {
//   layoutObjects = layoutObjects.filter(obj => obj.id !== id);
//   redrawCanvas();
//   updateObjectsList();
//   showToast('Đã xóa đối tượng');
// }

// function selectTool(tool) {
//   currentTool = tool;
//   document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
//   document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
  
//   if (canvas) {
//     canvas.style.cursor = tool === 'delete' ? 'not-allowed' : 'crosshair';
//   }
// }

// async function saveLayout() {
//   // In production, save to backend
//   localStorage.setItem('libraryLayout', JSON.stringify(layoutObjects));
//   const res = await fetch('/save-layout', {
//     method: 'POST',
//     headers: {'Content-Type': 'application/json'},
//     body: JSON.stringify(layoutObjects)
//   });
//   const result = await res.json();
//   if (result.success) {
//     showToast('Đã lưu layout thành công!', 'success');
//   } else {
//     showToast('Lỗi khi lưu layout. Vui lòng thử lại.', 'error');
//   }
// }

// function loadLayout() {
//   const saved = localStorage.getItem('libraryLayout');
  
//   if (saved) {
//     layoutObjects = JSON.parse(saved);
//     redrawCanvas();
//     updateObjectsList();
//   }
// }

/* ── LAYOUT EDITOR ── */
function initCanvas() {
  canvas = document.getElementById('layout-canvas');
  if (!canvas) return;
  
  ctx = canvas.getContext('2d');
  
  drawGrid();
  redrawCanvas();
  
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
}
 
function drawGrid() {
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
  
  // Snap grid overlay
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
}
 
function snap(value) {
  return Math.round(value / snapGrid) * snapGrid;
}
 
function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;
  startX = snap(rawX);
  startY = snap(rawY);
  
  if (currentTool === 'select') {
    selectedObject = getObjectAt(startX, startY);
    if (selectedObject) {
      isDragging = true;
      dragOffsetX = startX - selectedObject.x;
      dragOffsetY = startY - selectedObject.y;
      redrawCanvas();
    } else {
      isDrawing = true;
    }
  } else if (currentTool === 'delete') {
    deleteObjectAt(startX, startY);
  }
}
 
function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;
  const currentX = snap(rawX);
  const currentY = snap(rawY);
  
  if (isDragging && selectedObject) {
    selectedObject.x = snap(currentX - dragOffsetX);
    selectedObject.y = snap(currentY - dragOffsetY);
    redrawCanvas();
    return;
  }
  
  if (!isDrawing || currentTool === 'delete') return;
  
  redrawCanvas();
  
  // Preview
  ctx.strokeStyle = '#2D5A3D';
  ctx.fillStyle = 'rgba(45, 90, 61, 0.1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  
  const width = currentX - startX;
  const height = currentY - startY;
  
  if (currentShape === 'rect') {
    ctx.strokeRect(startX, startY, width, height);
    ctx.fillRect(startX, startY, width, height);
  } else if (currentShape === 'roundrect') {
    roundRect(ctx, startX, startY, width, height, 12, true, true);
  } else if (currentShape === 'circle') {
    const radius = Math.hypot(width, height) / 2;
    const centerX = startX + width / 2;
    const centerY = startY + height / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  ctx.setLineDash([]);
  
  // Show dimensions
  ctx.fillStyle = '#2D5A3D';
  ctx.font = 'bold 11px DM Sans';
  ctx.fillText(`${Math.abs(width)}×${Math.abs(height)}px`, currentX + 8, currentY - 8);
}
 
function handleMouseUp(e) {
  if (isDragging) {
    isDragging = false;
    updateObjectsList();
    return;
  }
  
  if (!isDrawing || currentTool === 'delete') {
    isDrawing = false;
    return;
  }
  
  const rect = canvas.getBoundingClientRect();
  const rawX = e.clientX - rect.left;
  const rawY = e.clientY - rect.top;
  const endX = snap(rawX);
  const endY = snap(rawY);
  
  const width = endX - startX;
  const height = endY - startY;
  
  if (Math.abs(width) < snapGrid * 2 || Math.abs(height) < snapGrid * 2) {
    isDrawing = false;
    redrawCanvas();
    return;
  }
  
  const obj = {
    id: Date.now(),
    shape: currentShape,
    type: currentType,
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(width),
    height: Math.abs(height),
    name: `${currentType === 'table' ? 'Bàn' : 'Ghế'}-${layoutObjects.filter(o => o.type === currentType).length + 1}`
  };
  
  if (currentShape === 'circle') {
    obj.radius = Math.hypot(width, height) / 2;
    obj.x = startX + width / 2;
    obj.y = startY + height / 2;
  }
  
  layoutObjects.push(obj);
  redrawCanvas();
  updateObjectsList();
  showToast(`Đã thêm ${obj.name}`);
  
  isDrawing = false;
}
 
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
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
}
 
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  
  layoutObjects.forEach(obj => {
    const isSelected = obj === selectedObject;
    
    // Colors
    if (obj.type === 'table') {
      ctx.fillStyle = '#D4C9A8';
      ctx.strokeStyle = isSelected ? '#2D5A3D' : '#A89E80';
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = isSelected ? '#2D5A3D' : '#6B9A7D';
    }
    
    ctx.lineWidth = isSelected ? 3 : 2;
    
    // Draw shape
    if (obj.shape === 'rect') {
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    } else if (obj.shape === 'roundrect') {
      roundRect(ctx, obj.x, obj.y, obj.width, obj.height, 12, true, true);
    } else if (obj.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    
    // Label
    ctx.fillStyle = obj.type === 'table' ? '#6B6860' : '#2D5A3D';
    ctx.font = isSelected ? 'bold 12px DM Sans' : '11px DM Sans';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const labelX = obj.shape === 'circle' ? obj.x : obj.x + obj.width / 2;
    const labelY = obj.shape === 'circle' ? obj.y : obj.y + obj.height / 2;
    
    ctx.fillText(obj.name, labelX, labelY);
    
    // Selection handles
    if (isSelected) {
      ctx.fillStyle = '#2D5A3D';
      const handleSize = 6;
      if (obj.shape === 'circle') {
        const r = obj.radius;
        [[0, -r], [r, 0], [0, r], [-r, 0]].forEach(([dx, dy]) => {
          ctx.fillRect(obj.x + dx - handleSize/2, obj.y + dy - handleSize/2, handleSize, handleSize);
        });
      } else {
        [[obj.x, obj.y], [obj.x + obj.width, obj.y], 
         [obj.x, obj.y + obj.height], [obj.x + obj.width, obj.y + obj.height]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        });
      }
    }
  });
}
 
function getObjectAt(x, y) {
  for (let i = layoutObjects.length - 1; i >= 0; i--) {
    const obj = layoutObjects[i];
    
    if (obj.shape === 'circle') {
      const dist = Math.hypot(x - obj.x, y - obj.y);
      if (dist <= obj.radius) return obj;
    } else {
      if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
        return obj;
      }
    }
  }
  return null;
}
 
function deleteObjectAt(x, y) {
  const obj = getObjectAt(x, y);
  if (obj) {
    layoutObjects = layoutObjects.filter(o => o !== obj);
    selectedObject = null;
    redrawCanvas();
    updateObjectsList();
    showToast('Đã xóa ' + obj.name);
  }
}
 
function updateObjectsList() {
  const list = document.getElementById('objects-list');
  if (!list) return;
  
  if (layoutObjects.length === 0) {
    list.innerHTML = '<p style="color:#999;font-size:13px;padding:1rem 0;text-align:center">Chưa có đối tượng nào<br><small>Chọn hình dạng và loại, sau đó vẽ trên canvas</small></p>';
    return;
  }
  
  list.innerHTML = layoutObjects.map((obj, i) => `
    <div style="padding:10px;background:${obj === selectedObject ? '#E8F2EB' : '#f5f5f5'};border:2px solid ${obj === selectedObject ? '#2D5A3D' : 'transparent'};border-radius:8px;margin-bottom:8px;cursor:pointer" onclick="selectObjectById(${obj.id})">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:500;font-size:13px">${obj.type === 'table' ? '📊' : '💺'} ${obj.name}</span>
        <button onclick="event.stopPropagation();deleteObjectById(${obj.id})" style="background:#FCEBEB;color:#A32D2D;border:none;padding:4px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:500">Xóa</button>
      </div>
      <div style="font-size:11px;color:#6B6860;display:flex;gap:12px;flex-wrap:wrap">
        <span>📐 ${obj.shape === 'circle' ? 'Tròn' : obj.shape === 'rect' ? 'Vuông' : 'Bo góc'}</span>
        <span>📍 (${obj.x}, ${obj.y})</span>
        ${obj.shape === 'circle' ? `<span>⭕ r=${Math.round(obj.radius)}</span>` : `<span>📏 ${obj.width}×${obj.height}</span>`}
      </div>
      <input type="text" value="${obj.name}" onchange="renameObject(${obj.id}, this.value)" onclick="event.stopPropagation()"
        style="width:100%;margin-top:6px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px" 
        placeholder="Đặt tên..."/>
    </div>
  `).join('');
}
 
function selectObjectById(id) {
  selectedObject = layoutObjects.find(o => o.id === id);
  redrawCanvas();
  updateObjectsList();
}
 
function deleteObjectById(id) {
  const obj = layoutObjects.find(o => o.id === id);
  layoutObjects = layoutObjects.filter(o => o.id !== id);
  selectedObject = null;
  redrawCanvas();
  updateObjectsList();
  if (obj) showToast('Đã xóa ' + obj.name);
}
 
function renameObject(id, newName) {
  const obj = layoutObjects.find(o => o.id === id);
  if (obj) {
    obj.name = newName.trim() || obj.name;
    redrawCanvas();
  }
}
 
function selectShape(shape) {
  currentShape = shape;
  document.querySelectorAll('[data-shape]').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-shape="${shape}"]`).classList.add('active');
}
 
function selectType(type) {
  currentType = type;
  document.querySelectorAll('[data-type]').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-type="${type}"]`).classList.add('active');
}
 
function selectTool(tool) {
  currentTool = tool;
  selectedObject = null;
  document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
  const btn = document.querySelector(`[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');
  
  if (canvas) {
    canvas.style.cursor = tool === 'delete' ? 'not-allowed' : tool === 'select' ? 'default' : 'crosshair';
  }
  redrawCanvas();
}
 
function updateSnapGrid() {
  snapGrid = parseInt(document.getElementById('snap-grid').value);
  redrawCanvas();
  showToast(`Snap grid: ${snapGrid}px`);
}
 
function saveLayout() {
  const data = {
    objects: layoutObjects,
    snapGrid: snapGrid,
    canvasSize: { width: canvas.width, height: canvas.height }
  };
  localStorage.setItem('libraryLayout', JSON.stringify(data));
  showToast('Đã lưu layout thành công!', 'success');
  console.log('Saved layout:', data);
}

/* ── BOOKS MANAGEMENT ── */
function renderBooksTable() {
  const tbody = document.getElementById('books-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = adminBooks.map(book => `
    <tr>
      <td><strong>${book.title}</strong></td>
      <td>${book.author}</td>
      <td><span class="badge ${book.status ? 'success' : 'danger'}">${book.status ? 'Có thể mượn' : 'Không thể mượn'}</span></td>
      <td>${book.borrowedCount} lượt</td>
      <td>
        <button class="action-btn edit" onclick="editBook(${book.id})">✏️ Sửa</button>
        <button class="action-btn delete" onclick="deleteBook(${book.id})">🗑️ Xóa</button>
      </td>
    </tr>
  `).join('');
}

function filterBooksAdmin() {
  const query = document.getElementById('book-search').value.toLowerCase();
  const rows = document.querySelectorAll('#books-table-body tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

function openBookModal() {
  editingBookId = null;
  document.getElementById('book-modal-title').textContent = 'Thêm Sách Mới';
  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-modal').classList.add('active');
}

function closeBookModal() {
  document.getElementById('book-modal').classList.remove('active');
}

async function editBook(id) {
  console.log('Editing book with ID:', id);
  const book = adminBooks.find(b => b.id === id);
  if (!book) return;
  
  editingBookId = id;
  document.getElementById('book-modal-title').textContent = 'Sửa Thông Tin Sách';
  document.getElementById('book-title').value = book.title;
  document.getElementById('book-author').value = book.author;
  document.getElementById('book-modal').classList.add('active');
}

async function deleteBook(id) {
  if (!confirm('Bạn có chắc muốn xóa sách này?')) return;
  
  const res = await fetch('/delete-book', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id })
  });
  const result = await res.json();
  if (!result.success) {
    showToast('Lỗi khi xóa sách. Vui lòng thử lại.', 'error');
    return;
  }

  updateBookList();
  renderBooksTable();
  showToast('Đã xóa sách thành công!', 'success');
}

async function saveBook() {
  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  
  if (!title || !author) {
    showToast('Vui lòng điền đầy đủ thông tin', 'error');
    return;
  }
  console.log('Saving book:', { id: editingBookId, title, author });
  
  if (editingBookId === null){
    const res = await fetch('/add-book', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title, author })
    });
    const result = await res.json();
    if (!result.success) {
      showToast('Lỗi khi thêm sách. Vui lòng thử lại.', 'error');
      return;
    }
    showToast('Đã thêm sách mới!', 'success');
  }
  else 
  {
    const res = await fetch('/edit-book', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id: editingBookId, title, author })
    });
    const result = await res.json();
    if (!result.success) {
      showToast('Lỗi khi cập nhật sách. Vui lòng thử lại.', 'error');
      return;
    }
    showToast('Đã cập nhật thông tin sách!', 'success');
  }
  
  updateBookList();
  renderBooksTable();
  closeBookModal();
}

/* ── PRICING ── */
function updatePrice(period) {
  const input = document.getElementById('price-' + period);
  const value = parseInt(input.value);
  
  if (isNaN(value) || value < 0) {
    showToast('Giá không hợp lệ', 'error');
    return;
  }
  
  // In production, save to backend
  localStorage.setItem('price-' + period, value);
  showToast(`Đã cập nhật giá khung ${period === 'morning' ? 'sáng' : period === 'afternoon' ? 'chiều' : 'tối'}!`, 'success');
}

/* ── ACCOUNTS MANAGEMENT ── */
function renderAccountsTable() {
  const tbody = document.getElementById('accounts-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = adminAccounts.map(acc => `
    <tr>
      <td>#${acc.id}</td>
      <td><strong>${acc.name}</strong></td>
      <td>${acc.email}</td>
      <td>${acc.created}</td>
      <td>${acc.bookings}</td>
      <td>${acc.borrows}</td>
      <td>
        <button class="action-btn delete" onclick="deleteAccount(${acc.id})">🗑️ Xóa</button>
      </td>
    </tr>
  `).join('');
}

function filterAccounts() {
  const query = document.getElementById('account-search').value.toLowerCase();
  const rows = document.querySelectorAll('#accounts-table-body tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

// function viewAccount(id) {
//   const acc = adminAccounts.find(a => a.id === id);
//   if (!acc) return;
  
//   alert(`Thông tin tài khoản:\n\nHọ tên: ${acc.name}\nEmail: ${acc.email}\nNgày tạo: ${acc.created}\nĐặt chỗ: ${acc.bookings}\nMượn sách: ${acc.borrows}\nTrạng thái: ${acc.status}`);
// }

async function deleteAccount(id) {
  if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
  
  const res = await fetch('/delete-account', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id })
  });
  const result = await res.json();
  if (!result.success) {
    showToast('Lỗi khi xóa tài khoản. Vui lòng thử lại.', 'error');
    return;
  }
  updateAccountList();
  renderAccountsTable();
  updateStats();
  showToast('Đã xóa tài khoản!', 'success');
}

/* ── TOAST ── */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show';
  if (type) toast.classList.add(type);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.className = 'toast', 300);
  }, 3000);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeBookModal();
  }
});

async function updateBookList() {
  const res = await fetch('/get-booklist');
  const books = await res.json();
  adminBooks = books;
  renderBooksTable();
}

async function updateAccountList() {
  const res = await fetch('/get-accountlist');
  const accounts = await res.json();
  adminAccounts = accounts;
  renderAccountsTable();
}