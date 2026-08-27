const { SlashCommandBuilder } = require('discord.js');
const db = require('croxydb');

const data = new SlashCommandBuilder()
    .setName('oneri')
    .setDescription('Sunucuya anonim öneri veya şikayet gönderir')
    .addStringOption(opt => opt.setName('mesaj').setDescription('Öneri / şikayet metniniz').setRequired(true));

module.exports = {
    name: 'oneri',
    data: data.toJSON(),
    description: 'Sunucuya anonim öneri veya şikayet gönderir',
    async execute(message, args, client) {
        const options = message.slashOptions || message.options;
        const oydurumCmd = client.commands.get('etkilesim');
        if (oydurumCmd?.oneriGonder) {
            return oydurumCmd.oneriGonder(message, options, client);
        }

        const OneriKanalId = client.config.ONERI_KANAL_ID || '914191232253702184';
        const kanal = client.channels.cache.get(OneriKanalId) || await client.channels.fetch(OneriKanalId).catch(() => null);
        if (!kanal?.isTextBased()) return message.reply({ content: '❌ Öneri kanalı bulunamadı.', flags: 64 });

        const mesajMetni = options?.getString?.('mesaj') || args.join(' ');
        if (!mesajMetni) return message.reply({ content: '❌ Lütfen bir öneri metni yazın.', flags: 64 });

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('📮 Anonim Öneri / Şikayet')
            .setColor('Gold')
            .setDescription(mesajMetni)
            .setFooter({ text: 'AniTest Anonim Geribildirim' })
            .setTimestamp();

        const gonderilen = await kanal.send({ embeds: [embed] });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`onay_voting_${gonderilen.id}`).setLabel('✅ Destekle (0)').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`red_voting_${gonderilen.id}`).setLabel('❌ Reddet (0)').setStyle(ButtonStyle.Danger)
        );

        await gonderilen.edit({ components: [row] });
        db.set(`anonim_oylama_${gonderilen.id}`, { messageId: gonderilen.id, evet: [], hayir: [] });

        return message.reply({ content: '✅ Anonim öneriniz yetkililere iletildi ve oylamaya sunuldu!', flags: 64 });
    }
};
