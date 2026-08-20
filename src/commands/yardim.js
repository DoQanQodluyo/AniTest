const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

function getCategories(commands) {
    const categories = new Map();

    commands.forEach(command => {
        const category = command.category || 'Genel';
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(command);
    });

    for (const commandList of categories.values()) {
        commandList.sort((first, second) => first.name.localeCompare(second.name, 'tr'));
    }

    return new Map([...categories.entries()].sort(([first], [second]) => first.localeCompare(second, 'tr')));
}

function getCommandList(commandList) {
    return commandList
        .map(command => `• **/${command.name}**: ${command.description || 'Açıklama belirtilmemiş.'}`)
        .join('\n');
}

function createPanel(categories, selectedCategory, selectedCommand, page, client) {
    const categoryEntries = [...categories.entries()];
    const selectedCommands = selectedCategory ? categories.get(selectedCategory) : null;
    const pageSize = 5;
    const totalPages = selectedCommands ? Math.max(1, Math.ceil(selectedCommands.length / pageSize)) : 1;
    const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
    const pageCommands = selectedCommands
        ? selectedCommands.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
        : null;
    const description = selectedCommand
        ? `**/${selectedCommand.name}** komutunun detayları aşağıda gösteriliyor.`
        : selectedCommands
        ? `**${selectedCategory}** kategorisindeki komutlar aşağıda listeleniyor.\nSayfa **${currentPage + 1}/${totalPages}**`
        : 'Komutları kategoriye göre görmek için aşağıdaki menüyü kullanın.';
    const commandDetailText = selectedCommand
        ? [
            `**📝 Açıklama**\n${selectedCommand.description || 'Açıklama belirtilmemiş.'}`,
            `**📌 Kullanım**\n\`${selectedCommand.usage || `/${selectedCommand.name}`}\``,
            `**🔗 Takma Adlar**\n${selectedCommand.aliases?.length ? selectedCommand.aliases.map(alias => `\`${alias}\``).join(', ') : 'Yok'}`,
            `**📂 Kategori**\n${selectedCommand.category || 'Genel'}`
        ].join('\n\n')
        : null;
    const embed = new EmbedBuilder()
        .setTitle('🤖 Komut Yardım Merkezi')
        .setColor('DarkGreen')
        .setDescription(description)
        .addFields({
            name: selectedCommand ? `📖 ${selectedCommand.name}` : selectedCommands ? `📂 ${selectedCategory}` : '📚 Kategoriler',
            value: selectedCommand ? commandDetailText : selectedCommands ? getCommandList(pageCommands) : categoryEntries
                .map(([category, commandList]) => `• **${category}**: ${commandList.length} komut`)
                .join('\n')
        })
        .setFooter({ text: `Toplam komut: ${client.commands.size}` })
        .setTimestamp();

    if (client.user) embed.setThumbnail(client.user.displayAvatarURL({ dynamic: true }));

    const categoryMenu = new StringSelectMenuBuilder()
        .setCustomId('yardim_category')
        .setPlaceholder('Bir komut kategorisi seçin...')
        .addOptions(categoryEntries.map(([category, commandList]) => ({
            label: category.slice(0, 100),
            value: category.slice(0, 100),
            description: `${commandList.length} komut içerir.`
        })));

    const commandOptions = selectedCommands?.slice(0, 25).map(command => ({
        label: command.name.slice(0, 100),
        value: command.name,
        description: (command.description || 'Komut detayını gösterir.').slice(0, 100)
    })) || [{ label: 'Önce kategori seçin', value: 'none', description: 'Komut seçimi için önce bir kategori seçin.' }];
    const commandMenu = new StringSelectMenuBuilder()
        .setCustomId('yardim_command')
        .setPlaceholder(selectedCommands ? 'Bir komut seçin...' : 'Önce kategori seçin...')
        .setDisabled(!selectedCommands)
        .addOptions(commandOptions);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('yardim_previous')
            .setLabel('Önceki')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!selectedCommands || currentPage === 0),
        new ButtonBuilder()
            .setCustomId('yardim_next')
            .setLabel('Sonraki')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!selectedCommands || currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId('yardim_refresh')
            .setLabel('Yenile')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('yardim_close')
            .setLabel('Kapat')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger)
    );

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(categoryMenu), new ActionRowBuilder().addComponents(commandMenu), buttons]
    };
}

function createCommandDetail(command) {
    return new EmbedBuilder()
        .setTitle(`📖 Komut Detayı: ${command.name}`)
        .setColor('Blue')
        .addFields(
            { name: '📝 Açıklama', value: command.description || 'Açıklama belirtilmemiş.' },
            { name: '📌 Kullanım', value: `\`${command.usage || `/${command.name}`}\``, inline: true },
            { name: '🔗 Takma Adlar', value: command.aliases?.length ? command.aliases.map(alias => `\`${alias}\``).join(', ') : 'Yok', inline: true },
            { name: '📂 Kategori', value: command.category || 'Genel', inline: true }
        )
        .setFooter({ text: 'Dinamik komut bilgisi' })
        .setTimestamp();
}

