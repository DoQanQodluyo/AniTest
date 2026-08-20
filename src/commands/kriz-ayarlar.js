const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');

function ayarlar(guildId) {
    return db.get(`kriz_ayar_${guildId}`) || { aktif: false, kanallar: [] };
}

module.exports = {
    name: 'kriz-ayarlar',
    data: new SlashCommandBuilder()
        .setName('kriz-ayarlar')
        .setDescription('Kriz korumasını yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand => subcommand.setName('durum').setDescription('Kriz korumasını açar veya kapatır.').addStringOption(option => option.setName('durum').setDescription('Sistem durumu.').setRequired(true).addChoices({ name: 'Aktif', value: 'aktif' }, { name: 'Pasif', value: 'pasif' })))
        .addSubcommand(subcommand => subcommand.setName('kanal-ekle').setDescription('Korunacak kanal ekler.').addChannelOption(option => option.setName('kanal').setDescription('Korunacak kanal.').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('kanal-cikar').setDescription('Korunan kanalı çıkarır.').addChannelOption(option => option.setName('kanal').setDescription('Çıkarılacak kanal.').setRequired(true))),
    aliases: ['kriz-koruma'], description: 'Kriz korumasının durumunu ve kanallarını yönetir.', usage: '/kriz-ayarlar', category: 'Yönetim',
    async execute(message, args, client, db) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Bu komut yalnızca yöneticiler içindir.');
        const mevcut = ayarlar(message.guild.id);
        const islem = args[0];
        if (islem === 'durum') mevcut.aktif = args[1] === 'aktif';
        if (islem === 'kanal-ekle' || islem === 'kanal-cikar') {
            const kanalId = message.mentions.channels.first()?.id;
            if (!kanalId) return message.reply('Bir kanal seçilmelidir.');
            mevcut.kanallar = mevcut.kanallar || [];
            if (islem === 'kanal-ekle' && !mevcut.kanallar.includes(kanalId)) mevcut.kanallar.push(kanalId);
            if (islem === 'kanal-cikar') mevcut.kanallar = mevcut.kanallar.filter(id => id !== kanalId);
        }
        db.set(`kriz_ayar_${message.guild.id}`, mevcut);
        return message.reply(`Kriz koruması güncellendi. Durum: **${mevcut.aktif ? 'Aktif' : 'Pasif'}** | Kanal sayısı: **${mevcut.kanallar.length}**`);
    }
};
