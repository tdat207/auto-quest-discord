/**
 * Core Discord Quest Automation Engine - Parallel Multi-Quest Edition
 * Enhanced with Pre-Scan, Schema Resilience & Anti-Failover Ticks
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.0 Chrome/120.0.0.0 Electron/28.0.0 Safari/537.36';

const SUPPORTED_TASK_TYPES = [
    'WATCH_VIDEO',
    'WATCH_VIDEO_ON_DESKTOP',
    'WATCH_VIDEO_ON_MOBILE',
    'PLAY_ON_DESKTOP',
    'STREAM_ON_DESKTOP',
    'PLAY_ACTIVITY',
    'PLAY_ON_PLAYSTATION',
    'PLAY_ON_XBOX'
];

class QuestSession {
    constructor(userToken, callbacks = {}) {
        this.userToken = userToken.trim();
        this.callbacks = callbacks;
        this.running = false;
        this.timer = null;
        this.trackedQuests = [];
    }

    log(msg) {
        if (this.callbacks.onLog) this.callbacks.onLog(msg);
    }

    async api(method, path, body = null) {
        const url = `https://discord.com/api/v9${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': this.userToken,
            'User-Agent': USER_AGENT
        };

        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!res.ok) {
            const errTxt = await res.text().catch(() => '');
            let parsed;
            try { parsed = JSON.parse(errTxt); } catch (e) {}
            const msg = parsed?.message || res.statusText;
            throw new Error(`Discord API ${res.status}: ${msg}`);
        }

        return res.json().catch(() => ({}));
    }

    /**
     * Pre-Scan Account & Quests
     * Validates token and returns structured quest inventory
     */
    static async scanAccount(userToken) {
        const token = userToken.trim();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': token,
            'User-Agent': USER_AGENT
        };

        // 1. Verify User
        const userRes = await fetch('https://discord.com/api/v9/users/@me', { headers });
        if (!userRes.ok) {
            throw new Error('Token không hợp lệ hoặc tài khoản đã hết hạn phiên đăng nhập.');
        }
        const user = await userRes.json();

        // 2. Fetch Quests
        const questsRes = await fetch('https://discord.com/api/v9/quests/@me', { headers });
        if (!questsRes.ok) {
            throw new Error('Không thể tải danh sách nhiệm vụ từ Discord.');
        }
        const questsData = await questsRes.json();
        const rawQuests = questsData.quests || [];
        const now = Date.now();

        const pending = [];
        const completed = [];

        for (const q of rawQuests) {
            const cfg = q.config || {};
            const exp = cfg.expires_at || cfg.expiresAt;
            const isExpired = exp ? (new Date(exp).getTime() <= now) : false;

            const uStatus = q.user_status || q.userStatus;
            const hasCompletedAt = !!uStatus?.completed_at || !!uStatus?.completedAt;

            const tasks = cfg.task_config_v2?.tasks || cfg.taskConfig?.tasks || {};
            let taskType = 'PLAY_ON_DESKTOP';
            for (const t of SUPPORTED_TASK_TYPES) {
                if (tasks[t]) { taskType = t; break; }
            }
            if (!tasks[taskType] && Object.keys(tasks).length > 0) {
                taskType = Object.keys(tasks)[0];
            }

            const targetSeconds = tasks[taskType]?.target || (15 * 60);
            const currentProgress = uStatus?.progress?.[taskType]?.value ??
                                   uStatus?.stream_progress_seconds ??
                                   uStatus?.streamProgressSeconds ?? 0;

            const isDone = hasCompletedAt || currentProgress >= targetSeconds;
            const questName = cfg.messages?.quest_name || cfg.messages?.questName || cfg.application?.name || 'Discord Quest';
            const publisher = cfg.messages?.game_publisher || cfg.messages?.game_title || '';
            const isVideo = taskType.startsWith('WATCH_VIDEO');

            // Parse reward
            let rewardName = 'Vật phẩm Discord';
            const rewards = cfg.rewards_config?.rewards || [];
            if (rewards.length > 0) {
                const r = rewards[0];
                if (r.orb_quantity) {
                    rewardName = `${r.orb_quantity} Orbs`;
                } else if (r.messages?.name) {
                    rewardName = r.messages.name;
                }
            }

            const item = {
                id: q.id,
                name: questName,
                publisher,
                taskType,
                isVideo,
                targetSeconds,
                currentProgress,
                pct: Math.min(100, Math.floor((currentProgress / targetSeconds) * 100)),
                rewardName,
                isCompleted: isDone,
                isEnrolled: !!uStatus?.enrolled_at || !!uStatus?.enrolledAt,
                isExpired
            };

            if (isExpired) continue;

            if (isDone) {
                completed.push(item);
            } else {
                pending.push(item);
            }
        }

        return {
            user: {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                globalName: user.global_name || user.username,
                tag: user.discriminator === '0' ? user.username : `${user.username}#${user.discriminator}`
            },
            pending,
            completed,
            totalActive: pending.length + completed.length
        };
    }

    async getQuests() {
        const res = await this.api('GET', '/quests/@me');
        return res.quests || [];
    }

    async enroll(questId) {
        return this.api('POST', `/quests/${questId}/enroll`, { location: 1 });
    }

    async getFallbackChannelId() {
        try {
            const dmChannels = await this.api('GET', '/users/@me/channels');
            if (Array.isArray(dmChannels) && dmChannels.length > 0) {
                return dmChannels[0].id;
            }
        } catch (e) {}

        try {
            const guilds = await this.api('GET', '/users/@me/guilds');
            if (Array.isArray(guilds) && guilds.length > 0) {
                const channels = await this.api('GET', `/guilds/${guilds[0].id}/channels`);
                if (Array.isArray(channels)) {
                    const voice = channels.find(c => c.type === 2);
                    if (voice) return voice.id;
                    if (channels.length > 0) return channels[0].id;
                }
            }
        } catch (e) {}

        return null;
    }

    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.log('Phiên làm quest đã kết thúc.');
    }

    async start(preScannedPending = null) {
        this.running = true;

        let pendingList = preScannedPending;
        if (!pendingList) {
            this.log('Đang quét danh sách quest trên tài khoản...');
            try {
                const scan = await QuestSession.scanAccount(this.userToken);
                pendingList = scan.pending;
            } catch (e) {
                if (this.callbacks.onError) this.callbacks.onError(`Lỗi: ${e.message}`);
                this.stop();
                return;
            }
        }

        if (!pendingList || pendingList.length === 0) {
            this.log('Tất cả quest hiện có đã hoàn thành 100%! Không còn quest nào cần làm.');
            if (this.callbacks.onComplete) this.callbacks.onComplete([]);
            this.stop();
            return;
        }

        const channelId = await this.getFallbackChannelId();

        this.trackedQuests = pendingList.map(q => ({
            id: q.id,
            name: q.name,
            taskType: q.taskType,
            isVideo: q.isVideo,
            targetSeconds: q.targetSeconds,
            elapsed: q.currentProgress,
            isCompleted: q.isCompleted,
            isEnrolled: q.isEnrolled,
            streamKey: channelId ? `call:${channelId}:1` : `call:${q.id}:1`
        }));

        this.log(`Phát hiện ${this.trackedQuests.length} quest đang active. Kích hoạt chạy SONG SONG tất cả cùng lúc!`);

        // Auto enroll in all pending quests concurrently
        await Promise.allSettled(this.trackedQuests.map(async item => {
            if (!item.isEnrolled) {
                try {
                    await this.enroll(item.id);
                    item.isEnrolled = true;
                    this.log(`✓ Đã tự động nhận quest: [${item.name}]`);
                } catch (e) {
                    // Already enrolled or minor location requirement
                    item.isEnrolled = true;
                }
            }
        }));

        const loop = async () => {
            if (!this.running) return;

            const activeItems = this.trackedQuests.filter(q => !q.isCompleted);
            if (activeItems.length === 0) {
                this.log('🎉 TẤT CẢ các quest đã hoàn thành 100%!');
                if (this.callbacks.onComplete) this.callbacks.onComplete(this.trackedQuests.map(q => q.name));
                this.stop();
                return;
            }

            // Parallel tick for all active quests
            await Promise.allSettled(activeItems.map(async item => {
                if (item.isVideo) {
                    item.elapsed = Math.min(item.targetSeconds, item.elapsed + 25);
                    try {
                        await this.api('POST', `/quests/${item.id}/video-progress`, { timestamp: item.elapsed });
                        if (item.elapsed >= item.targetSeconds) {
                            await this.api('POST', `/quests/${item.id}/video-progress`, { timestamp: item.targetSeconds });
                            item.isCompleted = true;
                            item.elapsed = item.targetSeconds;
                            this.log(`✓ Hoàn thành video: [${item.name}]`);
                        }
                    } catch (e) {
                        // Retry on next tick
                    }
                } else {
                    const willComplete = (item.elapsed + 30) >= item.targetSeconds;
                    try {
                        const res = await this.api('POST', `/quests/${item.id}/heartbeat`, {
                            stream_key: item.streamKey,
                            terminal: willComplete
                        });

                        const uStatus = res?.user_status || res?.userStatus;
                        const serverVal = res?.progress?.[item.taskType]?.value ?? uStatus?.progress?.[item.taskType]?.value;
                        if (typeof serverVal === 'number') {
                            item.elapsed = serverVal;
                        } else {
                            item.elapsed += 30;
                        }

                        if (uStatus?.completed_at || uStatus?.completedAt || item.elapsed >= item.targetSeconds) {
                            item.isCompleted = true;
                            item.elapsed = item.targetSeconds;
                            await this.api('POST', `/quests/${item.id}/heartbeat`, {
                                stream_key: item.streamKey,
                                terminal: true
                            }).catch(() => {});
                            this.log(`✓ Hoàn thành 100%: [${item.name}]`);
                        }
                    } catch (e) {
                        // Discord 503 or transient network error: preserve progress and continue next tick
                        item.elapsed = Math.min(item.targetSeconds, item.elapsed + 15);
                    }
                }
            }));

            const snapshot = this.trackedQuests.map(item => ({
                id: item.id,
                name: item.name,
                elapsed: item.elapsed,
                targetSeconds: item.targetSeconds,
                pct: Math.min(100, Math.floor((item.elapsed / item.targetSeconds) * 100)),
                isCompleted: item.isCompleted
            }));

            if (this.callbacks.onProgress) {
                this.callbacks.onProgress(snapshot);
            }

            if (this.running && this.trackedQuests.some(q => !q.isCompleted)) {
                this.timer = setTimeout(loop, 20000);
            } else if (this.running) {
                this.log('🎉 TẤT CẢ các quest đã hoàn thành 100%!');
                if (this.callbacks.onComplete) this.callbacks.onComplete(this.trackedQuests.map(q => q.name));
                this.stop();
            }
        };

        await loop();
    }
}

module.exports = { QuestSession, USER_AGENT };
