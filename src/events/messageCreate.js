const db = require('croxydb');
const { EmbedBuilder } = require('discord.js');
const { trafikArtir } = require('../utils/trafficAnalyzer');
const { mesajKontrolEt } = require('../utils/crisisGuard');
const { gorevIlerlemesi } = require('../utils/taskHub');

const krizKelimeleri = [
    'kriz',
    'acil',
    'tehdit',
    'tartışma',
    'kavga',
    'şiddet'
];

async function krizUyarisiGonder(message, client) {
    const icerik = message.content.toLocaleLowerCase('tr-TR');
    const kelimeler = client.config.krizKelimeleri?.length ? client.config.krizKelimeleri : krizKelimeleri;
    const bulunanKelime = kelimeler.find(kelime => icerik.includes(kelime));
    if (!bulunanKelime || !client.config.BOT_OWNER_ID) return;

    const sahip = await client.users.fetch(client.config.BOT_OWNER_ID).catch(() => null);
    if (!sahip) return;

    const embed = new EmbedBuilder()
        .setTitle('🚨 Kriz / Gerginlik Uyarısı')
        .setColor('Red')
        .addFields(
            { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
            { name: 'Kanal', value: `${message.channel}`, inline: true },
            { name: 'Tespit Edilen Kelime', value: `\`${bulunanKelime}\``, inline: true },
            { name: 'Mesaj İçeriği', value: message.content.slice(0, 1024) || 'İçerik yok.' },
            { name: 'Zaman', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
        )
        .setFooter({ text: `Sunucu: ${message.guild.name}` })
        .setTimestamp();

    await sahip.send({ embeds: [embed] }).catch(hata => {
        console.error('[Kriz] Sahibe DM gönderilemedi:', hata.message);
    });
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        const client = message.client;
        if (!message.guild) return;

        await krizUyarisiGonder(message, client);

        // 🚨 KRİTİK ÇÖZÜM: Client'ı doğrudan mesaj nesnesinden çek (Çökmeyi engeller)
        const guildId = message.guild.id;
        const userId = message.author.id;

        trafikArtir('mesaj', guildId, 1, new Date(), message.channel.id);
        mesajKontrolEt(message).catch(() => {});
        if (message.member?.roles.cache.has(message.client.config.GOREV_ROLU_ID)) {
            gorevIlerlemesi(userId, 'mesaj');
        }

        const settings = { trackMessages: true, ...(db.get(`settings_${guildId}`) || {}) };
        if (settings.trackMessages) {
            db.add(`chat_7d_${guildId}_${userId}`, 1);

            const allowedChannels = db.get(`allowedChannels_${guildId}`) || [];
            if (allowedChannels.includes(message.channel.id)) {
                db.add(`stat_${guildId}_${userId}`, 1);
            }
        }

        // 📰 Gazete İstatistik Takibi
        const bugunStr = new Date().toISOString().split('T')[0];
        db.add(`gazete_msg_${bugunStr}`, 1);
        db.add(`gazete_user_msg_${bugunStr}_${userId}`, 1);
        db.add(`gazete_channel_msg_${bugunStr}_${message.channel.id}`, 1);
    },
};