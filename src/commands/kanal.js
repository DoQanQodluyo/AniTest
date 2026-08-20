const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

function parseChannelIds(value) {
    return [...new Set(value
        .split(',')
        .map(channelId => channelId.trim())
        .filter(Boolean))];
}

function createChannelList(guild, channelIds) {
    if (channelIds.length === 0) return 'İzlenen kanal bulunmuyor.';

    return channelIds
        .map(channelId => guild.channels.cache.has(channelId) ? `<#${channelId}>` : `\`${channelId}\``)
        .join(', ');
}

module.exports = {
    name: 'kanal',
    data: new SlashCommandBuilder()
        .setName('kanal')
        .setDescription('Stat izleme kanallarını yönetir.')
        .addSubcommand(subcommand => subcommand
            .setName('ekle')
            .setDescription('Bir veya daha fazla kanalı stat izleme listesine ekler.')
            .addStringOption(option => option
                .setName('id-listesi')
                .setDescription('Virgülle ayrılmış kanal ID listesi.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('cikar')
            .setDescription('Bir veya daha fazla kanalı stat izleme listesinden çıkarır.')
            .addStringOption(option => option
                .setName('id-listesi')
                .setDescription('Virgülle ayrılmış kanal ID listesi.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('liste')
            .setDescription('Stat izleme kanal listesini gösterir.')),
    aliases: ['kanallar', 'kanal-ayarlari'],
    description: 'Stat izleme kanallarını alt komutlarla yönetir.',
    usage: '/kanal <ekle|cikar|liste> [id-listesi]',
    category: 'Yönetim',
    async execute(message, args, client, db) {
        if (message.author.id !== client.config.BOT_OWNER_ID && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komut için yetkiniz yok.');
        }

        const action = args[0];
        const key = `allowedChannels_${message.guild.id}`;
        const currentChannels = db.get(key) || [];

        if (action === 'liste') {
            const embed = new EmbedBuilder()
                .setTitle('📡 Stat İzleme Kanalları')
                .setColor('Blue')
                .setDescription(createChannelList(message.guild, currentChannels))
                .setFooter({ text: `Toplam kanal: ${currentChannels.length}` })
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const rawIds = args.slice(1).join(' ');
        const channelIds = parseChannelIds(rawIds);
        const invalidIds = channelIds.filter(channelId => !/^\d{17,20}$/.test(channelId));

        if (!['ekle', 'cikar'].includes(action) || channelIds.length === 0 || invalidIds.length > 0) {
            return message.reply('Kullanım: `/kanal ekle id-listesi`, `/kanal cikar id-listesi` veya `/kanal liste`. ID listesini virgülle ayırabilirsiniz.');
        }

        let updatedChannels = currentChannels;
        if (action === 'ekle') {
            updatedChannels = [...new Set([...currentChannels, ...channelIds])];
        } else {
            updatedChannels = currentChannels.filter(channelId => !channelIds.includes(channelId));
        }

        db.set(key, updatedChannels);

        const embed = new EmbedBuilder()
            .setTitle(action === 'ekle' ? '✅ Kanallar Eklendi' : '✅ Kanallar Çıkarıldı')
            .setColor(action === 'ekle' ? 'Green' : 'Orange')
            .setDescription(createChannelList(message.guild, updatedChannels))
            .addFields({ name: 'İşlenen ID sayısı', value: String(channelIds.length), inline: true })
            .setFooter({ text: `Toplam kanal: ${updatedChannels.length}` })
            .setTimestamp();

        return message.reply({ embeds: [embed] });
    }
};