module.exports = {
    name: 'yardim',
    data: new SlashCommandBuilder()
        .setName('yardim')
        .setDescription('Kullanılabilir komutları ve komut detaylarını listeler.')
        .addStringOption(option => option
            .setName('komut')
            .setDescription('Detayı gösterilecek komut adı veya aliası.')
            .setRequired(false)),
    aliases: ['help', 'y', 'bilgi', 'yardım', 'komutlar'],
    description: 'Sistemdeki tüm komutları kategorilerine göre dinamik olarak listeler.',
    usage: '/yardim [komut]',
    category: 'Genel',
    async execute(message, args, client, db) {
        const commands = client.commands;

        if (args[0]) {
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName) || commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            if (!command) {
                return message.reply(`❌ **\`${commandName}\`** adında bir komut bulunamadı.`);
            }

                return message.channel.send({ embeds: [createCommandDetail(command)] });
        }

        let categories = getCategories(commands);
        let selectedCategory = null;
        let selectedCommand = null;
        let currentPage = 0;
        const panelMessage = await message.channel.send(createPanel(categories, selectedCategory, selectedCommand, currentPage, client));
        const componentCollector = panelMessage.createMessageComponentCollector({ time: 120000 });

        const isAuthorized = interaction => interaction.user.id === message.author.id;

        componentCollector.on('collect', async interaction => {
            if (!isAuthorized(interaction)) {
                return interaction.deferUpdate();
            }

            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'yardim_category') {
                    selectedCategory = interaction.values[0];
                    selectedCommand = null;
                    currentPage = 0;
                } else if (interaction.customId === 'yardim_command') {
                    selectedCommand = categories.get(selectedCategory)?.find(command => command.name === interaction.values[0]) || null;
                }
            } else if (interaction.isButton()) {
                if (interaction.customId === 'yardim_close') {
                    componentCollector.stop('closed');
                    return interaction.update({ content: 'Yardım menüsü kapatıldı.', embeds: [], components: [] });
                }

                categories = getCategories(commands);
                const selectedCommands = selectedCategory ? categories.get(selectedCategory) : null;
                const totalPages = selectedCommands ? Math.max(1, Math.ceil(selectedCommands.length / 5)) : 1;

                if (interaction.customId === 'yardim_previous') currentPage = Math.max(0, currentPage - 1);
                if (interaction.customId === 'yardim_next') currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            categories = getCategories(commands);
                await interaction.update(createPanel(categories, selectedCategory, selectedCommand, currentPage, client));
        });

        componentCollector.on('end', () => {
            panelMessage.edit({
                components: createPanel(categories, selectedCategory, selectedCommand, currentPage, client).components
                    .map(row => {
                        row.components.forEach(component => component.setDisabled(true));
                        return row;
                    })
            }).catch(() => {});
        });
    }
};