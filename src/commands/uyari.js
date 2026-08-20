const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'lider-uyar',
    data: new SlashCommandBuilder()
        .setName('lider-uyar')
        .setDescription('Bir takım üyesi hakkında liderine bildirim gönderir.')
        .addUserOption(option => option
            .setName('kullanici')
            .setDescription('Hakkında bildirim gönderilecek kullanıcı.')
            .setRequired(true))
        .addStringOption(option => option
            .setName('sebep')
            .setDescription('Bildirim sebebi veya not.')
            .setRequired(true)),
    aliases: ['lider-uyarı', 'lideruyar', 'takim-lider-uyar'],
    description: 'Bir takım üyesi hakkında takım liderine özel bildirim gönderir.',
    usage: '/lider-uyar kullanici sebep',
    category: 'Yönetim',
    async execute(message, args, client, db) {
        const targetUser = message.mentions.users.first();
        const sebep = args.slice(1).join(' ');
        if (!targetUser || !sebep) return message.reply('Kullanım: `!lider-uyar @kullanıcı [sebep]`');

        const isSenderLeader = db.get(`teamLeader_${message.author.id}`);
        if (!isSenderLeader && !message.member.permissions.has('Administrator')) return message.reply('Sadece takım liderleri bu komutu kullanabilir.');

        const targetLeaderId = db.get(`userTeam_${targetUser.id}`);
        if (!targetLeaderId) return message.reply('Bu kullanıcının bağlı olduğu bir takım lideri yok.');

        try {
            const leaderUser = await client.users.fetch(targetLeaderId);
            const dmEmbed = new EmbedBuilder()
                .setTitle('📬 Takımınız Hakkında Yeni Bir Bildirim')
                .setColor('Orange')
                .setDescription(`**${message.author.tag}** isimli lider, takım üyeniz **${targetUser.tag}** hakkında bir usulsüzlük bildirdi.`)
                .addFields({ name: 'Bildirilen Sebep/Not', value: sebep })
                .setFooter({ text: 'Lütfen üyenizle iletişime geçin.' })
                .setTimestamp();
            
            await leaderUser.send({ embeds: [dmEmbed] });
            message.reply('✅ Uyarı/Not başarıyla üyenin takım liderine DM yoluyla iletildi.');
        } catch (error) {
            message.reply('❌ Liderin DM kutusu kapalı olduğu için mesaj iletilemedi.');
        }
    }
};