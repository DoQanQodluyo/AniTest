const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const db = require('croxydb');
const { standupKontrolEt } = require('../utils/standupAssistant');
const { haftalikSkorboarduKesinlestir } = require('../utils/weeklyScoreboard');
const { analizRaporuGonder } = require('../utils/trafficAnalyzer');
const { acilisRaporuGonder } = require('../utils/startupDiagnostics');
const { gorevleriGeriYukle } = require('../utils/taskHub');
const autoDeployCommands = require('../utils/autoDeployer');
const { sendReport, sendErrorReport } = require('../utils/reportLogger');
const { shouldPostReminder } = require('../utils/spamMonitor');
const { aktifDurumlariSenkronizeEt } = require('../utils/judicialSystem');

async function kuralHatirlatmasiniKontrolEt(client) {
    const channelId = client.config.KURAL_HATIRLATMA_KANAL_ID;
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const result = await shouldPostReminder(channel);
    if (!result.active) {
        await sendReport(client, { title: '⏭️ Kural hatırlatması pas geçildi', description: result.reason, color: 'Grey', channelId: client.config.BOT_KANAL_ID });
        return;
    }
    await channel.send({ content: result.content }).catch(error => sendErrorReport(client, 'Kural hatırlatması gönderilemedi', error));
    await sendReport(client, { title: '📢 Kural hatırlatması gönderildi', description: result.reason, color: 'Blue', channelId: client.config.BOT_KANAL_ID });
}

async function heartbeat(client, guild) {
    const startedAt = client.readyAt?.getTime() || Date.now();
    try {
        const dbProbe = `healthcheck_${guild.id}`;
        db.set(dbProbe, { zaman: Date.now() });
        if (!db.get(dbProbe)) throw new Error('croxydb yazma/okuma doğrulanamadı.');
        await guild.fetch();
        await sendReport(client, { title: '🟢 Bot Sistemleri Sorunsuz Çalışıyor', description: `Uptime: ${((Date.now() - startedAt) / 3600000).toFixed(2)} saat`, color: 'Green', channelId: client.config.BOT_KANAL_ID });
    } catch (error) {
        await sendErrorReport(client, '🔴 Sistemde Aksam Saptandı', error, [{ name: 'Uptime', value: `${((Date.now() - startedAt) / 3600000).toFixed(2)} saat` }]);
    }
}

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        console.log(`🤖 [AKTIF] ${client.user.tag} - Gelişmiş Puan Çarpanı ve Otomatik Rol Kontrolü Aktif.`);
        let deployBasarili = true;
        try {
            await autoDeployCommands(client);
        } catch (error) {
            deployBasarili = false;
            await sendErrorReport(client, 'Slash komutları senkronizasyonu başarısız', error);
        }
        await sendReport(client, {
            title: deployBasarili ? '✅ Bot hazır' : '⚠️ Bot hazır, slash senkronizasyonu başarısız',
            description: deployBasarili ? 'Tekil clientReady akışı aktif.' : 'Bot bağlandı fakat slash komutları senkronize edilemedi.',
            color: deployBasarili ? 'Green' : 'Orange',
            fields: [{ name: 'Komut sayısı', value: String(client.commands.size), inline: true }]
        });

        const guildId = client.config.GUILD_ID;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        aktifDurumlariSenkronizeEt(guild.id);

        await gorevleriGeriYukle(guild, client.config.GOREV_ROLU_ID).catch(error => {
            console.error('[Görev] Kalıcı görevler geri yüklenemedi:', error.message);
        });

        await acilisRaporuGonder(client, guild).catch(error => {
            console.error('[Sistem] Açılış durum raporu gönderilemedi:', error.message);
        });

        await checkMonthlyKudosReport(client, guild, db).catch(error => {
            console.error('[Kudos] Açılış aylık rapor kontrolü başarısız:', error);
        });

        standupKontrolEt(client, guild, { reason: 'İlk çevrimiçi kontrol', forceReport: true }).catch(error => {
            console.error('[Stand-up] Açılış kontrolü başarısız:', error);
            sendErrorReport(client, 'Stand-up açılış kontrolü başarısız', error);
        });

        client.on('shardReady', () => {
            aktifDurumlariSenkronizeEt(guild.id);
            standupKontrolEt(client, guild, { reason: 'Offline sonrası yeniden çevrimiçi kontrol', forceReport: true }).catch(error => {
                sendErrorReport(client, 'Stand-up yeniden çevrimiçi kontrolü başarısız', error);
            });
        });

        cron.schedule('* * * * *', async () => {
            await standupKontrolEt(client, guild, { reason: '09:00 günlük API kontrolü' }).catch(error => {
                sendErrorReport(client, 'Stand-up günlük API kontrolü başarısız', error);
            });
        });

        cron.schedule('*/30 * * * *', async () => kuralHatirlatmasiniKontrolEt(client).catch(error => sendErrorReport(client, 'Kural hatırlatma kontrolü başarısız', error)));
        cron.schedule('0 * * * *', async () => heartbeat(client, guild));

        cron.schedule('0 * * * *', async () => {
            await checkMonthlyKudosReport(client, guild, db).catch(error => {
                console.error('[Kudos] Saatlik aylık rapor kontrolü başarısız:', error);
            });
        });

        cron.schedule('0 0 * * 1', async () => {
            await analizRaporuGonder(client, guild).catch(error => {
                console.error('[Trafik] Haftalık analiz raporu gönderilemedi:', error.message);
            });
        });

        // Her Pazartesi 00:00 Haftalık Sıfırlama ve Rol Devir Teslimi (0 0 * * 1)
        cron.schedule('0 0 * * 1', async () => {
            await haftalikSkorboarduKesinlestir(client, guild).catch(error => {
                console.error('[Skorboard] Haftalık kesinleştirme başarısız:', error);
            });
        });

        await haftalikSkorboarduKesinlestir(client, guild).catch(error => {
            console.error('[Skorboard] Restart sonrası kontrol başarısız:', error);
        });
    },
};

