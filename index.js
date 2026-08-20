require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const config = require('./config.js');
const setupErrorHandler = require('./src/utils/errorHandler');

// 1. Client Yapılandırması
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// 2. Client Koleksiyonları ve Ayarları
client.commands = new Collection();
client.config = config;

// 3. Gelişmiş Hata Yönetim Sistemini Bağla (Anti-Crash)
setupErrorHandler(client);

// 4. Komut Handler (src/commands)
const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./src/commands/${file}`);
    if (command.name) {
        client.commands.set(command.name, command);
    }
}

// 5. Event Handler (src/events)
const eventFiles = fs.readdirSync('./src/events')
    .filter(file => file.endsWith('.js') && !file.endsWith('.js.js') && file !== 'ready.js');
for (const file of eventFiles) {
    const event = require(`./src/events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// 6. Botu Başlat
client.login(config.TOKEN);