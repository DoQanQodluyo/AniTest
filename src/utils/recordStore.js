const db = require('croxydb');
const config = require('../../config.js');

function kayitId(prefix = 'REC') {
    const now = new Date();
    return `#${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
}

function ownerMi(userId) {
    return userId === config.BOT_OWNER_ID || userId === config.SAHIP_ID;
}

function deleteByKey(userId, key) {
    if (!ownerMi(userId)) return { ok: false, reason: 'Bu işlem yalnızca bot sahibine açıktır.' };
    if (!key || typeof key !== 'string') return { ok: false, reason: 'Geçerli bir DB anahtarı verilmedi.' };
    const exists = db.get(key);
    if (exists === undefined) return { ok: false, reason: 'Kayıt bulunamadı.' };
    db.delete(key);
    return { ok: db.get(key) === undefined, reason: 'Kayıt silindi.' };
}

function deleteByRecordId(userId, id) {
    if (!ownerMi(userId)) return { ok: false, reason: 'Bu işlem yalnızca bot sahibine açıktır.' };
    if (!id) return { ok: false, reason: 'Kayıt ID zorunludur.' };
    for (const [key, value] of Object.entries(db.all())) {
        if (value && !Array.isArray(value) && value.id === id) {
            db.delete(key);
            return { ok: db.get(key) === undefined, reason: `Kayıt silindi: ${key}` };
        }
        if (Array.isArray(value) && value.some(item => item?.id === id)) {
            const filtered = value.filter(item => item?.id !== id);
            db.set(key, filtered);
            return { ok: !db.get(key).some(item => item?.id === id), reason: `Kayıt silindi: ${key}` };
        }
    }
    return { ok: false, reason: 'Kayıt ID bulunamadı.' };
}

module.exports = { kayitId, ownerMi, deleteByKey, deleteByRecordId };