// -------------------------------------------------------------
// GEÇEN HAFTANIN (10-16.08) VERİSİNE GÖRE ROL ATAMA FONKSİYONU
// -------------------------------------------------------------
async function checkAndAssignMissingWeeklyRoles(client, guild, db) {
    const config = client.config;
    
    const elemanRole = config.HAFTANIN_ELEMANI_ROL_ID ? guild.roles.cache.get(config.HAFTANIN_ELEMANI_ROL_ID) : null;
    const uyeRole = config.HAFTANIN_UYESI_ROL_ID ? guild.roles.cache.get(config.HAFTANIN_UYESI_ROL_ID) : null;

    const isElemanEmpty = elemanRole && elemanRole.members.size === 0;
    const isUyeEmpty = uyeRole && uyeRole.members.size === 0;

    if (!isElemanEmpty && !isUyeEmpty) return; // İki rol de kimsede boş değilse işlem yapma

    console.log('🔍 [Rol Kontrolü] Haftalık rollerden biri veya ikisi kimsede yok! Geçen haftanın (Pazartesi-Pazar) verisi hesaplanıyor...');

    // Geçen Haftanın (Örn: 10.08 - 16.08) Verisini Veritabanı Arşivinden / Loglardan Çek
    const lastWeekArchive = db.get(`archive_last_week_${guild.id}`) || {};

    // 1. Haftanın Elemanı Yoksa Geçen Haftanın Liderine Ver
    if (isElemanEmpty && elemanRole) {
        let topStaffId = null;
        let maxStaffScore = -1;

        guild.members.cache.forEach(m => {
            if (m.roles.cache.some(r => (config.STAFF_ROLES || []).includes(r.id))) {
                const userData = lastWeekArchive[m.id] || { chat: 0, voiceMin: 0, partner: 0 };
                // Yetkili Puanı: (Msg * 1) + (VoiceMin * 1.5) + (Partner * 2)
                const score = (userData.chat * 1) + (userData.voiceMin * 1.5) + (userData.partner * 2);
                
                if (score > maxStaffScore && score > 0) {
                    maxStaffScore = score;
                    topStaffId = m.id;
                }
            }
        });

        if (topStaffId) {
            const winner = await guild.members.fetch(topStaffId).catch(() => null);
            if (winner) {
                await winner.roles.add(elemanRole);
                console.log(`✅ [Otomatik Rol] Geçen haftanın 1.'si <@${topStaffId}> kullanıcısına Haftanın Elemanı rolü atandı.`);
            }
        }
    }

    // 2. Haftanın Üyesi Yoksa Geçen Haftanın Liderine Ver
    if (isUyeEmpty && uyeRole) {
        let topMemberId = null;
        let maxMemberScore = -1;

        guild.members.cache.forEach(m => {
            if (!m.user.bot) {
                const userData = lastWeekArchive[m.id] || { chat: 0, voiceMin: 0 };
                // Üye Puanı: (Msg * 1) + (VoiceMin * 1)
                const score = (userData.chat * 1) + (userData.voiceMin * 1);
                
                if (score > maxMemberScore && score > 0) {
                    maxMemberScore = score;
                    topMemberId = m.id;
                }
            }
        });

        if (topMemberId) {
            const winner = await guild.members.fetch(topMemberId).catch(() => null);
            if (winner) {
                await winner.roles.add(uyeRole);
                console.log(`✅ [Otomatik Rol] Geçen haftanın 1.'si <@${topMemberId}> kullanıcısına Haftanın Üyesi rolü atandı.`);
            }
        }
    }
}

