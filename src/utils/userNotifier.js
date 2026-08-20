const { EmbedBuilder } = require('discord.js');
const config = require('../../config.js');
const { sendReport } = require('./reportLogger');

async function kullaniciyaBildirim(client, user, title, description, fields = []) {
    if (!user) return { sent: false, reason: 'Kullanıcı nesnesi bulunamadı.' };
    const embed = new EmbedBuilder().setTitle(title).setColor('Orange').setDescription(description).addFields(fields).setTimestamp();
    try {
        await user.send({ embeds: [embed] });
        return { sent: true, reason: 'DM başarıyla gönderildi.' };
    } catch (error) {
        const reason = error.code === 50007 ? 'Kullanıcının DM kutusu kapalı.' : error.message || 'Bilinmeyen DM hatası.';
        await sendReport(client, {
            title: '⚠️ Kullanıcı DM bildirimi iletilemedi',
            description: reason,
            color: 'Red',
            channelId: config.BOT_KANAL_ID,
            fields: [{ name: 'Kullanıcı', value: `<@${user.id}>`, inline: true }, { name: 'Bildirim', value: title, inline: true }]
        });
        return { sent: false, reason };
    }
}

module.exports = { kullaniciyaBildirim };
