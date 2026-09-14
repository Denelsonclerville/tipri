import { createProduct, deleteProduct, fetchProducts, updateProduct } from './api.js';
import { registerWithEmail, signInWithEmail, signInWithProviderCredentials, signInWithFacebook, signInWithGoogle, getAuthSetupMessage, logOut } from './auth.js';
import { isFavorite, readFavorites, readFilters, readMyListings, readPreferences, removeFavorite, removeMyListing, saveFavorite, saveFilters, saveMyListing, savePreferences, saveUser, saveUserLocation, updateMyListing } from './storage.js';

export const state = { products: [], filters: { query: '', category: '', location: '', condition: '' }, authenticatedUser: null, pendingPost: false, journey: 'seller' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

export function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character])); }

function currentUserId() {
  const user = state.authenticatedUser;
  return user?.uid || user?.email || user?.displayName || '';
}

function mergeListingState(products) {
  const listings = readMyListings();
  return products.map((product) => {
    const listing = listings.find((item) => String(item.id) === String(product.id));
    return listing ? { ...product, sold: listing.status === 'Sold' } : product;
  });
}

function renderFavoriteCount() {
  const button = $('#favorites-button');
  if (button) button.innerHTML = `&#10084;&#65039; Favorites (${readFavorites().length})`;
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
  if ($('#favorites-drawer').hidden && $('#listings-drawer').hidden) document.body.style.overflow = '';
}

function renderFavorites() {
  const favorites = readFavorites();
  $('#favorites-content').innerHTML = favorites.length ? `<div class="saved-list">${favorites.map((product) => `<article class="saved-item"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}"><div><h3>${escapeHtml(product.title)}</h3><p>${product.currency === 'USD' ? '$' : product.currency + ' '}${Number(product.price).toLocaleString()} · ${escapeHtml(product.location)}</p><div class="saved-actions"><button class="drawer-action" data-favorite-contact="${escapeHtml(product.id)}">WhatsApp ↗</button><button class="drawer-action danger" data-favorite-remove="${escapeHtml(product.id)}">Remove from Favorites</button></div></div></article>`).join('')}</div>` : '<p class="drawer-empty">You have no saved items yet. Tap the heart on a listing to keep it here.</p>';
  $$('[data-favorite-contact]').forEach((button) => button.addEventListener('click', () => contactSeller(favorites.find((item) => String(item.id) === button.dataset.favoriteContact))));
  $$('[data-favorite-remove]').forEach((button) => button.addEventListener('click', () => { removeFavorite(button.dataset.favoriteRemove); renderFavoriteCount(); renderFavorites(); renderProducts(); }));
}

function renderMyListings() {
  const listings = readMyListings().filter((listing) => listing.ownerId === currentUserId());
  $('#listings-content').innerHTML = listings.length ? `<div class="seller-list">${listings.map((listing) => `<article class="seller-item"><img src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.title)}"><div><h3>${escapeHtml(listing.title)}</h3><p>${listing.currency === 'USD' ? '$' : listing.currency + ' '}${Number(listing.price).toLocaleString()} · <span class="seller-status ${listing.status === 'Sold' ? 'sold' : ''}">${listing.status}</span></p><div class="seller-actions"><button class="drawer-action" data-listing-edit="${escapeHtml(listing.id)}">Edit Price/Description</button><button class="drawer-action" data-listing-toggle="${escapeHtml(listing.id)}">Mark as ${listing.status === 'Sold' ? 'Active' : 'Sold'}</button><button class="drawer-action danger" data-listing-delete="${escapeHtml(listing.id)}">Delete Listing</button></div></div></article>`).join('')}</div>` : '<p class="drawer-empty">You have not posted any listings yet.</p>';
  $$('[data-listing-edit]').forEach((button) => button.addEventListener('click', () => openListingEditor(button.dataset.listingEdit)));
  $$('[data-listing-toggle]').forEach((button) => button.addEventListener('click', () => toggleListingStatus(button.dataset.listingToggle)));
  $$('[data-listing-delete]').forEach((button) => button.addEventListener('click', () => deleteListing(button.dataset.listingDelete)));
}

async function refreshCatalog() {
  state.products = mergeListingState(await fetchProducts());
  renderLiveFeed();
  renderProducts();
}

