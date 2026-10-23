const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export const tokens = {
  get: (k) => sessionStorage.getItem('mat_' + k) || '',
  set: (k, v) => sessionStorage.setItem('mat_' + k, v),
  clear: (k) => sessionStorage.removeItem('mat_' + k),
};

async function request(path, { method = 'GET', body, token, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch (e) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // plants
  listPlants: () => request('/api/plants'),
  addPlant: (token, body) => request('/api/plants', { method: 'POST', body, token }),
  deletePlant: (token, id) => request(`/api/plants/${id}`, { method: 'DELETE', token }),
  // provider
  createTransfer: (body) => request('/api/transfers', { method: 'POST', body }),
  getTransfer: (id) => request(`/api/transfers/${id}`),
  saveTransfer: (id, body) => request(`/api/transfers/${id}`, { method: 'PATCH', body }),
  sendTransfer: (id) => request(`/api/transfers/${id}/send`, { method: 'POST' }),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('/api/uploads/photo', { method: 'POST', form });
  },
  // receiver
  requestCode: (body) => request('/api/receiver/request-code', { method: 'POST', body }),
  verifyCode: (body) => request('/api/receiver/verify', { method: 'POST', body }),
  receiverTransfer: (token) => request('/api/receiver/transfer', { token }),
  saveReview: (token, review) => request('/api/receiver/review', { method: 'PUT', body: { review }, token }),
  submitReview: (token, review) => request('/api/receiver/submit', { method: 'POST', body: { review }, token }),
  // admin
  adminLogin: (password) => request('/api/admin/login', { method: 'POST', body: { password } }),
  adminStats: (token) => request('/api/admin/stats', { token }),
  adminTransfers: (token, search = '') =>
    request(`/api/admin/transfers?search=${encodeURIComponent(search)}`, { token }),
  adminTransfer: (token, id) => request(`/api/admin/transfers/${id}`, { token }),
};