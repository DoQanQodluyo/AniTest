const { REST, Routes } = require('discord.js');
const config = require('../../config.js');

module.exports = async function autoDeployCommands(client) {
    try {
        const token    = process.env.TOKEN || config.TOKEN;
        // client.user.id her zaman clientReady'de hazırdır; env fallback
        const clientId = process.env.CLIENT_ID || config.CLIENT_ID || client.user?.id;
        const guildId  = process.env.GUILD_ID  || config.GUILD_ID;

        if (!token) { console.error('❌ [Auto-Deployer] TOKEN bulunamadı!'); return; }
        if (!clientId) { console.error('❌ [Auto-Deployer] CLIENT_ID bulunamadı!'); return; }

        const commandsBody = [];
        client.commands.forEach(cmd => {
            if (cmd.data) {
                const d = typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data;
                if (d?.name) commandsBody.push(d);
            }
        });

        if (!commandsBody.length) {
            console.error('❌ [Auto-Deployer] Yüklenecek komut bulunamadı!');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(token);
        console.log(`🔄 [Auto-Deployer] ${commandsBody.length} komut Discord API'ye senkronize ediliyor...`);

        // Discord'un Guild komutlarında uyguladığı sık rate-limit'leri aşmak için
        // komutları sadece Global olarak yüklüyoruz. (DJS v14'te global komutlar anında güncellenir)
        await rest.put(Routes.applicationCommands(clientId), { body: commandsBody });
        console.log(`✅ [Auto-Deployer] ${commandsBody.length} komut global olarak yüklendi.`);

    } catch (error) {
        console.error('❌ [Auto-Deployer] Senkronizasyon hatası:', error.message || error);
        throw error;
    }
};