export function renderProducts() {
  const { query, category, location, condition } = state.filters;
  const products = state.products.filter((product) => {
    const text = `${product.title} ${product.description} ${product.category}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!category || product.category === category) && (!location || product.location === location) && (!condition || product.condition === condition);
  });
  $('#listing-count').textContent = `${String(products.length).padStart(2, '0')} listing${products.length === 1 ? '' : 's'}`;
  $('#empty-state').hidden = products.length > 0;
  $('#product-grid').innerHTML = products.map((product, index) => `<article class="product-card ${product.sold ? 'is-sold' : ''}" style="animation-delay: ${index * 50}ms"><div class="product-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy"><span class="condition-badge ${product.condition.includes('Repair') ? 'repair' : ''}">${escapeHtml(product.condition)}</span><span class="listing-status ${product.sold ? 'sold' : ''}">${product.sold ? 'Sold' : 'Active'}</span><button class="favorite-button ${isFavorite(product.id) ? 'is-favorite' : ''}" data-product-id="${escapeHtml(product.id)}" aria-label="${isFavorite(product.id) ? 'Remove from favorites' : 'Add to favorites'}">${isFavorite(product.id) ? '&#9829;' : '&#9825;'}</button></div><div class="product-body"><p class="product-category">${escapeHtml(product.category)}</p><h3 class="product-title" title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</h3><div class="product-meta"><strong class="product-price">${product.currency === 'USD' ? '$' : product.currency + ' '}${Number(product.price).toLocaleString()}</strong><span class="product-location">⌖ ${escapeHtml(product.location)}</span></div><button class="contact-button" data-product-id="${escapeHtml(product.id)}">Contact seller via WhatsApp ↗</button></div></article>`).join('');
  $$('.contact-button').forEach((button) => button.addEventListener('click', () => contactSeller(state.products.find((product) => String(product.id) === button.dataset.productId))));
  $$('.favorite-button').forEach((button) => button.addEventListener('click', () => toggleFavorite(button.dataset.productId)));
}

function contactSeller(product) {
  if (!product) return;
  saveFavorite(product);
  renderFavoriteCount();
  const message = `Hello! I am interested in your listing: ${product.title} posted on Second-Hand Market.`;
  window.open(`https://wa.me/${product.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function toggleFavorite(productId) {
  const product = state.products.find((item) => String(item.id) === String(productId));
  if (!product) return;
  if (isFavorite(productId)) removeFavorite(productId);
  else saveFavorite(product);
  renderFavoriteCount();
  renderProducts();
}

function openModal(content) { $('#modal-content').innerHTML = content; $('#modal-backdrop').hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { $('#modal-backdrop').hidden = true; document.body.style.overflow = ''; }

function requireSellerAuth() {
  if (state.authenticatedUser) return openPostModal();
  state.pendingPost = true;
  openLoginModal('login', '', 'Please sign in or create an account to post your item.');
}

function showMarketplace() {
  $('#auth-gate').hidden = true;
  $('#app-shell').classList.add('is-visible');
}

function enterBuyerFlow() {
  state.journey = 'buyer';
  $('#app-shell').classList.add('buyer-mode');
  showMarketplace();
  $('#market').scrollIntoView({ behavior: 'smooth' });
}

function enterSellerFlow() {
  state.journey = 'seller';
  $('#app-shell').classList.remove('buyer-mode');
  showMarketplace();
  if (state.authenticatedUser) return openPostModal();
  state.pendingPost = true;
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
      if (isSignup) await registerWithEmail($('#seller-name').value, $('#seller-access-email').value, $('#seller-access-password').value);
      else await signInWithEmail($('#seller-access-email').value, $('#seller-access-password').value);
      closeModal();
      if (state.pendingPost) {
        state.pendingPost = false;
        openPostModal();
      }
    } catch (error) { alert(error.message); }
  });
}

function openPostModal() {
  openModal(`<h2 id="modal-title">Post an <em>item.</em></h2><p class="modal-intro">Share something useful with your local community. Required fields are marked with an asterisk.</p><form id="post-form"><div class="form-grid"><div class="form-field"><label for="title">Product title *</label><input id="title" name="title" required placeholder="e.g. Toyota RAV4 2017"></div><div class="form-field"><label for="price">Price *</label><input id="price" name="price" type="number" min="0" required placeholder="0"></div><div class="form-field"><label for="currency">Currency</label><select id="currency" name="currency"><option>USD</option><option>HTG</option></select></div><div class="form-field"><label for="category">Category *</label><select id="category" name="category" required><option value="">Choose one</option><option>Vehicles & Motorcycles</option><option>Generators & Energy Systems</option><option>Heavy Home Appliances</option><option>Electronics</option><option>Furniture</option><option>Appliances</option><option>Solar & Tech</option><option>Clothing</option></select></div><div class="form-field"><label for="condition">Condition *</label><select id="condition" name="condition" required><option value="">Choose one</option><option>Fully Functional</option><option>Authentic Used Condition</option><option>Needs Minor Maintenance</option><option>Like New</option><option>Good Condition</option><option>Needs Minor Repair</option></select></div><div class="form-field"><label for="location">City / location *</label><input id="location" name="location" required placeholder="e.g. Delmas"></div><div class="form-field full"><label for="description">Description</label><textarea id="description" name="description" placeholder="Tell buyers what makes it special..."></textarea></div><div class="form-field"><label for="image">Image URL</label><input id="image" name="image" type="url" placeholder="https://..."></div><div class="form-field"><label for="phone">WhatsApp number *</label><input id="phone" name="phone" required placeholder="+509 3700 1234"></div></div><button class="button button-dark form-submit" type="submit">Publish listing <span>↗</span></button></form>`);
  $('#post-form').addEventListener('submit', submitPost);
}

