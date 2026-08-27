require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag} (${client.user.id})`);
    
    try {
        const globalCmds = await client.application.commands.fetch();
        console.log(`Found ${globalCmds.size} GLOBAL commands.`);
        
        const guildCmds = await client.application.commands.fetch({ guildId: config.GUILD_ID });
        console.log(`Found ${guildCmds.size} GUILD commands for ${config.GUILD_ID}.`);
    } catch (e) {
        console.error('Error fetching commands:', e);
    }
    
    process.exit(0);
});

client.login(process.env.TOKEN || config.TOKEN);
