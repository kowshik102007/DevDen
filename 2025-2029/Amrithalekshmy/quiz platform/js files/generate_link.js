

var session = JSON.parse(localStorage.getItem('quizcraft_session') || 'null');
if (!session || session.role !== 'teacher') {
  window.location.href = 'login.html';
}

function logout() {
  localStorage.removeItem('quizcraft_session');
  window.location.href = 'login.html';
}


function getParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

var quizId = getParam('quiz');
if (!quizId) {
  window.location.href = 'teacher_dashboard.html';
}

var quizzes = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
var quiz = null;
for (var i = 0; i < quizzes.length; i++) {
  if (quizzes[i].id === quizId) {
    quiz = quizzes[i];
    break;
  }
}

if (!quiz) {
  window.location.href = 'teacher_dashboard.html';
}


var baseUrl = window.location.href.replace(/generate_link\.html.*/, '');
var studentLink = baseUrl + 'student_view.html?quiz=' + quizId;

document.getElementById('quizTitleDisplay').textContent = '🎉 "' + quiz.title + '" is ready!';
document.getElementById('quizMeta').textContent =
  quiz.questions.length + ' questions · ' + quiz.timer + ' min · Created by ' + quiz.teacherName;

document.getElementById('linkInput').value = studentLink;


var infoGrid = document.getElementById('quizInfoGrid');
var infoItems = [
  { label: 'Title', value: quiz.title },
  { label: 'Subject', value: quiz.subject || '—' },
  { label: 'Questions', value: quiz.questions.length },
  { label: 'Time Limit', value: quiz.timer + ' minutes' },
  { label: 'Marks / Correct', value: quiz.marksCorrect },
  { label: 'Negative Marking', value: quiz.marksNegative > 0 ? '-' + quiz.marksNegative : 'None' },
  { label: 'Shuffle', value: quiz.shuffle ? 'Yes' : 'No' },
  { label: 'Show Answers', value: quiz.showAnswers ? 'After submit' : 'No' }
];

infoItems.forEach(function(item) {
  var div = document.createElement('div');
  div.className = 'info-item';
  div.innerHTML = '<div class="info-label">' + item.label + '</div><div class="info-value">' + item.value + '</div>';
  infoGrid.appendChild(div);
});

function copyLink() {
  var input = document.getElementById('linkInput');
  var confirm = document.getElementById('copyConfirm');

  navigator.clipboard.writeText(input.value).then(function() {
    document.getElementById('copyBtn').textContent = 'Copied!';
    confirm.classList.remove('hidden');
    setTimeout(function() {
      document.getElementById('copyBtn').textContent = 'Copy';
      confirm.classList.add('hidden');
    }, 2500);
  }).catch(function() {
    // fallback
    input.select();
    document.execCommand('copy');
    confirm.classList.remove('hidden');
    setTimeout(function() { confirm.classList.add('hidden'); }, 2500);
  });
}
