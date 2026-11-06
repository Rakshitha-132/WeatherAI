const elements = {
    searchForm: document.getElementById("searchForm"),
    cityInput: document.getElementById("cityInput"),
    searchBtn: document.getElementById("searchBtn"),
    locationSyncBtn: document.getElementById("locationSyncBtn"),
    message: document.getElementById("message"),
    placeChoices: document.getElementById("placeChoices"),
    dashboard: document.getElementById("weatherDashboard"),
    welcomeCard: document.getElementById("welcomeCard"),
    cityName: document.getElementById("cityName"),
    localDate: document.getElementById("localDate"),
    weatherIcon: document.getElementById("weatherIcon"),
    temperature: document.getElementById("temperature"),
    description: document.getElementById("description"),
    todayHigh: document.getElementById("todayHigh"),
    todayLow: document.getElementById("todayLow"),
    feels: document.getElementById("feels"),
    humidity: document.getElementById("humidity"),
    wind: document.getElementById("wind"),
    uvIndex: document.getElementById("uvIndex"),
    forecast: document.getElementById("forecast"),
    insights: document.getElementById("insights"),
    temperatureChart: document.getElementById("temperatureChart"),
    rainChart: document.getElementById("rainChart")
};

let currentUnit = "c";
let currentWeather = null;
let isBusy = false;

elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchCity(elements.cityInput.value);
});

elements.locationSyncBtn.addEventListener("click", syncCurrentLocation);

document.querySelectorAll(".quick-city").forEach((button) => {
    button.addEventListener("click", () => {
        elements.cityInput.value = button.dataset.city;
        searchCity(button.dataset.city);
    });
});

document.querySelectorAll(".unit-button").forEach((button) => {
    button.addEventListener("click", () => {
        if (!currentWeather || currentUnit === button.dataset.unit) return;
        currentUnit = button.dataset.unit;
        updateUnitButtons();
        renderWeather(currentWeather.place, currentWeather.data);
    });
});

function setBusy(busy) {
    isBusy = busy;
    elements.searchBtn.disabled = busy;
    elements.locationSyncBtn.disabled = busy;
    elements.cityInput.disabled = busy;
    elements.searchBtn.querySelector("span:first-child").textContent = busy
        ? "Loading"
        : "Search";
    elements.locationSyncBtn.innerHTML = busy
        ? '<span aria-hidden="true">◌</span> Finding weather...'
        : '<span aria-hidden="true">◎</span> Use my location';
}

function showMessage(text, kind = "") {
    elements.message.textContent = text;
    elements.message.className = `status-message${kind ? ` status-${kind}` : ""}`;
}

function clearPlaceChoices() {
    elements.placeChoices.replaceChildren();
    elements.placeChoices.hidden = true;
}

async function fetchJson(url, fallbackMessage) {
    let response;
    try {
        response = await fetch(url);
    } catch {
        throw new Error("Could not reach the weather service. Check your internet connection and try again.");
    }

    if (!response.ok) throw new Error(fallbackMessage);

    try {
        return await response.json();
    } catch {
        throw new Error("The weather service returned an unreadable response. Please try again.");
    }
}

async function searchCity(city) {
    const query = city.trim();
    if (isBusy) return;
    if (!query) {
        showMessage("Enter a city name to search.", "error");
        elements.cityInput.focus();
        return;
    }

    clearPlaceChoices();
    setBusy(true);
    showMessage(`Looking for ${query}...`);

    try {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.search = new URLSearchParams({
            name: query,
            count: "8",
            language: "en",
            format: "json"
        });
        const data = await fetchJson(url, "City search is unavailable right now. Please try again.");
        const places = (data.results || []).filter((place) =>
            Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
        );

        if (places.length === 0) throw new Error("We couldn't find that place. Check the spelling and try again.");
        if (places.length === 1) {
            await loadWeatherForPlace(places[0], true);
            return;
        }

        showPlaceChoices(places);
        showMessage("We found a few places with that name. Choose the one you mean.");
    } catch (error) {
        showMessage(error.message || "Could not search for that city.", "error");
    } finally {
        setBusy(false);
    }
}

