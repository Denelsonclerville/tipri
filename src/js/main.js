import { fetchProducts } from './api.js';
import { observeAuth } from './auth.js';
import { initUI, initWelcomeUI, loadWeather, state } from './ui.js';

async function startApplication() {
  if (document.querySelector('#welcome-gate')) {
    initWelcomeUI(observeAuth);
    return;
  }

  const requestedMode = new URLSearchParams(window.location.search).get('mode');
  state.currentMode = requestedMode === 'seller' ? 'seller' : 'buyer';
  document.body.classList.toggle('is-buyer-mode', state.currentMode === 'buyer');
  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    console.error('Listings could not load:', error);
  }
  initUI(products, (callback) => observeAuth((user) => {
    if (state.currentMode === 'seller' && !user) {
      window.location.replace('/?seller=1');
      return;
    }
    document.querySelector('#app-shell').classList.add('is-visible');
    callback(user);
  }));
  await loadWeather();
}

startApplication();
