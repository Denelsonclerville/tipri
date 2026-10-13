import { createProduct, deleteProduct, fetchProducts, fetchWeather, updateProduct } from './api.js';
import { registerWithEmail, signInWithEmail, signInWithProviderCredentials, signInWithFacebook, signInWithGoogle, getAuthSetupMessage, logOut } from './auth.js';
import { isFavorite, readCoordinates, readFavorites, readFilters, readMyListings, readPreferences, readUserLocation, removeFavorite, removeMyListing, saveCoordinates, saveFavorite, saveFilters, saveMyListing, savePreferences, saveUser, saveUserLocation, updateMyListing } from './storage.js';

export const state = { products: [], filters: { query: '', category: '', location: '', condition: '' }, authenticatedUser: null, pendingPost: false, pendingSellerAccess: false, currentMode: 'buyer', visibleProductLimit: 8 };
const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let marketplaceMap = null;
let listingMarkers = [];
let featuredProductIds = [];

export function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character])); }

function currentUserId() {
  const user = state.authenticatedUser;
  return user?.uid || user?.email || user?.displayName || '';
}

function mergeListingState(products) {
  const listings = readMyListings();
  return products.map((product) => {
    const listing = listings.find((item) => String(item.id) === String(product.id));
    return listing ? { ...product, status: listing.status.toLowerCase(), sold: listing.status === 'Sold' } : product;
  });
}

function renderFavoriteCount() {
  const count = $('#favorite-count');
  if (count) count.textContent = String(readFavorites().length);
  const button = $('#bottom-favorites');
  if (button) button.setAttribute('aria-label', `Saved favorites, ${readFavorites().length} items`);
}

function locationCoordinates(location = '') {
  const places = {
    'pétion-ville': [18.512, -72.286],
    delmas: [18.544, -72.302],
    tabarre: [18.583, -72.27],
    turgeau: [18.532, -72.33],
    kenscoff: [18.448, -72.283],
    carrefour: [18.541, -72.399]
  };
  return places[location.toLowerCase()] || [18.539, -72.336];
}

function initializeMap(products = state.products) {
  if (!window.L || !$('#map-view')) return;
  const center = [18.539, -72.336];
  if (!marketplaceMap) {
    marketplaceMap = window.L.map('map-view', { scrollWheelZoom: false }).setView(center, 12);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(marketplaceMap);
  }
  listingMarkers.forEach((marker) => marker.remove());
  listingMarkers = products.map((product) => {
    const marker = window.L.marker(locationCoordinates(product.location)).addTo(marketplaceMap);
    marker.bindPopup(`<strong>${escapeHtml(product.title)}</strong><br>${escapeHtml(product.location)}`);
    marker.on('click', () => {
      state.filters.location = product.location || '';
      syncFilterInputs();
      renderProducts();
    });
    return marker;
  });
  window.requestAnimationFrame(() => marketplaceMap.invalidateSize());
}

function randomProducts(products, limit) {
  const shuffled = [...products];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limit);
}

function renderLiveFeed() {
  const track = $('#live-feed-track');
  if (!track) return;
  const priorityProducts = state.products.filter((product) => ['Vehicles & Motorcycles', 'Generators & Energy Systems', 'Heavy Home Appliances'].includes(product.category));
  const products = priorityProducts.length ? priorityProducts : state.products;
  const cards = products.map((product) => `<article class="live-feed-card"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}"><div><span>${escapeHtml(product.category)}</span><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.posted || 'Just now')} · ${escapeHtml(product.location)}</small></div></article>`).join('');
  track.innerHTML = `${cards}${cards}`;
}