function showPlaceChoices(places) {
    const heading = document.createElement("p");
    heading.className = "choice-heading";
    heading.textContent = "Choose a location";
    elements.placeChoices.appendChild(heading);

    places.forEach((place) => {
        const button = document.createElement("button");
        const locationDetails = [place.admin1, place.country].filter(Boolean).join(", ");
        button.type = "button";
        button.className = "place-choice";
        button.innerHTML = `<span class="choice-pin" aria-hidden="true">⌖</span><span class="choice-copy"><strong></strong><small></small></span><span aria-hidden="true">→</span>`;
        button.querySelector("strong").textContent = place.name;
        button.querySelector("small").textContent = locationDetails || "Location";
        button.addEventListener("click", () => loadWeatherForPlace(place));
        elements.placeChoices.appendChild(button);
    });

    elements.placeChoices.hidden = false;
}

async function loadWeatherForPlace(place, searchInProgress = false) {
    if (isBusy && !searchInProgress) return;
    clearPlaceChoices();
    setBusy(true);
    showMessage(`Getting the forecast for ${place.name}...`);

    try {
        const data = await fetchWeather(place.latitude, place.longitude);
        currentWeather = { place, data };
        renderWeather(place, data);
        elements.welcomeCard.hidden = true;
        elements.dashboard.hidden = false;
        elements.cityInput.value = place.name;
        showMessage(`Forecast updated for ${place.name}.`, "success");
    } catch (error) {
        showMessage(error.message || "Could not load the forecast.", "error");
    } finally {
        setBusy(false);
    }
}

async function fetchWeather(latitude, longitude) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,is_day",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
        timezone: "auto",
        forecast_days: "7",
        wind_speed_unit: "kmh"
    });

    const data = await fetchJson(url, "Weather data is unavailable for this place right now.");
    if (!data.current || !data.daily || !Array.isArray(data.daily.time)) {
        throw new Error("The weather service returned incomplete forecast data. Please try again.");
    }
    return data;
}

function getWeatherInfo(code, isDay = true) {
    if (code === 0) return [isDay ? "Clear sky" : "Clear night", isDay ? "☀️" : "🌙"];
    if (code === 1) return ["Mainly clear", isDay ? "🌤️" : "☁️"];
    if (code === 2) return ["Partly cloudy", "⛅"];
    if (code === 3) return ["Overcast", "☁️"];
    if (code === 45 || code === 48) return ["Foggy", "🌫️"];
    if (code >= 51 && code <= 57) return ["Drizzle", "🌦️"];
    if (code >= 61 && code <= 67) return ["Rain", "🌧️"];
    if (code >= 71 && code <= 77) return ["Snow", "❄️"];
    if (code >= 80 && code <= 82) return ["Rain showers", "🌦️"];
    if (code === 85 || code === 86) return ["Snow showers", "🌨️"];
    if (code >= 95) return ["Thunderstorm", "⛈️"];
    return ["Variable conditions", "🌡️"];
}

function toDisplayTemperature(value) {
    const temperature = currentUnit === "c" ? value : (value * 9 / 5) + 32;
    return `${Math.round(temperature)}°`;
}

