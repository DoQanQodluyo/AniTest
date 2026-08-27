const { EmbedBuilder } = require('discord.js');

async function ilerlemeBaslat(channel, baslik) {
    if (!channel?.isTextBased?.()) return null;
    const msg = await channel.send({
        embeds: [
            new EmbedBuilder()
                .setTitle(baslik)
                .setColor('Blue')
                .setDescription('⏳ Başlatılıyor...')
                .setTimestamp()
        ]
    }).catch(error => {
        console.error('[ProgressReporter] İlerleme mesajı başlatılamadı:', error.message);
        return null;
    });

    if (!msg) return null;

    return {
        msg,
        adim: async (metin) => {
            return msg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(baslik)
                        .setColor('Blue')
                        .setDescription(`⏳ ${metin}`.slice(0, 4000))
                        .setTimestamp()
                ]
            }).catch(() => null);
        },
        bitir: async (basarili, metin) => {
            return msg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(baslik)
                        .setColor(basarili ? 'Green' : 'Red')
                        .setDescription(`${basarili ? '✅' : '❌'} ${metin}`.slice(0, 4000))
                        .setTimestamp()
                ]
            }).catch(() => null);
        },
        hata: async (adSoyad, error) => {
            const errText = error?.message || String(error || 'Bilinmeyen hata.');
            return msg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(baslik)
                        .setColor('Red')
                        .setDescription(`❌ Hata (${adSoyad}): ${errText}`.slice(0, 4000))
                        .setTimestamp()
                ]
            }).catch(() => null);
        }
    };
}

module.exports = { ilerlemeBaslat };
