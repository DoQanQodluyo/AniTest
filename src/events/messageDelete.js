const db = require('croxydb');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (!message.guild || message.author?.bot) return;
        if (!message.content && !message.attachments?.size) return;

        const kanalId = message.channel.id;
        const key = `snipe_list_${kanalId}`;
        const snipeList = db.get(key) || [];

        const deletedData = {
            yazarId: message.author?.id || 'bilinmiyor',
            yazarTag: message.author?.tag || message.author?.username || 'Bilinmeyen Kullanıcı',
            yazarAvatar: message.author?.displayAvatarURL?.({ extension: 'png' }) || null,
            icerik: message.content || 'İçerik bulunmuyor.',
            gorselUrl: message.attachments?.first()?.url || null,
            silinmeTarihi: Date.now(),
            mesajId: message.id
        };

        snipeList.push(deletedData);

        // Bellek Yönetimi: Maksimum 10 silinen mesaj saklanır
        while (snipeList.length > 10) {
            snipeList.shift();
        }

        db.set(key, snipeList);
    }
};
