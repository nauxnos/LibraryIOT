const TAKEN=[3,7,11,15,19,23,28,33,37,41,45,49,52,55,60];
let selectedSeat=null;
let userName;

const myBookings=[];
const myBorrows=[];
const books=[];

const canvas = document.getElementById("layout-canvas");
const ctx = canvas.getContext("2d");

function renderLayout(data) {
  console.log('Rendering layout with data:', data);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  data.objects.forEach(obj => {
    console.log('Rendering object:', obj);
    if (obj.shape === "rect") {
      // vẽ bàn
      ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

      // vẽ tên
      ctx.font = "12px Arial";
      ctx.fillText(obj.name, obj.x + 5, obj.y + 15);
    }
  });
}

function switchTab(t){
  console.log('Switching to tab:',t);
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',i===(t==='login'?0:1)));
  document.getElementById('form-login').classList.toggle('active',t==='login');
  document.getElementById('form-signup').classList.toggle('active',t==='signup');
  document.getElementById('login-hint').innerHTML=t==='login'?'Chưa có tài khoản? <a href="#" onclick="switchTab(\'signup\');return false" style="color:#2D5A3D">Đăng ký ngay</a>':'Đã có tài khoản? <a href="#" onclick="switchTab(\'login\');return false" style="color:#2D5A3D">Đăng nhập</a>';
}

function doLogin(){
  const e=document.getElementById('l-email').value;
  const p=document.getElementById('l-pass').value;
  if(!e||!p){showToast('Vui lòng điền đầy đủ thông tin');return;}
  if(e.includes('@')){enterApp();showToast('Chào mừng trở lại!');}
  else showToast('Email không hợp lệ');
}

function doSignup(){
  const n=document.getElementById('s-name').value;
  const e=document.getElementById('s-email').value;
  const p=document.getElementById('s-pass').value;
  if(!n||!e||!p){showToast('Vui lòng điền đầy đủ thông tin');return;}
  userName=n;
  const initials=n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('avatar-btn').textContent=initials;
  document.querySelector('.dropdown-header strong').textContent=n;
  document.querySelector('.dropdown-header span').textContent=e;
  enterApp();showToast('Tạo tài khoản thành công!');
}

function enterApp(){
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  data = {"objects":[{"id":1777612496001,"shape":"roundrect","type":"table","x":250,"y":90,"width":180,"height":220,"name":"Bàn-1"},{"id":1777612503688,"shape":"rect","type":"seat","x":190,"y":100,"width":40,"height":40,"name":"Ghế-1"},{"id":1777612506520,"shape":"rect","type":"seat","x":190,"y":170,"width":40,"height":40,"name":"Ghế-2"},{"id":1777612510183,"shape":"rect","type":"seat","x":190,"y":240,"width":40,"height":40,"name":"Ghế-3"},{"id":1777612515076,"shape":"rect","type":"seat","x":450,"y":100,"width":40,"height":40,"name":"Ghế-4"},{"id":1777612518157,"shape":"rect","type":"seat","x":450,"y":170,"width":40,"height":40,"name":"Ghế-5"},{"id":1777612529053,"shape":"rect","type":"seat","x":450,"y":240,"width":40,"height":40,"name":"Ghế-6"}],"snapGrid":10,"canvasSize":{"width":800,"height":500}}
  renderLayout(data);
  console.log('Layout rendered');
  buildSeats();buildBooks();
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('book-date').value=today;
}

function buildSeats(){
  const g=document.getElementById('seats-grid');g.innerHTML='';
  const rows=['A','B','C','D','E','F','G','H'];
  let idx=0;
  rows.forEach(r=>{
    for(let c=1;c<=8;c++){
      idx++;
      const s=document.createElement('button');
      s.className='seat'+(TAKEN.includes(idx)?' taken':'');
      s.textContent=r+'-'+String(c).padStart(2,'0');
      s.dataset.id=r+'-'+String(c).padStart(2,'0');
      if(!TAKEN.includes(idx))s.onclick=()=>selectSeat(s);
      g.appendChild(s);
    }
  });
}

