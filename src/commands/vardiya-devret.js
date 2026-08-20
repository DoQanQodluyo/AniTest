const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { SHIFT_KEY, PREVIOUS_SHIFT_KEY, collectTeamActivity, yetkiliMi, vardiyaEmbed, ownerDm, botChannelSend } = require('../utils/shiftHandover');

module.exports = {
    name: 'vardiya-devret',
    data: new SlashCommandBuilder()
        .setName('vardiya-devret')
        .setDescription('Takım etkinlikleriyle birlikte vardiya devri oluşturur.')
        .addStringOption(option => option.setName('notlar').setDescription('Bir sonraki vardiya amirine bırakılacak iş ve devir notları.').setRequired(true))
        .addStringOption(option => option.setName('vukuatlar').setDescription('Vardiya boyunca yaşanan krizler, cezalar veya önemli olaylar.').setRequired(false)),
    aliases: [],
    description: 'Takım performansını ve vardiya notlarını kalıcı vardiya raporuna dönüştürür.',
    usage: '/vardiya-devret notlar vukuatlar',
    category: 'Vardiya Sistemi',
    async execute(message, args, client) {
        if (!yetkiliMi(message.member, message.author.id)) return message.reply('❌ Bu komut yalnızca yapılandırılmış yetkililer tarafından kullanılabilir.');

        const notlar = args[0] || '';
        const vukuatlar = args[1] || 'Yok';
        if (!notlar.trim()) return message.reply('❌ `notlar` alanı zorunludur.');

        const etkinlik = collectTeamActivity(message.guild.id);
        const veri = {
            surum: 1,
            guildId: message.guild.id,
            amirId: message.author.id,
            amirEtiketi: message.author.tag || `<@${message.author.id}>`,
            notlar,
            vukuatlar,
            etkinlik,
            sorumluluklar: config.YETKILI_ROL_IDLERI.length ? config.YETKILI_ROL_IDLERI.map(id => `<@&${id}>`).join(', ') : 'Yapılandırılmadı.',
            zaman: Date.now()
        };

        const onceki = db.get(SHIFT_KEY);
        if (onceki) db.set(PREVIOUS_SHIFT_KEY, onceki);
        db.set(SHIFT_KEY, veri);

        const embed = vardiyaEmbed(veri, '📋 Vardiya Teslim Raporu');
        await ownerDm(client, { embeds: [embed] });
        await botChannelSend(client, { embeds: [embed] });
        return message.reply('✅ Vardiya raporu kaydedildi, bot sahibine DM ile gönderildi ve log kanalına işlendi.');
    }
};