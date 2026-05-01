function switchTab(t){
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',i===(t==='login'?0:1)));
  document.getElementById('form-login').classList.toggle('active',t==='login');
  document.getElementById('form-signup').classList.toggle('active',t==='signup');
  document.getElementById('login-hint').innerHTML=t==='login'?'Chưa có tài khoản? <a href="#" onclick="switchTab(\'signup\');return false" style="color:#2D5A3D">Đăng ký ngay</a>':'Đã có tài khoản? <a href="#" onclick="switchTab(\'login\');return false" style="color:#2D5A3D">Đăng nhập</a>';
}

async function doLogin(){
  const e=document.getElementById('l-email').value;
  const p=document.getElementById('l-pass').value;
  if(!e||!p){showToast('Vui lòng điền đầy đủ thông tin');return;}
  if(e.includes('@')){showToast('Chào mừng trở lại!');}
  else showToast('Email không hợp lệ');
  const res = await fetch('/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ email: e, password: p })
  });

  const data = await res.json();
  if (data.success) {
    showToast('Đăng nhập thành công!');
    window.location.href = data.redirect;
  } else {
    showToast('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
  }
}

async function doSignup(){
  const n=document.getElementById('s-name').value;
  const e=document.getElementById('s-email').value;
  const p=document.getElementById('s-pass').value;
  if(!n||!e||!p){showToast('Vui lòng điền đầy đủ thông tin');return;}
  if(!e.includes('@')){showToast('Email không hợp lệ');return;}
  const res = await fetch('/signup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ name: n, email: e, password: p })
  });

  const data = await res.json();
  if (data.success) {
    showToast('Tạo tài khoản thành công!');
    window.location.href = data.redirect;
  } else {
    let errorMsg;
    switch(data.error){
      case 'EmailExists': errorMsg = 'Email đã tồn tại. Vui lòng sử dụng email khác.'; break;
      default:
        errorMsg = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    }
    showToast(errorMsg);
  }
}

function showToast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

document.getElementById("loginform").addEventListener("submit", function(e){
  e.preventDefault();   // 🔥 chặn reload + tránh gọi 2 lần
  doLogin();            // 👉 chỉ gọi 1 lần
});