function selectSeat(el){
  document.querySelectorAll('.seat.selected').forEach(s=>s.classList.remove('selected'));
  el.classList.add('selected');
  selectedSeat=el.dataset.id;
  document.getElementById('selected-info').textContent='Đã chọn: Chỗ '+selectedSeat+' — Tầng 2, Khu yên tĩnh';
}

function confirmBooking(){
  if(!selectedSeat){showToast('Vui lòng chọn chỗ ngồi');return;}
  const d=document.getElementById('book-date').value;
  const t=document.getElementById('book-time').value;
  if(!d){showToast('Vui lòng chọn ngày');return;}
  showToast('Đặt chỗ '+selectedSeat+' thành công!');
  myBookings.push({seat:selectedSeat,date:d.split('-').reverse().join('/'),time:t});
  document.querySelectorAll('.seat.selected').forEach(s=>s.classList.remove('selected'));
  selectedSeat=null;
  document.getElementById('selected-info').textContent='Vui lòng chọn một chỗ ngồi từ sơ đồ';
}

function buildBooks(){
  const g=document.getElementById('books-grid');g.innerHTML='';
  books.forEach((b,i)=>{
    const card=document.createElement('div');
    card.className='book-card';
    card.dataset.title=b.title.toLowerCase();
    card.dataset.author=b.author.toLowerCase();
    card.innerHTML=`<div class="book-cover" style="background:${['#EAF3DE','#E6F1FB','#FAEEDA','#FBEAF0','#E1F5EE','#FAECE7','#EEEDFE','#EAF3DE'][i%8]}">${b.emoji}</div>
<div class="book-info">
  <div class="book-title">${b.title}</div>
  <div class="book-author">${b.author}</div>
  <span class="book-status ${b.avail?'avail':'out'}">${b.avail?'Còn sách':'Đã mượn hết'}</span>
  <button class="btn-borrow" ${b.avail?'':'disabled'} onclick="borrowBook('${b.title}',${i})">${b.avail?'Mượn sách':'Không khả dụng'}</button>
</div>`;
    g.appendChild(card);
  });
}

function borrowBook(title,i){
  if(!books[i].avail)return;
  books[i].avail=false;
  const due=new Date();due.setDate(due.getDate()+14);
  const dueStr=due.toLocaleDateString('vi-VN');
  myBorrows.push({title,author:books[i].author,due:dueStr});
  buildBooks();
  filterBooks();
  showToast('Đã mượn "'+title+'" — hạn trả '+dueStr);
}

function filterBooks(){
  const q=document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(c=>{
    c.style.display=(c.dataset.title.includes(q)||c.dataset.author.includes(q))?'':'none';
  });
}

function switchPage(p){
  document.querySelectorAll('.page-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.getElementById('nav-seat').classList.toggle('active',p==='seat');
  document.getElementById('nav-book').classList.toggle('active',p==='book');
}

function toggleDropdown(){
  document.getElementById('dropdown').classList.toggle('open');
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.nav-right'))document.getElementById('dropdown').classList.remove('open');
});

// function openManage(type){
//   closeDropdown();
//   const overlay=document.getElementById('modal-overlay');
//   const body=document.getElementById('modal-body');
//   const title=document.getElementById('modal-title-text');
//   if(type==='seats'){
//     title.textContent='Chỗ ngồi đã đặt';
//     body.innerHTML=myBookings.length?myBookings.map(b=>`<div class="manage-item"><div class="manage-info"><strong>Chỗ ${b.seat}</strong><span>${b.date} · ${b.time}</span></div><button class="btn-cancel" onclick="cancelBooking('${b.seat}')">Hủy đặt</button></div>`).join(''):'<p style="color:var(--muted);font-size:14px;text-align:center;padding:2rem 0">Bạn chưa có đặt chỗ nào</p>';
//   }else if(type==='books'){
//     title.textContent='Sách đang mượn';
//     body.innerHTML=myBorrows.length?myBorrows.map(b=>`<div class="manage-item"><div class="manage-info"><strong>${b.title}</strong><span>${b.author} · Hạn trả: ${b.due}</span></div><button class="btn-cancel" onclick="returnBook('${b.title}')">Trả sách</button></div>`).join(''):'<p style="color:var(--muted);font-size:14px;text-align:center;padding:2rem 0">Bạn chưa mượn sách nào</p>';
//   }else{
//     title.textContent='Sửa thông tin';
//     body.innerHTML=`<div class="form-group" style="margin-bottom:1rem"><label style="font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Họ và tên</label><input type="text" class="input-field" value="${userName}"/></div><div class="form-group" style="margin-bottom:1rem"><label style="font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Email</label><input type="email" class="input-field" value="nguyen@email.com"/></div><div class="form-group" style="margin-bottom:1.5rem"><label style="font-size:12px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Mật khẩu mới</label><input type="password" class="input-field" placeholder="Để trống nếu không đổi"/></div><button class="btn-book" onclick="showToast('Đã lưu thông tin!');closeModal()">Lưu thay đổi</button>`;
//   }
//   overlay.classList.add('open');
// }

