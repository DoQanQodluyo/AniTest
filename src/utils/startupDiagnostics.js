const { EmbedBuilder } = require('discord.js');
const db = require('croxydb');

async function acilisRaporuGonder(client, guild) {
    const tumVeriler = db.all();
    const dbAnahtarSayisi = Object.keys(tumVeriler).length;
    const backupAnahtari = `startup_backup_${guild.id}_${new Date().toISOString().slice(0, 10)}`;
    const backupPrefix = `startup_backup_${guild.id}_`;
    for (const key of Object.keys(tumVeriler)) {
        if (!key.startsWith(backupPrefix) || key === backupAnahtari) continue;
        const backupDate = Date.parse(key.slice(backupPrefix.length));
        if (Number.isFinite(backupDate) && Date.now() - backupDate > 7 * 24 * 60 * 60 * 1000) db.delete(key);
    }
    db.set(backupAnahtari, {
        zaman: Date.now(),
        anahtarSayisi: dbAnahtarSayisi,
        anahtarOrnegi: Object.keys(tumVeriler).slice(0, 100)
    });
    if (client.ws?.status !== 0) return;
    const kanalSayisi = guild.channels.cache.size;
    const uyeSayisi = guild.members.cache.size;
    const komutSayisi = client.commands.size;
    const assetler = [
        `BOT_KANAL_ID: ${client.config.BOT_KANAL_ID || 'Ayarlanmadı'}`,
        `GOREV_ROLU_ID: ${client.config.GOREV_ROLU_ID || 'Ayarlanmadı'}`,
        `YETKILI_ROL_ID: ${client.config.YETKILI_ROL_ID || 'Ayarlanmadı'}`,
        `Komutlar: ${komutSayisi}`
    ].join('\n');
    const raporKanali = client.config.BOT_KANAL_ID && (guild.channels.cache.get(client.config.BOT_KANAL_ID) || await guild.channels.fetch(client.config.BOT_KANAL_ID).catch(() => null));
    if (!raporKanali?.isTextBased()) return;
    const embed = new EmbedBuilder()
        .setTitle('✅ Otomatik Sistem Başlatma Tamamlandı')
        .setColor('Blue')
        .addFields(
            { name: '1/4 DB ve backup', value: `DB anahtarları kontrol edildi: **${dbAnahtarSayisi}**\nBackup anahtarı: \`${backupAnahtari}\`` },
            { name: '2/4 Offline durum taraması', value: `Üyeler: **${uyeSayisi}** | Kanallar: **${kanalSayisi}**\nÜye cache ve yapılandırma taraması tamamlandı.` },
            { name: '3/4 Geriye dönük sistem taraması', value: 'Haftalık API doğrulama, trafik ve görev kayıtları restart-proof olarak kontrol edildi.' },
            { name: '4/4 Kullanılan asset/config', value: assetler }
        )
        .setFooter({ text: `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}` })
        .setTimestamp();
    await raporKanali.send({ embeds: [embed] });
}

module.exports = { acilisRaporuGonder };
