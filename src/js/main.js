import { fetchProducts } from './api.js';
import { observeAuth } from './auth.js';
import { enterDashboard, initUI, initWelcomeUI, loadWeather, updateUsdToHtgRate } from './ui.js';

async function loadCurrencyMetadata() {
  const countryInfo = document.querySelector('#country-info');
  if (!countryInfo) return;

  try {
    const countryResponse = await fetch('https://restcountries.com/v3.1/name/haiti?fields=name,currencies');
    if (!countryResponse.ok) throw new Error(`Unable to load country metadata (${countryResponse.status}).`);
    const [country] = await countryResponse.json();
    const countryName = country?.name?.common;
    const currencyCode = Object.keys(country?.currencies || {})[0];
    if (!countryName || !currencyCode) throw new Error('Country metadata is incomplete.');

    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error(`Unable to load exchange rates (${response.status}).`);
    const data = await response.json();
    const rate = data?.rates?.[currencyCode];
    if (data.result !== 'success' || !Number.isFinite(rate)) throw new Error('Exchange-rate response is incomplete.');
    updateUsdToHtgRate(currencyCode === 'HTG' ? rate : null);
    countryInfo.textContent = `${countryName} · 1 USD ≈ ${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(rate)} ${currencyCode}`;
  } catch (error) {
    console.error('Exchange rate could not load:', error);
    updateUsdToHtgRate(null);
    countryInfo.textContent = 'USD / HTG exchange rate unavailable';
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
  await Promise.all([loadWeather(), loadCurrencyMetadata()]);
}

startApplication();
