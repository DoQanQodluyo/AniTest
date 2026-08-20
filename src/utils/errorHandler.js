const { sendErrorReport, sendConnectionReport } = require('./reportLogger');

module.exports = function setupErrorHandler(client) {
    const recentErrors = new Map();
    const networkCodes = new Set(['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED']);
    const sendErrorLog = async (title, error, fields = []) => {
        console.error(`❌ [${title}]`, error);
        const code = error?.code || '';
        const fingerprint = `${code}:${title}`;
        const cooldown = networkCodes.has(code) || title.includes('bağlantısı') ? 60000 : 10000;
        const previous = recentErrors.get(fingerprint) || 0;
        if (Date.now() - previous < cooldown) return;
        recentErrors.set(fingerprint, Date.now());
        if (networkCodes.has(code)) {
            await sendConnectionReport(client, 'Discord ağ bağlantısı sorunu', `${title}: ${error.message || error}`, fields).catch(() => {});
            return;
        }
        await sendErrorReport(client, title, error, fields).catch(reportError => {
            console.error('❌ [Rapor] Hata raporu oluşturulamadı:', reportError);
        });
    };

    // 1. Yakalanmamış Promise Reddetmeleri (Botun çökmesini önler)
    process.on('unhandledRejection', (reason, promise) => {
        sendErrorLog('Unhandled Rejection (Promise Hatası)', reason);
    });

    // 2. Yakalanmamış Kod İstisnaları (Botun kapanmasını önler)
    process.on('uncaughtException', (error, origin) => {
        sendErrorLog('Uncaught Exception (Kritik Kod Hatası)', error, [{ name: 'Kaynak', value: origin || 'Bilinmiyor' }]);
    });

    process.on('warning', warning => {
        sendErrorLog('Node.js Uyarısı', warning);
    });

    client.on('error', (error) => {
        sendErrorLog('Discord WebSocket / Client Hatası', error);
    });

    client.on('shardError', error => {
        sendErrorLog('Discord Shard Hatası', error);
    });

    client.on('warn', warning => {
        sendErrorLog('Discord.js Uyarısı', new Error(warning));
    });

    client.on('shardReconnecting', shardId => {
        sendConnectionReport(client, 'Discord bağlantısı yeniden kuruluyor', `Shard ${shardId} yeniden bağlanmayı deniyor.`).catch(() => {});
    });

    client.on('shardDisconnect', (event, shardId) => {
        sendConnectionReport(client, 'Discord bağlantısı kesildi', `Shard ${shardId} bağlantısı kesildi.`, [{ name: 'Kod', value: String(event?.code || 'Bilinmiyor') }]).catch(() => {});
    });
};