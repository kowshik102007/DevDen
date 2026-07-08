

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

var allQuizzes = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
var myQuizzes = allQuizzes.filter(function(q) { return q.teacherEmail === session.email; });

if (!quizId) {

  document.getElementById('statsTitle').textContent = 'Quiz Statistics';
  document.getElementById('statsSubtitle').textContent = 'Select a quiz to view results.';
  document.getElementById('quizPickSection').classList.remove('hidden');
  document.querySelector('.table-section').classList.add('hidden');

  var pickList = document.getElementById('quizPickList');

  if (myQuizzes.length === 0) {
    pickList.innerHTML = '<p style="color:#aaa;font-size:0.9rem;">No quizzes found.</p>';
  } else {
    myQuizzes.forEach(function(q) {
      var div = document.createElement('div');
      div.className = 'quiz-pick-card';
      div.innerHTML =
        '<div>' +
          '<div class="quiz-pick-title">' + q.title + '</div>' +
          '<div class="quiz-pick-meta">' + q.questions.length + ' questions · ' + q.timer + ' min</div>' +
        '</div>' +
        '<span class="pick-arrow">→</span>';
      div.onclick = function() {
        window.location.href = 'quiz_stats.html?quiz=' + q.id;
      };
      pickList.appendChild(div);
    });
  }

} else {

  var quiz = null;
  for (var i = 0; i < allQuizzes.length; i++) {
    if (allQuizzes[i].id === quizId) { quiz = allQuizzes[i]; break; }
  }

  if (!quiz) {
    document.getElementById('statsTitle').textContent = 'Quiz not found.';
    document.getElementById('statsSubtitle').textContent = '';
  } else {
    document.getElementById('statsTitle').textContent = quiz.title + ' – Results';
    document.getElementById('statsSubtitle').textContent = quiz.questions.length + ' questions · ' + quiz.timer + ' min · ' + quiz.subject;

    var allResults = JSON.parse(localStorage.getItem('quizcraft_results') || '[]');
    var results = allResults.filter(function(r) { return r.quizId === quizId; });


    var totalAttempts = results.length;
    var avgScore = 0;
    var highest = 0;
    var passCount = 0;

    if (totalAttempts > 0) {
      var sumPercent = 0;
      results.forEach(function(r) {
        sumPercent += r.percent;
        if (r.percent > highest) highest = r.percent;
        if (r.percent >= 40) passCount++;
      });
      avgScore = Math.round(sumPercent / totalAttempts);
    }

    var summaryGrid = document.getElementById('summaryGrid');
    var summaryItems = [
      { label: 'Total Attempts', value: totalAttempts },
      { label: 'Average Score', value: avgScore + '%' },
      { label: 'Highest Score', value: highest + '%' },
      { label: 'Pass Rate', value: totalAttempts > 0 ? Math.round((passCount/totalAttempts)*100) + '%' : '—' }
    ];

    summaryItems.forEach(function(item) {
      var div = document.createElement('div');
      div.className = 'summary-card';
      div.innerHTML = '<div class="summary-label">' + item.label + '</div><div class="summary-value">' + item.value + '</div>';
      summaryGrid.appendChild(div);
    });


    if (results.length === 0) {
      document.getElementById('noResultsMsg').classList.remove('hidden');
    } else {
      var table = document.getElementById('statsTable');
      table.classList.remove('hidden');
      var tbody = document.getElementById('statsTableBody');


      var sorted = results.slice().sort(function(a, b) { return b.percent - a.percent; });

      sorted.forEach(function(r, idx) {
        var tr = document.createElement('tr');
        var gradeClass = 'grade-d';
        if (r.rank === 'A+') gradeClass = 'grade-a-plus';
        else if (r.rank === 'A') gradeClass = 'grade-a';
        else if (r.rank === 'B') gradeClass = 'grade-b';
        else if (r.rank === 'C') gradeClass = 'grade-c';

        var dateStr = new Date(r.submittedAt).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });

        tr.innerHTML =
          '<td>' + (idx+1) + '</td>' +
          '<td><strong>' + r.studentName + '</strong></td>' +
          '<td style="color:#16a34a;font-weight:700;">' + r.correct + '</td>' +
          '<td style="color:#dc2626;font-weight:700;">' + r.incorrect + '</td>' +
          '<td style="color:#ca8a04;">' + r.unanswered + '</td>' +
          '<td style="color:#0284C7;font-weight:700;">' + r.totalMarks + '/' + r.maxMarks + '</td>' +
          '<td>' + r.percent + '%</td>' +
          '<td><span class="grade-badge ' + gradeClass + '">' + r.rank + '</span></td>' +
          '<td style="color:#999;font-size:0.8rem;">' + dateStr + '</td>';

        tbody.appendChild(tr);
      });
    }
  }
}
