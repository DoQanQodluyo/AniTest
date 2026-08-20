const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const DEFAULT_SETTINGS = {
    trackMessages: true,
    trackPartners: true,
    autoScoreboard: true
};

function getSettings(guildId, db) {
    return { ...DEFAULT_SETTINGS, ...(db.get(`settings_${guildId}`) || {}) };
}

function saveSettings(guildId, settings, db) {
    db.set(`settings_${guildId}`, settings);
}

function createPanel(guild, db, selectedChannelIds = []) {
    const settings = getSettings(guild.id, db);
    const allowedChannels = db.get(`allowedChannels_${guild.id}`) || [];
    const channelList = allowedChannels.length > 0
        ? allowedChannels.map(channelId => `<#${channelId}>`).join(', ')
        : 'Henüz kanal eklenmemiş.';
    const selectedText = selectedChannelIds.length > 0
        ? selectedChannelIds.map(channelId => `<#${channelId}>`).join(', ')
        : 'Kanal seçilmedi.';

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Sunucu Ayarları')
        .setColor('Blue')
        .setDescription('Ayarları ve stat izleme kanallarını bu panelden yönetin. Değişiklikler anında kaydedilir.')
        .addFields(
            { name: '💬 Mesaj İstatistikleri', value: settings.trackMessages ? '🟢 Açık' : '🔴 Kapalı', inline: true },
            { name: '🤝 Partner Takibi', value: settings.trackPartners ? '🟢 Açık' : '🔴 Kapalı', inline: true },
            { name: '🏆 Otomatik Skorboard', value: settings.autoScoreboard ? '🟢 Açık' : '🔴 Kapalı', inline: true },
            { name: '📡 İzlenen Kanallar', value: channelList, inline: false },
            { name: '🎯 Seçili Kanallar', value: selectedText, inline: false }
        )
        .setFooter({ text: 'Panel 2 dakika boyunca aktiftir.' })
        .setTimestamp();

    const settingMenu = new StringSelectMenuBuilder()
        .setCustomId('ayarlar_setting')
        .setPlaceholder('Bir ayar işlemi seçin...')
        .addOptions(
            { label: 'Mesaj istatistiklerini aç/kapat', value: 'trackMessages', description: 'Canlı mesaj sayacını değiştirir.', emoji: '💬' },
            { label: 'Partner takibini aç/kapat', value: 'trackPartners', description: 'Partner mesajlarından veri toplamayı değiştirir.', emoji: '🤝' },
            { label: 'Otomatik skorboardu aç/kapat', value: 'autoScoreboard', description: 'Otomatik skorboard işlemlerini değiştirir.', emoji: '🏆' },
            { label: 'Tüm stat verilerini sıfırla', value: 'resetStats', description: 'Mesaj, ses ve partner statlarını siler.', emoji: '🗑️' }
        );

    const channelMenu = new ChannelSelectMenuBuilder()
        .setCustomId('ayarlar_channels')
        .setPlaceholder('Yönetilecek kanalları seçin...')
        .setChannelTypes(0)
        .setMinValues(1)
        .setMaxValues(25);

    const settingButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ayarlar_messages').setLabel(settings.trackMessages ? 'Mesaj: Açık' : 'Mesaj: Kapalı').setStyle(settings.trackMessages ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ayarlar_partners').setLabel(settings.trackPartners ? 'Partner: Açık' : 'Partner: Kapalı').setStyle(settings.trackPartners ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ayarlar_scoreboard').setLabel(settings.autoScoreboard ? 'Skorboard: Açık' : 'Skorboard: Kapalı').setStyle(settings.autoScoreboard ? ButtonStyle.Success : ButtonStyle.Danger)
    );

    const channelButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ayarlar_channel_add').setLabel('Kanalları Ekle').setEmoji('📥').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ayarlar_channel_remove').setLabel('Kanalları Çıkar').setEmoji('📤').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ayarlar_refresh').setLabel('Yenile').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ayarlar_close').setLabel('Kapat').setEmoji('✖️').setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(settingMenu),
            new ActionRowBuilder().addComponents(channelMenu),
            settingButtons,
            channelButtons
        ]
    };
}

function getToggleKey(customId) {
    return {
        ayarlar_messages: 'trackMessages',
        ayarlar_partners: 'trackPartners',
        ayarlar_scoreboard: 'autoScoreboard'
    }[customId];
}

module.exports = {
    name: 'ayarlar',
    data: new SlashCommandBuilder()
        .setName('ayarlar')
        .setDescription('Sunucu ayarlarını tek bir kontrol panelinden yönetir.'),
    aliases: ['ayar', 'ayar-yönet', 'sunucu-ayarlari'],
    description: 'Sunucu ayarlarını ve stat izleme kanallarını etkileşimli panelle yönetir.',
    usage: '/ayarlar',
    category: 'Yönetim',
    async execute(message, args, client, db) {
        if (message.author.id !== client.config.BOT_OWNER_ID && !message.member.permissions.has('Administrator')) {
            return message.reply('Bu komut için yetkiniz yok.');
        }

        let selectedChannelIds = [];
        const panelMessage = await message.reply(createPanel(message.guild, db));
        const collector = panelMessage.createMessageComponentCollector({ time: 120000 });
        const isAuthorized = interaction => interaction.user.id === message.author.id;

        collector.on('collect', async interaction => {
            if (!isAuthorized(interaction)) return interaction.deferUpdate();

            if (interaction.isChannelSelectMenu()) {
                selectedChannelIds = interaction.values;
                return interaction.update(createPanel(message.guild, db, selectedChannelIds));
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.values[0] === 'resetStats') {
                    db.deleteAll();
                } else {
                    const settings = getSettings(message.guild.id, db);
                    const settingKey = interaction.values[0];
                    settings[settingKey] = !settings[settingKey];
                    saveSettings(message.guild.id, settings, db);
                }
                return interaction.update(createPanel(message.guild, db, selectedChannelIds));
            }

            if (interaction.customId === 'ayarlar_close') {
                collector.stop('closed');
                return interaction.update({ content: 'Sunucu ayarları paneli kapatıldı.', embeds: [], components: [] });
            }

            const settingKey = getToggleKey(interaction.customId);
            if (settingKey) {
                const settings = getSettings(message.guild.id, db);
                settings[settingKey] = !settings[settingKey];
                saveSettings(message.guild.id, settings, db);
            } else if (interaction.customId === 'ayarlar_channel_add' || interaction.customId === 'ayarlar_channel_remove') {
                const key = `allowedChannels_${message.guild.id}`;
                const currentChannels = db.get(key) || [];
                const updatedChannels = interaction.customId === 'ayarlar_channel_add'
                    ? [...new Set([...currentChannels, ...selectedChannelIds])]
                    : currentChannels.filter(channelId => !selectedChannelIds.includes(channelId));
                db.set(key, updatedChannels);
            }

            await interaction.update(createPanel(message.guild, db, selectedChannelIds));
        });

        collector.on('end', () => {
            const disabledPanel = createPanel(message.guild, db, selectedChannelIds);
            disabledPanel.components.forEach(row => row.components.forEach(component => component.setDisabled(true)));
            panelMessage.edit({ components: disabledPanel.components }).catch(() => {});
        });
    }
};
