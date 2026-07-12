// personalisation.js

var session = JSON.parse(localStorage.getItem('quizcraft_session') || 'null');
if (!session || session.role !== 'teacher') {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('quizcraft_session');
  window.location.href = 'login.html';
}


document.getElementById('shuffleToggle').addEventListener('change', function() {
  document.getElementById('shuffleLabel').textContent = this.checked
    ? 'Yes – questions will be shuffled'
    : 'No – fixed order';
});

document.getElementById('showAnswersToggle').addEventListener('change', function() {
  document.getElementById('showAnswersLabel').textContent = this.checked
    ? 'Yes – correct answers shown after submission'
    : 'No – only show score';
});

function saveAndProceed() {
  var title = document.getElementById('quizTitle').value.trim();
  var subject = document.getElementById('quizSubject').value.trim();
  var numQ = parseInt(document.getElementById('numQuestions').value);
  var timer = parseInt(document.getElementById('timerMins').value);
  var marksCorrect = parseFloat(document.getElementById('marksCorrect').value) || 2;
  var marksNeg = parseFloat(document.getElementById('marksNegative').value) || 0;
  var shuffle = document.getElementById('shuffleToggle').checked;
  var showAns = document.getElementById('showAnswersToggle').checked;

  var errEl = document.getElementById('settingsError');
  errEl.classList.add('hidden');

  if (!title || isNaN(numQ) || isNaN(timer) || numQ < 1 || timer < 1) {
    errEl.textContent = 'Please fill in all required fields with valid values.';
    errEl.classList.remove('hidden');
    return;
  }


  var draft = {
    title: title,
    subject: subject,
    numQuestions: numQ,
    timer: timer,
    marksCorrect: marksCorrect,
    marksNegative: marksNeg,
    shuffle: shuffle,
    showAnswers: showAns,
    teacherEmail: session.email,
    teacherName: session.name
  };

  localStorage.setItem('quizcraft_draft', JSON.stringify(draft));
  window.location.href = 'add_questions.html';
}
