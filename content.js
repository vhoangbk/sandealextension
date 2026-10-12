(() => {
  if (window.__spsLoaded) return;
  window.__spsLoaded = true;

  const host = document.createElement('div');
  host.id = 'sps-host';
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
<style>
  * { box-sizing: border-box; font-family: system-ui, sans-serif; }
  .bar { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; display: flex; gap: 8px; }
  button { background: #ee4d2d; color: #fff; border: 0; border-radius: 6px; padding: 10px 14px; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
  button:hover { background: #d73f20; }
  button.sec { background: #333; }
  .toast { position: fixed; right: 16px; bottom: 70px; z-index: 2147483647; background: #222; color: #fff; padding: 10px 14px; border-radius: 6px; font-size: 14px; display: none; max-width: 320px; }
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 2147483647; display: none; align-items: center; justify-content: center; }
  .modal { background: #fff; color: #222; width: min(960px, 94vw); max-height: 86vh; border-radius: 8px; display: flex; flex-direction: column; }
  .head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; font-weight: 600; }
  .head button { padding: 4px 10px; }
  .body { overflow: auto; padding: 0 16px 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; vertical-align: middle; }
  img { width: 56px; height: 56px; object-fit: cover; border-radius: 4px; }
  a { color: #ee4d2d; text-decoration: none; }
  .del { background: #999; padding: 4px 8px; font-size: 12px; box-shadow: none; }
  input.aff { width: 100%; min-width: 200px; padding: 6px 8px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; }
  .empty { padding: 24px; text-align: center; color: #888; }
</style>
<div class="bar">
  <button id="add">Add product</button>
  <button id="list" class="sec">List product</button>
  <button id="export" class="sec">Export</button>
</div>
<div class="toast" id="toast"></div>
<div class="overlay" id="overlay">
  <div class="modal">
    <div class="head"><span id="count"></span><button id="close">Đóng</button></div>
    <div class="body" id="tbody"></div>
  </div>
</div>`;

  const $ = (id) => root.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.style.display = 'none'), 2500);
  }

  async function onAdd() {
    if (!Scraper.parseIds()) return toast('Đây không phải trang chi tiết sản phẩm.');
    toast('Đang lấy dữ liệu...');
    try {
      const p = await Scraper.scrape();
      const st = await Store.upsert(p);
      toast(`${st === 'added' ? 'Đã thêm' : 'Đã cập nhật'}: ${p.name.slice(0, 50)}`);
    } catch (e) {
      console.error(e);
      toast('Lỗi: ' + e.message);
    }
  }

  async function renderList() {
    const items = (await Store.list()).sort((a, b) => b.updatedAt - a.updatedAt);
    $('count').textContent = `Danh sách sản phẩm (${items.length})`;
    $('tbody').innerHTML = items.length
      ? `<table><thead><tr><th>Ảnh</th><th>ID</th><th>Tên</th><th>Category</th><th>Đã bán</th><th>Affiliate link</th><th></th></tr></thead><tbody>${items
          .map(
            (p) => `<tr>
<td><img src="${esc(p.image)}" alt=""></td>
<td>${esc(p.id)}</td>
<td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></td>
<td>${esc(p.category)}</td>
<td>${esc(p.soldText || p.sold)}</td>
<td><input class="aff" type="url" data-aff="${esc(p.id)}" value="${esc(p.affiliate_url || '')}" placeholder="https://..."></td>
<td><button class="del" data-id="${esc(p.id)}">Xoá</button></td></tr>`
          )
          .join('')}</tbody></table>`
      : '<div class="empty">Chưa có sản phẩm nào.</div>';
  }

  async function onList() {
    await renderList();
    $('overlay').style.display = 'flex';
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function onExport() {
    const items = await Store.list();
    if (!items.length) return toast('Chưa có dữ liệu để export.');
    // header CSV -> field lưu trữ (trường thiếu để trống)
    const cols = [
      ['category', 'category'], ['product_url', 'url'], ['affiliate_url', 'affiliate_url'],
      ['name', 'name'], ['price', 'price'], ['sold', 'sold'], ['thumbnail', 'image'],
    ];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => c[0]).join(',')]
      .concat(items.map((p) => cols.map(([, f]) => q(p[f])).join(',')))
      .join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    download(`shopee-products-${stamp}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    toast(`Đã export ${items.length} sản phẩm (CSV).`);
  }

  $('add').onclick = onAdd;
  $('list').onclick = onList;
  $('export').onclick = onExport;
  $('close').onclick = () => ($('overlay').style.display = 'none');
  $('overlay').onclick = (e) => { if (e.target === $('overlay')) $('overlay').style.display = 'none'; };
  $('tbody').onclick = async (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    if (id) { await Store.remove(id); renderList(); }
  };
  $('tbody').onchange = async (e) => {
    const input = e.target;
    const id = input.dataset && input.dataset.aff;
    if (!id) return;
    const v = input.value.trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) {
      toast('Link affiliate phải bắt đầu bằng http:// hoặc https://');
      return renderList();
    }
    await Store.update(id, { affiliate_url: v });
    toast(v ? 'Đã lưu link affiliate.' : 'Đã xoá link affiliate.');
  };
})();
