const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const teamStore = require('../utils/teamStore');

module.exports = {
    name: 'takim-isim',
    data: new SlashCommandBuilder()
        .setName('takim-isim')
        .setDescription('Bir takımın adını değiştirir.')
        .addStringOption(option => option
            .setName('isim')
            .setDescription('Yeni takım adı.')
            .setMaxLength(32)
            .setRequired(true))
        .addUserOption(option => option
            .setName('lider')
            .setDescription('Adı değiştirilecek takım lideri; yönetici değilseniz boş bırakın.')
            .setRequired(false)),
    aliases: ['takim-adi', 'takimadi', 'team-name', 'takim-isimlendir'],
    description: 'Takımınızın veya belirtilen takımın adını özelleştirmenizi / değiştirmenizi sağlar.',
    usage: '/takim-isim [lider] isim',
    category: 'Takım Yönetimi',
    async execute(message, args, client, db) {
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const isTeamLeader = teamStore.getLeader(message.guild.id, message.author.id);

        // Yetki Kontrolü
        if (!isAdmin && !isTeamLeader) {
            return message.reply('❌ Bu komutu kullanabilmek için **Takım Lideri** veya **Yönetici** olmalısınız.');
        }

        const targetLeader = message.mentions.users.first();
        let leaderId = '';
        let newTeamName = '';

        if (targetLeader) {
            // Eğer bir lider etiketlendiyse, sadece Yöneticiler başkasının takım adını değiştirebilir
            if (!isAdmin) {
                return message.reply('❌ Başka bir takımın adını sadece Yöneticiler değiştirebilir!');
            }
            leaderId = targetLeader.id;
            newTeamName = args.filter(argument => !/^<@!?\d+>$/.test(argument)).join(' ');
        } else {
            // Etiket yoksa, Takım Lideri kendi takımının adını değiştiriyordur
            if (isTeamLeader) {
                leaderId = message.author.id;
                newTeamName = args.join(' ');
            } else if (isAdmin) {
                return message.reply('❌ Yönetici olarak işlem yaparken lideri etiketlemelisiniz:\n`!takim-isim @lider <yeni_takım_adı>`');
            }
        }

        if (!newTeamName || newTeamName.trim().length === 0) {
            return message.reply('❌ Lütfen bir takım adı girin!\n**Örnek Kullanım:** `!takim-isim Alfa Takımı`');
        }

        if (newTeamName.length > 32) {
            return message.reply('❌ Takım adı en fazla **32 karakter** uzunluğunda olabilir.');
        }

        const cleanName = newTeamName.trim();

        // Veritabanına Kaydet
        teamStore.saveName(message.guild.id, leaderId, cleanName);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Takım İsmi Güncellendi')
            .setColor('Purple')
            .setDescription(`<@${leaderId}> liderliğindeki takımın yeni adı **"${cleanName}"** olarak ayarlandı!`)
            .addFields(
                { name: '👤 Takım Lideri', value: `<@${leaderId}>`, inline: true },
                { name: '🏷️ Yeni Takım Adı', value: `\`${cleanName}\``, inline: true }
            )
            .setFooter({ text: `İşlemi Yapan: ${message.author.tag}` })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }
};