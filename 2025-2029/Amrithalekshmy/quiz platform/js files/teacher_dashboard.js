

var session = JSON.parse(localStorage.getItem('quizcraft_session') || 'null');
if (!session || session.role !== 'teacher') {
  window.location.href = 'login.html';
}

document.getElementById('teacherName').textContent = session.name;
document.getElementById('greetName').textContent   = session.name.split(' ')[0];

function logout() {
  localStorage.removeItem('quizcraft_session');
  window.location.href = 'login.html';
}

function loadQuizList() {
  var quizzes    = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
  var mine       = quizzes.filter(function(q) { return q.teacherEmail === session.email; });
  var allResults = JSON.parse(localStorage.getItem('quizcraft_results') || '[]');
  var myIds      = mine.map(function(q) { return q.id; });
  var myResults  = allResults.filter(function(r) { return myIds.indexOf(r.quizId) !== -1; });


  document.getElementById('statQuizzes').textContent  = mine.length;
  document.getElementById('statAttempts').textContent = myResults.length;

  if (myResults.length > 0) {
    var sum = myResults.reduce(function(acc, r) { return acc + (r.percent || 0); }, 0);
    document.getElementById('statAvg').textContent = Math.round(sum / myResults.length) + '%';
  } else {
    document.getElementById('statAvg').textContent = '—';
  }

  var emptyMsg  = document.getElementById('emptyMsg');
  var cardsGrid = document.getElementById('quizCardsGrid');
  var tableWrap = document.getElementById('tableWrap');
  var tbody     = document.getElementById('quizTableBody');

  if (mine.length === 0) {
    emptyMsg.classList.remove('hidden');
    cardsGrid.classList.add('hidden');
    tableWrap.classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  if (mine.length <= 9) {
    tableWrap.classList.add('hidden');
    cardsGrid.classList.remove('hidden');
    cardsGrid.innerHTML = '';

    mine.forEach(function(quiz) {
      var dateStr  = new Date(quiz.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      var attempts = allResults.filter(function(r) { return r.quizId === quiz.id; }).length;

      var card = document.createElement('div');
      card.className = 'quiz-item-card';
      card.innerHTML =
        '<div class="qic-header">' +
          '<div class="qic-title">' + quiz.title + '</div>' +
          '<div class="qic-date">' + dateStr + '</div>' +
        '</div>' +
        '<div class="qic-meta">' +
          '<span class="qic-tag">📝 ' + quiz.questions.length + ' Qs</span>' +
          '<span class="qic-tag">⏱ ' + quiz.timer + ' min</span>' +
          '<span class="qic-tag">👥 ' + attempts + ' attempts</span>' +
        '</div>' +
        '<div class="qic-actions">' +
          '<button class="btn-sm btn-link"   onclick="copyLink(\'' + quiz.id + '\')">Copy Link</button>' +
          '<button class="btn-sm btn-stats"  onclick="viewStats(\'' + quiz.id + '\')">Stats</button>' +
          '<button class="btn-sm btn-delete" onclick="deleteQuiz(\'' + quiz.id + '\')">Delete</button>' +
        '</div>';

      cardsGrid.appendChild(card);
    });

  } else {
    cardsGrid.classList.add('hidden');
    tableWrap.classList.remove('hidden');
    tbody.innerHTML = '';

    mine.forEach(function(quiz) {
      var tr       = document.createElement('tr');
      var dateStr  = new Date(quiz.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      var attempts = allResults.filter(function(r) { return r.quizId === quiz.id; }).length;

      tr.innerHTML =
        '<td>' + quiz.title + '</td>' +
        '<td>' + quiz.questions.length + '</td>' +
        '<td>' + quiz.timer + ' min</td>' +
        '<td>' + attempts + '</td>' +
        '<td>' + dateStr + '</td>' +
        '<td class="td-actions">' +
          '<button class="btn-sm btn-link"   onclick="copyLink(\'' + quiz.id + '\')">Copy Link</button>' +
          '<button class="btn-sm btn-stats"  onclick="viewStats(\'' + quiz.id + '\')">Stats</button>' +
          '<button class="btn-sm btn-delete" onclick="deleteQuiz(\'' + quiz.id + '\')">Delete</button>' +
        '</td>';

      tbody.appendChild(tr);
    });
  }
}

function copyLink(id) {
  var link = window.location.origin +
    window.location.pathname.replace('teacher_dashboard.html', '') +
    'student_view.html?quiz=' + id;
  navigator.clipboard.writeText(link).then(function() {
    alert('Link copied!\n\n' + link);
  }).catch(function() {
    prompt('Copy this link:', link);
  });
}

function viewStats(id) {
  window.location.href = 'quiz_stats.html?quiz=' + id;
}

function deleteQuiz(id) {
  if (!confirm('Delete this quiz? This cannot be undone.')) return;
  var quizzes = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
  quizzes = quizzes.filter(function(q) { return q.id !== id; });
  localStorage.setItem('quizcraft_quizzes', JSON.stringify(quizzes));
  loadQuizList();
}

loadQuizList();
