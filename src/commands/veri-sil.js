const { SlashCommandBuilder } = require('discord.js');
const { deleteByKey, deleteByRecordId, ownerMi } = require('../utils/recordStore');

module.exports = {
    name: 'veri-sil',
    data: new SlashCommandBuilder()
        .setName('veri-sil')
        .setDescription('Bir DB kaydını yalnızca bot sahibi siler.')
        .addStringOption(option => option.setName('anahtar').setDescription('Silinecek tam DB anahtarı.').setRequired(false))
        .addStringOption(option => option.setName('kayit-id').setDescription('Silinecek kayıt IDsi.').setRequired(false)),
    aliases: [], category: 'Sistem Yönetimi', description: 'Sadece bot sahibinin kontrollü veri silmesini sağlar.', usage: '/veri-sil anahtar',
    async execute(message) {
        if (!ownerMi(message.author.id)) return message.reply('❌ Bu işlem yalnızca bot sahibine açıktır.');
        const key = message.slashOptions?.getString('anahtar');
        const id = message.slashOptions?.getString('kayit-id');
        if (!key && !id) return message.reply('❌ `anahtar` veya `kayit-id` alanlarından biri zorunludur.');
        const result = key ? deleteByKey(message.author.id, key) : deleteByRecordId(message.author.id, id);
        return message.reply(result.ok ? `✅ ${result.reason}` : `❌ ${result.reason}`);
    }
};