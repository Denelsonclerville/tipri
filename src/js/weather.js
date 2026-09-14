import { fetchWeather } from './api.js';
import { readCoordinates, readUserLocation, saveCoordinates } from './storage.js';

async function requestLocation() {
  return new Promise((resolve) => {
    const savedLocation = readUserLocation();
    const savedCoordinates = readCoordinates();
    if (savedCoordinates) return resolve(`?lat=${savedCoordinates.latitude}&lon=${savedCoordinates.longitude}`);
    if (!navigator.geolocation || !navigator.permissions) return resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : '');
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (permission.state !== 'granted') return resolve(savedLocation ? `?city=${encodeURIComponent(savedLocation)}` : '');
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

function weatherIcon(condition) {
  const value = condition.toLowerCase();
  return value.includes('rain') ? '☂' : value.includes('cloud') ? '☁' : '☀';
}

export async function loadWeather() {
  try {
    const weather = await fetchWeather(await requestLocation());
    const icon = weatherIcon(weather.condition);
    document.querySelector('#gate-weather').innerHTML = `<span class="gate-weather-main"><span class="weather-icon">${icon}</span><strong>${weather.temperature}</strong><small>${weather.location} · ${weather.condition}</small></span><span class="weather-stat"><b>H ${weather.high}</b><b>L ${weather.low}</b></span><span class="weather-stat"><b>↑ ${weather.sunrise}</b><b>↓ ${weather.sunset}</b></span>`;
    document.querySelector('#weather-widget').innerHTML = `<span class="weather-icon">${icon}</span><span><strong>${weather.temperature}</strong><small>${weather.location} · ${weather.condition}</small></span>`;
  } catch (error) {
    console.warn('Weather fallback is active:', error.message);
  }
}
