document.getElementById('predictForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = {};

    formData.forEach((value, key) => {
        // Convert numeric-looking fields to numbers, leave categorical ones as strings
        data[key] = isNaN(value) ? value : Number(value);
    });

    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Predicting...';
    resultDiv.className = 'result';
    resultDiv.style.display = 'block';

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        resultDiv.textContent = `${result.label} (Probability: ${(result.probability * 100).toFixed(1)}%)`;
        resultDiv.className = result.prediction === 1 ? 'result leave' : 'result stay';

    } catch (err) {
        resultDiv.textContent = 'Error getting prediction. Check the console / Flask server.';
        console.error(err);
    }
});