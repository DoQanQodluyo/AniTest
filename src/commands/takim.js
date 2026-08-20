const { SlashCommandBuilder } = require('discord.js');
const teamStore = require('../utils/teamStore');

module.exports = {
    name: 'takim',
    data: new SlashCommandBuilder()
        .setName('takim')
        .setDescription('Takım liderlerini ve takım üyelerini yönetir.')
        .addSubcommand(subcommand => subcommand
            .setName('lider-ekle')
            .setDescription('Bir kullanıcıyı takım lideri yapar.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Takım lideri yapılacak kullanıcı.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('lider-cikar')
            .setDescription('Bir kullanıcının takım liderliğini kaldırır.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Liderliği kaldırılacak kullanıcı.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('uye-ekle')
            .setDescription('Bir kullanıcıyı kendi takımına ekler.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Takıma eklenecek kullanıcı.')
                .setRequired(true)))
        .addSubcommand(subcommand => subcommand
            .setName('uye-cikar')
            .setDescription('Bir kullanıcıyı takımdan çıkarır.')
            .addUserOption(option => option
                .setName('kullanici')
                .setDescription('Takımdan çıkarılacak kullanıcı.')
                .setRequired(true))),
    aliases: ['takım', 'takim-yonet', 'takimyonet'],
    description: 'Takım liderlerini ve takım üyelerini yönetir.',
    usage: '/takim <lider-ekle|lider-cikar|uye-ekle|uye-cikar> kullanici',
    category: 'Ekip',
    execute(message, args, client) {
        const islem = args[0];
        const targetUser = message.mentions.users.first();
        if (!islem || !targetUser) return message.reply('Kullanım: `!takim lider-ekle @kullanıcı` veya `!takim uye-ekle @kullanıcı`');

        if (islem === 'lider-ekle' || islem === 'lider-cikar') {
            if (!message.member.permissions.has('Administrator')) return message.reply('Yetkin yok!');
            if (islem === 'lider-ekle') {
                teamStore.saveLeader(message.guild.id, targetUser.id);
                message.reply(`👑 ${targetUser} artık bir Takım Lideri!`);
            } else {
                teamStore.removeLeader(message.guild.id, targetUser.id);
                message.reply(`🔻 ${targetUser} kullanıcısının Takım Liderliği alındı.`);
            }
            return;
        }

        const isLeader = teamStore.getLeader(message.guild.id, message.author.id);
        if (!isLeader && !message.member.permissions.has('Administrator')) return message.reply('Takımına üye eklemek için Takım Lideri olmalısın!');

        if (islem === 'uye-ekle') {
            const hasTeam = teamStore.read(`userTeam_${targetUser.id}`, null);
            if (hasTeam) return message.reply('❌ Bu kullanıcı zaten başka bir takımda!');
            teamStore.saveMembers(message.guild.id, message.author.id, [
                ...teamStore.getMembers(message.guild.id, message.author.id),
                targetUser.id
            ]);
            message.reply(`✅ ${targetUser}, başarıyla senin takımına eklendi!`);
        } else if (islem === 'uye-cikar') {
            const userLeader = teamStore.read(`userTeam_${targetUser.id}`, null);
            if (userLeader !== message.author.id && !message.member.permissions.has('Administrator')) {
                return message.reply('❌ Sadece kendi takımındaki üyeleri çıkarabilirsin.');
            }
            teamStore.removeMember(message.guild.id, message.author.id, targetUser.id);
            message.reply(`🚪 ${targetUser}, takımdan çıkarıldı.`);
        }
    }
};