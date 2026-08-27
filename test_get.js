require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token    = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId  = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

rest.on('rateLimit', (info) => {
    console.log('RATE LIMIT:', info);
});
rest.on('response', (req, res) => {
    console.log('RESPONSE:', res.status, req.path);
});

(async () => {
    try {
        console.log(`Sending GET to ${Routes.applicationGuildCommands(clientId, guildId)}...`);
        const res = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
        console.log(`✅ Success! Found ${res.length} guild commands.`);
        console.log(res.map(c => c.name).join(', '));
        process.exit(0);
    } catch(e) {
        console.error('❌ ERROR:', e.message);
        process.exit(1);
    }
})();
