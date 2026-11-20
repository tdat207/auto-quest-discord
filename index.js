/**
 * Discord Quest Bot - Autonomous Quest Center (MT System Clone)
 * Framework: discord.js v14
 * Workflow: Pre-scan -> Private DM Report -> Channel Live Progress -> Final DM Notification
 */

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { QuestSession } = require('./quest_engine');

// Optional HTTP Health-check server & Visual Diagnostic for Cloud Hosting (Render, Koyeb, Glitch, etc.)
let botConnected = false;
let lastLoginError = null;

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    const isReady = client.isReady();
    const tokenConfigured = Boolean(activeBotToken && activeBotToken !== 'DÁN_BOT_TOKEN_VÀO_ĐÂY');

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Auto Quest Bot - Cloud Status</title></head><body style="font-family:sans-serif;background:#1e1f22;color:#fff;padding:30px;line-height:1.6;max-width:650px;margin:0 auto;">`;
    html += `<h2 style="color:#5865F2;">⚡ Discord Auto Quest Bot Status</h2>`;

    if (isReady) {
        html += `<div style="background:#2b2d31;padding:16px;border-radius:8px;border-left:4px solid #57F287;">`;
        html += `<p style="color:#57F287;font-size:18px;margin:0 0 8px 0;">✅ <b>BOT ĐANG ONLINE VÀ KẾT NỐI VÀO DISCORD THÀNH CÔNG!</b></p>`;
        html += `<p style="margin:4px 0;">• Tên Bot: <b>${client.user.tag}</b> (ID: <code>${client.user.id}</code>)</p>`;
        html += `<p style="margin:4px 0;">• Máy chủ Discord phục vụ: <b>${client.guilds.cache.size} server(s)</b></p>`;
        html += `<p style="margin:8px 0 0 0;color:#949ba4;"><i>Bấm nút "🚀 Bắt đầu" hoặc gõ <code>/quest</code> trên Discord sẽ hoạt động ngay lập tức.</i></p>`;
        html += `</div>`;
    } else {
        html += `<div style="background:#2b2d31;padding:16px;border-radius:8px;border-left:4px solid #ED4245;">`;
        html += `<p style="color:#ED4245;font-size:18px;margin:0 0 8px 0;">❌ <b>BOT CHƯA KẾT NỐI VÀO DISCORD ĐƯỢC!</b></p>`;
        if (!tokenConfigured) {
            html += `<p style="color:#FAA61A;">⚠️ <b>NGUYÊN NHÂN:</b> Chưa có biến môi trường <code>BOT_TOKEN</code> trên Render!</p>`;
            html += `<p><b>Cách sửa ngay:</b> Vào Render ➔ Dịch vụ <code>auto-quest-discord</code> ➔ Tab <b>Environment</b> ➔ Thêm:<br>• Key: <code>BOT_TOKEN</code><br>• Value: <i>(Dán Bot Token của bạn từ Developer Portal)</i></p>`;
        } else {
            html += `<p style="margin:4px 0;">Đã nhận biến <code>BOT_TOKEN</code> nhưng kết nối đến Discord Gateway chưa hoàn tất.</p>`;
            if (lastLoginError) {
                html += `<p style="color:#ED4245;margin:4px 0;">Chi tiết lỗi: <b>${lastLoginError}</b></p>`;
            }
        }
        html += `</div>`;
    }

    html += `<hr style="border-color:#383a40;margin:24px 0;">`;
    html += `<p style="color:#80848e;font-size:12px;margin:0;">Render Cloud Engine · Auto Keep-Alive Loop Active (4m)</p>`;
    html += `</body></html>`;

    res.end(html);
}).listen(PORT, () => {
    console.log(`[Ritmada] Health check server running on port ${PORT}`);
});

// Auto Keep-Alive loop for Render (Resets the 15-minute inactivity timer automatically)
const renderUrl = process.env.RENDER_EXTERNAL_URL;
if (renderUrl) {
    console.log(`[Ritmada] Auto Keep-Alive active for: ${renderUrl}`);
    setInterval(async () => {
        try {
            await fetch(renderUrl);
            console.log(`[Keep-Alive] Self-pinged ${renderUrl} successfully.`);
        } catch (e) {}
    }, 4 * 60 * 1000); // Ping every 4 minutes (Render timeout is 15 minutes)
}

// Load config
const configPath = path.join(__dirname, 'config.json');
let config = { botToken: '' };
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {}
}
const activeBotToken = process.env.BOT_TOKEN || config.botToken;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

const activeSessions = new Map(); // userId => { session, message, lastList, targetUser }

const generateProgressBar = (pct) => {
    const totalBars = 12;
    const filled = Math.min(totalBars, Math.max(0, Math.round((pct / 100) * totalBars)));
    const empty = totalBars - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
};

const createCenterEmbed = () => {
    return new EmbedBuilder()
        .setTitle('⚡ Trung tâm Quest (Auto Multi-Quest)')
        .setDescription(
            'Hệ thống tự động cày tất cả nhiệm vụ Discord song song trong 1 lượt:\n\n' +
            '• **🚀 Bắt đầu** — Mở ô nhập Token và kích hoạt toàn bộ quest\n' +
            '• **🔑 Lấy Token** — Xem mã lấy token 1 chạm trong trình duyệt\n' +
            '• **📊 Tiến độ** — Theo dõi thời gian thực phiên đang chạy\n' +
            '• **🔄 Quét lại** — Làm mới và chạy lại danh sách quest\n' +
            '• **⏹ Dừng phiên** — Hủy phiên làm quest hiện tại\n\n' +
            '💡 *Mẹo chạy nhanh:* Gõ `/quest token: <token>` để chạy tức thì không cần bấm nút!\n' +
            '👥 *Nhiều người dùng có thể kích hoạt cùng lúc hoàn toàn độc lập!*'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Discord Multi-Quest Engine · MT System Clone' });
};

const createActionButtons = () => {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_start')
            .setLabel('🚀 Bắt đầu')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_token_guide')
            .setLabel('🔑 Lấy Token')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_progress')
            .setLabel('📊 Tiến độ')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('btn_refresh')
            .setLabel('🔄 Quét lại')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_stop')
            .setLabel('⏹ Dừng phiên')
            .setStyle(ButtonStyle.Danger)
    );
};

client.once('ready', async () => {
    console.log('========================================================');
    console.log(`🎉 [Ritmada] Bot đã online thành công: ${client.user.tag}`);
    console.log('========================================================');

    try {
        await client.application.commands.set([
            {
                name: 'setup',
                description: 'Mở Bảng Điều Khiển Trung tâm Quest'
            },
            {
                name: 'quest',
                description: 'Chạy cày quest tự động hoặc mở Bảng Điều Khiển',
                options: [
                    {
                        name: 'token',
                        description: 'Dán User Token để chạy trực tiếp (Không lo lag nút bấm)',
                        type: 3, // String type
                        required: false
                    }
                ]
            }
        ]);
        console.log('[Ritmada] Đã đăng ký Slash Command: gõ "/setup" hoặc "/quest" trong Discord để dùng.');
    } catch (e) {
        console.error('Lỗi đăng ký slash command:', e.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. Handle Slash Commands (/setup, /quest)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            const embed = createCenterEmbed();
            const row = createActionButtons();
            await interaction.reply({ embeds: [embed], components: [row] });
            return;
        }

        if (interaction.commandName === 'quest') {
            const tokenArg = interaction.options.getString('token');
            if (tokenArg && tokenArg.trim()) {
                await interaction.deferReply({ ephemeral: true });
                await handleUserTokenSubmission(interaction.user, tokenArg.trim(), interaction.channel, interaction);
                return;
            }
            const embed = createCenterEmbed();
            const row = createActionButtons();
            await interaction.reply({ embeds: [embed], components: [row] });
            return;
        }
    }

    // 2. Handle Button Clicks
    if (interaction.isButton()) {
        const userId = interaction.user.id;

        if (interaction.customId === 'btn_start') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('modal_token_input')
                    .setTitle('Nhập Token Tài Khoản Discord');

                const tokenInput = new TextInputBuilder()
                    .setCustomId('user_token')
                    .setLabel('Discord User Token (Cần làm quest)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Dán user token của tài khoản vào đây...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(tokenInput));
                await interaction.showModal(modal);
            } catch (err) {
                console.error('ShowModal error:', err.message);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⚠️ Kết nối mạng hơi chậm. Bạn có thể gõ ngay: `/quest token: <dán_token>` để cày tức thì!',
                        ephemeral: true
                    }).catch(() => {});
                }
            }
            return;
        }

        if (interaction.customId === 'btn_token_guide') {
            const guideEmbed = new EmbedBuilder()
                .setTitle('🔑 Hướng dẫn lấy User Token (5 giây)')
                .setDescription(
                    'Token dùng để xác thực và nhận/cày nhiệm vụ cho tài khoản của bạn:\n\n' +
                    '**Bước 1:** Mở Discord trên trình duyệt (Web) hoặc app Discord trên máy tính.\n' +
                    '**Bước 2:** Bấm phím **F12** (hoặc `Ctrl + Shift + I`) ➔ Chọn tab **Console**.\n' +
                    '**Bước 3:** Dán đoạn mã dưới đây vào rồi nhấn **Enter** (Token sẽ tự động copy vào bộ nhớ):\n\n' +
                    '```javascript\n' +
                    'window.webpackChunkdiscord_app.push([[Math.random()],{},(req)=>{for(const m of Object.keys(req.c).map(x=>req.c[x].exports).filter(x=>x)){if(m.default?.getToken)return copy(m.default.getToken()),console.log("%c[Ritmada] Token đã được copy!","color:#57F287;font-weight:bold;");if(m.getToken)return copy(m.getToken()),console.log("%c[Ritmada] Token đã được copy!","color:#57F287;font-weight:bold;");}}]);\n' +
                    '```\n\n' +
                    '**Bước 4:** Bấm nút **🚀 Bắt đầu** trên bảng điều khiển và dán Token vào.\n\n' +
                    '🔒 *An toàn bảo mật: Ô nhập token là Modal riêng tư (Ephemeral), chỉ có bạn và Bot thấy, bạn bè trong nhóm không thể nhìn thấy.*'
                )
                .setColor(0x5865F2);
            return interaction.reply({ embeds: [guideEmbed], ephemeral: true });
        }

        if (interaction.customId === 'btn_stop') {
            const userSession = activeSessions.get(userId);
            if (!userSession) {
                return interaction.reply({ content: '❌ Bạn hiện không có phiên làm quest nào đang chạy.', ephemeral: true });
            }
            userSession.session.stop();
            activeSessions.delete(userId);
            return interaction.reply({ content: '⏹ Đã dừng phiên làm quest thành công.', ephemeral: true });
        }

        if (interaction.customId === 'btn_progress') {
            const userSession = activeSessions.get(userId);
            if (!userSession) {
                return interaction.reply({ content: 'Chưa có phiên nào đang chạy. Bấm **🚀 Bắt đầu** để mở phiên.', ephemeral: true });
            }
            const list = userSession.lastList || [];
            if (list.length === 0) {
                return interaction.reply({ content: '⏳ Đang quét danh sách quest từ Discord... Đợi vài giây rồi bấm lại.', ephemeral: true });
            }
            let text = '📊 **Tiến độ các quest đang chạy song song:**\n\n';
            for (const q of list) {
                const bar = generateProgressBar(q.pct);
                text += `${q.isCompleted ? '✅' : '🎮'} **${q.name}**\n\`[${bar}]\` **${q.pct}%** (${Math.floor(q.elapsed / 60)}m/${Math.floor(q.targetSeconds / 60)}m)\n\n`;
            }
            return interaction.reply({ content: text, ephemeral: true });
        }

        if (interaction.customId === 'btn_refresh') {
            const userSession = activeSessions.get(userId);
            if (!userSession) {
                return interaction.reply({ content: 'Chưa có phiên nào để quét lại. Bấm **🚀 Bắt đầu** trước.', ephemeral: true });
            }
            const token = userSession.session.userToken;
            userSession.session.stop();
            activeSessions.delete(userId);
            await interaction.reply({ content: '🔄 Đang quét lại và kích hoạt toàn bộ quest...', ephemeral: true });
            handleUserTokenSubmission(interaction.user, token, interaction.channel, null);
        }
    }

    // 3. Handle Modal Submit (User entered token)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_token_input') {
            const token = interaction.fields.getTextInputValue('user_token').trim();
            await interaction.deferReply({ ephemeral: true });
            await handleUserTokenSubmission(interaction.user, token, interaction.channel, interaction);
        }
    }
});

