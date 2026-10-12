const CFG_KEY = 'sbConfig';   // { url, anonKey, email, password }
const SESS_KEY = 'sbSession'; // { access_token, refresh_token, expires_at }

const toRow = (p) => {
  const m = { id: 'id', url: 'url', image: 'image', name: 'name', category: 'category', price: 'price',
    sold: 'sold', soldText: 'sold_text', affiliate_url: 'affiliate_url' };
  const row = {};
  for (const k in m) if (k in p) row[m[k]] = p[k];
  return row;
};
const fromRow = (r) => ({
  id: r.id, url: r.url, image: r.image, name: r.name, category: r.category, price: r.price,
  sold: Number(r.sold), soldText: r.sold_text, affiliate_url: r.affiliate_url, updatedAt: Number(r.updated_at),
});

async function getCfg() {
  const c = (await chrome.storage.local.get(CFG_KEY))[CFG_KEY];
  if (!c || !c.url || !c.anonKey || !c.email || !c.password)
    throw new Error('Chưa cấu hình Supabase. Mở trang Options của extension.');
  return { ...c, url: c.url.replace(/\/+$/, '') };
}

async function authRequest(cfg, path, body) {
  const res = await fetch(`${cfg.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.msg || `Đăng nhập thất bại (${res.status})`);
  const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 };
  await chrome.storage.local.set({ [SESS_KEY]: s });
  return s;
}

async function getToken(cfg, force) {
  let s = (await chrome.storage.local.get(SESS_KEY))[SESS_KEY];
  if (!force && s && s.expires_at > Date.now()) return s.access_token;
  if (s && s.refresh_token) {
    try { return (await authRequest(cfg, 'token?grant_type=refresh_token', { refresh_token: s.refresh_token })).access_token; } catch {}
  }
  return (await authRequest(cfg, 'token?grant_type=password', { email: cfg.email, password: cfg.password })).access_token;
}

async function rest(path, { method = 'GET', body, headers = {} } = {}, retry = true) {
  const cfg = await getCfg();
  const token = await getToken(cfg, !retry);
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry) return rest(path, { method, body, headers }, false);
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `Supabase lỗi ${res.status}`);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

const ops = {
  async list() {
    return (await rest('products?select=*')).map(fromRow);
  },
  async upsert(p) {
    const ex = await rest(`products?select=id&id=eq.${encodeURIComponent(p.id)}`);
    await rest('products?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { ...toRow(p), updated_at: Date.now() },
    });
    return ex.length ? 'updated' : 'added';
  },
  async update(id, patch) {
    const r = await rest(`products?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: { ...toRow(patch), updated_at: Date.now() },
    });
    return r.length > 0;
  },
  async remove(id) {
    await rest(`products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg && msg.op === 'test') {
    // used by options page: force a fresh login
    getCfg().then((c) => getToken(c, true)).then(() => rest('products?select=id&limit=1'))
      .then(() => send({ result: true }), (e) => send({ error: e.message }));
    return true;
  }
  if (!msg || !ops[msg.op]) return;
  ops[msg.op](...msg.args).then((result) => send({ result }), (e) => send({ error: e.message }));
  return true;
});
