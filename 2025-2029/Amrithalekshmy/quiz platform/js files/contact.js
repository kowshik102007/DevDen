

var session = JSON.parse(localStorage.getItem('quizcraft_session') || 'null');

if (session) {
  document.getElementById('loginNavLink').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  if (session.role === 'teacher') {
    document.getElementById('dashNavLink').classList.remove('hidden');
  }
} else {
  document.getElementById('loginNavLink').classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('quizcraft_session');
  window.location.href = 'login.html';
}

function sendMessage() {
  var name = document.getElementById('contactName').value.trim();
  var email = document.getElementById('contactEmail').value.trim();
  var msg = document.getElementById('contactMsg').value.trim();

  if (!name || !email || !msg) {
    alert('Please fill in all fields.');
    return;
  }


  document.getElementById('sentMsg').classList.remove('hidden');
  document.getElementById('contactName').value = '';
  document.getElementById('contactEmail').value = '';
  document.getElementById('contactMsg').value = '';

  setTimeout(function() {
    document.getElementById('sentMsg').classList.add('hidden');
  }, 4000);
}
