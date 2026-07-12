const form = document.getElementById("predictionForm");
const resultCard = document.getElementById("resultCard");
const predictionText = document.getElementById("predictionText");
const usageLevel = document.getElementById("usageLevel");
const suggestion = document.getElementById("suggestion");
const historyTable = document.getElementById("historyTable");

let energyChart = null;

form.addEventListener("submit", async function(event) {
    event.preventDefault();

    const temperature = Number(document.getElementById("temperature").value);
    const humidity = Number(document.getElementById("humidity").value);
    const date = document.getElementById("date").value;
    const hour = Number(document.getElementById("hour").value);
    const rate = Number(document.getElementById("rate").value);

    const inputData = {
        temperature: temperature,
        humidity: humidity,
        date: date,
        hour: hour
    };

    try {
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(inputData)
        });

        const data = await response.json();

        resultCard.style.display = "block";

        if (response.ok) {
            const energyWh = data.predicted_energy;
            const energyKWh = energyWh / 1000;
            const estimatedCost = energyKWh * rate;

            let rangeText = "";

            if (data.usage_level === "Low") {
                rangeText = "Less than 50 Wh";
            } else if (data.usage_level === "Medium") {
                rangeText = "50 Wh to 99.99 Wh";
            } else {
                rangeText = "100 Wh and above";
            }

            predictionText.innerText = `Predicted Energy: ${energyWh} ${data.unit}`;
            usageLevel.innerText = `Usage Level: ${data.usage_level} (${rangeText})`;
            suggestion.innerText = `Estimated Cost: ₹${estimatedCost.toFixed(2)}. ${data.suggestion}`;

            saveHistory({
                date: date,
                hour: hour,
                energyValue: energyWh,
                energy: `${energyWh} Wh`,
                cost: `₹${estimatedCost.toFixed(2)}`,
                level: `${data.usage_level} (${rangeText})`
            });

            loadHistory();
            updateChart();

        } else {
            predictionText.innerText = "Prediction failed";
            usageLevel.innerText = "";
            suggestion.innerText = data.error;
        }

    } catch (error) {
        resultCard.style.display = "block";
        predictionText.innerText = "Backend not connected";
        usageLevel.innerText = "";
        suggestion.innerText = "Make sure Flask backend is running on http://127.0.0.1:5000";
    }
});

function saveHistory(record) {
    let history = JSON.parse(localStorage.getItem("predictionHistory")) || [];

    history.unshift(record);

    localStorage.setItem("predictionHistory", JSON.stringify(history));
}

function loadHistory() {
    let history = JSON.parse(localStorage.getItem("predictionHistory")) || [];

    historyTable.innerHTML = "";

    history.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${item.date}</td>
            <td>${item.hour}</td>
            <td>${item.energy}</td>
            <td>${item.cost}</td>
            <td>${item.level}</td>
        `;

        historyTable.appendChild(row);
    });
}

function updateChart() {
    let history = JSON.parse(localStorage.getItem("predictionHistory")) || [];

    // Show only latest 10 predictions in chart
    history = history.slice(0, 10).reverse();

    const labels = history.map(item => `${item.date} ${item.hour}:00`);
    const energyValues = history.map(item => Number(item.energyValue));

    const chartElement = document.getElementById("energyChart");

    if (!chartElement) {
        return;
    }

    const ctx = chartElement.getContext("2d");

    if (energyChart !== null) {
        energyChart.destroy();
    }

    energyChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Predicted Energy Consumption (Wh)",
                    data: energyValues,
                    borderWidth: 2,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function clearHistory() {
    localStorage.removeItem("predictionHistory");
    loadHistory();
    updateChart();
}

loadHistory();
updateChart();