/**
 * Standalone 1-Click Parallel Quest Runner (Multi-Account Edition)
 * Run directly on your machine without needing a Bot Token
 * Supports 1 or multiple accounts (1 token per line in token.txt)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { QuestSession } = require('./quest_engine');

const tokenFilePath = path.join(__dirname, 'token.txt');

const getTokens = () => {
    return new Promise((resolve) => {
        if (fs.existsSync(tokenFilePath)) {
            const raw = fs.readFileSync(tokenFilePath, 'utf8');
            const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 20 && !l.startsWith('#'));
            if (lines.length > 0) {
                console.log(`[Ritmada] Đã tìm thấy ${lines.length} tài khoản trong token.txt.`);
                return resolve(lines);
            }
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('\n[Ritmada] Hãy dán Discord User Token của bạn vào đây rồi bấm Enter:\n> ', (ans) => {
            rl.close();
            const token = ans.trim();
            if (token) {
                fs.writeFileSync(tokenFilePath, token, 'utf8');
                console.log('[Ritmada] Đã lưu token vào token.txt cho những lần chạy sau.');
                resolve([token]);
            } else {
                resolve([]);
            }
        });
    });
};

const progressBar = (pct) => {
    const total = 14;
    const filled = Math.min(total, Math.max(0, Math.round((pct / 100) * total)));
    return '█'.repeat(filled) + '░'.repeat(total - filled);
};

(async () => {
    console.clear();
    console.log('========================================================');
    console.log('   DISCORD AUTO MULTI-QUEST RUNNER (CHẠY SONG SONG)    ');
    console.log('   Tự động hoàn thành TẤT CẢ quest trong đúng 15 phút  ');
    console.log('   Hỗ trợ cày cùng lúc nhiều tài khoản của bạn & bạn bè');
    console.log('========================================================\n');

    const tokens = await getTokens();
    if (!tokens || tokens.length === 0) {
        console.error('[!] Không có token nào. Thoát chương trình.');
        process.exit(1);
    }

    console.log(`\n🚀 Kích hoạt cày quest cho ${tokens.length} tài khoản cùng lúc...\n`);

    const runAccount = (token, index) => {
        const tag = `Acc #${index + 1}`;
        const session = new QuestSession(token, {
            onLog: (msg) => {
                console.log(`[${tag}] ${msg}`);
            },
            onProgress: (questList) => {
                console.log(`\n--- TIẾN ĐỘ [${tag}] (${new Date().toLocaleTimeString('vi-VN')}) ---`);
                for (const q of questList) {
                    const bar = progressBar(q.pct);
                    const status = q.isCompleted ? '✓ XONG' : `${Math.floor(q.elapsed / 60)}m/${Math.floor(q.targetSeconds / 60)}m`;
                    console.log(` ${q.isCompleted ? '✅' : '🎮'} [${q.name}]: [${bar}] ${q.pct}% (${status})`);
                }
            },
            onComplete: (names) => {
                console.log(`\n🎉 [${tag}] TẤT CẢ NHIỆM VỤ ĐÃ HOÀN THÀNH 100%!`);
                if (names && names.length > 0) {
                    names.forEach(n => console.log(` • ${n}`));
                }
            },
            onError: (err) => {
                console.error(`\n[${tag} Lỗi] ${err}`);
            }
        });

        return session.start();
    };

    await Promise.allSettled(tokens.map((t, idx) => runAccount(t, idx)));

    console.log('\n========================================================');
    console.log('🎉 TẤT CẢ CÁC TÀI KHOẢN ĐÃ XỬ LÝ XONG!');
    console.log('Hãy mở Discord lên để nhận quà (Orbs / Vật phẩm).');
    console.log('========================================================\n');
})();
