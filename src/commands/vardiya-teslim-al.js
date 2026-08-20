const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');
const config = require('../../config.js');
const { SHIFT_KEY, PREVIOUS_SHIFT_KEY, yetkiliMi, vardiyaEmbed, ownerDm } = require('../utils/shiftHandover');

module.exports = {
    name: 'vardiya-teslim-al',
    data: new SlashCommandBuilder()
        .setName('vardiya-teslim-al')
        .setDescription('Önceki vardiya devrini DM ile teslim alır ve geçici devri temizler.'),
    aliases: [],
    description: 'Aktif vardiya raporunu yetkiliye DM olarak iletir ve teslim sonrası geçici veriyi temizler.',
    usage: '/vardiya-teslim-al',
    category: 'Vardiya Sistemi',
    async execute(message, args, client) {
        if (!yetkiliMi(message.member, message.author.id)) return message.reply('❌ Bu komut yalnızca yapılandırılmış yetkililer tarafından kullanılabilir.');

        const veri = db.get(SHIFT_KEY);
        if (!veri) return message.reply('❌ Teslim alınacak aktif bir vardiya devri bulunamadı.');

        const teslimVerisi = {
            ...veri,
            amirEtiketi: message.author.tag || `<@${message.author.id}>`,
            sorumluluklar: config.YETKILI_ROL_IDLERI.length ? config.YETKILI_ROL_IDLERI.map(id => `<@&${id}>`).join(', ') : 'Yapılandırılmadı.'
        };
        const embed = vardiyaEmbed(teslimVerisi, '📥 Vardiya Teslim Alındı', 'Green');
        const uye = await client.users.fetch(message.author.id).catch(() => null);
        if (uye) await uye.send({ embeds: [embed] }).catch(() => null);

        await ownerDm(client, { content: `✅ Vardiya ${message.author.tag || message.author.id} tarafından teslim alındı.` });
        db.set(PREVIOUS_SHIFT_KEY, veri);
        db.delete(SHIFT_KEY);
        return message.reply('✅ Önceki vardiya bilgileri DM üzerinden iletildi. Devir geçici verileri temizlendi; takım istatistik geçmişi korundu.');
    }
};