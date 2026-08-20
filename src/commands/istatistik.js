const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'istatistik',
    data: new SlashCommandBuilder()
        .setName('istatistik')
        .setDescription('Botun gecikme, RAM ve çalışma süresi bilgilerini gösterir.'),
    aliases: ['istatistikler', 'stat', 'durum', 'ping'],
    description: 'Botun gecikme, RAM ve çalışma süresi bilgilerini gösterir.',
    usage: '/istatistik',
    category: 'Genel',
    execute(message, args, client, db) {
        const ping = client.ws.ping;
        const uptime = Math.floor(client.uptime / 1000);
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = uptime % 60;
        const ram = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot İstatistikleri ve Durumu')
            .setColor('Green')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '📡 Gecikme (Ping)', value: `**${ping}** ms`, inline: true },
                { name: '💾 RAM Kullanımı', value: `**${ram}** MB`, inline: true },
                { name: '⏱️ Açık Kalma (Uptime)', value: `${days} Gün, ${hours} Saat, ${minutes} Dk, ${seconds} Sn`, inline: false },
                { name: '🛡️ Anti-Crash Durumu', value: '✅ Aktif (Güvende)', inline: false }
            )
            .setFooter({ text: 'Gelişmiş DJS Altyapısı' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};