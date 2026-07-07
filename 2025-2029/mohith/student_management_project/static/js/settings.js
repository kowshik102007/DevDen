const toggle = document.getElementById("themeToggle");

if (document.body.classList.contains("dark")) {
    toggle.checked = true;
}

toggle.addEventListener("change", () => {
    if (toggle.checked) {
        document.body.classList.remove("light");
        document.body.classList.add("dark");
        saveTheme("dark");
    } else {
        document.body.classList.remove("dark");
        document.body.classList.add("light");
        saveTheme("light");
    }
});

function saveTheme(theme) {
    fetch("/theme", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `theme=${theme}`
    });
}