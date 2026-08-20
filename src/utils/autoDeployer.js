const { REST, Routes } = require('discord.js');
const config = require('../../config.js');

module.exports = async function autoDeployCommands(client) {
    try {
        console.log('🔄 [Auto-Deployer] Slash komutları senkronize ediliyor...');

        const commandsBody = [];
        client.commands.forEach(cmd => {
            if (cmd.data) {
                const dataJSON = typeof cmd.data.toJSON === 'function' ? cmd.data.toJSON() : cmd.data;
                commandsBody.push(dataJSON);
            }
        });

        // 💡 SELF-HEALING (Kendi Kendini Onarma):
        // Eğer CLIENT_ID env veya config'te yoksa, botun aktif Discord ID'sini otomatik al.
        const token = process.env.TOKEN || config.TOKEN;
        const clientId = process.env.CLIENT_ID || config.CLIENT_ID || client.user?.id;

        if (!token || !clientId) {
            console.error('❌ [Auto-Deployer] Token veya Client ID tespit edilemedi!');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(token);

        const route = config.GUILD_ID
            ? Routes.applicationGuildCommands(clientId, config.GUILD_ID)
            : Routes.applicationCommands(clientId);

        await rest.put(route, { body: commandsBody });

        if (config.GUILD_ID) {
            const globalCommands = await rest.get(Routes.applicationCommands(clientId));
            for (const globalCommand of globalCommands) {
                await rest.delete(Routes.applicationCommand(clientId, globalCommand.id));
            }
            if (globalCommands.length) {
                console.log(`🧹 [Auto-Deployer] ${globalCommands.length} eski global slash komutu temizlendi.`);
            }
        }

        console.log(`✅ [Auto-Deployer] ${commandsBody.length} slash komutu ${config.GUILD_ID ? 'sunucuya' : 'globale'} başarıyla senkronize edildi!`);
    } catch (error) {
        console.error('❌ [Auto-Deployer] Senkronizasyon hatası:', error);
        throw error; // Error Handler'ın yakalaması için hatayı fırlatıyoruz
    }
};  