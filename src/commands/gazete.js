const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');

const DUYURU_KANAL_ID = '914191232253702184';

async function gazeteBasimiYap(client, guild, kanalId) {
    const kanal = guild.channels.cache.get(kanalId)
        || await guild.channels.fetch(kanalId).catch(() => null);
    if (!kanal?.isTextBased()) return;

    const bugunStr = new Date().toISOString().split('T')[0];
    const yediGunOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let toplamMesaj = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        toplamMesaj += db.get(`gazete_msg_${d}`) || 0;
    }

    const allData = db.all() || {};
    const kullaniciMesajlar = {};
    for (const key in allData) {
        if (key.startsWith('gazete_user_msg_')) {
            const tarihUserId = key.replace('gazete_user_msg_', '');
            const tarih = tarihUserId.substring(0, 10);
            if (tarih >= yediGunOnce) {
                const userId = tarihUserId.substring(11);
                kullaniciMesajlar[userId] = (kullaniciMesajlar[userId] || 0) + (allData[key] || 0);
            }
        }
    }

    const sirali = Object.entries(kullaniciMesajlar).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const yeniKuralSayisi = db.get('weekly_new_rules_count') || 0;

    const embed = new EmbedBuilder()
        .setTitle('📰 AniTest Haftalık Gazetesi')
        .setColor('Gold')
        .addFields(
            { name: '💬 Toplam Mesaj', value: `**${toplamMesaj}** mesaj`, inline: true },
            { name: '📜 Yeni Kural', value: `**${yeniKuralSayisi}** kural`, inline: true },
            { name: '🏆 En Aktif Üyeler', value: sirali.length ? sirali.map(([id, sayi], i) => `**${i + 1}.** <@${id}> — ${sayi} mesaj`).join('\n') : '*Veri bulunamadı.*' }
        )
        .setFooter({ text: 'AniTest Haftalık Gazete Sistemi' })
        .setTimestamp();

    await kanal.send({ content: '📰 **Haftalık Gazete Yayınlandı!**', embeds: [embed] }).catch(() => null);
}

const data = new SlashCommandBuilder()
    .setName('gazete')
    .setDescription('Haftalık sunucu gazetesini yayınlar ve görüntüler');

module.exports = {
    name: 'gazete',
    data: data.toJSON(),
    description: 'Haftalık sunucu gazetesini yayınlar ve görüntüler',
    gazeteBasimiYap,
    async execute(message, args, client) {
        await gazeteBasimiYap(client, message.guild, DUYURU_KANAL_ID);
        return message.reply({ content: '📰 Gazete başarıyla yayınlandı!', flags: 64 });
    }
};
