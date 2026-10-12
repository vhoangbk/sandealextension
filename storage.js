// Content-script side: forwards every call to background.js, which talks to Supabase.
const Store = {
  async _call(op, args) {
    const r = await chrome.runtime.sendMessage({ op, args });
    if (!r) throw new Error('Không nhận được phản hồi từ background.');
    if (r.error) throw new Error(r.error);
    return r.result;
  },
  list() { return this._call('list', []); },
  // returns 'added' | 'updated'
  upsert(p) { return this._call('upsert', [p]); },
  update(id, patch) { return this._call('update', [id, patch]); },
  remove(id) { return this._call('remove', [id]); },
};