/**
 * Core User Flow:
 * 1. Pre-Scan Account
 * 2. Send Everything to Private DM (Zero public spam in channel)
 * 3. Live Parallel Progression inside DM
 */
const handleUserTokenSubmission = async (discordUser, token, channel, interaction) => {
    const userId = discordUser.id;

    if (activeSessions.has(userId)) {
        activeSessions.get(userId).session.stop();
        activeSessions.delete(userId);
    }

    // Step 1: Open DM Channel
    let dmChannel = null;
    try {
        dmChannel = await discordUser.createDM();
    } catch (e) {
        console.warn(`[DM Open Failed] User ${discordUser.tag}: ${e.message}`);
    }

    // Step 2: Pre-Scan Quests
    let scanResult;
    try {
        scanResult = await QuestSession.scanAccount(token);
    } catch (e) {
        const errMsg = `❌ Lỗi xác thực tài khoản: ${e.message}`;
        if (interaction) {
            await interaction.editReply({ content: errMsg });
        }
        return;
    }

    const { user: accUser, pending, completed } = scanResult;

    // Check if DM is accessible
    if (!dmChannel) {
        const warning = `⚠️ **Không thể gửi Tin Nhắn Riêng (DM) cho bạn!**\n` +
            `Bạn đang chặn tin nhắn từ thành viên server. Hãy bật tin nhắn riêng:\n` +
            `👉 *Cài đặt người dùng ➔ Quyền riêng tư & An toàn ➔ Bật "Cho phép tin nhắn trực tiếp từ thành viên máy chủ"*.`;
        if (interaction) {
            await interaction.editReply({ content: warning });
        }
        return;
    }

    // Case A: Everything is already 100% complete
    if (pending.length === 0) {
        let dmDesc = `**Tài khoản:** \`${accUser.tag}\` (ID: ${accUser.id})\n\n`;
        dmDesc += `🎉 **TẤT CẢ NHIỆM VỤ ĐÃ HOÀN THÀNH 100%!**\n`;
        dmDesc += `Không còn nhiệm vụ nào cần làm trên tài khoản này.\n\n`;
        if (completed.length > 0) {
            dmDesc += `**Danh sách nhiệm vụ đã hoàn tất:**\n`;
            completed.forEach(q => {
                dmDesc += ` • ✅ **${q.name}** — *${q.rewardName}*\n`;
            });
        }
        dmDesc += `\n🎁 *Hãy mở Discord lên vào mục Nhiệm Vụ (Quests) để nhận Orbs / Vật phẩm.*`;

        const dmEmbed = new EmbedBuilder()
            .setTitle('✨ Báo Cáo Nhiệm Vụ — Đã Hoàn Thành 100%')
            .setDescription(dmDesc)
            .setColor(0x57F287)
            .setTimestamp();

        try {
            await dmChannel.send({ embeds: [dmEmbed] });
        } catch (e) {}

        if (interaction) {
            await interaction.editReply({ content: `✅ Tài khoản **${accUser.tag}** đã xong 100% tất cả quest! Chi tiết đã gửi trong **Tin nhắn riêng (DM)**.` });
        }
        return;
    }

    // Case B: There are pending quests -> Send Initial DM & Setup Live DM Message
    let dmReport = `**Tài khoản Discord:** \`${accUser.tag}\`\n`;
    dmReport += `Phát hiện **${pending.length} nhiệm vụ** đang cần thực hiện:\n\n`;

    pending.forEach((q, idx) => {
        const icon = q.isVideo ? '🎬' : '🎮';
        const typeStr = q.isVideo ? 'Xem video' : 'Chơi game';
        const durationStr = q.targetSeconds >= 60 ? `${Math.round(q.targetSeconds / 60)} phút` : `${q.targetSeconds} giây`;
        dmReport += `**${idx + 1}.** ${icon} **${q.name}**\n`;
        dmReport += `   └ Loại: *${typeStr}* · Thời gian: *${durationStr}* · Thưởng: **${q.rewardName}** (Tiến độ: ${q.pct}%)\n`;
    });

    dmReport += `\n⏳ *Hệ thống đang bắt đầu cày song song tất cả nhiệm vụ...*`;

    const liveEmbed = new EmbedBuilder()
        .setTitle(`🚀 Đang tự động làm ${pending.length} nhiệm vụ song song`)
        .setDescription(dmReport)
        .setColor(0x5865F2)
        .setFooter({ text: 'Cập nhật trực tiếp mỗi 20 giây trong DM' })
        .setTimestamp();

    let liveDmMessage = null;
    try {
        liveDmMessage = await dmChannel.send({ embeds: [liveEmbed] });
    } catch (e) {
        console.warn(`[DM Send Failed]: ${e.message}`);
    }

    // Ephemeral reply to user in server - ZERO chat drift in the channel!
    if (interaction) {
        await interaction.editReply({
            content: `✅ Đã khởi động cày **${pending.length} nhiệm vụ** song song!\n📩 **Toàn bộ tiến độ và kết quả đang được gửi trực tiếp trong Tin nhắn riêng (DM) của bạn.** Hãy mở DM với Bot để theo dõi!`
        });
    }

    // Step 3: Start QuestSession
    const session = new QuestSession(token, {
        onLog: (msg) => {
            console.log(`[QuestUser:${userId}] ${msg}`);
        },
        onProgress: async (questList) => {
            if (activeSessions.has(userId)) {
                activeSessions.get(userId).lastList = questList;
            }

            if (liveDmMessage) {
                let desc = `**Tài khoản:** \`${accUser.tag}\`\n\n`;
                for (const q of questList) {
                    const bar = generateProgressBar(q.pct);
                    const icon = q.isCompleted ? '✅' : (q.isVideo ? '🎬' : '🎮');
                    desc += `${icon} **${q.name}**\n\`[${bar}]\` **${q.pct}%** (${Math.floor(q.elapsed / 60)}m/${Math.floor(q.targetSeconds / 60)}m)\n\n`;
                }
                desc += `⚡ *Tất cả nhiệm vụ đang được cày song song trong đúng 1 lượt 15 phút!*`;

                const embed = new EmbedBuilder()
                    .setTitle(`🎮 Tiến độ ${questList.length} nhiệm vụ song song`)
                    .setDescription(desc)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Tự động cập nhật mỗi 20s · Không cần mở game' });

                await liveDmMessage.edit({ embeds: [embed] }).catch(() => {});
            }
        },
        onComplete: async (completedNames) => {
            if (liveDmMessage) {
                const completeEmbed = new EmbedBuilder()
                    .setTitle('🎉 TẤT CẢ NHIỆM VỤ ĐÃ HOÀN THÀNH 100%!')
                    .setDescription(
                        `Chúc mừng \`${accUser.tag}\`!\nCác nhiệm vụ đã hoàn thành:\n` +
                        completedNames.map(n => `• ✅ **${n}**`).join('\n') +
                        `\n\n🎁 **Hãy mở Discord lên vào mục Nhiệm Vụ (Quests) để nhận toàn bộ phần thưởng (Orbs / Vật phẩm)!**`
                    )
                    .setColor(0x57F287)
                    .setTimestamp();

                await liveDmMessage.edit({ embeds: [completeEmbed] }).catch(() => {});
            }

            if (dmChannel) {
                await dmChannel.send(`🔔 <@${userId}> Tất cả nhiệm vụ của bạn đã hoàn thành 100%! Hãy mở Discord nhận thưởng ngay nhé.`).catch(() => {});
            }

            activeSessions.delete(userId);
        },
        onError: async (errMsg) => {
            if (liveDmMessage) {
                const errEmbed = new EmbedBuilder()
                    .setTitle('❌ Có lỗi xảy ra trong quá trình chạy')
                    .setDescription(errMsg)
                    .setColor(0xED4245);
                await liveDmMessage.edit({ embeds: [errEmbed] }).catch(() => {});
            }
            activeSessions.delete(userId);
        }
    });

    activeSessions.set(userId, { session, message: liveDmMessage, lastList: [], targetUser: discordUser });
    session.start(pending);
};

if (!activeBotToken || activeBotToken === 'DÁN_BOT_TOKEN_VÀO_ĐÂY') {
    console.log('========================================================');
    console.log('[Ritmada] CHƯA CÓ BOT TOKEN!');
    console.log('Hãy mở file "config.json" và dán Bot Token của bạn vào.');
    console.log('Hoặc đặt biến môi trường BOT_TOKEN nếu chạy trên Cloud.');
    console.log('========================================================');
} else {
    client.login(activeBotToken).catch(err => {
        lastLoginError = err.message;
        console.error('[Ritmada] Đăng nhập Bot thất bại:', err.message);
    });
}
