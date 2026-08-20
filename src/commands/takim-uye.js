const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const teamStore = require('../utils/teamStore');

module.exports = {
    name: 'takim-uye',
    data: new SlashCommandBuilder()
        .setName('takim-uye')
        .setDescription('Takıma üye ekler veya takımdan üye çıkarır.')
        .addSubcommand(subcommand => subcommand
            .setName('ekle')
            .setDescription('Bir kullanıcıyı takıma ekler.')
            .addUserOption(option => option
                .setName('uye')
                .setDescription('Takıma eklenecek kullanıcı.')
                .setRequired(true))
            .addUserOption(option => option
                .setName('lider')
                .setDescription('Yönetici olarak işlem yapılacak takım lideri.')
                .setRequired(false))
            .addUserOption(option => option
                .setName('uye-2')
                .setDescription('İki kişiyle kullanımda ikinci üyeyi seçin; lider otomatik bulunur.')
                .setRequired(false)))
        .addSubcommand(subcommand => subcommand
            .setName('cikar')
            .setDescription('Bir kullanıcıyı takımdan çıkarır.')
            .addUserOption(option => option
                .setName('uye')
                .setDescription('Takımdan çıkarılacak kullanıcı.')
                .setRequired(true))
            .addUserOption(option => option
                .setName('lider')
                .setDescription('İkinci kişi veya yönetici olarak işlem yapılacak takım lideri.')
                .setRequired(false))),
    aliases: ['takım-üye', 'takimuye', 'team-member', 'tuye'],
    description: 'Takımınıza üye ekler veya takımınızdan üye çıkarır.',
    usage: '/takim-uye <ekle|cikar> uye [lider]',
    category: 'Takım Yönetimi',
    async execute(message, args, client, db) {
        const action = args[0]?.toLowerCase();

        // Yanlış veya eksik işlem girildiğinde rehber göster
        if (!action || !['ekle', 'cikar', 'çıkar', 'add', 'remove'].includes(action)) {
            const usageEmbed = new EmbedBuilder()
                .setTitle('❓ Takım Üye Yönetimi Kullanımı')
                .setColor('Yellow')
                .setDescription('Takımınıza üye eklemek veya çıkarmak için aşağıdaki formatları kullanabilirsiniz:')
                .addFields(
                    { name: '➕ Üye Ekleme', value: '`!takim-uye ekle @kullanici`' },
                    { name: '➖ Üye Çıkarma', value: '`!takim-uye çıkar @kullanici`' },
                    { name: '👑 Admin İle Başkasının Takımına Ekleme', value: '`!takim-uye ekle @kullanici @takım_lideri`' }
                )
                .setFooter({ text: 'Kısayol: !takim ekle @kullanici' });

            return message.reply({ embeds: [usageEmbed] });
        }

        // 1. Yetki ve Liderlik Kontrolü
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const isBotOwner = message.author.id === client.config.BOT_OWNER_ID;
        const isTeamLeader = teamStore.getLeader(message.guild.id, message.author.id);

        if (!isAdmin && !isBotOwner && !isTeamLeader) {
            return message.reply('❌ Bu komutu kullanabilmek için **Takım Lideri** veya **Yönetici** olmalısınız.');
        }

        // 2. Hedef Kullanıcı Kontrolü
        const slashUsers = ['uye', 'uye-2', 'lider']
            .map(name => message.slashOptions?.getUser(name))
            .filter(Boolean);
        const mentionedUsers = message.mentions.users.toJSON();
        const candidates = [...new Map([...slashUsers, ...mentionedUsers].map(user => [user.id, user])).values()];
        const leaderCandidate = candidates.find(user => teamStore.getLeader(message.guild.id, user.id));
        const targetCandidate = leaderCandidate && candidates.length >= 2
            ? candidates.find(user => user.id !== leaderCandidate.id)
            : slashUsers[0] || mentionedUsers[0];
        const targetMember = (targetCandidate && message.guild.members.cache.get(targetCandidate.id))
            || message.slashOptions?.getMember('uye')
            || message.mentions.members.first();
        if (!targetMember) {
            return message.reply(`❌ Lütfen işlem yapmak istediğiniz kullanıcıyı etiketleyin!\n**Örnek:** \`!takim-uye ${action} @kullanici\``);
        }

        if (targetMember.user.bot) {
            return message.reply('❌ Botlar üzerinde takım işlemi yapamazsınız!');
        }

        // 3. Takım Liderini Tespit Etme
        let leaderId = '';
        const selectedLeader = message.slashOptions?.getUser('lider') || null;

        if (leaderCandidate && candidates.length >= 2) {
            leaderId = leaderCandidate.id;
        } else if (selectedLeader && (isAdmin || isBotOwner)) {
            leaderId = selectedLeader.id;
        } else if (candidates.length >= 2 && (isAdmin || isBotOwner)) {
            return message.reply('❌ Etiketlenen kişiler arasında kayıtlı bir takım lideri bulunamadı.');
        } else if (isTeamLeader) {
            // Lider işlemi kendisi yapıyorsa
            leaderId = message.author.id;
        } else if (isAdmin || isBotOwner) {
            return message.reply(`❌ Yönetici olarak işlem yaparken takım liderini de etiketlemelisiniz:\n\`!takim-uye ${action} @üye @takım_lideri\``);
        }

        const isTargetLeaderValid = teamStore.getLeader(message.guild.id, leaderId);
        if (!isTargetLeaderValid) {
            return message.reply('❌ İşlem yapılmak istenen kişi aktif bir takım lideri değil!');
        }

        const teamName = teamStore.getTeamName(message.guild.id, leaderId);
        let teamMembers = teamStore.getMembers(message.guild.id, leaderId);

        // 4. İŞLEM: EKLEME
        if (['ekle', 'add'].includes(action)) {
            if (isBotOwner) {
                teamMembers = teamStore.forceAssignMember(message.guild.id, leaderId, targetMember.id);
            } else {
                if (teamMembers.includes(targetMember.id)) {
                    return message.reply(`❌ <@${targetMember.id}> zaten **${teamName}** kadrosunda bulunuyor!`);
                }

                teamMembers.push(targetMember.id);
                teamStore.saveMembers(message.guild.id, leaderId, teamMembers);
            }

            const addEmbed = new EmbedBuilder()
                .setTitle('➕ Takıma Yeni Üye Eklendi')
                .setColor('Green')
                .setDescription(`<@${targetMember.id}> kullanıcısı **${teamName}** kadrosuna${isBotOwner ? ' zorla' : ''} başarıyla eklendi!`)
                .addFields(
                    { name: '🛡️ Takım Adı', value: `\`${teamName}\``, inline: true },
                    { name: '👑 Takım Lideri', value: `<@${leaderId}>`, inline: true },
                    { name: '👥 Güncel Üye Sayısı', value: `\`${teamMembers.length} Kişi\``, inline: true }
                )
                .setFooter({ text: `İşlemi Yapan: ${message.author.tag}` })
                .setTimestamp();

            return message.channel.send({ embeds: [addEmbed] });
        }

        // 5. İŞLEM: ÇIKARMA
        if (['cikar', 'çıkar', 'remove'].includes(action)) {
            if (!teamMembers.includes(targetMember.id)) {
                return message.reply(`❌ <@${targetMember.id}> kullanıcısı **${teamName}** kadrosunda yer almıyor.`);
            }

            teamMembers = teamMembers.filter(id => id !== targetMember.id);
            teamStore.removeMember(message.guild.id, leaderId, targetMember.id);

            const removeEmbed = new EmbedBuilder()
                .setTitle('➖ Takımdan Üye Çıkarıldı')
                .setColor('Red')
                .setDescription(`<@${targetMember.id}> kullanıcısı **${teamName}** kadrosundan çıkarıldı.`)
                .addFields(
                    { name: '🛡️ Takım Adı', value: `\`${teamName}\``, inline: true },
                    { name: '👥 Kalan Üye Sayısı', value: `\`${teamMembers.length} Kişi\``, inline: true }
                )
                .setFooter({ text: `İşlemi Yapan: ${message.author.tag}` })
                .setTimestamp();

            return message.channel.send({ embeds: [removeEmbed] });
        }
    }
};