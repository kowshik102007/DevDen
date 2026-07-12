

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

var quizId = getParam('quiz');
var quiz   = null;

if (quizId) {
  var quizzes = JSON.parse(localStorage.getItem('quizcraft_quizzes') || '[]');
  for (var i = 0; i < quizzes.length; i++) {
    if (quizzes[i].id === quizId) { quiz = quizzes[i]; break; }
  }
}


if (!quiz && typeof questionBank !== 'undefined') {
  quiz = {
    id: 'legacy', title: 'Quiz',
    questions: questionBank,
    numQuestions: typeof questionsPerStudent !== 'undefined' ? questionsPerStudent : 5,
    timer: 15, shuffle: true, showAnswers: false,
    marksCorrect: 2, marksNegative: 0
  };
}

if (!quiz) {
  document.body.innerHTML =
    '<div style="height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;flex-direction:column;gap:16px;background:#f0f9ff;">' +
    '<span style="font-size:3rem">😕</span>' +
    '<h2 style="color:#1e293b;font-size:1.4rem;">Quiz not found</h2>' +
    '<p style="color:#94a3b8;">Please ask your teacher for a valid quiz link.</p></div>';
  throw new Error('No quiz found');
}


document.getElementById('quizTitleDisplay').textContent = quiz.title;
document.getElementById('quizMetaDisplay').textContent  =
  quiz.questions.length + ' questions  ·  ' + quiz.timer + ' minutes' +
  (quiz.subject ? '  ·  ' + quiz.subject : '');


function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

var quizData    = [];
var currentIndex = 0;
var userAnswers  = [];
var timerInterval = null;
var secondsLeft   = 0;
var studentName   = '';

function startQuiz() {
  var nameVal = document.getElementById('studentNameInput').value.trim();
  if (!nameVal) {
    document.getElementById('nameError').classList.remove('hidden');
    return;
  }
  studentName = nameVal;
  document.getElementById('nameError').classList.add('hidden');

  var pool = quiz.shuffle ? shuffleArray(quiz.questions) : quiz.questions.slice();
  quizData    = pool.slice(0, quiz.numQuestions);
  userAnswers = new Array(quizData.length).fill(null);

  document.getElementById('nameScreen').classList.add('hidden');
  document.getElementById('quizScreen').classList.remove('hidden');


  document.getElementById('qlpTitle').textContent   = quiz.title;
  document.getElementById('qlpStudent').textContent = 'Student: ' + studentName;


  secondsLeft   = quiz.timer * 60;
  updateTimerDisplay();
  timerInterval = setInterval(function() {
    secondsLeft--;
    updateTimerDisplay();
    if (secondsLeft <= 0) { clearInterval(timerInterval); submitQuiz(); }
  }, 1000);

  loadQuestion(0);
}

function updateTimerDisplay() {
  var mins = Math.floor(secondsLeft / 60);
  var secs = secondsLeft % 60;
  document.getElementById('timerDisplay').textContent =
    mins + ':' + (secs < 10 ? '0' : '') + secs;

  var box = document.getElementById('timerBox');
  box.classList.remove('warning','danger');
  if      (secondsLeft <= 60)  box.classList.add('danger');
  else if (secondsLeft <= 180) box.classList.add('warning');
}