function updateUnitButtons() {
    document.querySelectorAll(".unit-button").forEach((button) => {
        const selected = button.dataset.unit === currentUnit;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

function formatPlaceName(place) {
    const name = place.name || "Your location";
    const country = place.country || place.countryName;
    return country ? `${name}, ${country}` : name;
}

function formatLocalDate(time) {
    if (!time) return "";
    const date = new Date(`${time.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function renderWeather(place, data) {
    const current = data.current;
    const daily = data.daily;
    const timezone = data.timezone;
    const condition = getWeatherInfo(current.weather_code, current.is_day !== 0);

    elements.cityName.textContent = formatPlaceName(place);
    elements.localDate.textContent = formatLocalDate(current.time);
    elements.weatherIcon.textContent = condition[1];
    elements.temperature.textContent = toDisplayTemperature(current.temperature_2m);
    elements.description.textContent = condition[0];
    elements.todayHigh.textContent = toDisplayTemperature(daily.temperature_2m_max[0]);
    elements.todayLow.textContent = toDisplayTemperature(daily.temperature_2m_min[0]);
    elements.feels.textContent = `${toDisplayTemperature(current.apparent_temperature)}${currentUnit === "c" ? "C" : "F"}`;
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.wind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    elements.uvIndex.textContent = Number.isFinite(current.uv_index)
        ? `${current.uv_index} · ${getUvDescription(current.uv_index)}`
        : "Not available";

    renderForecast(daily);
    renderInsights(current, daily);
    renderTrends(daily);
}

function getUvDescription(index) {
    if (index < 3) return "Low";
    if (index < 6) return "Moderate";
    if (index < 8) return "High";
    if (index < 11) return "Very high";
    return "Extreme";
}

function getDayLabel(date, index) {
    if (index === 0) return "Today";
    return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function renderForecast(daily) {
    elements.forecast.replaceChildren();
    daily.time.forEach((date, index) => {
        const [description, icon] = getWeatherInfo(daily.weather_code[index]);
        const card = document.createElement("article");
        card.className = `forecast-day${index === 0 ? " forecast-today" : ""}`;

        const day = document.createElement("p");
        day.className = "forecast-weekday";
        day.textContent = getDayLabel(date, index);

        const weatherIcon = document.createElement("span");
        weatherIcon.className = "forecast-icon";
        weatherIcon.setAttribute("aria-label", description);
        weatherIcon.textContent = icon;

        const descriptionText = document.createElement("p");
        descriptionText.className = "forecast-condition";
        descriptionText.textContent = description;

        const temperatures = document.createElement("p");
        temperatures.className = "forecast-temperatures";
        temperatures.textContent = `${toDisplayTemperature(daily.temperature_2m_max[index])} / ${toDisplayTemperature(daily.temperature_2m_min[index])}`;

        const rain = document.createElement("p");
        rain.className = "forecast-rain";
        rain.textContent = `${daily.precipitation_probability_max[index] ?? "—"}% rain`;

        card.append(day, weatherIcon, descriptionText, temperatures, rain);
        elements.forecast.appendChild(card);
    });
}

function createInsight(icon, title, description) {
    const item = document.createElement("article");
    item.className = "insight-item";
    const iconElement = document.createElement("span");
    iconElement.className = "insight-icon";
    iconElement.setAttribute("aria-hidden", "true");
    iconElement.textContent = icon;
    const copy = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = title;
    const detail = document.createElement("p");
    detail.textContent = description;
    copy.append(heading, detail);
    item.append(iconElement, copy);
    return item;
}

function renderInsights(current, daily) {
    const todayHigh = daily.temperature_2m_max[0];
    const rainChance = daily.precipitation_probability_max[0] ?? 0;
    const uvIndex = current.uv_index ?? daily.uv_index_max[0];
    const weatherCode = current.weather_code;
    const insights = [];

    if (rainChance >= 50 || (weatherCode >= 51 && weatherCode <= 82)) {
        insights.push(createInsight("☂", "Keep a layer handy", `Rain is possible today, with a ${rainChance}% chance of precipitation.`));
    } else if (weatherCode === 0 || weatherCode === 1) {
        insights.push(createInsight("☀", "A bright outlook", "Skies look mostly clear. It could be a lovely day to get outside."));
    } else {
        insights.push(createInsight("☁", "A changeable sky", "Clouds may come and go. Check the forecast again before heading out."));
    }

    if (Number.isFinite(uvIndex) && uvIndex >= 6) {
        insights.push(createInsight("◉", "UV is on the high side", `The UV index may reach ${uvIndex}. Consider sun protection if you're outdoors.`));
    } else if (Number.isFinite(todayHigh) && todayHigh >= 30) {
        insights.push(createInsight("♨", "A warm afternoon", `Temperatures may reach ${toDisplayTemperature(todayHigh)}. Keep water close when you're out.`));
    } else if (Number.isFinite(todayHigh) && todayHigh <= 5) {
        insights.push(createInsight("❄", "Bundle up", `Today's high is around ${toDisplayTemperature(todayHigh)}. A warm layer may come in handy.`));
    } else {
        const sunrise = daily.sunrise?.[0];
        const sunset = daily.sunset?.[0];
        if (sunrise && sunset) {
            insights.push(createInsight("◷", "Daylight hours", `Sunrise is around ${formatClockTime(sunrise)} and sunset around ${formatClockTime(sunset)} local time.`));
        }
    }

    const maxWind = current.wind_speed_10m;
    if (maxWind >= 35) {
        insights.push(createInsight("≋", "Breezy conditions", `Winds are around ${Math.round(maxWind)} km/h. Take care with lightweight items outdoors.`));
    } else {
        const nextRainyDay = daily.precipitation_probability_max.findIndex((chance, index) => index > 0 && chance >= 60);
        if (nextRainyDay > 0) {
            insights.push(createInsight("◌", "A heads-up for later", `Rain chances rise to ${daily.precipitation_probability_max[nextRainyDay]}% on ${getDayLabel(daily.time[nextRainyDay], nextRainyDay)}.`));
        }
    }

    elements.insights.replaceChildren(...insights.slice(0, 3));
}

function formatClockTime(value) {
    const time = value.split("T")[1];
    if (!time) return value;
    const [hours, minutes] = time.split(":");
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function renderTrends(daily) {
    elements.temperatureChart.replaceChildren();
    elements.rainChart.replaceChildren();
    const lows = daily.temperature_2m_min;
    const highs = daily.temperature_2m_max;
    const temperatureMin = Math.min(...lows);
    const temperatureMax = Math.max(...highs);
    const temperatureRange = Math.max(temperatureMax - temperatureMin, 1);

    daily.time.forEach((date, index) => {
        const label = getDayLabel(date, index);
        const tempRow = document.createElement("div");
        tempRow.className = "trend-row";
        const dayLabel = document.createElement("span");
        dayLabel.className = "trend-day";
        dayLabel.textContent = index === 0 ? "Today" : label;
        const bars = document.createElement("div");
        bars.className = "temperature-bars";
        const lowBar = document.createElement("span");
        lowBar.className = "temperature-bar low-bar";
        lowBar.style.width = `${Math.max(8, ((lows[index] - temperatureMin) / temperatureRange) * 100)}%`;
        lowBar.title = `Low ${toDisplayTemperature(lows[index])}`;
        const highBar = document.createElement("span");
        highBar.className = "temperature-bar high-bar";
        highBar.style.width = `${Math.max(8, ((highs[index] - temperatureMin) / temperatureRange) * 100)}%`;
        highBar.title = `High ${toDisplayTemperature(highs[index])}`;
        bars.append(lowBar, highBar);
        const values = document.createElement("span");
        values.className = "trend-values";
        values.textContent = `${toDisplayTemperature(highs[index])} / ${toDisplayTemperature(lows[index])}`;
        tempRow.append(dayLabel, bars, values);
        elements.temperatureChart.appendChild(tempRow);

        const rainRow = document.createElement("div");
        rainRow.className = "trend-row";
        const rainLabel = document.createElement("span");
        rainLabel.className = "trend-day";
        rainLabel.textContent = index === 0 ? "Today" : label;
        const rainTrack = document.createElement("span");
        rainTrack.className = "rain-track";
        const rainBar = document.createElement("span");
        rainBar.className = "rain-bar";
        const probability = daily.precipitation_probability_max[index] ?? 0;
        rainBar.style.width = `${Math.max(0, Math.min(100, probability))}%`;
        rainTrack.appendChild(rainBar);
        const rainValue = document.createElement("span");
        rainValue.className = "trend-values";
        rainValue.textContent = `${probability}%`;
        rainRow.append(rainLabel, rainTrack, rainValue);
        elements.rainChart.appendChild(rainRow);
    });
}

function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            maximumAge: 300000,
            timeout: 12000
        });
    });
}

