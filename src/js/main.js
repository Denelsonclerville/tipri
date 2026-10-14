import { fetchProducts } from './api.js';
import { observeAuth } from './auth.js';
import { enterDashboard, initUI, initWelcomeUI, loadWeather } from './ui.js';

async function loadCountryMetadata() {
  const countryInfo = document.querySelector('#country-info');
  if (!countryInfo) return;

  try {
    const response = await fetch('https://restcountries.com/v3.1/alpha/ht?fields=name,currencies');
    if (!response.ok) throw new Error(`Unable to load country details (${response.status}).`);
    const [country] = await response.json();
    const name = country?.name?.common;
    const currency = Object.keys(country?.currencies || {})[0];
    if (!name || !currency) throw new Error('Country details response is incomplete.');
    countryInfo.textContent = `${name} · ${currency}`;
  } catch (error) {
    console.error('Regional metadata could not load:', error);
    countryInfo.textContent = 'Haiti · Regional details unavailable';
  }
}

async function startApplication() {
  const hasWelcomeGate = Boolean(document.querySelector('#welcome-gate'));
  if (hasWelcomeGate) {
    initWelcomeUI(observeAuth);
  } else {
    document.querySelector('#app-shell')?.classList.add('is-visible');
  }
  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    console.error('Listings could not load:', error);
  }
  const savedRole = localStorage.getItem('tipri_dashboard_role');
  const initialRole = savedRole === 'seller' && localStorage.getItem('tipri_user') ? 'seller' : 'buyer';
  initUI(products, observeAuth, initialRole);
  if (!hasWelcomeGate) {
    const activeRole = localStorage.getItem('tipri_dashboard_role') === 'seller' && localStorage.getItem('tipri_user')
      ? 'seller'
      : 'buyer';
    enterDashboard(activeRole);
  }
  await Promise.all([loadWeather(), loadCountryMetadata()]);
}

startApplication();
