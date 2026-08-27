const db = require('croxydb');

const pencere = new Map();
const YAVAS_MODU_SURESI = 180000;

function izinliMi(guildId, kanalId) {
    const ayarlar = db.get(`kriz_ayar_${guildId}`) || { aktif: false, kanallar: [] };
    return ayarlar.aktif && Array.isArray(ayarlar.kanallar) && ayarlar.kanallar.includes(kanalId);
}

async function mesajKontrolEt(message) {
    if (!message.guild || message.author.bot || !izinliMi(message.guild.id, message.channel.id)) return;
    const anahtar = `${message.guild.id}_${message.channel.id}`;
    const simdi = Date.now();
    const mevcut = pencere.get(anahtar);
    if (!mevcut || simdi - mevcut.baslangic >= 60000) {
        pencere.set(anahtar, { baslangic: simdi, sayi: 1, yavasMod: false });
        return;
    }
    mevcut.sayi += 1;
    const limit = Number(message.client?.config?.KRIZ_MESAJ_LIMIT) || 15;
    if (mevcut.sayi < limit || mevcut.yavasMod) return;
    mevcut.yavasMod = true;
    const bitis = Date.now() + YAVAS_MODU_SURESI;
    db.set(`yavasmod_bitis_${message.channel.id}`, bitis);
    try {
        await message.channel.setRateLimitPerUser(2, 'Kriz koruması: 1 dakikalık mesaj limiti aşıldı.');
        await message.channel.send('⚠️ Bu kanalda kısa süreli yoğunluk tespit edildi. 3 dakika boyunca yavaş mod uygulanacaktır.');
        setTimeout(() => {
            message.channel.setRateLimitPerUser(0, 'Kriz koruması yavaş modu sona erdi.').catch(() => {});
            db.delete(`yavasmod_bitis_${message.channel.id}`);
            pencere.delete(anahtar);
        }, YAVAS_MODU_SURESI);
    } catch (hata) {
        db.delete(`yavasmod_bitis_${message.channel.id}`);
        console.error('[Kriz Koruması] Yavaş mod uygulanamadı:', hata.message);
    }
}

async function yavasModlariGeriYukle(client) {
    const allData = db.all() || {};
    const simdi = Date.now();
    for (const key in allData) {
        if (key.startsWith('yavasmod_bitis_')) {
            const kanalId = key.replace('yavasmod_bitis_', '');
            const bitis = allData[key];
            const kanal = await client.channels.fetch(kanalId).catch(() => null);
            if (!kanal || typeof kanal.setRateLimitPerUser !== 'function') {
                db.delete(key);
                continue;
            }
            if (bitis <= simdi) {
                await kanal.setRateLimitPerUser(0, 'Kriz koruması yavaş modu süresi doldu (restart kurtarma).').catch(() => {});
                db.delete(key);
            } else {
                const kalanSure = bitis - simdi;
                setTimeout(() => {
                    kanal.setRateLimitPerUser(0, 'Kriz koruması yavaş modu sona erdi.').catch(() => {});
                    db.delete(key);
                    pencere.delete(`${kanal.guild?.id}_${kanal.id}`);
                }, kalanSure);
            }
        }
    }
}

module.exports = { izinliMi, mesajKontrolEt, yavasModlariGeriYukle };