function openDrawer(id) {
  $(`#${id}`).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDrawer(id) {
  $(`#${id}`).hidden = true;
  if ($('#favorites-drawer').hidden && $('#listings-drawer').hidden && $('#account-drawer').hidden && $('#notifications-drawer').hidden) document.body.style.overflow = '';
}

function renderFavorites() {
  const favorites = readFavorites();
  $('#favorites-content').innerHTML = favorites.length ? `<div class="saved-list">${favorites.map((product) => `<article class="saved-item"><img src="${escapeHtml(product.image_url || product.image)}" alt="${escapeHtml(product.title)}"><div><h3>${escapeHtml(product.title)}</h3><p>${product.currency === 'USD' ? '$' : product.currency + ' '}${Number(product.price).toLocaleString()} · ${escapeHtml(product.location)}</p><div class="saved-actions"><button class="drawer-action" data-favorite-contact="${escapeHtml(product.id)}">WhatsApp ↗</button><button class="drawer-action danger" data-favorite-remove="${escapeHtml(product.id)}">Remove from Favorites</button></div></div></article>`).join('')}</div>` : '<p class="drawer-empty">You have no saved items yet. Tap the heart on a listing to keep it here.</p>';
  $$('[data-favorite-contact]').forEach((button) => button.addEventListener('click', () => contactSeller(favorites.find((item) => String(item.id) === button.dataset.favoriteContact))));
  $$('[data-favorite-remove]').forEach((button) => button.addEventListener('click', () => { removeFavorite(button.dataset.favoriteRemove); renderFavoriteCount(); renderFavorites(); renderProducts(); }));
}

function renderMyListings() {
  const listings = readMyListings().filter((listing) => listing.ownerId === currentUserId());
  const countBadge = $('#listing-count-badge');
  if (countBadge) {
    countBadge.textContent = String(listings.length);
    countBadge.hidden = listings.length === 0;
  }
  $('#listings-content').innerHTML = listings.length ? `<div class="seller-list">${listings.map((listing) => `<article class="seller-item"><img src="${escapeHtml(listing.image_url || listing.image)}" alt="${escapeHtml(listing.title)}"><div><h3>${escapeHtml(listing.title)}</h3><p>${listing.currency === 'USD' ? '$' : listing.currency + ' '}${Number(listing.price).toLocaleString()} · <span class="seller-status ${listing.status === 'Sold' ? 'sold' : ''}">${escapeHtml(listing.status)}</span></p><div class="seller-actions"><button class="drawer-action" data-listing-edit="${escapeHtml(listing.id)}">Edit Price/Description</button><button class="drawer-action" data-listing-toggle="${escapeHtml(listing.id)}">Mark as ${listing.status === 'Sold' ? 'Active' : 'Sold'}</button><button class="drawer-action danger" data-listing-delete="${escapeHtml(listing.id)}">Delete Listing</button></div></div></article>`).join('')}</div>` : '<p class="drawer-empty">You have not posted any listings yet.</p>';
  $$('[data-listing-edit]').forEach((button) => button.addEventListener('click', () => openListingEditor(button.dataset.listingEdit)));
  $$('[data-listing-toggle]').forEach((button) => button.addEventListener('click', () => toggleListingStatus(button.dataset.listingToggle)));
  $$('[data-listing-delete]').forEach((button) => button.addEventListener('click', () => deleteListing(button.dataset.listingDelete)));
}

function renderAccount() {
  const user = state.authenticatedUser;
  const name = user?.displayName || user?.email?.split('@')[0] || 'Marketplace member';
  $('#account-content').innerHTML = `<div class="account-summary"><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(user?.email || '')}</small></span><button class="drawer-action danger" id="account-logout" type="button">Log out</button></div>`;
  $('#account-logout').addEventListener('click', () => logOut());
}

function renderNotifications() {
  $('#notifications-content').innerHTML = '<p class="drawer-empty">No notifications yet. Buyer messages are not connected to the marketplace yet, so new contacts cannot be counted here for now.</p>';
}

function syncNavigationMode() {
  const isSeller = state.currentMode === 'seller';
  $('#bottom-activity-label').textContent = isSeller ? 'My listings' : 'Saved';
  $('#bottom-activity').setAttribute('aria-label', isSeller ? 'My listings' : 'Saved items');
  $('#bottom-activity').querySelector('span').textContent = isSeller ? '▣' : '♡';
  $('#listing-count-badge').hidden = !isSeller || Number($('#listing-count-badge').textContent) === 0;
}

async function refreshCatalog() {
  state.products = mergeListingState(await fetchProducts());
  renderLiveFeed();
  initializeMap();
  renderProducts();
}

export function renderProducts() {
  const { query, category, location, condition } = state.filters;
  const products = state.products.filter((product) => {
    const text = `${product.title} ${product.description} ${product.category} ${product.location}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!category || product.category === category) && (!location || product.location === location) && (!condition || product.condition === condition);
  });
  const hasFilters = Boolean(query || category || location || condition);
  if (!hasFilters && !featuredProductIds.some((id) => products.some((product) => String(product.id) === id))) {
    featuredProductIds = randomProducts(products, 8).map((product) => String(product.id));
  }
  const visibleProducts = hasFilters
    ? products
    : featuredProductIds.map((id) => products.find((product) => String(product.id) === id)).filter(Boolean);
  $('#listing-count').textContent = `${String(products.length).padStart(2, '0')} listing${products.length === 1 ? '' : 's'}`;
  $('#empty-state').hidden = products.length > 0;
  $('#show-more-products').hidden = true;
  $('#product-grid').innerHTML = visibleProducts.map((product, index) => {
    const isSold = product.status === 'sold' || product.sold;
    return `<article class="product-card ${isSold ? 'is-sold' : ''}" style="animation-delay: ${index * 50}ms"><div class="product-image"><img src="${escapeHtml(product.image_url || product.image)}" alt="${escapeHtml(product.title)}" loading="lazy"><span class="condition-badge ${product.condition.includes('Repair') ? 'repair' : ''}">${escapeHtml(product.condition)}</span><span class="listing-status ${isSold ? 'sold' : ''}">${isSold ? 'Sold' : 'Active'}</span><button class="favorite-button ${isFavorite(product.id) ? 'is-favorite' : ''}" data-product-id="${escapeHtml(product.id)}" aria-label="${isFavorite(product.id) ? 'Remove from favorites' : 'Add to favorites'}">${isFavorite(product.id) ? '&#9829;' : '&#9825;'}</button></div><div class="product-body"><p class="product-category">${escapeHtml(product.category)}</p><h3 class="product-title" title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</h3><div class="product-meta"><strong class="product-price">${product.currency === 'USD' ? '$' : product.currency + ' '}${Number(product.price).toLocaleString()}</strong><span class="product-location">⌖ ${escapeHtml(product.location)}</span></div><button class="contact-button" data-product-id="${escapeHtml(product.id)}">Contact seller via WhatsApp ↗</button></div></article>`;
  }).join('');
  $$('.contact-button').forEach((button) => button.addEventListener('click', () => contactSeller(state.products.find((product) => String(product.id) === button.dataset.productId))));
  $$('.favorite-button').forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.productId)));
}

function contactSeller(product) {
  if (!product) return;
  if (!state.authenticatedUser) return openLoginModal('login', '', 'Log in to contact a seller.');
  saveFavorite(product);
  renderFavoriteCount();
  const message = `Hello! I am interested in your listing: ${product.title} posted on Second-Hand Market.`;
  window.open(`https://wa.me/${product.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function toggleFavorite(productId) {
  if (!state.authenticatedUser) return openLoginModal('login', '', 'Log in to save items.');
  const product = state.products.find((item) => String(item.id) === String(productId));
  if (!product) return;
  if (isFavorite(productId)) removeFavorite(productId);
  else saveFavorite(product);
  renderFavoriteCount();
  renderProducts();
}

function openModal(content) { $('#modal-content').innerHTML = content; $('#modal-backdrop').hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { $('#modal-backdrop').hidden = true; document.body.style.overflow = ''; }

function showToast(message) {
  const toast = $('#toast-container');
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 4000);
}

function enterDashboard(role) {
  if (role === 'seller' && !state.authenticatedUser) {
    startSellerJourney();
    return;
  }

  state.currentMode = role;
  const welcomeGate = $('#welcome-gate');
  if (!$('#app-shell')) {
    window.location.assign(`/dashboard.html?mode=${role}`);
    return;
  }
  if (welcomeGate) welcomeGate.hidden = true;
  const shell = $('#app-shell');
  shell.hidden = false;
  shell.classList.add('is-visible');
  shell.classList.toggle('buyer-mode', role === 'buyer');
  shell.classList.toggle('seller-mode', role === 'seller');
  $('.bottom-nav').hidden = !state.authenticatedUser;
  document.body.classList.toggle('is-buyer-mode', role === 'buyer');
  syncNavigationMode();
  initializeMap();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function continueAfterAuthentication() {
  closeModal();
  if (state.pendingSellerAccess) {
    state.pendingSellerAccess = false;
    enterDashboard('seller');
  }
  if (state.pendingPost) {
    state.pendingPost = false;
    openPostModal();
  }
}

function startSellerJourney() {
  if (state.authenticatedUser) return enterDashboard('seller');
  state.pendingSellerAccess = true;
  openSellerAccessModal();
}

export function initWelcomeUI(observeAuthentication) {
  let openSellerAccessOnAuth = new URLSearchParams(window.location.search).get('seller') === '1';
  let resolveAuthReady;
  let authReadyResolved = false;
  const authReady = new Promise((resolve) => {
    resolveAuthReady = resolve;
  });
  if (openSellerAccessOnAuth) window.history.replaceState({}, '', '/');

  observeAuthentication((user) => {
    state.authenticatedUser = user;
    if (!authReadyResolved) {
      authReadyResolved = true;
      resolveAuthReady(user);
    }
    if (!openSellerAccessOnAuth) return;
    openSellerAccessOnAuth = false;
    if (user) enterDashboard('seller');
    else startSellerJourney();
  });

  $('#buyer-btn').addEventListener('click', () => enterDashboard('buyer'));
  $('#seller-btn').addEventListener('click', async () => {
    if (await authReady) enterDashboard('seller');
    else startSellerJourney();
  });
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (event) => {
    if (event.target === $('#modal-backdrop')) closeModal();
  });
}

function requireSellerAuth() {
  if (state.authenticatedUser) {
    enterDashboard('seller');
    return openPostModal();
  }
  state.pendingPost = true;
  state.pendingSellerAccess = true;
  openSellerAccessModal();
}

function openSellerAccessModal() {
  renderSellerAccessMode('login');
}

function renderSellerAccessMode(mode) {
  const isSignup = mode === 'signup';
  openModal(`<h2 id="modal-title">Seller <em>access.</em></h2><p class="auth-guard-message">You should log in or sign up first to access your seller space.</p><p class="modal-intro">${isSignup ? 'Create your seller account to start posting products.' : 'Log in to access your seller space and post products.'}</p><form id="seller-access-form">${isSignup ? '<div class="form-field"><label for="seller-name">Full name</label><input id="seller-name" required placeholder="Your name"></div>' : ''}<div class="form-field"><label for="seller-access-email">Email address</label><input id="seller-access-email" type="email" required placeholder="you@example.com"></div><div class="form-field"><label for="seller-access-password">Password</label><input id="seller-access-password" type="password" minlength="6" required placeholder="At least 6 characters"></div><button class="button button-dark form-submit" type="submit">${isSignup ? 'Sign up' : 'Log in'} <span>↗</span></button></form><div class="seller-switch">${isSignup ? 'Already have an account?' : 'New seller?'} <button class="inline-link" id="seller-switch-button" type="button">${isSignup ? 'Log in' : 'Sign up'}</button></div>`);
  $('#seller-switch-button').addEventListener('click', () => renderSellerAccessMode(isSignup ? 'login' : 'signup'));
  $('#seller-access-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const authenticatedUser = isSignup
        ? await registerWithEmail($('#seller-name').value, $('#seller-access-email').value, $('#seller-access-password').value)
        : await signInWithEmail($('#seller-access-email').value, $('#seller-access-password').value);
      state.authenticatedUser = authenticatedUser.user || authenticatedUser;
      continueAfterAuthentication();
    } catch (error) { alert(error.message); }
  });
}

function openPostModal() {
  openModal(`<h2 id="modal-title">Post an <em>item.</em></h2><p class="modal-intro">Share something useful with your local community. Required fields are marked with an asterisk.</p><form id="post-form"><div class="form-grid"><div class="form-field"><label for="title">Product title *</label><input id="title" name="title" required placeholder="e.g. Toyota RAV4 2017"></div><div class="form-field"><label for="price">Price *</label><input id="price" name="price" type="number" min="0" required placeholder="0"></div><div class="form-field"><label for="currency">Currency</label><select id="currency" name="currency"><option>USD</option><option>HTG</option></select></div><div class="form-field"><label for="category">Category *</label><select id="category" name="category" required><option value="">Choose one</option><option>Vehicles & Motorcycles</option><option>Generators & Energy Systems</option><option>Heavy Home Appliances</option><option>Electronics</option><option>Furniture</option><option>Appliances</option><option>Solar & Tech</option><option>Clothing</option></select></div><div class="form-field"><label for="condition">Condition *</label><select id="condition" name="condition" required><option value="">Choose one</option><option>Fully Functional</option><option>Authentic Used Condition</option><option>Needs Minor Maintenance</option><option>Like New</option><option>Good Condition</option><option>Needs Minor Repair</option></select></div><div class="form-field"><label for="location">City / location *</label><input id="location" name="location" required placeholder="e.g. Delmas"></div><div class="form-field full"><label for="description">Description</label><textarea id="description" name="description" placeholder="Tell buyers what makes it special..."></textarea></div><div class="form-field"><label for="image">Image URL</label><input id="image" name="image" type="url" placeholder="https://..."></div><div class="form-field"><label for="phone">WhatsApp number *</label><input id="phone" name="phone" required placeholder="+509 3700 1234"></div></div><button class="button button-dark form-submit" type="submit">Publish listing <span>↗</span></button></form>`);
  $('#post-form').addEventListener('submit', submitPost);
}

async function submitPost(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const product = Object.fromEntries(new FormData(form));
  const imageUrl = product.image.trim() || DEFAULT_PRODUCT_IMAGE;
  const duplicate = state.products.some((existing) =>
    existing.title.trim().toLowerCase() === product.title.trim().toLowerCase() &&
    Number(existing.price) === Number(product.price) &&
    String(existing.image_url || existing.image || DEFAULT_PRODUCT_IMAGE).trim() === imageUrl
  );
  form.querySelectorAll('.is-duplicate').forEach((field) => field.classList.remove('is-duplicate'));
  form.querySelectorAll('.has-duplicate').forEach((field) => field.classList.remove('has-duplicate'));
  if (duplicate) {
    ['title', 'price', 'image'].forEach((name) => {
      const field = form.elements.namedItem(name);
      field.classList.add('is-duplicate');
      field.closest('.form-field').classList.add('has-duplicate');
    });
    showToast('This item already exists in the marketplace.');
    form.elements.namedItem('title').focus();
    return;
  }
  try {
    const createdProduct = await createProduct({ ...product, owner: currentUserId() });
    saveMyListing({ ...createdProduct, ownerId: currentUserId(), status: 'Active', postedAt: new Date().toISOString() });
    saveUserLocation(product.location);
    closeModal();
    state.filters = { query: '', category: '', location: '', condition: '' };
    syncFilterInputs();
    await refreshCatalog();
    renderMyListings();
    $('#market').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    if (error.message === 'This item already exists in the marketplace.') {
      ['title', 'price', 'image'].forEach((name) => {
        const field = form.elements.namedItem(name);
        field.classList.add('is-duplicate');
        field.closest('.form-field').classList.add('has-duplicate');
      });
      showToast(error.message);
      return;
    }
    alert(error.message);
  }
}

function openListingEditor(listingId) {
  const listing = readMyListings().find((item) => String(item.id) === String(listingId));
  if (!listing) return;
  openModal(`<h2 id="modal-title">Edit your <em>listing.</em></h2><p class="modal-intro">Update the price or description shown to buyers.</p><form id="edit-listing-form"><div class="form-field"><label for="edit-price">Price</label><input id="edit-price" name="price" type="number" min="0" required value="${escapeHtml(listing.price)}"></div><div class="form-field" style="margin-top:14px"><label for="edit-description">Description</label><textarea id="edit-description" name="description">${escapeHtml(listing.description || '')}</textarea></div><button class="button button-dark form-submit" type="submit">Save changes <span>↗</span></button></form>`);
  $('#edit-listing-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const changes = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const updated = await updateProduct(listingId, changes);
      updateMyListing(listingId, changes);
      state.products = state.products.map((product) => String(product.id) === String(listingId) ? { ...product, ...updated } : product);
      closeModal();
      renderProducts();
      renderMyListings();
    } catch (error) { alert(error.message); }
  });
}

