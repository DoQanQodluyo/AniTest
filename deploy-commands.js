/**
 * deploy-commands.js — bağımsız deploy scripti
 * node deploy-commands.js
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token    = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

if (!token || !clientId) { console.error('TOKEN ve CLIENT_ID gerekli'); process.exit(1); }

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data);
        } else {
            console.log(`[UYARI] ${file} dosyasında 'data' veya 'execute' eksik.`);
        }
    } catch (error) {
        console.error(`[HATA] ${file} yüklenirken hata oluştu:`, error.message);
    }
}

console.log(`📦 Deploy: ${commands.length} komut bulundu — ${commands.map(c => c.name).join(', ')}`);

const rest = new REST({ version: '10' }).setToken(token);
(async () => {
    try {
        if (guildId) {
            const res = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            console.log(`✅ ${res.length} komut guild'e yüklendi!`);
            const globals = await rest.get(Routes.applicationCommands(clientId)).catch(() => []);
            if (globals.length) {
                await rest.put(Routes.applicationCommands(clientId), { body: [] });
                console.log(`🧹 ${globals.length} global komut temizlendi.`);
            }
        } else {
            const res = await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log(`✅ ${res.length} komut global yüklendi!`);
        }
    } catch(e) { console.error('❌ HATA:', e.message); process.exit(1); }
})();
