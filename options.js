const F = ['url', 'anonKey', 'email', 'password'];
const $ = (id) => document.getElementById(id);
chrome.storage.local.get('sbConfig').then((r) => F.forEach((k) => ($(k).value = (r.sbConfig || {})[k] || '')));
$('save').onclick = async () => {
  const cfg = Object.fromEntries(F.map((k) => [k, $(k).value.trim()]));
  await chrome.storage.local.set({ sbConfig: cfg, sbSession: null });
  $('msg').textContent = 'Đang kiểm tra...';
  const r = await chrome.runtime.sendMessage({ op: 'test' });
  $('msg').textContent = r.error ? 'Lỗi: ' + r.error : 'Kết nối thành công.';
};
