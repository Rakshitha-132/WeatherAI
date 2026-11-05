
const searchBtn = document.getElementById("searchBtn");
const cityInput = document.getElementById("cityInput");

function resetWeatherPanels() {
    document.getElementById("weather").hidden = true;
    document.getElementById("forecastSection").hidden = true;
    document.getElementById("analytics").hidden = true;
}

searchBtn.addEventListener("click", getWeather);

cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") getWeather();
});

async function getWeather() {
    const city = cityInput.value.trim();
    const message = document.getElementById("message");

    if (!city) {
        message.textContent = "Please enter a city name.";
        resetWeatherPanels();
        return;
    }

    message.textContent = "Loading weather data...";
    resetWeatherPanels();

    try {
        // Find city coordinates
        const geoURL =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

        const geoResponse = await fetch(geoURL);
        if (!geoResponse.ok) throw new Error("City search failed.");

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found. Try another city.");
        }

        const place = geoData.results[0];
        const { latitude, longitude } = place;

        // Get weather information
        const weatherURL =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;

        const weatherResponse = await fetch(weatherURL);
        if (!weatherResponse.ok) throw new Error("Weather data unavailable.");

        const data = await weatherResponse.json();

        displayWeather(place, data);
        message.textContent = "Weather updated successfully!";

    } catch (error) {
        resetWeatherPanels();
        message.textContent = error.message;
    }
}

// Convert weather codes into descriptions and icons
function getWeatherInfo(code) {
    if (code === 0) return ["Clear sky", "☀️"];
    if (code <= 2) return ["Partly cloudy", "🌤️"];
    if (code === 3) return ["Cloudy", "☁️"];
    if (code <= 48) return ["Foggy", "🌫️"];
    if (code <= 57) return ["Drizzle", "🌦️"];
    if (code <= 67) return ["Rain", "🌧️"];
    if (code <= 77) return ["Snow", "❄️"];
    if (code <= 82) return ["Rain showers", "🌦️"];
    if (code <= 86) return ["Snow showers", "🌨️"];
    if (code <= 99) return ["Thunderstorm", "⛈️"];

    return ["Unknown", "🌡️"];
}

function displayWeather(place, data) {
    const current = data.current;
    const info = getWeatherInfo(current.weather_code);

    document.getElementById("cityName").textContent =
        `${place.name}, ${place.country}`;

    document.getElementById("weatherIcon").textContent = info[1];

    document.getElementById("temperature").textContent =
        `${Math.round(current.temperature_2m)}°C`;

    document.getElementById("description").textContent = info[0];

    document.getElementById("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    document.getElementById("wind").textContent =
        `${current.wind_speed_10m} km/h`;

    document.getElementById("feels").textContent =
        `${Math.round(current.apparent_temperature)}°C`;

    document.getElementById("weather").hidden = false;

    displayForecast(data.daily);
}

function displayForecast(daily) {
    displayAnalytics(daily);
    const forecast = document.getElementById("forecast");
    forecast.innerHTML = "";

    daily.time.forEach((date, index) => {
        const info = getWeatherInfo(daily.weather_code[index]);

        const card = document.createElement("div");

        const day = new Date(date + "T12:00:00")
            .toLocaleDateString("en", { weekday: "short" });

        card.innerHTML = `
            <h3>${day}</h3>
            <p>${info[1]}</p>
            <p>${Math.round(daily.temperature_2m_max[index])}° / 
            ${Math.round(daily.temperature_2m_min[index])}°</p>
            <p>Rain: ${daily.precipitation_probability_max[index] ?? "N/A"}%</p>
        `;

        forecast.appendChild(card);
    });

    document.getElementById("forecastSection").hidden = false;
}

let temperatureChart = null;
let rainChart = null;

function displayAnalytics(daily) {
    const labels = daily.time.map(date =>
        new Date(date + "T12:00:00").toLocaleDateString(
            "en", { weekday: "short" }
        )
    );

    const temperatureCanvas =
        document.getElementById("temperatureChart");

    const rainCanvas =
        document.getElementById("rainChart");

    // Remove previous charts before updating
    if (temperatureChart) temperatureChart.destroy();
    if (rainChart) rainChart.destroy();

    temperatureChart = new Chart(temperatureCanvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Maximum Temperature (°C)",
                    data: daily.temperature_2m_max,
                    borderColor: "#ffb347",
                    backgroundColor: "rgba(255,179,71,0.15)",
                    fill: true,
                    tension: 0.4
                },
                {
                    label: "Minimum Temperature (°C)",
                    data: daily.temperature_2m_min,
                    borderColor: "#65c7f7",
                    backgroundColor: "rgba(101,199,247,0.1)",
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: "white" }
                }
            },
            scales: {
                x: {
                    ticks: { color: "white" }
                },
                y: {
                    ticks: { color: "white" },
                    title: {
                        display: true,
                        text: "Temperature °C",
                        color: "white"
                    }
                }
            }
        }
    });

    rainChart = new Chart(rainCanvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Rain Probability (%)",
                data: daily.precipitation_probability_max,
                backgroundColor: "#65c7f7",
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: "white" }
                }
            },
            scales: {
                x: {
                    ticks: { color: "white" }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: "white" }
                }
            }
        }
    });

    document.getElementById("analytics").hidden = false;
}
