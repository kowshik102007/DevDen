document.getElementById("editForm").addEventListener("submit", function () {
    const btn = document.querySelector("button");
    btn.innerText = "Updating...";
    btn.style.opacity = "0.7";
});

const inputs = document.querySelectorAll("input");

inputs.forEach(input => {
    input.addEventListener("focus", () => {
        input.style.boxShadow = "0 0 8px rgba(102,126,234,0.5)";
    });

    input.addEventListener("blur", () => {
        input.style.boxShadow = "none";
    });
});