// src/services/systemMonitor.js

const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

module.exports = {
    /**
     * Veritabanını güvenli bir şekilde başlatır ve doğrular.
     */
    async verifyDatabase() {
        const dbPath = path.join(process.cwd(), 'croxydb', 'croxydb.json');
        const maxRetries = 3;
        let attempts = 0;
        
        while (attempts < maxRetries) {
            try {
                await fs.mkdir(path.dirname(dbPath), { recursive: true });
                
                try {
                    const data = await fs.readFile(dbPath, 'utf8');
                    JSON.parse(data || '{}');
                    return true;
                } catch (err) {
                    if (err.code === 'ENOENT' || err instanceof SyntaxError) {
                        console.log(`⚠️ [Veritabanı] croxydb.json bulunamadı veya bozuk. Onarılıyor (Deneme: ${attempts + 1})...`);
                        await fs.writeFile(dbPath, '{}', 'utf8');
                    } else {
                        throw err;
                    }
                }
                return true;
            } catch (err) {
                console.error(`🔴 [Veritabanı] Doğrulama başarısız (Deneme ${attempts + 1}):`, err.message);
                attempts++;
                await new Promise(res => setTimeout(res, 1500 * attempts));
            }
        }
        
        console.error('🔴 [Veritabanı] Tüm kurtarma denemeleri başarısız oldu.');
        return false;
    },

    /**
     * Sistem durumunu ve uptime'ı raporlar.
     * @param {object} client - Discord Client nesnesi.
     * @param {object} guild - Sunucu nesnesi.
     */
    reportSystemStatus: async function(client, guild) {
        const isDbHealthy = await this.verifyDatabase();

        if (!isDbHealthy) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('🔴 Sistemde Aksama Saptandı')
                .setColor('Red')
                .setDescription(`Veritabanı yazma/okuma doğrulaması başarısız oldu. Kritik servisler askıda olabilir.`);
            
            return { title: '🔴 Sistemde Aksama Saptandı', description: errorEmbed.description, color: 'Red', fields: [{ name: 'Kontrol Zamanı', value: new Date().toISOString() }] };
        }

        const uptimeHours = Math.floor((Date.now() - client.readyAt.milliseconds) / (1000 * 60 * 60));
        const uptimeEmbed = new EmbedBuilder()
            .setTitle('🟢 Bot Sistemleri Sorunsuz Çalışıyor')
            .setColor('Green')
            .setDescription(`Sistem şu anda sorunsuz çalışıyor. Uptime: ${uptimeHours} saat.`)
            .setTimestamp();

        return { title: '🟢 Bot Sistemleri Sorunsuz Çalışıyor', description: uptimeEmbed.description, color: 'Green', fields: [{ name: 'Uptime', value: `${uptimeHours} saat` }] };
    }
};
