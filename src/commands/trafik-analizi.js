const { SlashCommandBuilder } = require('discord.js');
const { apiOncelikliAnalizPaketiOlustur } = require('../utils/trafficAnalyzer');

module.exports = {
    name: 'trafik-analizi',
    data: new SlashCommandBuilder()
        .setName('trafik-analizi')
        .setDescription('Son 4 haftanın sunucu yoğunluğunu analiz eder.')
        .addStringOption(option => option
            .setName('tur')
            .setDescription('Üretilecek analiz grafiği.')
            .setRequired(true)
            .addChoices(
                { name: 'Saatlik', value: 'saatlik' },
                { name: 'Günlük', value: 'gunluk' },
                { name: 'Kanal bazlı', value: 'kanal-bazli' },
                { name: 'Trend', value: 'trend' }
            ))
        .addChannelOption(option => option
            .setName('kanal')
            .setDescription('Kanal bazlı analiz için kanal.')
            .setRequired(false)),
    aliases: ['yogunluk-analizi'], description: 'Saatlik mesaj ve ses trafiğinden yoğunluk tahmini üretir.', usage: '/trafik-analizi', category: 'Analiz',
    async execute(message, args, client) {
        const tur = args[0] || 'saatlik';
        const kanalEtiketi = args.find(arg => /^<#\d+>$/.test(arg));
        const kanalId = kanalEtiketi ? kanalEtiketi.slice(2, -1) : null;
        const ilerlemeMesaji = await message.progress?.('⏳ Trafik analizi hazırlanıyor. Discord API üzerinden bekleyen mesajlar taranıyor...');
        const ilerleme = async icerik => {
            if (message.updateProgress) await message.updateProgress({ content: icerik, embeds: [], files: [] });
        };
        const paket = await apiOncelikliAnalizPaketiOlustur(message.guild, tur, kanalId, ilerleme);
        if (message.updateProgress) return message.updateProgress(paket);
        if (ilerlemeMesaji?.edit) return ilerlemeMesaji.edit(paket);
        return message.reply(paket);
    }
};
