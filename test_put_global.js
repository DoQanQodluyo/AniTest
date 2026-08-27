require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token    = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            const d = typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
            if (d?.name) commands.push(d);
        }
    } catch (error) {}
}

const rest = new REST({ version: '10' }).setToken(token);

rest.on('rateLimit', (info) => {
    console.log('RATE LIMIT:', info);
});
rest.on('response', (req, res) => {
    console.log('RESPONSE:', res.status, req.path);
});

(async () => {
    try {
        console.log(`Sending PUT to Global Commands...`);
        const res = await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log(`✅ Success!`);
        process.exit(0);
    } catch(e) {
        console.error('❌ ERROR:', e.message);
        process.exit(1);
    }
})();