async function getLocationName(latitude, longitude) {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        localityLanguage: "en"
    });
    const data = await fetchJson(url, "Nearby place name lookup failed.");
    return {
        name: data.city || data.locality || data.principalSubdivision || "Your location",
        country: data.countryName || ""
    };
}

function getLocationError(error) {
    if (error.code === 1) return "Location permission was denied. Allow location access in your browser and try again.";
    if (error.code === 2) return "Your location is unavailable right now. Try again or search for a city.";
    if (error.code === 3) return "Finding your location took too long. Try again.";
    return error.message || "Could not sync your location.";
}

async function syncCurrentLocation() {
    if (isBusy) return;
    if (!navigator.geolocation) {
        showMessage("Location access is not supported by this browser. Search for a city instead.", "error");
        return;
    }

    setBusy(true);
    clearPlaceChoices();
    showMessage("Asking your browser for your location...");

    try {
        const position = await getLocation();
        const { latitude, longitude } = position.coords;
        const [weatherResult, placeResult] = await Promise.allSettled([
            fetchWeather(latitude, longitude),
            getLocationName(latitude, longitude)
        ]);
        if (weatherResult.status === "rejected") throw weatherResult.reason;
        const placeLookupFailed = placeResult.status === "rejected";
        const place = placeLookupFailed
            ? { name: "Your location", country: "" }
            : placeResult.value;
        const data = weatherResult.value;
        currentWeather = { place, data };
        renderWeather(place, data);
        elements.welcomeCard.hidden = true;
        elements.dashboard.hidden = false;
        elements.cityInput.value = place.name === "Your location" ? "" : place.name;
        showMessage(placeLookupFailed
            ? "Weather loaded for your location; we couldn't find its nearby place name."
            : `Forecast synced for ${formatPlaceName(place)}.`, placeLookupFailed ? "" : "success");
    } catch (error) {
        showMessage(error.code ? getLocationError(error) : error.message, "error");
    } finally {
        setBusy(false);
    }
}
