const CONFIG = {

  API_BASE_URL: "http:

  LOGIN_ENDPOINT: "/login",

  DASHBOARD_PAGE: "Dashboard.html",

  SESSION_KEY: "pharmaUser",
};

(function checkAlreadyLoggedIn() {
  const existing = localStorage.getItem(CONFIG.SESSION_KEY);
  if (existing) {
    window.location.href = CONFIG.DASHBOARD_PAGE;
  }
})();

function showFieldError(inputEl, errorEl, show) {
  inputEl.classList.toggle("error-input", show);
  errorEl.style.display = show ? "block" : "none";
}

function showAlert(message, type) {
  const box = document.getElementById("alertBox");
  box.textContent   = message;
  box.className     = `alert-box ${type}`;
  box.style.display = "block";
}

function hideAlert() {
  document.getElementById("alertBox").style.display = "none";
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validatePassword(value) {
  return value.length >= 6;
}

document.getElementById("email").addEventListener("blur", function () {
  showFieldError(this, document.getElementById("emailError"), !validateEmail(this.value));
});

document.getElementById("password").addEventListener("blur", function () {
  showFieldError(this, document.getElementById("passwordError"), !validatePassword(this.value));
});

["email", "password"].forEach(function (id) {
  document.getElementById(id).addEventListener("input", function () {
    this.classList.remove("error-input");
    document.getElementById(id + "Error").style.display = "none";
    hideAlert();
  });
});

document.getElementById("togglePw").addEventListener("click", function () {
  const pw = document.getElementById("password");
  const isText = pw.type === "text";
  pw.type          = isText ? "password" : "text";
  this.textContent = isText ? "👁️" : "🙈";
});

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const emailVal    = document.getElementById("email").value;
  const passwordVal = document.getElementById("password").value;
  const btn         = document.getElementById("submitBtn");

  const emailOk    = validateEmail(emailVal);
  const passwordOk = validatePassword(passwordVal);

  showFieldError(document.getElementById("email"),    document.getElementById("emailError"),    !emailOk);
  showFieldError(document.getElementById("password"), document.getElementById("passwordError"), !passwordOk);

  if (!emailOk || !passwordOk) return;

  btn.classList.add("loading");
  btn.disabled = true;
  hideAlert();

  try {

    const response = await fetch(CONFIG.API_BASE_URL + CONFIG.LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:    emailVal.trim(),
        password: passwordVal,
      }),
    });

    const data = await response.json();

    btn.classList.remove("loading");
    btn.disabled = false;

    if (response.ok) {
      
      const sessionData = {
        name:      data.user.name,
        email:     data.user.email,
        role:      data.user.role,

        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));

      showAlert(`✅ Welcome, ${data.user.name}! Redirecting…`, "success");

      setTimeout(function () {
        window.location.href = CONFIG.DASHBOARD_PAGE;
      }, 1200);

    } else {

      showAlert("❌ " + (data.message || "Invalid email or password."), "error");
    }

  } catch (err) {

    btn.classList.remove("loading");
    btn.disabled = false;
    showAlert("🔴 Cannot reach server. Is Flask running?", "error");
    console.error("Flask connection error:", err);
  }
});