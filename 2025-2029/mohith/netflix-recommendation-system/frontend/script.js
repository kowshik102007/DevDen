async function getRecommendations() {

    const movie = document.getElementById("movieInput").value.trim();

    if (movie === "") {
        alert("Please enter a movie name.");
        return;
    }

    const results = document.getElementById("results");

    // Loading
    results.innerHTML = `
        <h2 class="recommend-title">Searching...</h2>

        <div class="card">
            <div class="info">
                <h3>Loading recommendations...</h3>
            </div>
        </div>
    `;

    try {

        const response = await fetch(
            `http://127.0.0.1:5000/recommend?title=${encodeURIComponent(movie)}`
        );

        if (!response.ok) {
            throw new Error("Server Error");
        }

        const data = await response.json();

        let html = `
            <h2 class="recommend-title">
                Recommendations for "${movie}"
            </h2>
        `;

        if (!data.recommendations || data.recommendations.length === 0) {

            html += `
                <div class="card">
                    <div class="info">
                        <h3>No recommendations found.</h3>
                    </div>
                </div>
            `;

        } else {

            data.recommendations.forEach(movie => {

                html += `

                <div class="card">

                    <div class="poster">

                        <img
                            src="${movie.poster || 'https://via.placeholder.com/300x450?text=No+Poster'}"
                            alt="${movie.title}"
                            onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster';"
                        >

                    </div>

                    <div class="info">

                        <h2>${movie.title}</h2>

                        <p>🎬 ${movie.type}</p>

                        <p>📅 ${movie.release_year}</p>

                        <p>⭐ Netflix Rating: ${movie.rating}</p>

                        <p class="genre">
                            🎭 ${movie.genre ? movie.genre.split(",")[0] : "Unknown"}
                        </p>

                        <p>${movie.description}</p>

                    </div>

                </div>

                `;

            });

        }

        results.innerHTML = html;

    } catch (error) {

        console.log(error);

        results.innerHTML = `
            <h2 class="recommend-title">Recommendations</h2>

            <div class="card">

                <div class="info">

                    <h3>⚠️ Server Error</h3>

                    <p>Could not connect to Flask backend.</p>

                </div>

            </div>
        `;

    }

}

document
    .getElementById("movieInput")
    .addEventListener("keypress", function (event) {

        if (event.key === "Enter") {
            getRecommendations();
        }

    });