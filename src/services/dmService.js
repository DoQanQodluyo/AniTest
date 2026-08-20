// src/services/dmService.js

const db = require('croxydb');

module.exports = {
    /**
     * Kullanıcıya anında DM gönderir. DM kapalıysa hata loglanır.
     * @param {object} guild - Sunucu nesnesi.
     * @param {string} userId - Hedef kullanıcı ID'si.
     * @param {string} messageText - Gönderilecek mesaj.
     * @param {string} context - Gönderimin kaynağı (örneğin: 'Soruşturma Açıldı').
     */
    async sendUserDM: async (guild, userId, messageText, context) => {
        try {
            const user = await guild.users.fetch(userId).catch(() => null);

            if (user) {
                // Kullanıcının DM'inin açık olup olmadığını kontrol et (Discord.js v14'teki yöntem)
                const isDMsOpen = user.dmChannel && user.dmChannel.isPrivate();

                if (isDMsOpen) {
                    const channel = user.dmChannel;
                    await channel.send(messageText).catch(err => {
                        console.error(`[DM HATA] Kullanıcı ${userId} için DM gönderilemedi (Kanal kapalı/Hata): ${err.message}`);
                    });
                    return { success: true, log: `DM başarıyla gönderildi: ${context}` };
                } else {
                    // DM kapalıysa loglama yap
                    console.error(`[DM HATA] Kullanıcı ${userId} için DM gönderilemedi (DM kapalı): ${context}`);
                    return { success: false, log: `DM kapalı olduğu için bildirim iletilemedi: ${context}` };
                }
            } else {
                console.error(`[DM HATA] Sunucuda bulunamayan kullanıcı ID: ${userId}. Bildirim yapılamadı.`);
                return { success: false, log: `Sunucuda bulunamayan kullanıcı ID: ${userId}` };
            }
        } catch (error) {
            console.error(`[DM GENEL HATA] Kullanıcı ${userId} ile iletişim kurulamadı:`, error);
            return { success: false, log: `DM genel hata: ${error.message}` };
        }
    }
};