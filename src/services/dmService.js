// src/services/dmService.js

const config = require('../../config.js');

/**
 * Banlı kullanıcıya bile DM gönderebilen servis.
 * guild.members yerine client.users.fetch kullanır.
 */
module.exports = {
    async sendUserDM(guildOrClient, userId, messageText, context) {
        try {
            // guildOrClient hem guild hem de client olarak gelebilir
            const client = guildOrClient?.client || guildOrClient;
            const user = await client.users.fetch(userId).catch(() => null);

            if (!user) {
                console.warn(`[DM] Kullanıcı bulunamadı: ${userId} (${context})`);
                return { success: false, log: `Kullanıcı bulunamadı: ${userId}` };
            }

            const sent = await user.send(messageText).catch(err => {
                console.warn(`[DM] DM kapalı veya engel: ${userId} — ${err.message} (${context})`);
                return null;
            });

            return sent
                ? { success: true, log: `DM gönderildi: ${context}` }
                : { success: false, log: `DM iletilemedi (kapalı): ${context}` };
        } catch (err) {
            console.error(`[DM HATA] ${userId} — ${err.message} (${context})`);
            return { success: false, log: `DM genel hata: ${err.message}` };
        }
    },

    /**
     * Embed ile DM gönderir.
     */
    async sendUserDMEmbed(guildOrClient, userId, embed, context) {
        try {
            const client = guildOrClient?.client || guildOrClient;
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) return { success: false, log: `Kullanıcı bulunamadı: ${userId}` };
            const sent = await user.send({ embeds: [embed] }).catch(() => null);
            return sent
                ? { success: true }
                : { success: false, log: `DM iletilemedi (kapalı): ${context}` };
        } catch (err) {
            return { success: false, log: err.message };
        }
    }
};