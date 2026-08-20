const config = require('../../config.js');

const SPAM_WINDOW_MS = 30 * 60 * 1000;

async function sonBesMesajiAl(channel) {
    if (!channel?.messages?.fetch) return [];
    const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
    return messages ? [...messages.values()] : [];
}

async function kanalDurumu(channel, currentTime = Date.now()) {
    const messages = await sonBesMesajiAl(channel);
    const lastMessage = messages[0];
    if (!lastMessage) return { active: false, reason: 'Kanalda son mesaj bulunamadı.' };
    if (lastMessage.author?.bot && lastMessage.content?.includes('Topluluk kuralları')) {
        return { active: false, reason: 'Son mesaj botun kural hatırlatıcısı.' };
    }
    const recentHumanMessage = messages.find(message =>
        !message.author?.bot && currentTime - message.createdTimestamp <= SPAM_WINDOW_MS
    );
    if (!recentHumanMessage) return { active: false, reason: 'Son 30 dakikada yeni insan mesajı yok.' };
    return { active: true, reason: 'Son 30 dakika içinde insan mesajı bulundu.' };
}

async function shouldPostReminder(channel) {
    const status = await kanalDurumu(channel);
    return {
        ...status,
        content: status.active
            ? `Topluluk kurallarına uymaya özen gösterelim. 🤝 Partnerlik işlemlerinin lütfen <#${config.PARTNER_KANAL_ID}> kanalından yürütülmesini unutmayın.`
            : null
    };
}

module.exports = { sonBesMesajiAl, kanalDurumu, shouldPostReminder };