const fs = require('fs');
const path = require('path');
const croxyPath = path.join(__dirname, '..', 'croxydb', 'croxydb.json');
const { qdb } = require('../utils/moderationGuard');

async function croxyToQuickMigration() {
    try {
        if (!fs.existsSync(croxyPath)) return;
        const raw = fs.readFileSync(croxyPath, 'utf8');
        if (!raw || !raw.trim()) return;

        const data = JSON.parse(raw);
        console.log(`📦 [Migration] croxydb (${Object.keys(data).length} anahtar) QuickDB'ye aktarılıyor...`);

        for (const [key, value] of Object.entries(data)) {
            const current = await qdb.get(key);
            if (current === undefined || current === null) {
                await qdb.set(key, value);
            }
        }
        console.log(`✅ [Migration] Tüm veriler QuickDB'ye aktarıldı.`);
    } catch (err) {
        console.error(`❌ [Migration] Aktarım sırasında hata oluştu:`, err.message);
    }
}

module.exports = { croxyToQuickMigration };