// -------------------------------------------------------------
// HAFTALIK SIFIRLAMA VE ARŞİVLEME FONKSİYONU (PAZARTESİ 00:00)
// -------------------------------------------------------------
async function processWeeklyResetAndRoles(client, guild, db) {
    const config = client.config;
    console.log('🔄 [Pazartesi 00:00] Haftalık Sıfırlama ve Rol Devir Teslimi Başladı...');

    const lastWeekData = {};

    // 1. Yetkili Kazananını Belirle
    let topStaffId = null;
    let maxStaffPoint = -1;

    guild.members.cache.forEach(m => {
        const partnerCount = db.get(`partnerData_${m.id}`)?.haftalik || 0;
        const chatCount = db.get(`chat_7d_${guild.id}_${m.id}`) || 0;
        const voiceMs = db.get(`voice_7d_${guild.id}_${m.id}`) || 0;
        const voiceMin = Math.floor(voiceMs / 60000);

        // Veri Arşivi
        lastWeekData[m.id] = { chat: chatCount, voiceMin: voiceMin, partner: partnerCount };

        if (m.roles.cache.some(r => (config.STAFF_ROLES || []).includes(r.id))) {
            const score = (chatCount * 1) + (voiceMin * 1.5) + (partnerCount * 2);
            if (score > maxStaffPoint && score > 0) {
                maxStaffPoint = score;
                topStaffId = m.id;
            }
        }
    });

    // Rolü Güncelle
    if (config.HAFTANIN_ELEMANI_ROL_ID) {
        const role = guild.roles.cache.get(config.HAFTANIN_ELEMANI_ROL_ID);
        if (role) {
            for (const member of role.members.values()) {
                await member.roles.remove(role).catch(() => {});
            }
            if (topStaffId) {
                const winner = await guild.members.fetch(topStaffId).catch(() => null);
                if (winner) await winner.roles.add(role).catch(() => {});
            }
        }
    }

    // 2. Üye Kazananını Belirle
    let topMemberId = null;
    let maxMemberPoint = -1;

    guild.members.cache.forEach(m => {
        if (!m.user.bot) {
            const userData = lastWeekData[m.id] || { chat: 0, voiceMin: 0 };
            const score = (userData.chat * 1) + (userData.voiceMin * 1);
            if (score > maxMemberPoint && score > 0) {
                maxMemberPoint = score;
                topMemberId = m.id;
            }
        }
    });

    if (config.HAFTANIN_UYESI_ROL_ID) {
        const role = guild.roles.cache.get(config.HAFTANIN_UYESI_ROL_ID);
        if (role) {
            for (const member of role.members.values()) {
                await member.roles.remove(role).catch(() => {});
            }
            if (topMemberId) {
                const winner = await guild.members.fetch(topMemberId).catch(() => null);
                if (winner) await winner.roles.add(role).catch(() => {});
            }
        }
    }

    // 3. Geçen Haftanın Verisini Arşive Kaydet ve Haftayı Sıfırla
    db.set(`archive_last_week_${guild.id}`, lastWeekData);

    const allData = db.all();
    for (const key in allData) {
        if (key.startsWith(`chat_7d_${guild.id}_`) || key.startsWith(`voice_7d_${guild.id}_`)) {
            db.delete(key);
        }
    }
    console.log('✅ Haftalık veriler başarıyla sıfırlandı ve geçen haftanın verileri arşive kaydedildi.');
}

function getKudosMonthKey(date) {
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}_${date.getUTCFullYear()}`;
}

function getPreviousMonthKey(date = new Date()) {
    return getKudosMonthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

async function checkMonthlyKudosReport(client, guild, db) {
    const reportChannelId = client.config.RAPOR_KANAL_ID;
    if (!reportChannelId) return;

    const currentMonth = getKudosMonthKey(new Date());
    const previousMonth = getPreviousMonthKey(new Date());
    const markerKey = `last_reported_month_${guild.id}`;
    if (db.get(markerKey) === previousMonth) return;

    const history = db.get(`kudos_history_${guild.id}`) || [];
    const scores = new Map();
    for (const record of history) {
        if (record.month !== previousMonth) continue;
        scores.set(record.receiverId, (scores.get(record.receiverId) || 0) + 1);
    }

    const leaders = [...scores.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, 5);
    const reportChannel = guild.channels.cache.get(reportChannelId)
        || await guild.channels.fetch(reportChannelId).catch(() => null);
    if (!reportChannel || !reportChannel.isTextBased()) return;

    const leaderboard = leaders.length > 0
        ? leaders.map(([userId, score], index) => `**${index + 1}.** <@${userId}> — **${score} teşekkür**`).join('\n')
        : 'Geçen ay kayıtlı teşekkür bulunamadı.';
    const embed = new EmbedBuilder()
        .setTitle(`🏆 ${previousMonth} Mikro-Teşekkür Liderlik Tablosu`)
        .setColor('Gold')
        .setDescription(leaderboard)
        .setFooter({ text: `Raporlandı: ${currentMonth}` })
        .setTimestamp();

    await reportChannel.send({ embeds: [embed] });
    db.set(markerKey, previousMonth);
}