const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { haftalikSkorboarduKesinlestir } = require('../utils/weeklyScoreboard');

module.exports = {
    name: 'skorboard-yenile',
    data: new SlashCommandBuilder()
        .setName('skorboard-yenile')
        .setDescription('Geçen haftanın doğrulanmış skorboardunu oluşturur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    aliases: ['sbyenile', 'skorboard-guncelle', 'sb-refresh'],
    description: 'Discord API ve hibrit yetkili verileriyle haftalık skorboardu kesinleştirir.',
    usage: '/skorboard-yenile',
    category: 'Sistem Yönetimi',
    async execute(message, args, client, db) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Bu komutu sadece yöneticiler kullanabilir.');
        }

        const durum = await message.reply('⏳ Geçen haftanın mesajları Discord API üzerinden doğrulanıyor ve skorboard hazırlanıyor...');
        try {
            const sonuc = await haftalikSkorboarduKesinlestir(client, message.guild, { zorla: true });
            await durum.edit(sonuc.atlandi ? '✅ Bu haftanın skorboardu zaten kesinleştirilmiş.' : '✅ Doğrulanmış skorboard ve rol devir teslimi tamamlandı.');
        } catch (hata) {
            console.error('[Skorboard] Manuel kesinleştirme hatası:', hata);
            await durum.edit('❌ Skorboard kesinleştirilemedi. Detaylar hata loguna yazıldı.').catch(() => {});
        }
    }
};
