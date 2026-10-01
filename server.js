const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const dataPath = path.join(__dirname, 'public', 'json', 'products.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'src')));
app.use('/json', express.static(path.join(__dirname, 'public', 'json')));

function readProducts() {
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function writeProducts(products) {
  fs.writeFileSync(dataPath, JSON.stringify(products, null, 2));
}

app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

app.get('/api/weather', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  let resolvedLatitude = latitude;
  let resolvedLongitude = longitude;
  let location = city || 'Port-au-Prince';
  const hasCoordinates = Number.isFinite(resolvedLatitude) && Number.isFinite(resolvedLongitude);
  try {
    if (!hasCoordinates) {
      const geocodingResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
      if (!geocodingResponse.ok) throw new Error('Location service unavailable');
      const geocodingData = await geocodingResponse.json();
      const place = geocodingData.results?.[0];
      if (!place) throw new Error('Weather location not found');
      resolvedLatitude = place.latitude;
      resolvedLongitude = place.longitude;
      location = place.name;
    }

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${resolvedLatitude}&longitude=${resolvedLongitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=3`);
    if (!response.ok) throw new Error('Weather service unavailable');
    const data = await response.json();
    const current = data.current;
    const daily = data.daily;
    const weatherCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Foggy', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
      61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow',
      80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers', 95: 'Thunderstorm',
      96: 'Thunderstorm', 99: 'Thunderstorm'
    };
    res.json({
      temperature: current?.temperature_2m !== undefined ? `${Math.round(current.temperature_2m)}°C` : '30°C',
      humidity: current?.relative_humidity_2m !== undefined ? `${Math.round(current.relative_humidity_2m)}%` : '--',
      wind: current?.wind_speed_10m !== undefined ? `${Math.round(current.wind_speed_10m)} km/h` : '--',
      condition: weatherCodes[current?.weather_code] || 'Current conditions',
      high: daily?.temperature_2m_max?.[0] !== undefined ? `${Math.round(daily.temperature_2m_max[0])}°` : '31°',
      low: daily?.temperature_2m_min?.[0] !== undefined ? `${Math.round(daily.temperature_2m_min[0])}°` : '24°',
      sunrise: daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:15 AM',
      sunset: daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '06:20 PM',
      forecast: (daily?.time || []).map((date, index) => ({
        day: index === 0 ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        condition: weatherCodes[daily.weather_code?.[index]] || 'Current conditions',
        high: daily.temperature_2m_max?.[index] !== undefined ? `${Math.round(daily.temperature_2m_max[index])}°` : '--',
        low: daily.temperature_2m_min?.[index] !== undefined ? `${Math.round(daily.temperature_2m_min[index])}°` : '--'
      })),
      location
    });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Weather service unavailable' });
  }
});

app.post('/post-item', (req, res) => {
  const { title, price, currency, category, condition, description, location, phone, owner } = req.body;
  const image = req.body.image_url || req.body.image;
  if (!title || !price || !category || !condition || !location || !phone) {
    return res.status(400).json({ error: 'Please complete all required fields.' });
  }

  const products = readProducts();
  const imageUrl = image?.trim() || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80';
  const isDuplicate = products.some((existing) =>
    String(existing.title || '').trim().toLowerCase() === title.trim().toLowerCase() &&
    Number(existing.price) === Number(price) &&
    String(existing.image_url || existing.image || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80').trim() === imageUrl
  );
  if (isDuplicate) return res.status(409).json({ error: 'This item already exists in the marketplace.' });

  const product = {
    id: Date.now(),
    title: title.trim(),
    price: Number(price),
    currency: currency || 'USD',
    category,
    condition,
    description: description?.trim() || '',
    location: location.trim(),
    image: imageUrl,
    image_url: imageUrl,
    phone: phone.replace(/[^0-9+]/g, ''),
    owner: owner || 'local-seller',
    sold: false,
    status: 'active',
    posted: 'Just now'
  };
  products.unshift(product);
  writeProducts(products);
  res.status(201).json(product);
});

app.patch('/api/products/:id', (req, res) => {
  const products = readProducts();
  const product = products.find((item) => String(item.id) === req.params.id);
  if (!product) return res.status(404).json({ error: 'Listing not found.' });
  Object.assign(product, {
    title: req.body.title?.trim() || product.title,
    price: req.body.price ? Number(req.body.price) : product.price,
    category: req.body.category || product.category,
    condition: req.body.condition || product.condition,
    description: req.body.description?.trim() ?? product.description,
    location: req.body.location?.trim() || product.location,
    phone: req.body.phone ? req.body.phone.replace(/[^0-9+]/g, '') : product.phone,
    image: req.body.image?.trim() || req.body.image_url?.trim() || product.image,
    image_url: req.body.image_url?.trim() || req.body.image?.trim() || product.image_url || product.image,
    sold: typeof req.body.sold === 'boolean' ? req.body.sold : product.sold,
    status: typeof req.body.sold === 'boolean' ? (req.body.sold ? 'sold' : 'active') : product.status || (product.sold ? 'sold' : 'active')
  });
  writeProducts(products);
  res.json(product);
});

app.delete('/api/products/:id', (req, res) => {
  const products = readProducts();
  const nextProducts = products.filter((item) => String(item.id) !== req.params.id);
  if (nextProducts.length === products.length) return res.status(404).json({ error: 'Listing not found.' });
  writeProducts(nextProducts);
  res.status(204).end();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Second Hand Market running at http://localhost:${PORT}`);
});
