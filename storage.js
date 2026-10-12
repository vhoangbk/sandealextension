const Store = {
  KEY: 'products',
  async getAll() {
    const r = await chrome.storage.local.get(this.KEY);
    return r[this.KEY] || {};
  },
  async list() {
    return Object.values(await this.getAll());
  },
  // returns 'added' | 'updated'
  async upsert(p) {
    const all = await this.getAll();
    const status = all[p.id] ? 'updated' : 'added';
    all[p.id] = { ...all[p.id], ...p, updatedAt: Date.now() };
    await chrome.storage.local.set({ [this.KEY]: all });
    return status;
  },
  async update(id, patch) {
    const all = await this.getAll();
    if (!all[id]) return false;
    all[id] = { ...all[id], ...patch, updatedAt: Date.now() };
    await chrome.storage.local.set({ [this.KEY]: all });
    return true;
  },
  async remove(id) {
    const all = await this.getAll();
    delete all[id];
    await chrome.storage.local.set({ [this.KEY]: all });
  },
};
