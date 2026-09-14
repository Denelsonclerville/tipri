import { fetchProducts } from './api.js';
import { observeAuth } from './auth.js';
import { loadWeather } from './weather.js';
import { initUI } from './ui.js';

async function startApplication() {
  let products = [];
  try {
    products = await fetchProducts();
  } catch (error) {
    console.error('Listings could not load:', error);
  }
  initUI(products, observeAuth);
  await loadWeather();
}

startApplication();