async function submitPost(event) {
  event.preventDefault();
  try {
    const product = Object.fromEntries(new FormData(event.currentTarget));
    const createdProduct = await createProduct({ ...product, owner: currentUserId() });
    saveMyListing({ ...createdProduct, ownerId: currentUserId(), status: 'Active', postedAt: new Date().toISOString() });
    saveUserLocation(product.location);
    closeModal();
    state.filters = { query: '', category: '', location: '', condition: '' };
    syncFilterInputs();
    await refreshCatalog();
    renderMyListings();
    $('#market').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { alert(error.message); }
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
  $('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); try { if (isRegister) await registerWithEmail($('#name').value, $('#email').value, $('#password').value); else if (isProviderLogin) await signInWithProviderCredentials(provider, $('#email').value, $('#password').value); else await signInWithEmail($('#email').value, $('#password').value); closeModal(); if (state.pendingPost) { state.pendingPost = false; openPostModal(); } } catch (error) { alert(error.message); } });
  if (!isProviderLogin) { $('#google-login').addEventListener('click', () => openLoginModal('login', 'Google')); $('#facebook-login').addEventListener('click', () => openLoginModal('login', 'Facebook')); }
}

async function runAuth(action) { try { await action(); closeModal(); if (state.pendingPost) { state.pendingPost = false; openPostModal(); } } catch (error) { alert(error.message); } }
function setLoggedIn(user) { const name = user.displayName || user.email.split('@')[0]; saveUser(name); state.authenticatedUser = user; $('#listings-button').hidden = false; const initials = name.slice(0, 2).toUpperCase(); $('#auth-area').innerHTML = `<div class="profile-chip"><span>${initials}</span>${escapeHtml(name)}</div><button class="text-button" id="logout-button">Log out</button><button class="button button-dark" id="post-top-button">Post an item <span>↗</span></button>`; $('#post-top-button').addEventListener('click', requireSellerAuth); $('#logout-button').addEventListener('click', () => logOut()); renderMyListings(); }
function syncFilterInputs() { $('#catalog-search').value = state.filters.query; $('#category-filter').value = state.filters.category; $('#location-filter').value = state.filters.location; $('#condition-filter').value = state.filters.condition; }
function syncFilters() { state.filters = { query: $('#catalog-search').value, category: $('#category-filter').value, location: $('#location-filter').value, condition: $('#condition-filter').value }; saveFilters(state.filters); renderProducts(); }

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
      $('#listings-button').hidden = true;
      $('#auth-area').innerHTML = '<button class="text-button" id="login-button">Log in</button><button class="button button-dark" id="post-top-button">Post an item <span>↗</span></button>';
      localStorage.removeItem('marketplaceUser');
      $('#login-button').addEventListener('click', () => openLoginModal('login'));
      $('#post-top-button').addEventListener('click', requireSellerAuth);
    }
  });
  $('#post-top-button').addEventListener('click', requireSellerAuth);
  $('#login-button').addEventListener('click', () => openLoginModal('login'));
  $('#buyer-entry').addEventListener('click', enterBuyerFlow);
  $('#seller-entry').addEventListener('click', enterSellerFlow);
  $('#browse-button').addEventListener('click', enterBuyerFlow);
  $('#hero-post-button').addEventListener('click', enterSellerFlow);
  if ($('#how-it-works')) $('#how-it-works').addEventListener('click', () => alert('Browse a listing, check its details, and meet the seller in a safe public location.'));
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); });
  $('#favorites-button').addEventListener('click', () => { renderFavorites(); openDrawer('favorites-drawer'); });
  $('#listings-button').addEventListener('click', () => { renderMyListings(); openDrawer('listings-drawer'); });
  $$('[data-close-drawer]').forEach((button) => button.addEventListener('click', () => closeDrawer(button.dataset.closeDrawer)));
  $('#header-search').addEventListener('input', (event) => { $('#catalog-search').value = event.target.value; syncFilters(); });
  $('#catalog-search').addEventListener('input', syncFilters);
  ['category-filter', 'location-filter', 'condition-filter'].forEach((id) => $(`#${id}`).addEventListener('change', syncFilters));
  $$('.category-pill').forEach((pill) => pill.addEventListener('click', () => { $$('.category-pill').forEach((item) => item.classList.remove('active')); pill.classList.add('active'); $('#category-filter').value = pill.dataset.category; syncFilters(); }));
  if (getAuthSetupMessage()) console.warn(getAuthSetupMessage());
  renderFavoriteCount();
  renderLiveFeed();
  state.products = mergeListingState(state.products);
  renderProducts();
}
