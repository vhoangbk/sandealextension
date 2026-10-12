// Trích thông tin sản phẩm từ trang chi tiết Shopee (meta / JSON-LD / text, tránh class hash).
const Scraper = {
  parseIds(url = location.href) {
    const m =
      url.match(/-i\.(\d+)\.(\d+)/) ||
      url.match(/\/product\/(\d+)\/(\d+)/);
    return m ? { shopId: m[1], itemId: m[2], id: `${m[1]}_${m[2]}` } : null;
  },

  meta(prop) {
    const el = document.querySelector(`meta[property="${prop}"],meta[name="${prop}"]`);
    return el ? el.content.trim() : '';
  },

  jsonLd() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const d = JSON.parse(s.textContent);
        (Array.isArray(d) ? d : [d]).forEach((x) => (x['@graph'] ? out.push(...x['@graph']) : out.push(x)));
      } catch (_) {}
    });
    return out;
  },

  // "1,2k" | "5k+" | "12,3tr" | "1.234" -> number
  parseSold(txt) {
    const m = txt.toLowerCase().match(/([\d.,]+)\s*(k|tr|m)?/);
    if (!m) return 0;
    let s = m[1];
    const unit = m[2];
    if (unit) s = s.replace(',', '.');
    else s = s.replace(/[.,]/g, '');
    let n = parseFloat(s) || 0;
    if (unit === 'k') n *= 1e3;
    else if (unit === 'tr' || unit === 'm') n *= 1e6;
    return Math.round(n);
  },

  findSold() {
    // phần tử lá chứa "Đã bán" (vi) / "sold" (en)
    const re = /(đã bán|sold)/i;
    const els = document.querySelectorAll('div,span');
    for (const el of els) {
      if (el.children.length > 1) continue;
      const t = (el.textContent || '').trim();
      if (t.length > 40 || !re.test(t)) continue;
      // "Đã bán 1,2k" hoặc label "Đã bán" + sibling chứa số
      let raw = t;
      if (!/\d/.test(raw)) {
        const sib = el.previousElementSibling || el.nextElementSibling;
        if (sib) raw = `${sib.textContent.trim()} ${t}`;
      }
      if (/\d/.test(raw)) {
        const num = raw.replace(re, '').trim();
        return { raw: num, value: this.parseSold(num) };
      }
    }
    return { raw: '', value: 0 };
  },

  findCategory(ld) {
    const bc = ld.find((x) => x['@type'] === 'BreadcrumbList');
    if (bc && bc.itemListElement) {
      const names = bc.itemListElement
        .map((i) => i.name || (i.item && i.item.name))
        .filter(Boolean);
      // bỏ "Shopee" đầu và tên sản phẩm cuối
      return names.slice(1, -1).join(' > ') || names.join(' > ');
    }
    const links = [...document.querySelectorAll('a[href*="-cat."]')];
    return links.map((a) => a.textContent.trim()).filter(Boolean).join(' > ');
  },

  // Giá: JSON-LD offers trước, fallback phần tử lá đầu tiên chứa "₫" (lấy số đầu tiên)
  findPrice(prod) {
    let o = prod.offers;
    if (Array.isArray(o)) o = o[0];
    const v = o && (o.price ?? o.lowPrice);
    if (v) return String(v).replace(/[^\d.]/g, '');
    for (const el of document.querySelectorAll('div,span')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 20 && /^₫?\s*[\d.,]+\s*₫?$/.test(t) && t.includes('₫')) {
        return t.replace(/[^\d]/g, '');
      }
    }
    return '';
  },

  async waitFor(fn, ms = 3000) {
    const end = Date.now() + ms;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) return v;
      await new Promise((r) => setTimeout(r, 300));
    }
  },

  async scrape() {
    const ids = this.parseIds();
    if (!ids) return null;
    const ld = this.jsonLd();
    const prod = ld.find((x) => x['@type'] === 'Product') || {};
    const h1 = document.querySelector('h1');

    const name = prod.name || (h1 && h1.textContent.trim()) || this.meta('og:title');
    let image = Array.isArray(prod.image) ? prod.image[0] : prod.image;
    image = image || this.meta('og:image');

    const sold = await this.waitFor(() => {
      const s = this.findSold();
      return s.raw ? s : null;
    }) || { raw: '', value: 0 };

    return {
      id: ids.id,
      url: location.origin + location.pathname,
      image: image || '',
      name: name || '',
      category: this.findCategory(ld).split(' > ')[0].trim(), // chỉ lấy category cấp 1
      price: await this.waitFor(() => this.findPrice(prod)) || '',
      sold: sold.value,
      soldText: sold.raw,
    };
  },
};
