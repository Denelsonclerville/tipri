export async function fetchProducts() {
  const response = await fetch('/api/products');
  if (!response.ok) throw new Error('Unable to load listings');
  return response.json();
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
    body: JSON.stringify(product)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to publish listing');
  return data;
}

export async function updateProduct(id, changes) {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to update listing');
  return data;
}

export async function deleteProduct(id) {
  const response = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Unable to delete listing');
  }
}