async function toggleListingStatus(listingId) {
  const listing = readMyListings().find((item) => String(item.id) === String(listingId));
  if (!listing) return;
  const status = listing.status === 'Sold' ? 'Active' : 'Sold';
  try {
    await updateProduct(listingId, { sold: status === 'Sold' });
    updateMyListing(listingId, { status });
    await refreshCatalog();
    renderMyListings();
  } catch (error) { alert(error.message); }
}

async function deleteListing(listingId) {
  if (!window.confirm('Delete this listing permanently?')) return;
  try {
    await deleteProduct(listingId);
    removeMyListing(listingId);
    await refreshCatalog();
    renderMyListings();
  } catch (error) { alert(error.message); }
}

function openLoginModal(mode = 'login', provider = '', guardMessage = '') {
  const isRegister = mode === 'register';
  const isProviderLogin = Boolean(provider);
  const title = isRegister ? 'Join the <em>market.</em>' : isProviderLogin ? `Continue with <em>${provider}.</em>` : 'Welcome <em>back.</em>';
  const intro = isRegister ? 'Create your free account and start discovering local finds.' : isProviderLogin ? `Enter your ${provider} account details to continue.` : 'Sign in to manage your listings and save your favorite finds.';
  const action = isRegister ? 'Create account' : 'Sign in';
  const identifierLabel = provider === 'Facebook' ? 'Username or email' : 'Google email';
  const identifierType = provider === 'Facebook' ? 'text' : 'email';
  openModal(`<h2 id="modal-title">${title}</h2>${guardMessage ? `<p class="auth-guard-message">${guardMessage}</p>` : ''}<p class="modal-intro">${intro}</p><div class="login-options">${isProviderLogin ? '' : '<button class="google-button" id="google-login">G&nbsp;&nbsp; Continue with Google</button><button class="google-button" id="facebook-login">f&nbsp;&nbsp; Continue with Facebook</button><div class="divider">or continue with email</div>'}<form id="login-form">${isRegister ? '<div class="form-field"><label for="name">Full name</label><input id="name" required placeholder="Your name"></div>' : ''}<div class="form-field"><label for="email">${isProviderLogin ? identifierLabel : 'Email address'}</label><input id="email" type="${isProviderLogin ? identifierType : 'email'}" required placeholder="${isProviderLogin && provider === 'Facebook' ? 'username or email' : 'you@example.com'}"></div><div class="form-field" style="margin-top:14px"><label for="password">Password</label><input id="password" type="password" minlength="6" required placeholder="At least 6 characters"></div><button class="button button-dark form-submit" type="submit">${action} <span>↗</span></button></form></div>`);
  $('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); try { if (isRegister) await registerWithEmail($('#name').value, $('#email').value, $('#password').value); else if (isProviderLogin) await signInWithProviderCredentials(provider, $('#email').value, $('#password').value); else await signInWithEmail($('#email').value, $('#password').value); continueAfterAuthentication(); } catch (error) { alert(error.message); } });
  if (!isProviderLogin) { $('#google-login').addEventListener('click', () => openLoginModal('login', 'Google')); $('#facebook-login').addEventListener('click', () => openLoginModal('login', 'Facebook')); }
}

async function runAuth(action) { try { await action(); closeModal(); if (state.pendingPost) { state.pendingPost = false; openPostModal(); } } catch (error) { alert(error.message); } }
function setLoggedIn(user) {
  const name = user.displayName || user.email?.split('@')[0] || 'Marketplace member';
  saveUser(name);
  state.authenticatedUser = user;
  document.body.classList.add('is-authenticated');
  $('#app-shell').classList.add('is-authenticated');
  $('.bottom-nav').hidden = false;
  syncNavigationMode();
  const profileButton = $('#profile-button');
  profileButton.textContent = name.slice(0, 1).toUpperCase();
  profileButton.setAttribute('aria-label', `Profile for ${name}`);
  profileButton.title = `Profile for ${name}`;
  $('#profile-status').textContent = 'Account';
  const accountNavButton = $('#bottom-profile');
  accountNavButton.querySelector('span').textContent = name.slice(0, 1).toUpperCase();
  accountNavButton.querySelector('small').textContent = 'Account';
  accountNavButton.setAttribute('aria-label', `Account for ${name}`);
  renderAccount();
  renderMyListings();
}
function syncFilterInputs() { $('#catalog-search').value = state.filters.query; $('#category-filter').value = state.filters.category; $('#location-filter').value = state.filters.location; $('#condition-filter').value = state.filters.condition; }
function syncFilters() { state.filters = { query: $('#catalog-search').value, category: $('#category-filter').value, location: $('#location-filter').value, condition: $('#condition-filter').value }; saveFilters(state.filters); renderProducts(); }

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

async function requestWeatherLocation() {
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
    const weather = await fetchWeather(await requestWeatherLocation());
    const value = weather && typeof weather === 'object' ? weather : buildFallbackWeather();
    renderWeather(value);
  } catch {
    renderWeather(buildFallbackWeather());
  }
}

