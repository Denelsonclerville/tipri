import { fetchWeather } from './api.js';
import { readCoordinates, readUserLocation, saveCoordinates } from './storage.js';

function buildFallbackWeather() {
  return {
    temperature: '--',
    condition: 'Forecast unavailable',
    humidity: '--',
    wind: '--',
    high: '--',
    low: '--',
    location: 'Port-au-Prince',
    forecast: ['Today', 'Tomorrow', 'Next day'].map((day) => ({
      day,
      condition: 'Forecast unavailable',
      high: '--',
      low: '--'
    }))
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

async function requestLocation() {
  return new Promise((resolve) => {
    const savedLocation = readUserLocation();
    const savedCoordinates = readCoordinates();
    if (savedCoordinates) return resolve(`?lat=${savedCoordinates.latitude}&lon=${savedCoordinates.longitude}`);
    if (!navigator.geolocation || !navigator.permissions) {
      return resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : '');
    }

    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (permission.state !== 'granted') {
        return resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : '');
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          saveCoordinates(position.coords.latitude, position.coords.longitude);
          resolve(`?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
        },
        () => resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : ''),
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 900000 }
      );
    }).catch(() => resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : ''));
  });
}

function weatherIcon(condition = '') {
  const value = String(condition).toLowerCase();
  if (value.includes('unavailable')) return '–';
  if (value.includes('rain')) return '☂';
  if (value.includes('cloud') || value.includes('fog')) return '☁';
  if (value.includes('storm')) return '⛈';
  return '☀';
}

export async function loadWeather() {
  const banners = [...document.querySelectorAll('#gate-weather, #meteo-banner')];
  if (!banners.length) return;

  const renderWeather = (weather) => {
    const icon = weatherIcon(weather.condition);
    const markup = `
      <div class="meteo-main">
        <span class="meteo-icon" aria-hidden="true">${icon}</span>
        <div>
          <p class="meteo-label">Local weather</p>
          <h3>${escapeHtml(weather.temperature)}</h3>
        </div>
      </div>
      <div class="meteo-summary">
        <span>${escapeHtml(weather.location)}</span>
        <strong>${escapeHtml(weather.condition)}</strong>
      </div>
      <div class="meteo-grid">
        <span>Humidity <strong>${escapeHtml(weather.humidity ?? '--')}</strong></span>
        <span>Wind <strong>${escapeHtml(weather.wind ?? '--')}</strong></span>
        <span>High <strong>${escapeHtml(weather.high ?? '--')}</strong></span>
        <span>Low <strong>${escapeHtml(weather.low ?? '--')}</strong></span>
      </div>
      <h4 class="forecast-heading">3-day forecast</h4>
      <div class="forecast-list">${(weather.forecast || []).map((day) => `
        <div class="forecast-day">
          <strong>${escapeHtml(day.day)}</strong>
          <span aria-hidden="true">${weatherIcon(day.condition)}</span>
          <span class="forecast-condition">${escapeHtml(day.condition)}</span>
          <span class="forecast-temperatures"><strong>${escapeHtml(day.high)}</strong><span>${escapeHtml(day.low)}</span></span>
        </div>
      `).join('')}</div>
    `;
    banners.forEach((banner) => { banner.innerHTML = markup; });
  };

  try {
    const weather = await fetchWeather(await requestLocation());
    const value = weather && typeof weather === 'object' ? weather : buildFallbackWeather();
    renderWeather(value);
  } catch {
    renderWeather(buildFallbackWeather());
  }
}
