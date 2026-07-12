

function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

function doLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  var role = document.getElementById('loginRole').value;
  var errEl = document.getElementById('loginError');

  if (!email || !password) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.remove('hidden');
    return;
  }

  var users = JSON.parse(localStorage.getItem('quizcraft_users') || '[]');
  var found = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email && users[i].password === password && users[i].role === role) {
      found = users[i];
      break;
    }
  }

  if (!found) {
    errEl.textContent = 'Invalid email, password, or role.';
    errEl.classList.remove('hidden');
    return;
  }


  localStorage.setItem('quizcraft_session', JSON.stringify({ name: found.name, email: found.email, role: found.role }));
  errEl.classList.add('hidden');

  if (role === 'teacher') {
    window.location.href = 'teacher_dashboard.html';
  } else {

    window.location.href = 'contact.html';
  }
}

function doRegister() {
  var name = document.getElementById('regName').value.trim();
  var email = document.getElementById('regEmail').value.trim();
  var password = document.getElementById('regPassword').value;
  var role = document.getElementById('regRole').value;
  var errEl = document.getElementById('registerError');
  var okEl = document.getElementById('registerSuccess');

  errEl.classList.add('hidden');
  okEl.classList.add('hidden');

  if (!name || !email || !password) {
    errEl.textContent = 'Please fill in all fields.';
    errEl.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.classList.remove('hidden');
    return;
  }

  var users = JSON.parse(localStorage.getItem('quizcraft_users') || '[]');
  for (var i = 0; i < users.length; i++) {
    if (users[i].email === email) {
      errEl.textContent = 'An account with this email already exists.';
      errEl.classList.remove('hidden');
      return;
    }
  }

  users.push({ name: name, email: email, password: password, role: role });
  localStorage.setItem('quizcraft_users', JSON.stringify(users));

  okEl.classList.remove('hidden');

  setTimeout(function() { switchTab('login'); }, 1200);
}
