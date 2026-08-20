const config = require('../../config.js');
const { alanlariEmbedlereBol } = require('./embedPaginator');

const recentReports = new Map();
const REPORT_COOLDOWN_MS = 10000;

function trim(value, limit = 1024) {
    const text = String(value ?? 'Belirtilmedi.');
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function errorDetails(error) {
    if (!error) return { message: 'Bilinmeyen hata.', stack: 'Stack bilgisi yok.' };
    return {
        message: error.message || String(error),
        stack: error.stack || 'Stack bilgisi yok.'
    };
}

async function getReportChannel(client, requestedChannelId) {
    const channelId = requestedChannelId || config.RAPOR_KANAL_ID || config.BOT_KANAL_ID;
    if (!client?.isReady?.() || !channelId) return null;
    const cachedChannel = client.channels.cache.get(channelId);
    if (cachedChannel) return cachedChannel;
    if (typeof client.channels.fetch !== 'function') return null;
    return client.channels.fetch(channelId).catch(() => null);
}

async function sendReport(client, options = {}) {
    const title = options.title || 'Bot İşlem Raporu';
    const fingerprint = `${options.level || 'bilgi'}:${title}:${options.description || ''}`;
    const lastSent = recentReports.get(fingerprint) || 0;
    if (Date.now() - lastSent < REPORT_COOLDOWN_MS) return false;

    const channel = await getReportChannel(client, options.channelId);
    if (!channel?.isTextBased?.()) return false;

    recentReports.set(fingerprint, Date.now());
    const fields = Array.isArray(options.fields) ? options.fields : [];
    const embeds = alanlariEmbedlereBol({
        title: trim(title, 256),
        color: options.color || 'Blue',
        description: options.description || 'İşlem kaydı oluşturuldu.',
        fields: fields.map(field => ({ ...field, name: trim(field.name || 'Detay', 256) }))
    });

    const packets = [];
    for (let index = 0; index < embeds.length; index += 10) packets.push(embeds.slice(index, index + 10));
    for (const packet of packets) await channel.send({
        content: options.mentionOwner && config.BOT_OWNER_ID ? `<@${config.BOT_OWNER_ID}>` : undefined,
        embeds: packet
    }).catch(error => {
        console.error('[Rapor] Rapor kanalına gönderilemedi:', error.message);
        recentReports.delete(fingerprint);
    });
    return true;
}

async function sendErrorReport(client, title, error, extraFields = []) {
    const details = errorDetails(error);
    const options = {
        title: `🚨 ${title}`,
        description: details.message,
        color: 'Red',
        level: 'hata',
        mentionOwner: true,
        fields: [
            { name: 'Stack', value: `\`\`\`js\n${details.stack}\n\`\`\`` },
            ...extraFields
        ]
    };
    const sent = await sendReport(client, options);
    if (sent && config.BOT_OWNER_ID) {
        const owner = await client.users.fetch(config.BOT_OWNER_ID).catch(() => null);
        if (owner) {
            const embeds = require('./embedPaginator').alanlariEmbedlereBol(options);
            for (let index = 0; index < embeds.length; index += 10) {
                await owner.send({ embeds: embeds.slice(index, index + 10) }).catch(() => null);
            }
        }
    }
    return sent;
}

async function sendConnectionReport(client, title, description, fields = []) {
    return sendReport(client, {
        title: `🔌 ${title}`,
        description,
        color: 'Orange',
        channelId: config.BOT_KANAL_ID,
        fields
    });
}

module.exports = { sendReport, sendErrorReport, sendConnectionReport, errorDetails };