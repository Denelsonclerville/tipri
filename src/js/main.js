import { fetchProducts } from './api.js';
import { observeAuth } from './auth.js';
import { enterDashboard, initUI, initWelcomeUI, loadWeather } from './ui.js';

async function loadCurrencyMetadata() {
  const countryInfo = document.querySelector('#country-info');
  if (!countryInfo) return;

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) throw new Error(`Unable to load exchange rates (${response.status}).`);
    const data = await response.json();
    const rate = data?.rates?.HTG;
    if (data.result !== 'success' || !Number.isFinite(rate)) throw new Error('Exchange-rate response is incomplete.');
    countryInfo.textContent = `1 USD ≈ ${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(rate)} HTG`;
  } catch (error) {
    console.error('Exchange rate could not load:', error);
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