function loadQuestion(index) {
  var q = quizData[index];


  var pct = Math.round(((index + 1) / quizData.length) * 100);
  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('questionCounter').textContent = 'Question ' + (index+1) + ' of ' + quizData.length;


  document.getElementById('questionText').textContent = q.question;


  var list = document.getElementById('optionsList');
  list.innerHTML = '';

  q.options.forEach(function(opt) {
    var li    = document.createElement('li');
    var label = document.createElement('label');
    label.className = 'option-label';
    if (userAnswers[index] === opt) label.classList.add('selected');

    var radio  = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'option';
    radio.value = opt;
    if (userAnswers[index] === opt) radio.checked = true;

    radio.addEventListener('change', function() {
      userAnswers[index] = this.value;
      list.querySelectorAll('.option-label').forEach(function(l) { l.classList.remove('selected'); });
      label.classList.add('selected');
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(opt));
    li.appendChild(label);
    list.appendChild(li);
  });


  var prevBtn = document.getElementById('prevBtn');
  prevBtn.disabled = (index === 0);

  var nextBtn = document.getElementById('nextBtn');
  if (index === quizData.length - 1) {
    nextBtn.textContent = 'Submit Quiz';
    nextBtn.className   = 'nav-btn btn-submit';
    nextBtn.onclick     = submitQuiz;
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.className   = 'nav-btn btn-next';
    nextBtn.onclick     = goToNext;
  }
}

function goToNext() {
  if (currentIndex < quizData.length - 1) { currentIndex++; loadQuestion(currentIndex); }
}

function goToPrev() {
  if (currentIndex > 0) { currentIndex--; loadQuestion(currentIndex); }
}

function submitQuiz() {
  clearInterval(timerInterval);

  var correct   = 0, incorrect = 0, unanswered = 0;
  var totalMarks = 0, maxMarks = 0;

  for (var i = 0; i < quizData.length; i++) {
    var marks = quizData[i].marks || quiz.marksCorrect || 2;
    maxMarks += marks;
    if (userAnswers[i] === null) {
      unanswered++;
    } else if (userAnswers[i] === quizData[i].answer) {
      correct++;
      totalMarks += marks;
    } else {
      incorrect++;
      totalMarks -= (quiz.marksNegative || 0);
    }
  }
  if (totalMarks < 0) totalMarks = 0;

  var percent = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
  var rank = 'D';
  if      (percent >= 85) rank = 'A+';
  else if (percent >= 70) rank = 'A';
  else if (percent >= 55) rank = 'B';
  else if (percent >= 40) rank = 'C';


  var result = {
    quizId: quiz.id, studentName: studentName,
    correct: correct, incorrect: incorrect, unanswered: unanswered,
    totalMarks: totalMarks, maxMarks: maxMarks,
    percent: Math.round(percent), rank: rank, submittedAt: Date.now()
  };
  var results = JSON.parse(localStorage.getItem('quizcraft_results') || '[]');
  results.push(result);
  localStorage.setItem('quizcraft_results', JSON.stringify(results));


  document.getElementById('scoreHeading').textContent     = studentName + "'s Results";
  document.getElementById('scoreStudentName').textContent = studentName;
  document.getElementById('rankBadge').textContent        = rank;
  document.getElementById('correctCount').textContent     = correct;
  document.getElementById('incorrectCount').textContent   = incorrect;
  document.getElementById('partialCount').textContent     = unanswered;
  document.getElementById('totalMarks').textContent       = totalMarks + ' / ' + maxMarks;


  if (quiz.showAnswers) {
    var reviewSection = document.getElementById('answersReview');
    var reviewList    = document.getElementById('answersReviewList');
    reviewSection.classList.remove('hidden');
    reviewList.innerHTML = '';

    quizData.forEach(function(q, idx) {
      var div = document.createElement('div');
      var studentAns = userAnswers[idx];
      var cls = studentAns === null ? 'unanswered' : studentAns === q.answer ? 'correct-ans' : 'wrong-ans';

      div.className = 'review-item ' + cls;
      div.innerHTML =
        '<div class="review-q">' + (idx+1) + '. ' + q.question + '</div>' +
        (studentAns ? '<div class="review-your">Your answer: ' + studentAns + '</div>' : '<div class="review-your">Not answered</div>') +
        (cls !== 'correct-ans' ? '<div class="review-correct">✓ Correct: ' + q.answer + '</div>' : '');
      reviewList.appendChild(div);
    });
  }


  document.getElementById('quizScreen').classList.add('hidden');
  document.getElementById('scoreScreen').classList.remove('hidden');
}
