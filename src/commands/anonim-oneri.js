const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder
} = require('discord.js');

function oylamaButonlari(mesajId, evetSayisi, hayirSayisi) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`onay_voting_${mesajId}`)
            .setLabel(`Onayla (${evetSayisi})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`red_voting_${mesajId}`)
            .setLabel(`Reddet (${hayirSayisi})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );
}

module.exports = {
    name: 'anonim-oneri',
    data: new SlashCommandBuilder()
        .setName('anonim-oneri')
        .setDescription('Kimliğinizi gizleyerek öneri veya şikayet gönderir.')
        .addStringOption(option => option
            .setName('fikir_veya_sikayet')
            .setDescription('Anonim olarak iletilecek fikir veya şikayet.')
            .setMaxLength(2000)
            .setRequired(true)),
    aliases: ['anonim-fikir', 'anonim-sikayet'],
    description: 'Kimliği gizli öneri ve şikayet gönderir.',
    usage: '/anonim-oneri fikir_veya_sikayet',
    category: 'Genel',
    async execute(message, args, client, db) {
        const oneriMetni = args.join(' ').trim();
        const oneriKanali = client.config.ONERI_KANAL_ID
            ? await client.channels.fetch(client.config.ONERI_KANAL_ID).catch(() => null)
            : null;

        if (!oneriKanali || !oneriKanali.isTextBased()) {
            return message.reply({
                content: 'Öneri kanalı yapılandırılmamış veya erişilemiyor.',
                flags: 64
            });
        }

        if (!oneriMetni) {
            return message.reply({
                content: 'Lütfen bir fikir veya şikayet yazın.',
                flags: 64
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('📮 Anonim Öneri / Şikayet')
            .setColor('Blue')
            .setDescription(oneriMetni)
            .setFooter({ text: 'Gönderenin kimliği gizlidir.' })
            .setTimestamp();

        const oneriMesaji = await oneriKanali.send({ embeds: [embed] });
        const oylamaVerisi = {
            messageId: oneriMesaji.id,
            evet: [],
            hayir: []
        };

        db.set(`anonim_oylama_${oneriMesaji.id}`, oylamaVerisi);
        await oneriMesaji.edit({
            embeds: [embed],
            components: [oylamaButonlari(oneriMesaji.id, 0, 0)]
        });

        return message.reply({
            content: 'Anonim öneriniz başarıyla iletildi.',
            flags: 64
        });
    },

    oylamaButonlari
};
