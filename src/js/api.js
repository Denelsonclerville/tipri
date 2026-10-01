export function normalizeProduct(product = {}) {
  const raw = { ...product };
  const imageUrl = raw.image_url ?? raw.image ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80';
  const status = String(raw.status ?? (raw.sold ? 'sold' : 'active')).toLowerCase();
  const next = {
    ...raw,
    id: raw.id ?? Date.now(),
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

  return next;
}

export async function fetchProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Unable to load listings');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Listings response must be an array');
    return data.map(normalizeProduct);
  } catch (error) {
    const fallbackResponse = await fetch('/json/products.json');
    if (!fallbackResponse.ok) throw error;
    const fallbackData = await fallbackResponse.json();
    if (!Array.isArray(fallbackData)) throw new Error('Listings dataset must be an array');
    return fallbackData.map(normalizeProduct);
  }
}

export async function fetchWeather(query = '') {
  const response = await fetch(`/api/weather${query}`);
  if (!response.ok) throw new Error('Unable to load weather');
  return response.json();
}

export async function createProduct(product) {
  const response = await fetch('/post-item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...product, image: product.image_url ?? product.image ?? undefined })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to publish listing');
  return normalizeProduct(data);
}

export async function updateProduct(id, changes) {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to update listing');
  return normalizeProduct(data);
}

export async function deleteProduct(id) {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) {
    try {
      const data = await response.json();
      throw new Error(data.error || 'Unable to delete listing');
    } catch (error) {
      throw new Error('Unable to delete listing');
    }
  }
}
