const { EmbedBuilder } = require('discord.js');
const { standupOturumuAktifMi } = require('../utils/standupAssistant');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || message.guild) return;
        if (standupOturumuAktifMi(message.author.id)) return;

        const icerik = message.content?.trim() || '[Ek veya boş mesaj]';
        const embed = new EmbedBuilder()
            .setTitle('📩 Yeni Özel Mesaj')
            .setColor('Blue')
            .addFields(
                { name: 'Gönderen', value: `<@${message.author.id}> (${message.author.tag})`, inline: false },
                { name: 'Mesaj', value: icerik.slice(0, 1024), inline: false },
                { name: 'Zaman', value: `<t:${Math.floor(message.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Kullanıcı ID: ${message.author.id}` })
            .setTimestamp(message.createdTimestamp);

        const owner = client.config.BOT_OWNER_ID
            ? await client.users.fetch(client.config.BOT_OWNER_ID).catch(() => null)
            : null;
        if (owner && owner.id !== message.author.id) {
            await owner.send({ embeds: [embed] }).catch(error => {
                console.error('[DM Log] Sahibe DM gönderilemedi:', error.message);
            });
        }

        const logChannel = client.config.BOT_KANAL_ID
            ? await client.channels.fetch(client.config.BOT_KANAL_ID).catch(() => null)
            : null;
        if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] }).catch(error => {
                console.error('[DM Log] Bot kanalına kayıt gönderilemedi:', error.message);
            });
        }
    }
};