export function initUI(products, observeAuthentication) {
  state.products = products;
  state.filters = { ...state.filters, ...readFilters() };
  const preferences = readPreferences();
  if (preferences.compactMode) document.body.classList.add('compact-mode');
  syncFilterInputs();
  observeAuthentication((user) => {
    if (user) setLoggedIn(user);
    else {
      state.authenticatedUser = null;
      document.body.classList.remove('is-authenticated');
      $('#app-shell').classList.remove('is-authenticated');
      $('.bottom-nav').hidden = true;
      $('#profile-button').textContent = 'P';
      $('#profile-button').setAttribute('aria-label', 'Log in');
      $('#profile-button').title = 'Log in';
      $('#profile-status').textContent = 'Log in';
      const accountNavButton = $('#bottom-profile');
      accountNavButton.querySelector('span').textContent = '◉';
      accountNavButton.querySelector('small').textContent = 'Profile';
      accountNavButton.setAttribute('aria-label', 'Profile');
      localStorage.removeItem('marketplaceUser');
    }
  });
  $('#post-top-button').addEventListener('click', requireSellerAuth);
  $('#seller-nav-button').addEventListener('click', requireSellerAuth);
  $('#header-login').addEventListener('click', () => openLoginModal('login'));
  $('#header-signup').addEventListener('click', () => openLoginModal('register'));
  $('#show-more-products').addEventListener('click', () => { state.visibleProductLimit += 8; renderProducts(); });
  $('#profile-button').addEventListener('click', () => openLoginModal('login'));
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); });
  $('#bottom-profile').addEventListener('click', () => {
    renderAccount();
    openDrawer('account-drawer');
  });
  $('#bottom-activity').addEventListener('click', () => {
    if (state.currentMode === 'seller') {
      renderMyListings();
      openDrawer('listings-drawer');
      return;
    }
    renderFavorites();
    openDrawer('favorites-drawer');
  });
  $('#bottom-notifications').addEventListener('click', () => {
    renderNotifications();
    openDrawer('notifications-drawer');
  });
  $('#map-reset').addEventListener('click', () => marketplaceMap?.setView([18.539, -72.336], 12));
  $$('[data-close-drawer]').forEach((button) => button.addEventListener('click', () => closeDrawer(button.dataset.closeDrawer)));
  $('#header-search').addEventListener('input', (event) => { $('#catalog-search').value = event.target.value; syncFilters(); });
  $('#search-toggle').addEventListener('click', () => {
    const isOpen = $('.site-header').classList.toggle('search-open');
    $('#search-toggle').setAttribute('aria-expanded', String(isOpen));
    if (isOpen) $('#header-search').focus();
  });
  $('#catalog-search').addEventListener('input', () => { state.visibleProductLimit = 8; syncFilters(); });
  ['category-filter', 'location-filter', 'condition-filter'].forEach((id) => $(`#${id}`).addEventListener('change', () => { state.visibleProductLimit = 8; syncFilters(); }));
  $$('.category-pill').forEach((pill) => pill.addEventListener('click', () => { $$('.category-pill').forEach((item) => item.classList.remove('active')); pill.classList.add('active'); $('#category-filter').value = pill.dataset.category; syncFilters(); }));
  if (getAuthSetupMessage()) console.warn(getAuthSetupMessage());
  renderFavoriteCount();
  renderLiveFeed();
  state.products = mergeListingState(state.products);
  syncNavigationMode();
  initializeMap();
  renderProducts();
  window.setInterval(() => {
    if (!Object.values(state.filters).some(Boolean)) {
      featuredProductIds = [];
      renderProducts();
    }
  }, 18000);
}
