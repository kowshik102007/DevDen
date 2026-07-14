document.getElementById("generateBtn").addEventListener("click", async () => {
    const seedText = document.getElementById("inputText").value.trim();
    const output = document.getElementById("outputStory");

    if (!seedText) {
        output.textContent = "Please enter a seed sentence.";
        return;
    }

    output.textContent = "Generating story...";
    try {
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                seed_text: seedText,
                next_words: 50,
                max_sequence_len: 50
            })
        });

        const data = await response.json();
        output.textContent = data.story || "No story generated.";
    } catch (error) {
        output.textContent = "Error generating story.";
        console.error(error);
    }
});

document.getElementById("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const themeBtn = document.getElementById("themeToggle");
    themeBtn.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
});
