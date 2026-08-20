const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function parcalaraBol(value, limit = 1024) {
    const text = String(value ?? '');
    if (!text) return [''];
    const chunks = [];
    for (let index = 0; index < text.length; index += limit) chunks.push(text.slice(index, index + limit));
    return chunks;
}

function alanlariEmbedlereBol({ title, description, color = 'Blue', fields = [], footer, timestamp = true }) {
    const pages = [new EmbedBuilder().setTitle(title).setColor(color)];
    if (description) {
        const descriptions = parcalaraBol(description, 4096);
        descriptions.forEach((part, index) => {
            if (index === 0) pages[0].setDescription(part);
            else pages.push(new EmbedBuilder().setTitle(`${title} (${index + 1})`).setColor(color).setDescription(part));
        });
    }

    for (const field of fields) {
        const parts = parcalaraBol(field.value, 1024);
        parts.forEach((part, index) => {
            let page = pages[pages.length - 1];
            if (page.data.fields?.length >= 25) {
                page = new EmbedBuilder().setTitle(`${title} (${pages.length + 1})`).setColor(color);
                pages.push(page);
            }
            page.addFields({ name: index ? `${field.name} (${index + 1})` : field.name, value: part, inline: Boolean(field.inline) });
        });
    }

    if (footer || timestamp) pages.forEach(page => {
        if (footer) page.setFooter({ text: footer });
        if (timestamp) page.setTimestamp();
    });
    return pages;
}

function sayfalamaSatiri(id, page, total) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sayfa_onceki_${id}`).setLabel('Önceki').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
        new ButtonBuilder().setCustomId(`sayfa_sonraki_${id}`).setLabel('Sonraki').setStyle(ButtonStyle.Primary).setDisabled(page >= total - 1)
    );
}

module.exports = { parcalaraBol, alanlariEmbedlereBol, sayfalamaSatiri };