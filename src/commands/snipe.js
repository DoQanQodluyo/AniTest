const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Kanalda silinen son mesajları görüntüler')
    .addIntegerOption(opt => 
        opt.setName('sayi')
            .setDescription('Silinen mesaj sayısı (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
    );

module.exports = {
    name: 'snipe',
    data: data.toJSON(),
    description: 'Kanalda silinen son mesajları görüntüler',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const sayi = options?.getInteger?.('sayi') || 1;
        const kanalId = message.channel?.id || message.channelId;
        const snipeList = db.get(`snipe_list_${kanalId}`) || [];

        if (!snipeList.length) {
            return message.reply({ content: '❌ Bu kanalda silinen mesaj kaydı bulunmuyor.', flags: 64 });
        }

        const gosterilecekler = snipeList.slice(-sayi).reverse();
        const embeds = gosterilecekler.map((s, i) => {
            const silinmeTarihi = Math.floor(s.silinmeTarihi / 1000);
            return new EmbedBuilder()
                .setTitle(`🗑️ Silinen Mesaj ${gosterilecekler.length > 1 ? `(${i + 1}/${gosterilecekler.length})` : ''}`)
                .setColor('Red')
                .setDescription(s.icerik || '*İçerik yok.*')
                .addFields(
                    { name: '👤 Yazan', value: `<@${s.yazarId}> (${s.yazarTag})`, inline: true },
                    { name: '🕐 Silinme', value: `<t:${silinmeTarihi}:R>`, inline: true }
                )
                .setImage(s.gorselUrl || null)
                .setTimestamp();
        });

        return message.reply({ embeds });
    }
};
