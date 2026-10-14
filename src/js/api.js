const PRODUCTS_STORAGE_KEY = 'marketplaceProducts';
const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80';

export function normalizeProduct(product = {}) {
  const raw = { ...product };
  const imageUrl = raw.image_url ?? raw.image ?? DEFAULT_PRODUCT_IMAGE;
  const status = String(raw.status ?? (raw.sold ? 'sold' : 'active')).toLowerCase();
  return {
    ...raw,
    id: raw.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: raw.title ?? 'Untitled item',
    price: Number(raw.price ?? 0),
    category: raw.category ?? 'General',
    condition: raw.condition ?? 'Good Condition',
    description: raw.description ?? '',
    image_url: imageUrl,
    image: imageUrl,
    status,
    sold: status === 'sold'
  };
}

function saveProducts(products) {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  return products;
}

export async function fetchProducts() {
  const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
  if (storedProducts !== null) {
    const products = JSON.parse(storedProducts);
    if (!Array.isArray(products)) throw new Error('Saved listings must be an array.');
    return products.map(normalizeProduct);
  }

  const response = await fetch('./json/products.json');
  if (!response.ok) throw new Error(`Unable to load listings (${response.status}).`);
  const products = await response.json();
  if (!Array.isArray(products)) throw new Error('Listings dataset must be an array.');
  return saveProducts(products.map(normalizeProduct));
}

function isDuplicateProduct(existing, product) {
  const existingImage = String(existing.image_url || existing.image || DEFAULT_PRODUCT_IMAGE).trim();
  const newImage = String(product.image_url || product.image || DEFAULT_PRODUCT_IMAGE).trim();
  return String(existing.title).trim().toLowerCase() === String(product.title).trim().toLowerCase()
    && Number(existing.price) === Number(product.price)
    && existingImage === newImage;
}

export async function createProduct(product) {
  const products = await fetchProducts();
  const imageUrl = String(product.image_url || product.image || '').trim() || DEFAULT_PRODUCT_IMAGE;
  const candidate = normalizeProduct({
    ...product,
    image_url: imageUrl,
    image: imageUrl,
    posted: product.posted || 'Just now',
    postedAt: product.postedAt || new Date().toISOString()
  });

  if (products.some((existing) => isDuplicateProduct(existing, candidate))) {
    throw new Error('This item already exists in the marketplace.');
  }

  saveProducts([candidate, ...products]);
  return candidate;
}

export async function updateProduct(id, changes) {
  const products = await fetchProducts();
  let updatedProduct;
  const nextProducts = products.map((product) => {
    if (String(product.id) !== String(id)) return product;
    const next = { ...product, ...changes };
    if (Object.hasOwn(changes, 'sold')) next.status = changes.sold ? 'sold' : 'active';
    updatedProduct = normalizeProduct(next);
    return updatedProduct;
  });

  if (!updatedProduct) throw new Error('Listing not found.');
  saveProducts(nextProducts);
  return updatedProduct;
}

export async function deleteProduct(id) {
  const products = await fetchProducts();
  const nextProducts = products.filter((product) => String(product.id) !== String(id));
  if (nextProducts.length === products.length) throw new Error('Listing not found.');
  saveProducts(nextProducts);
}

const WEATHER_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Heavy rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Heavy thunderstorm with hail'
};

function weatherCondition(code) {
  return WEATHER_CODES[code] || 'Current conditions';
}

export async function geocodeLocation(query) {
  const locationName = String(query).trim();
  if (!locationName) throw new Error('Enter a location to search.');

  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocodingUrl.search = new URLSearchParams({ name: locationName, count: '1', language: 'en', format: 'json' });
  const geocodingResponse = await fetch(geocodingUrl);
  if (!geocodingResponse.ok) throw new Error(`Unable to find location (${geocodingResponse.status}).`);
  const geocodingData = await geocodingResponse.json();
  const place = geocodingData.results?.[0];
  if (!place) throw new Error(`No location found for "${locationName}".`);
  return { name: place.name, latitude: place.latitude, longitude: place.longitude };
}

export async function fetchWeather({ latitude, longitude, city }) {
  const place = latitude === undefined || longitude === undefined
    ? await geocodeLocation(city || 'Port-au-Prince')
    : { name: city || 'Port-au-Prince', latitude, longitude };

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '3'
  });
  const response = await fetch(forecastUrl);
  if (!response.ok) throw new Error(`Unable to load weather (${response.status}).`);
  const data = await response.json();
  if (!data.current || !data.daily) throw new Error('Weather response is incomplete.');

  const formatTemperature = (temperature) => `${Math.round(temperature)}°C`;
  const formatter = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: data.timezone });
  return {
    temperature: formatTemperature(data.current.temperature_2m),
    condition: weatherCondition(data.current.weather_code),
    humidity: `${data.current.relative_humidity_2m}%`,
    wind: `${Math.round(data.current.wind_speed_10m)} km/h`,
    high: formatTemperature(data.daily.temperature_2m_max[0]),
    low: formatTemperature(data.daily.temperature_2m_min[0]),
    location: place.name,
    forecast: data.daily.time.map((date, index) => ({
      day: index === 0 ? 'Today' : formatter.format(new Date(`${date}T12:00:00`)),
      condition: weatherCondition(data.daily.weather_code[index]),
      high: formatTemperature(data.daily.temperature_2m_max[index]),
      low: formatTemperature(data.daily.temperature_2m_min[index])
    }))
  };
}