function openManage(type){
  closeDropdown();

  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title-text');

  if(type === 'seats'){
    title.textContent = 'Chỗ ngồi đã đặt';
    body.innerHTML = renderSeats();
  }
  else if(type === 'books'){
    title.textContent = 'Sách đang mượn';
    body.innerHTML = renderBooks();
  }
  else{
    title.textContent = 'Sửa thông tin';
    body.innerHTML = renderProfile();
  }

  overlay.classList.add('open');
}

function renderSeats(){
  if(!myBookings.length){
    return `<p class="empty">Bạn chưa có đặt chỗ nào</p>`;
  }

  return myBookings.map(b => `
    <div class="manage-item">
      <div class="manage-info">
        <strong>Chỗ ${b.seat}</strong>
        <span>${b.date} · ${b.time}</span>
      </div>
      <button class="btn-cancel" onclick="cancelBooking('${b.seat}')">
        Hủy
      </button>
    </div>
  `).join('');
}

function renderBooks(){
  if(!myBorrows.length){
    return `<p class="empty">Bạn chưa mượn sách nào</p>`;
  }
  return myBorrows.map(b => `
    <div class="manage-item">
      <div class="manage-info">
        <strong>${b.title}</strong>
        <span>${b.author} · Hạn trả: ${b.due}</span>
      </div>
      <button class="btn-cancel" onclick="returnBook('${b.title}')">
        Trả sách
      </button>
    </div>
  `).join('');
}

function renderProfile(){
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

    <button class="btn-book" onclick="saveProfile()">Lưu thay đổi</button>
  `;
}

async function saveProfile(){
  userName = document.querySelector('#user-name').value || userName;
  userEmail = document.querySelector('#user-email').value || userEmail;
  password = document.querySelector('#user-password').value;

  const res = await fetch('/update-profile', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      name: userName,
      email: userEmail,
      password: password
    })
  });

  const data = await res.json();
  if (data.success) {
      CURRENT_USER.name = userName;
      CURRENT_USER.email = userEmail;
      showToast('Cập nhật thông tin thành công!');
      closeModal();
  } else {
      showToast('Cập nhật thông tin thất bại. Vui lòng thử lại.');
  }  
  showToast('Đã lưu thông tin!');
  closeModal();
}

function cancelBooking(seat){
  const i=myBookings.findIndex(b=>b.seat===seat);
  if(i>-1)myBookings.splice(i,1);
  openManage('seats');showToast('Đã hủy chỗ '+seat);
}

function returnBook(title){
  const i=myBorrows.findIndex(b=>b.title===title);
  if(i>-1)myBorrows.splice(i,1);
  const bi=books.findIndex(b=>b.title===title);
  if(bi>-1){books[bi].avail=true;buildBooks();filterBooks();}
  openManage('books');showToast('Đã trả "'+title+'" thành công!');
}

function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function closeDropdown(){document.getElementById('dropdown').classList.remove('open');}
async function doLogout()
{
  closeDropdown();
  await fetch("/logout");
  window.location.href = "/";
}

function showToast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
