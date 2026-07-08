

var session = JSON.parse(localStorage.getItem('quizcraft_session') || 'null');
if (!session || session.role !== 'teacher') {
  window.location.href = 'login.html';
}

var draft = JSON.parse(localStorage.getItem('quizcraft_draft') || 'null');
if (!draft) {
  window.location.href = 'personalisation.html';
}

var totalQ        = draft.numQuestions;
var currentQ      = 0;
var savedQuestions = new Array(totalQ).fill(null);

document.getElementById('pageTitle').textContent = draft.title;

function logout() {
  localStorage.removeItem('quizcraft_session');
  window.location.href = 'login.html';
}

function updateUI() {
  
  document.getElementById('pageSubtitle').textContent = 'Question ' + (currentQ + 1) + ' of ' + totalQ;
  document.getElementById('formCounter').textContent  = 'Question ' + (currentQ + 1);


  var donePct = Math.round((savedQuestions.filter(function(q){ return q !== null; }).length / totalQ) * 100);
  document.getElementById('progressFill').style.width = donePct + '%';
  document.getElementById('progressLabel').textContent = donePct + '% complete';


  document.getElementById('prevQBtn').disabled = (currentQ === 0);
  var isLast = (currentQ === totalQ - 1);
  document.getElementById('nextQBtn').textContent = isLast ? 'Finish & Generate Link →' : 'Save & Next →';


  var saved = savedQuestions[currentQ];
  document.getElementById('questionText').value = saved ? saved.question : '';
  ['opt0','opt1','opt2','opt3'].forEach(function(id, i) {
    document.getElementById(id).value = saved ? saved.options[i] : '';
  });
  document.querySelectorAll('input[name="correctOpt"]').forEach(function(r) {
    r.checked = false;
  });
  if (saved) {
    var r = document.getElementById('radio' + saved.answer);
    if (r) r.checked = true;
  }

  document.getElementById('qError').classList.add('hidden');
  updateSidebar();
}

function updateSidebar() {
  var ul = document.getElementById('questionList');
  ul.innerHTML = '';

  for (var i = 0; i < totalQ; i++) {
    var li = document.createElement('li');
    li.className = 'qitem';
    if (savedQuestions[i]) li.classList.add('done');
    if (i === currentQ) li.classList.add('active');

    var qtext = savedQuestions[i] ? savedQuestions[i].question : 'Question ' + (i + 1);
    li.textContent = (i + 1) + '. ' + (qtext.length > 28 ? qtext.substring(0, 28) + '…' : qtext);

    (function(idx) {
      li.onclick = function() {
        if (trySaveCurrent(false)) {
          currentQ = idx;
          updateUI();
        }
      };
    })(i);

    ul.appendChild(li);
  }
}

function trySaveCurrent(required) {
  var qtext = document.getElementById('questionText').value.trim();
  var opts  = [
    document.getElementById('opt0').value.trim(),
    document.getElementById('opt1').value.trim(),
    document.getElementById('opt2').value.trim(),
    document.getElementById('opt3').value.trim()
  ];
  var correctRadio = document.querySelector('input[name="correctOpt"]:checked');
  var correctIdx   = correctRadio ? parseInt(correctRadio.value) : -1;
  var errEl        = document.getElementById('qError');


  if (!required && !qtext && opts.every(function(o){ return !o; }) && correctIdx === -1) {
    return true;
  }

  if (!qtext || opts.some(function(o){ return !o; }) || correctIdx === -1) {
    errEl.textContent = 'Please fill in the question, all 4 options, and select the correct answer.';
    errEl.classList.remove('hidden');
    return false;
  }

  savedQuestions[currentQ] = { question: qtext, options: opts, answer: correctIdx };
  errEl.classList.add('hidden');
  return true;
}

function nextOrFinish() {
  var isLast = (currentQ === totalQ - 1);
  if (!trySaveCurrent(true)) return;

  if (!isLast) {
    currentQ++;
    updateUI();
    return;
  }


  var missing = [];
  for (var i = 0; i < totalQ; i++) {
    if (!savedQuestions[i]) missing.push(i + 1);
  }
  if (missing.length > 0) {
    var errEl = document.getElementById('qError');
    errEl.textContent = 'Please complete questions: ' + missing.join(', ');
    errEl.classList.remove('hidden');
    return;
  }


  var quizId    = 'quiz_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  var questions = savedQuestions.map(function(q) {
    return {
      question: q.question,
      options:  q.options,
      answer:   q.options[q.answer],
      marks:    draft.marksCorrect
    };
  });

  var quizObj = {
    id:            quizId,
    title:         draft.title,
    subject:       draft.subject,
    numQuestions:  draft.numQuestions,
    timer:         draft.timer,
    marksCorrect:  draft.marksCorrect,
    marksNegative: draft.marksNegative,
    shuffle:       draft.shuffle,
    showAnswers:   draft.showAnswers,
    teacherEmail:  draft.teacherEmail,
    teacherName:   draft.teacherName,
    questions:     questions,
    createdAt:     Date.now()
  };

  var quizzes = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
  quizzes.push(quizObj);
  localStorage.setItem('quizcraft_quizzes', JSON.stringify(quizzes));
  localStorage.removeItem('quizcraft_draft');

  window.location.href = 'generate_link.html?quiz=' + quizId;
}

function prevQuestion() {
  trySaveCurrent(false);
  if (currentQ > 0) {
    currentQ--;
    updateUI();
  }
}

updateUI();
