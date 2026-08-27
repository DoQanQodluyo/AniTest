// --- index.js ---
require('dotenv').config();
const { verifyDatabase } = require('./src/services/systemMonitor');

(async () => {
    console.log('🔄 [Sistem] Veritabanı kontrol ediliyor...');
    const isDbHealthy = await verifyDatabase();
    if (!isDbHealthy) {
        console.error('🔴 [Sistem] Veritabanı doğrulanamadı. Bot başlatılamıyor.');
        process.exit(1);
    }
    console.log('✅ [Sistem] Veritabanı hazır.');

    const { Client, GatewayIntentBits, Collection, Partials, EmbedBuilder, Options, ActivityType } = require('discord.js');
    const fs = require('fs');
    const config = require('./config.js');
    const setupErrorHandler = require('./src/utils/errorHandler');

    // 1. Client Yapılandırması ve RAM Koruması (GC Limits)
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildVoiceStates
        ],
        partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
        makeCache: Options.cacheWithLimits({
            MessageManager: 25,
            ThreadManager: 10,
            PresenceManager: 0,
            ReactionManager: 0,
            GuildMemberManager: {
                maxSize: 100,
                keepOverLimit: member => member.id === client.user.id,
            },
        }),
    });

    // 2. Client Koleksiyonları ve Ayarları
    client.commands = new Collection();
    client.config = config;

    // 3. Gelişmiş Hata Yönetim Sistemini Bağla (Anti-Crash)
    setupErrorHandler(client);
    process.on('unhandledRejection', (reason, promise) => {
        console.error('🔴 [Anti-Crash] İşlenmeyen Promise Reddi:', reason);
    });
    process.on('uncaughtException', (error) => {
        console.error('🔴 [Anti-Crash] Yakalanmayan İstisna:', error);
    });

    // 4. Komut Handler (src/commands)
    const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const command = require(`./src/commands/${file}`);
            const cmdName = command.data?.name || command.name;
            if (cmdName) {
                client.commands.set(cmdName, command);
            }
        } catch (cmdError) {
            console.error(`🔴 [Komut Yükleme Hatası] ${file}:`, cmdError.message);
        }
    }
    console.log(`📦 ${client.commands.size} komut yüklendi: ${[...client.commands.keys()].join(', ')}`);

    // 5. Event Handler (src/events)
    const eventFiles = fs.readdirSync('./src/events').filter(file => file.endsWith('.js') && !file.endsWith('.js.js') && file !== 'ready.js');
    for (const file of eventFiles) {
        try {
            const event = require(`./src/events/${file}`);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        } catch (eventError) {
            console.error(`🔴 [Event Yükleme Hatası] ${file}:`, eventError.message);
        }
    }

    // 6. Cron Joblar (node-cron)
    const cron = require('node-cron');
    const db = require('croxydb');
    const DUYURU_KANAL_ID = config.DUYURU_KANAL_ID || '914191232253702184';

    // Cron 1: Her gece 00:00 Zaman Kapsülü Kontrolü
    cron.schedule('0 0 * * *', async () => {
        console.log('⏳ [Zaman Kapsülü] Günlük kilit açma kontrolü çalışıyor...');
        const bugunStr = new Date().toISOString().split('T')[0];
        const kapsuller = db.get('zaman_kapsulleri') || [];
        const kalanKapsuller = [];

        for (const kapsul of kapsuller) {
            if (kapsul.tarih <= bugunStr) {
                const kanal = client.channels.cache.get(kapsul.channelId)
                    || await client.channels.fetch(kapsul.channelId).catch(() => null)
                    || client.channels.cache.get(config.BOT_KANAL_ID);

                if (kanal?.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('⏳ ZAMAN KAPSÜLÜ AÇILDI!')
                        .setColor('Purple')
                        .setDescription(`<@${kapsul.userId}> Tarafından **${kapsul.olusturulmaTarihi}** Tarihinde Bırakıldı:\n\n${kapsul.mesaj}`)
                        .setFooter({ text: `Kilit Bitiş Tarihi: ${kapsul.tarih}` })
                        .setTimestamp();

                    if (kapsul.gorselUrl) embed.setImage(kapsul.gorselUrl);
                    await kanal.send({ content: `<@${kapsul.userId}>`, embeds: [embed] }).catch(() => null);
                }
            } else {
                kalanKapsuller.push(kapsul);
            }
        }
        db.set('zaman_kapsulleri', kalanKapsuller);
    });

    // Cron 2: Her Pazar Gece 20:00 Gazete Basımı
    cron.schedule('0 20 * * 0', async () => {
        console.log('📰 [Gazete] Pazar 20:00 - Otomatik gazete yayınlanıyor...');
        const guild = client.guilds.cache.get(config.GUILD_ID) || client.guilds.cache.first();
        if (guild) {
            const analizCmd = client.commands.get('analiz');
            if (analizCmd?.gazeteBasimiYap) {
                await analizCmd.gazeteBasimiYap(client, guild, DUYURU_KANAL_ID);
            }
            db.set('weekly_new_rules_count', 0);
        }
    });

    // 7. Dinamik Dönen Durum / Presence Rotasyonu
    let presenceIndex = 0;
    const startPresenceRotation = () => {
        const updatePresence = () => {
            if (!client.user) return;
            const totalMembers = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);
            const totalGuilds = client.guilds.cache.size;
            const dashUrl = config.DASHBOARD_URL || 'http://78.154.103.8:16362';

            const activities = [
                { name: `${totalMembers} kullanıcıyı dinliyor`, type: ActivityType.Listening },
                { name: `${totalGuilds} sunucuda nöbette!`, type: ActivityType.Watching },
                { name: `/yardim | 🌐 ${dashUrl}`, type: ActivityType.Playing },
                { name: `AniBot v2 • Güvenlik & Görev Sistemi`, type: ActivityType.Custom, state: `🌐 Panel: ${dashUrl}` }
            ];

            const current = activities[presenceIndex % activities.length];
            client.user.setPresence({
                activities: [current],
                status: 'online'
            });
            presenceIndex++;
        };

        updatePresence();
        setInterval(updatePresence, 15000);
    };

    // 8. Botu Başlat & Dashboard Bağla
    console.log('✅ [Sistem] Discord\'a bağlanılıyor...');
    client.login(config.TOKEN || config.BOT_TOKEN).then(() => {
        // Durum rotasyonunu başlat
        startPresenceRotation();

        // Web Dashboard Başlat
        const { startDashboard } = require('./src/dashboard/server');
        startDashboard(client);
    }).catch(err => {
        console.error('🔴 [Giriş Hatası] Discord client giriş yapamadı:', err.message);
    });
})();