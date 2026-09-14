const STORAGE_KEYS = {
  user: 'marketplaceUser',
  locationAsked: 'marketplaceLocationAsked',
  filters: 'marketplaceFilters',
  preferences: 'marketplacePreferences',
  userLocation: 'marketplaceUserLocation',
  coordinates: 'marketplaceCoordinates',
  favorites: 'favorite_products',
  listings: 'my_listings'
};

export function readUser() {
  return localStorage.getItem(STORAGE_KEYS.user);
}

export function saveUser(name) {
  localStorage.setItem(STORAGE_KEYS.user, name);
}

export function saveUserLocation(location) {
  if (location) localStorage.setItem(STORAGE_KEYS.userLocation, location);
}

export function readUserLocation() {
  return localStorage.getItem(STORAGE_KEYS.userLocation) || '';
}

export function saveCoordinates(latitude, longitude) {
  localStorage.setItem(STORAGE_KEYS.coordinates, JSON.stringify({ latitude, longitude }));
}

export function readCoordinates() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.coordinates)) || null;
  } catch (error) {
    return null;
  }
}

export function saveLocationPreference(allowed) {
  localStorage.setItem(STORAGE_KEYS.locationAsked, String(allowed));
}

export function hasLocationPreference() {
  return localStorage.getItem(STORAGE_KEYS.locationAsked) !== null;
}

export function saveFilters(filters) {
  localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
}

export function readFilters() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.filters)) || {};
  } catch (error) {
    return {};
  }
}

export function savePreferences(preferences) {
  localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
}

export function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences)) || {};
  } catch (error) {
    return {};
  }
}

function readCollection(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function writeCollection(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

export function readFavorites() {
  return readCollection(STORAGE_KEYS.favorites);
}

export function saveFavorite(product) {
  const favorites = readFavorites().filter((item) => String(item.id) !== String(product.id));
  favorites.unshift({ ...product, savedAt: new Date().toISOString() });
  writeCollection(STORAGE_KEYS.favorites, favorites);
  return favorites;
}

export function removeFavorite(productId) {
  const favorites = readFavorites().filter((item) => String(item.id) !== String(productId));
  writeCollection(STORAGE_KEYS.favorites, favorites);
  return favorites;
}

export function isFavorite(productId) {
  return readFavorites().some((item) => String(item.id) === String(productId));
}

export function readMyListings() {
  return readCollection(STORAGE_KEYS.listings);
}

export function saveMyListing(listing) {
  const listings = readMyListings().filter((item) => String(item.id) !== String(listing.id));
  listings.unshift(listing);
  writeCollection(STORAGE_KEYS.listings, listings);
  return listings;
}

export function updateMyListing(listingId, changes) {
  const listings = readMyListings().map((item) => String(item.id) === String(listingId) ? { ...item, ...changes } : item);
  writeCollection(STORAGE_KEYS.listings, listings);
  return listings;
}

export function removeMyListing(listingId) {
  const listings = readMyListings().filter((item) => String(item.id) !== String(listingId));
  writeCollection(STORAGE_KEYS.listings, listings);
  return listings;
}
