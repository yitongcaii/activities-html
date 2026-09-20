// 数据存储配置
const USE_CLOUDBASE = false; // 设置为 true 使用 Supabase，false 使用 localStorage

// 本地数据存储（fallback）
const LocalDB = {
    users: [],
    gifts: [],
    orders: [],
    pointsLog: [],
    admin: { id: 'admin', password: 'PointsMall@2026Demo', name: '管理员' },
    currentUser: null,
    isAdmin: false,
    adminPassword: 'PointsMall@2026Demo',
    
    // 获取所有用户
    getUsers() {
        return Promise.resolve(this.users || []);
    },
    
    // 根据用户名获取用户
    getUserByName(name) {
        const user = (this.users || []).find(u => u.name === name);
        return Promise.resolve(user || null);
    },
    
    // 根据用户ID获取用户
    getUserById(userId) {
        const user = (this.users || []).find(u => u.id === userId);
        return Promise.resolve(user || null);
    },
    
    // 添加用户
    addUser(user) {
        this.users = this.users || [];
        this.users.push(user);
        saveData();
        return Promise.resolve(user);
    },
    
    // 更新用户积分
    updateUserPoints(userId, points) {
        const user = (this.users || []).find(u => u.id === userId);
        if (user) {
            user.points = points;
            saveData();
        }
        return Promise.resolve(user);
    },
    
    // 删除用户
    deleteUser(userId) {
        this.users = (this.users || []).filter(u => u.id !== userId);
        saveData();
        return Promise.resolve(true);
    },
    
    // 获取所有礼品
    getGifts() {
        return Promise.resolve(this.gifts || []);
    },
    
    // 根据ID获取礼品
    getGiftById(id) {
        const gift = (this.gifts || []).find(g => g.id === id);
        return Promise.resolve(gift || null);
    },
    
    // 添加礼品
    addGift(gift) {
        this.gifts = this.gifts || [];
        this.gifts.push(gift);
        saveData();
        return Promise.resolve(gift);
    },
    
    // 更新礼品
    updateGift(id, updates) {
        const gift = (this.gifts || []).find(g => g.id === id);
        if (gift) {
            Object.assign(gift, updates);
            saveData();
        }
        return Promise.resolve(gift);
    },
    
    // 删除礼品
    deleteGift(id) {
        this.gifts = (this.gifts || []).filter(g => g.id !== id);
        saveData();
        return Promise.resolve(true);
    },
    
    // 获取所有订单
    getOrders() {
        return Promise.resolve(this.orders || []);
    },
    
    // 获取用户订单
    getUserOrders(userId) {
        const orders = (this.orders || []).filter(o => o.user_id === userId);
        return Promise.resolve(orders);
    },
    
    // 创建订单
    createOrder(order) {
        this.orders = this.orders || [];
        this.orders.push(order);
        saveData();
        return Promise.resolve(order);
    },
    
    // 更新订单状态
    updateOrderStatus(orderId, status) {
        const order = (this.orders || []).find(o => o.id === orderId);
        if (order) {
            order.status = status;
            saveData();
        }
        return Promise.resolve(order);
    },
    
    // 获取用户积分记录
    getUserPointsLog(userId) {
        const logs = (this.pointsLog || []).filter(l => l.user_id === userId);
        return Promise.resolve(logs);
    },
    
    // 添加积分记录
    addPointsLog(log) {
        this.pointsLog = this.pointsLog || [];
        this.pointsLog.push(log);
        saveData();
        return Promise.resolve(log);
    },
    
    // 获取所有积分记录
    getAllPointsLog() {
        return Promise.resolve(this.pointsLog || []);
    },
    
    // 获取管理员
    getAdmin() {
        return Promise.resolve(this.admin || null);
    },
    
    // 更新管理员密码
    updateAdminPassword(password) {
        if (this.admin) {
            this.admin.password = password;
            saveData();
        }
        return Promise.resolve(this.admin);
    }
};

// 当前使用的数据库
let DB = null;

// ==================== 初始化 ===================

async function initData() {
    // 等待 SupabaseDB 加载完成
    console.log('🔍 开始初始化数据库...');

    // 等待最多 2 秒让 SupabaseDB 挂载
    let retries = 0;
    while (USE_CLOUDBASE && !window.SupabaseDB && retries < 20) {
        console.log(`⏳ 等待 SupabaseDB 加载... (${retries + 1}/20)`);
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }

    console.log('🔍 window.SupabaseDB 存在?', !!window.SupabaseDB);

    if (USE_CLOUDBASE && window.SupabaseDB) {
        DB = window.SupabaseDB;
        console.log('✅ 使用 Supabase 云数据库');
        console.log('🔍 DB 类型:', typeof DB);
        console.log('🔍 DB 拥有的方法:', Object.keys(DB).filter(k => typeof DB[k] === 'function'));
        console.log('🔍 getUserByName 方法存在?', typeof DB.getUserByName);
    } else {
        if (USE_CLOUDBASE && !window.SupabaseDB) {
            console.error('❌ SupabaseDB 未找到！检查 supabase-db.js 是否正确加载');
            console.error('🔍 window 对象上的属性:', Object.keys(window).filter(k => k.includes('Supabase')));
        }
        DB = LocalDB;
        console.log('✅ 使用本地 localStorage 存储');

        // 本地存储模式
        const savedData = localStorage.getItem('pointsMallData');
        if (savedData) {
            Object.assign(DB, JSON.parse(savedData));
        } else {
            // 初始化示例数据
            DB.users = [
                { id: 'user_1', name: '测试用户', points: 100, account_type: '集团', watch_time: 30 },
                { id: 'user_2', name: '张三', points: 500, account_type: '集团', watch_time: 120 },
                { id: 'user_3', name: '李四', points: 300, account_type: '集团', watch_time: 60 },
                { id: 'user_4', name: '王五', points: 200, account_type: '云智', watch_time: 90 }
            ];
            DB.gifts = [
                {
                    id: 'gift_1',
                    name: '太空蓝保温杯',
                    image: '奖品池/cup-blue.png',
                    description: '高品质不锈钢保温杯，太空蓝配色，保温效果好，陪伴每一场培训。',
                    points: 100,
                    stock: 50,
                    status: true
                },
                {
                    id: 'gift_2',
                    name: '怪奇鹅护腕鼠标垫',
                    image: '奖品池/mousepad.png',
                    description: '腾讯怪奇鹅联名护腕鼠标垫，舒适支撑，办公好搭档。',
                    points: 150,
                    stock: 30,
                    status: true
                },
                {
                    id: 'gift_3',
                    name: '生日鹅毛绒公仔挂件',
                    image: '奖品池/plush-pendant.png',
                    description: '软萌毛绒公仔挂件，生日主题，随身可爱陪伴。',
                    points: 200,
                    stock: 20,
                    status: true
                },
                {
                    id: 'gift_4',
                    name: '生日鹅毛绒公仔礼物盒',
                    image: '奖品池/plush-giftbox.png',
                    description: '精致礼物盒装毛绒公仔，生日惊喜一站搞定。',
                    points: 300,
                    stock: 15,
                    status: true
                },
                {
                    id: 'gift_5',
                    name: '短款工卡套套装',
                    image: '奖品池/cardholder.png',
                    description: '实用短款工卡套套装，轻便耐用，工牌收纳刚刚好。',
                    points: 120,
                    stock: 40,
                    status: true
                }
            ];
            DB.orders = [];
            DB.pointsLog = [];
            DB.currentUser = null;
            saveData();
        }
    }
}

// 保存数据到 localStorage（仅本地模式使用）
function saveData() {
    if (!USE_CLOUDBASE) {
        localStorage.setItem('pointsMallData', JSON.stringify(DB));
    }
}

// ==================== UI 更新 ===================

async function updateUI() {
    if (!DB.currentUser) return;
    
    if (USE_CLOUDBASE && !DB.isAdmin) {
        // 从数据库加载最新用户信息
        const user = await DB.getUserByName(DB.currentUser.name);
        if (user) {
            DB.currentUser = user;
        }
    }
    
    // 更新积分显示
    document.getElementById('nav-points').textContent = DB.currentUser.points || 0;
    document.getElementById('home-points').textContent = DB.currentUser.points || 0;
    document.getElementById('profile-points').textContent = DB.currentUser.points || 0;
    document.getElementById('profile-name').textContent = DB.currentUser.name || '用户';
    document.getElementById('nav-username').textContent = DB.currentUser.name || '用户';
}

// ==================== 页面导航 ===================

async function showPage(pageName) {
    // 检查是否已登录
    if (!DB.currentUser) {
        showUserLogin();
        return;
    }

    // 检查管理员权限
    if (pageName === 'admin' && !DB.isAdmin) {
        alert('需要管理员权限才能访问管理后台');
        return;
    }

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 显示目标页面
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 更新导航
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });

    // 加载页面数据
    switch(pageName) {
        case 'home':
            await loadHome();
            break;
        case 'mall':
            await loadMall();
            break;
        case 'profile':
            await updateUI();
            break;
        case 'admin':
            await loadAdmin();
            break;
    }
}

// ==================== 页面加载 ===================

async function loadHome() {
    await updateUI();

    const allGifts = await DB.getGifts();
    const hotGifts = allGifts.filter(gift => gift.status).slice(0, 4);
    renderGifts(hotGifts, 'hot-gifts');

    // 加载积分排行榜（侧边栏）
    await loadPointsRank();

    // 加载观看时长排行榜
    await loadWatchTimeRank();
}

async function loadMall() {
    const allGifts = await DB.getGifts();
    const availableGifts = allGifts.filter(gift => gift.status);
    renderGifts(availableGifts, 'mall-gifts');
}

async function loadAdmin() {
    await updateStats();
    await loadRecentOrders();
    await loadUsersList();
    await loadAdminGiftsList();
    await loadAdminOrdersList();
    await loadPointsUsers();

    // 加载管理员后台的榜单
    await loadPointsRank();
}

// ==================== 礼品渲染 ===================

function renderGifts(gifts, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (gifts.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">🎁</div><p>暂无礼品</p></div>';
        return;
    }

    container.innerHTML = gifts.map(gift => {
        const escapedId = encodeURIComponent(gift.id);
        const escapedName = escapeHtml(gift.name);
        const escapedDesc = escapeHtml(gift.description || '');
        const escapedPoints = escapeHtml(String(gift.points));
        const escapedStock = escapeHtml(String(gift.stock));
        const escapedImage = escapeHtml(gift.image);
        return `
            <div class="gift-card" onclick="showGiftDetail('${escapedId}')">
                <img class="gift-image" src="${escapedImage}" alt="${escapedName}">
                <div class="gift-info">
                    <div class="gift-name">${escapedName}</div>
                    <div class="gift-desc">${escapedDesc}</div>
                    <div class="gift-footer">
                        <div class="gift-points">${escapedPoints} 积分</div>
                        <div class="stock-info ${gift.stock <= 5 ? 'stock-low' : ''}">库存: ${escapedStock}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function showGiftDetail(giftId) {
    giftId = decodeURIComponent(giftId);
    const gift = await DB.getGiftById(giftId);
    if (!gift) {
        alert('礼品不存在');
        return;
    }

    // 确保当前用户信息是最新的
    if (!DB.isAdmin) {
        const currentUserInDB = await DB.getUserByName(DB.currentUser.name);
        if (currentUserInDB) {
            DB.currentUser = currentUserInDB;
        }
    }

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 显示礼品详情页面
    document.getElementById('page-gift-detail').classList.add('active');

    const detailContainer = document.getElementById('gift-detail');

    // 判断是否可以兑换
    const hasEnoughPoints = DB.currentUser.points >= gift.points;
    const hasStock = gift.stock > 0;
    const canExchange = hasEnoughPoints && hasStock;

    // 将礼品ID保存到全局对象
    window._currentGiftForExchange = gift;

    detailContainer.innerHTML = `
        <img class="gift-detail-image" src="${gift.image}" alt="${gift.name}">
        <h2 class="gift-detail-name">${gift.name}</h2>
        <p class="gift-detail-desc">${gift.description}</p>
        <div class="gift-detail-points">所需积分：${gift.points}</div>
        <div class="gift-stock">库存数量：${gift.stock}</div>
        <button class="exchange-btn"
                onclick="window._doExchange()"
                ${canExchange ? '' : 'disabled'}>
            ${!hasStock ? '已售罄' : (!hasEnoughPoints ? '积分不足' : '立即兑换')}
        </button>
    `;

    // 手动更新导航
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
}

// ==================== 兑换礼品 ===================

window._doExchange = async function() {
    if (!window._currentGiftForExchange) {
        alert('礼品信息丢失，请重新选择礼品');
        return;
    }

    const gift = window._currentGiftForExchange;

    // 确保使用最新的用户信息
    const currentUserInDB = await DB.getUserByName(DB.currentUser.name);
    if (currentUserInDB) {
        DB.currentUser = currentUserInDB;
    }

    // 检查账号类型，云智用户不能兑换
    if (DB.currentUser.account_type === '云智') {
        alert('云智同学的惊喜礼品由云智培训侧发放，暂不支持自行兑换');
        return;
    }

    if (DB.currentUser.points < gift.points) {
        alert(`积分不足！当前积分：${DB.currentUser.points}，需要：${gift.points}`);
        return;
    }

    if (gift.stock <= 0) {
        alert('库存不足');
        return;
    }

    // 打开领取方式选择弹窗
    const modal = document.getElementById('delivery-method-modal');
    modal.classList.add('active');
};

// 确认领取方式
window.confirmDeliveryMethod = async function() {
    const selectedMethod = document.querySelector('input[name="delivery-method"]:checked').value;
    const gift = window._currentGiftForExchange;

    try {
        // 扣减积分
        const newPoints = DB.currentUser.points - gift.points;
        await DB.updateUserPoints(DB.currentUser.id, newPoints);
        DB.currentUser.points = newPoints;

        // 减少库存
        await DB.updateGift(gift.id, { stock: gift.stock - 1 });

        // 创建订单
        const order = {
            id: `order_${Date.now()}`,
            gift_id: gift.id,
            gift_name: gift.name,
            gift_image: gift.image,
            user_id: DB.currentUser.id,
            user_name: DB.currentUser.name,
            points: gift.points,
            status: 'pending',
            delivery_method: selectedMethod, // 添加领取方式
            delivery_method_text: selectedMethod === 'shenzhen' ? '深圳腾讯大厦' : '异地邮寄',
            created_at: new Date().toISOString()
        };
        await DB.createOrder(order);

        // 添加积分流水
        await DB.addPointsLog({
            id: `log_${Date.now()}`,
            user_id: DB.currentUser.id,
            type: 'exchange',
            change: -gift.points,
            balance: newPoints,
            reason: `兑换礼品：${gift.name}`,
            created_at: new Date().toISOString()
        });

        // 关闭弹窗
        closeModal('delivery-method-modal');

        await updateUI();
        alert('兑换成功！');
        showPage('mall');
    } catch (error) {
        console.error('兑换失败:', error);
        alert('兑换失败，请重试');
    }
};

// ==================== 搜索礼品 ===================

async function searchGifts() {
    const keyword = document.getElementById('search-input').value.toLowerCase();
    const allGifts = await DB.getGifts();
    const filtered = allGifts.filter(gift => 
        gift.status && 
        (gift.name.toLowerCase().includes(keyword) || 
         (gift.description && gift.description.toLowerCase().includes(keyword)))
    );
    renderGifts(filtered, 'mall-gifts');
}

// ==================== 积分记录和订单 ===================

// ==================== 榜单功能 ===================

// 加载积分排行榜
async function loadPointsRank() {
    const container = document.getElementById('points-rank-list') ||
                      document.getElementById('admin-points-rank-list');
    if (!container) return;

    const allUsers = await DB.getUsers();

    // 按积分降序排序
    const sortedUsers = allUsers
        .sort((a, b) => b.points - a.points)
        .slice(0, 10); // 取前10名

    if (sortedUsers.length === 0) {
        container.innerHTML = '<div class="empty"><p>暂无数据</p></div>';
        return;
    }

    container.innerHTML = sortedUsers.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = DB.currentUser && user.id === DB.currentUser.id;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const crownIcon = rank <= 3 ? '<span class="rank-crown">👑</span>' : '';

        return `
            <div class="rank-item ${rankClass} ${isCurrentUser ? 'current-user' : ''}">
                <div class="rank-number">${crownIcon}<span>${rank}</span></div>
                <span class="rank-name">${escapeHtml(user.name)}</span>
                <span class="rank-score">${user.points}</span>
            </div>
        `;
    }).join('');
}

// 加载观看时长排行榜
async function loadWatchTimeRank() {
    const container = document.getElementById('watch-time-rank-list');
    if (!container) return;

    const allUsers = await DB.getUsers();

    // 按观看时长降序排序
    const sortedUsers = allUsers
        .sort((a, b) => (b.watch_time || 0) - (a.watch_time || 0))
        .slice(0, 10); // 取前10名

    if (sortedUsers.length === 0 || sortedUsers.every(u => !u.watch_time || u.watch_time === 0)) {
        container.innerHTML = '<div class="empty"><p>暂无数据</p></div>';
        return;
    }

    container.innerHTML = sortedUsers.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = DB.currentUser && user.id === DB.currentUser.id;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const crownIcon = rank <= 3 ? '<span class="rank-crown">👑</span>' : '';
        const watchTime = user.watch_time || 0;
        const hours = Math.floor(watchTime / 60);
        const minutes = watchTime % 60;
        const timeDisplay = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;

        return `
            <div class="rank-item ${rankClass} ${isCurrentUser ? 'current-user' : ''}">
                <div class="rank-number">${crownIcon}<span>${rank}</span></div>
                <span class="rank-name">${escapeHtml(user.name)}</span>
                <span class="rank-score">${timeDisplay}</span>
            </div>
        `;
    }).join('');
}

// 加载礼品兑换排行榜
async function loadExchangeRank() {
    const container = document.getElementById('exchange-rank-list') ||
                      document.getElementById('admin-exchange-rank-list');
    if (!container) return;

    const allUsers = await DB.getUsers();

    // 计算每个用户的兑换次数
    const userExchangeCounts = {};
    for (const user of allUsers) {
        const userOrders = await DB.getUserOrders(user.id);
        userExchangeCounts[user.id] = userOrders.length;
    }

    // 按兑换次数降序排序
    const sortedUsers = allUsers
        .map(user => ({
            ...user,
            exchangeCount: userExchangeCounts[user.id] || 0
        }))
        .sort((a, b) => b.exchangeCount - a.exchangeCount)
        .slice(0, 10); // 取前10名

    if (sortedUsers.length === 0 || sortedUsers.every(u => u.exchangeCount === 0)) {
        container.innerHTML = '<div class="empty"><p>暂无兑换数据</p></div>';
        return;
    }

    container.innerHTML = sortedUsers.map((user, index) => {
        const rank = index + 1;
        const isCurrentUser = DB.currentUser && user.id === DB.currentUser.id;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const crownIcon = rank <= 3 ? '<span class="rank-crown">👑</span>' : '';

        return `
            <div class="rank-item ${rankClass} ${isCurrentUser ? 'current-user' : ''}">
                <div class="rank-number">${crownIcon}${rank}</div>
                <span class="rank-name">${escapeHtml(user.name)}</span>
                <span class="rank-score">${user.exchangeCount}件</span>
            </div>
        `;
    }).join('');
}

async function openPointsLog() {
    const modal = document.getElementById('points-log-modal');
    const container = document.getElementById('points-log-list');
    
    const userLogs = await DB.getUserPointsLog(DB.currentUser.id);
    
    if (userLogs.length === 0) {
        container.innerHTML = '<div class="empty"><p>暂无积分记录</p></div>';
    } else {
        container.innerHTML = userLogs.map(log => `
            <div class="log-item">
                <div class="log-header">
                    <span class="log-reason">${log.reason}</span>
                    <span class="log-amount ${log.change > 0 ? 'positive' : 'negative'}">
                        ${log.change > 0 ? '+' : ''}${log.change}
                    </span>
                </div>
                <div class="log-time">${formatTime(log.created_at)}</div>
                <div>余额: ${log.balance}</div>
            </div>
        `).join('');
    }
    
    modal.classList.add('active');
}

async function openExchangeRecords() {
    const modal = document.getElementById('exchange-records-modal');
    const container = document.getElementById('exchange-records-list');

    const userOrders = await DB.getUserOrders(DB.currentUser.id);

    if (userOrders.length === 0) {
        container.innerHTML = '<div class="empty"><p>暂无兑换记录</p></div>';
    } else {
        container.innerHTML = userOrders.map(order => {
            const escapedGiftName = escapeHtml(order.gift_name);
            const escapedPoints = escapeHtml(String(order.points));
            return `
                <div class="order-item">
                    <div class="order-header">
                        <span>${escapedGiftName}</span>
                        <span class="status-badge status-${order.status}">${getOrderStatusText(order.status)}</span>
                    </div>
                    <div class="order-time">${formatTime(order.created_at)}</div>
                    <div>消耗积分：${escapedPoints}</div>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ==================== 管理后台 ===================

async function updateStats() {
    const allGifts = await DB.getGifts();
    const allOrders = await DB.getOrders();
    
    document.getElementById('stat-users').textContent = '4'; // 用户数量
    document.getElementById('stat-gifts').textContent = allGifts.filter(g => g.status).length;
    document.getElementById('stat-orders').textContent = allOrders.length;
}

async function loadRecentOrders() {
    const container = document.getElementById('recent-orders');
    const recentOrders = await DB.getOrders();
    const top5 = recentOrders.slice(0, 5);

    if (top5.length === 0) {
        container.innerHTML = '<div class="empty"><p>暂无订单</p></div>';
    } else {
        container.innerHTML = top5.map(order => {
            const escapedUserName = escapeHtml(order.user_name);
            const escapedGiftName = escapeHtml(order.gift_name);
            const escapedPoints = escapeHtml(String(order.points));
            return `
                <div class="order-item">
                    <div class="order-header">
                        <span>${escapedUserName} - ${escapedGiftName}</span>
                        <span>${escapedPoints} 积分</span>
                    </div>
                    <div class="order-time">${formatTime(order.created_at)}</div>
                </div>
            `;
        }).join('');
    }
}

async function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`admin-${tabName}`).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

async function loadUsersList() {
    const container = document.getElementById('users-list');
    const users = await DB.getUsers();

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>用户ID</th>
                    <th>用户名</th>
                    <th>积分</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${users.map((user, index) => {
                    const escapedName = escapeHtml(user.name);
                    const escapedPoints = escapeHtml(String(user.points));
                    const escapedIdDisplay = escapeHtml(user.id);
                    return `
                        <tr data-user-index="${index}">
                            <td>${escapedIdDisplay}</td>
                            <td>${escapedName}</td>
                            <td>${escapedPoints}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-primary" onclick="editUserPointsByIndex(${index})">管理积分</button>
                                    <button class="btn btn-danger" onclick="deleteUserByIndex(${index})">删除</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function loadPointsUsers() {
    const select = document.getElementById('points-user');
    const users = await DB.getUsers();
    select.innerHTML = users.map(user => 
        `<option value="${user.id}">${user.name} (${user.points} 积分)</option>`
    ).join('');
}

async function loadAdminGiftsList() {
    const container = document.getElementById('admin-gifts-list');
    const gifts = await DB.getGifts();

    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>礼品</th>
                    <th>所需积分</th>
                    <th>库存</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${gifts.map(gift => {
                    const escapedId = encodeURIComponent(gift.id);
                    const escapedName = escapeHtml(gift.name);
                    const escapedDesc = escapeHtml(gift.description || '');
                    const escapedPoints = escapeHtml(String(gift.points));
                    const escapedStock = escapeHtml(String(gift.stock));
                    const escapedImage = escapeHtml(gift.image);
                    return `
                        <tr>
                            <td>
                                <img src="${escapedImage}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;margin-right:10px;">
                                ${escapedName}
                            </td>
                            <td>${escapedPoints}</td>
                            <td>${escapedStock}</td>
                            <td>
                                <span class="status-badge ${gift.status ? 'status-completed' : 'status-cancelled'}">
                                    ${gift.status ? '已上架' : '已下架'}
                                </span>
                            </td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-primary" onclick="editGift('${escapedId}')">编辑</button>
                                    <button class="btn btn-secondary" onclick="toggleGiftStatus('${escapedId}')">
                                        ${gift.status ? '下架' : '上架'}
                                    </button>
                                    <button class="btn btn-danger" onclick="deleteGift('${escapedId}')">删除</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

async function loadAdminOrdersList() {
    const container = document.getElementById('admin-orders-list');
    const orders = await DB.getOrders();

    if (orders.length === 0) {
        container.innerHTML = '<div class="empty"><p>暂无订单</p></div>';
    } else {
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>订单号</th>
                        <th>用户</th>
                        <th>礼品</th>
                        <th>积分</th>
                        <th>状态</th>
                        <th>时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => {
                        const escapedId = encodeURIComponent(order.id);
                        const escapedUserName = escapeHtml(order.user_name);
                        const escapedGiftName = escapeHtml(order.gift_name);
                        const escapedPoints = escapeHtml(String(order.points));
                        return `
                            <tr>
                                <td>${order.id}</td>
                                <td>${escapedUserName}</td>
                                <td>${escapedGiftName}</td>
                                <td>${escapedPoints}</td>
                                <td>
                                    <span class="status-badge status-${order.status}">
                                        ${getOrderStatusText(order.status)}
                                    </span>
                                </td>
                                <td>${formatTime(order.created_at)}</td>
                                <td>
                                    <div class="action-buttons">
                                        ${order.status === 'pending' ? `
                                            <button class="btn btn-primary" onclick="updateOrderStatus('${escapedId}', 'shipped')">发货</button>
                                            <button class="btn btn-danger" onclick="updateOrderStatus('${escapedId}', 'cancelled')">取消</button>
                                        ` : ''}
                                        ${order.status === 'shipped' ? `
                                            <button class="btn btn-success" onclick="updateOrderStatus('${escapedId}', 'completed')">完成</button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
}

// ==================== 模态框函数 ===================

function showAddGiftModal() {
    document.getElementById('gift-form').reset();
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('batch-preview').innerHTML = '';
    document.getElementById('add-gift-modal').classList.add('active');
}

function switchUploadTab(tab) {
    document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    }
    document.getElementById(`upload-${tab}`).classList.add('active');
}

function showAddUserModal() {
    document.getElementById('user-form').reset();
    document.getElementById('user-points').value = 0;
    document.getElementById('add-user-modal').classList.add('active');
}

function showBatchImportUsersModal() {
    document.getElementById('batch-user-form').reset();
    document.getElementById('batch-user-preview').innerHTML = '';
    document.getElementById('batch-import-users-modal').classList.add('active');
}

function showBatchDeleteUsersModal() {
    document.getElementById('batch-delete-user-form').reset();
    document.getElementById('batch-delete-preview').innerHTML = '';
    document.getElementById('batch-delete-users-modal').classList.add('active');
}

function showAddPointsModal() {
    loadPointsUsers();
    document.getElementById('points-form').reset();
    document.getElementById('add-points-modal').classList.add('active');
}

function previewImage(input) {
    const preview = document.getElementById('image-preview');
    const hiddenInput = document.getElementById('gift-image');

    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (file.size > 500 * 1024) {
            alert('图片文件过大，请选择小于500KB的图片');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;

            if (base64Data.length > 1000000) {
                alert('图片数据过大，请使用更小的图片');
                return;
            }

            preview.innerHTML = `
                <img src="${base64Data}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
            `;
            hiddenInput.value = base64Data;
        };
        reader.onerror = function() {
            alert('图片读取失败，请重试');
            preview.innerHTML = '';
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
        hiddenInput.value = '';
    }
}

// ==================== 添加礼品 ===================

document.getElementById('gift-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('gift-name').value.trim();
    const image = document.getElementById('gift-image').value;
    const description = document.getElementById('gift-description').value.trim();
    const points = parseInt(document.getElementById('gift-points').value);
    const stock = parseInt(document.getElementById('gift-stock').value);
    const status = document.getElementById('gift-status').value === 'true';

    if (!name) {
        alert('请填写礼品名称');
        return;
    }

    if (!image) {
        alert('请上传礼品图片');
        return;
    }

    if (isNaN(points) || points < 0) {
        alert('请填写有效的积分数量');
        return;
    }

    if (isNaN(stock) || stock < 0) {
        alert('请填写有效的库存数量');
        return;
    }

    const gift = {
        id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        image: image,
        description: description,
        points: points,
        stock: stock,
        status: status
    };

    try {
        await DB.addGift(gift);
        closeModal('add-gift-modal');
        await loadAdmin();
        alert('礼品添加成功！');
    } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败：' + error.message);
    }
});

// ==================== 添加用户 ===================

document.getElementById('user-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const userId = document.getElementById('user-id').value.trim();
    const userName = document.getElementById('user-name').value.trim();
    const accountType = document.getElementById('user-account-type').value;
    const watchTime = parseInt(document.getElementById('user-watch-time').value) || 0;
    const userPoints = parseInt(document.getElementById('user-points').value) || 0;

    // 检查用户名是否已存在
    const existingUser = await DB.getUserByName(userName);
    if (existingUser) {
        alert('用户名已存在，请使用其他用户名');
        return;
    }

    if (!userId) {
        alert('请填写用户ID');
        return;
    }

    if (!userName) {
        alert('请填写用户名');
        return;
    }

    const user = {
        id: userId,
        name: userName,
        account_type: accountType,
        watch_time: watchTime,
        points: userPoints
    };

    try {
        await DB.addUser(user);
        
        // 如果设置了初始积分，添加积分记录
        if (userPoints > 0) {
            await DB.addPointsLog({
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                type: 'admin_add',
                change: userPoints,
                balance: userPoints,
                reason: '初始积分',
                created_at: new Date().toISOString()
            });
        }

        closeModal('add-user-modal');
        await loadAdmin();
        await updateUI();
        alert('用户添加成功！');
    } catch (error) {
        console.error('添加用户失败:', error);
        alert('添加用户失败：' + error.message);
    }
});

// ==================== 发放积分 ===================

document.getElementById('points-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const userId = document.getElementById('points-user').value;
    const amount = parseInt(document.getElementById('points-amount').value);
    const type = document.getElementById('points-type').value;
    const reason = document.getElementById('points-reason').value.trim();

    // 使用 getUserById 根据 userId 获取用户信息
    const user = await DB.getUserById(userId);
    if (!user) {
        console.error('用户不存在, userId:', userId);
        alert('用户不存在，请重试');
        return;
    }

    const change = type === 'add' ? amount : -amount;
    const newPoints = user.points + change;

    // 检查积分是否足够
    if (type === 'reduce' && newPoints < 0) {
        alert(`用户当前积分为 ${user.points}，扣减 ${amount} 后将为 ${newPoints}，不允许负积分！`);
        return;
    }

    try {
        console.log(`🔄 更新用户积分: 用户=${user.name}, 用户ID=${userId}, ${type === 'add' ? '增加' : '扣减'}=${amount}, 新积分=${newPoints}`);

        // 更新用户积分（直接写入 Supabase）
        const updatedUser = await DB.updateUserPoints(userId, newPoints);
        if (!updatedUser) {
            throw new Error('更新用户积分失败');
        }

        console.log('✅ Supabase 数据库已更新, 用户积分:', newPoints);

        // 如果是当前登录用户，同步更新本地状态
        if (DB.currentUser && DB.currentUser.id === userId) {
            DB.currentUser.points = newPoints;
            console.log('✅ 当前用户积分已同步更新');
        }

        // 添加积分流水（直接写入 Supabase）
        const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            type: type === 'add' ? 'admin_add' : 'admin_reduce',
            change: change,
            balance: newPoints,
            reason: reason,
            created_at: new Date().toISOString()
        };

        const logResult = await DB.addPointsLog(logEntry);
        if (!logResult) {
            console.warn('⚠️ 积分流水记录添加失败，但用户积分已更新');
        } else {
            console.log('✅ 积分流水已记录到 Supabase');
        }

        // 刷新界面
        await updateUI();
        closeModal('add-points-modal');
        await loadAdmin(); // 重新加载后台数据，显示最新积分

        alert(`✅ 操作成功！\n用户「${user.name}」积分已${type === 'add' ? '增加' : '扣减'} ${amount}，当前积分：${newPoints}`);
    } catch (error) {
        console.error('❌ 操作失败:', error);
        alert('操作失败：' + error.message);
    }
});

// ==================== 礼品管理 ===================

function editGift(giftId) {
    alert('编辑功能开发中，请删除后重新添加');
}

async function toggleGiftStatus(giftId) {
    giftId = decodeURIComponent(giftId);
    const gift = await DB.getGiftById(giftId);
    if (gift) {
        try {
            await DB.updateGift(giftId, { status: !gift.status });
            await loadAdmin();
        } catch (error) {
            console.error('更新状态失败:', error);
            alert('更新失败：' + error.message);
        }
    }
}

async function deleteGift(giftId) {
    giftId = decodeURIComponent(giftId);
    if (confirm('确定要删除该礼品吗？')) {
        try {
            await DB.deleteGift(giftId);
            await loadAdmin();
            alert('删除成功！');
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败：' + error.message);
        }
    }
}

async function updateOrderStatus(orderId, newStatus) {
    orderId = decodeURIComponent(orderId);
    try {
        await DB.updateOrderStatus(orderId, newStatus);
        await loadAdmin();
        alert('订单状态已更新！');
    } catch (error) {
        console.error('更新失败:', error);
        alert('更新失败：' + error.message);
    }
}

async function editUserPointsByIndex(index) {
    const users = await DB.getUsers();
    if (index < 0 || index >= users.length) {
        alert('用户不存在');
        return;
    }

    const user = users[index];
    showAddPointsModal();
    document.getElementById('points-user').value = user.id;
}

async function deleteUserByIndex(index) {
    const users = await DB.getUsers();
    if (index < 0 || index >= users.length) {
        alert('用户不存在');
        return;
    }

    const user = users[index];
    const userOrders = await DB.getUserOrders(user.id);
    const hasPendingOrders = userOrders.some(order => order.status === 'pending');

    let confirmMessage = `确定要删除用户「${user.name}」吗？\n\n`;
    if (userOrders.length > 0) {
        confirmMessage += `该用户有 ${userOrders.length} 条订单记录，`;
        if (hasPendingOrders) {
            confirmMessage += `其中包含未完成的订单。\n\n删除后将一并删除该用户的：\n- 积分明细记录\n- 所有订单记录\n\n`;
        } else {
            confirmMessage += `\n删除后将一并删除该用户的：\n- 积分明细记录\n- 所有订单记录\n\n`;
        }
    } else {
        confirmMessage += `删除后将一并删除该用户的积分明细记录。\n\n`;
    }
    confirmMessage += `此操作不可恢复，确认删除？`;

    if (!confirm(confirmMessage)) {
        return;
    }

    if (!confirm('再次确认：真的要删除该用户吗？')) {
        return;
    }

    try {
        await DB.deleteUser(user.id);
        
        // 如果删除的是当前登录的用户，退出登录
        if (DB.currentUser && DB.currentUser.id === user.id) {
            alert('您已删除自己的账号，将自动退出登录');
            logout();
            return;
        }

        await loadAdmin();
        alert(`用户「${user.name}」已成功删除！`);
    } catch (error) {
        console.error('删除用户失败:', error);
        alert('删除用户失败：' + error.message);
    }
}

// ==================== 工具函数 ===================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timeStr) {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getOrderStatusText(status) {
    const statusMap = {
        'pending': '待发货',
        'shipped': '已发货',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

function clearAllUsers() {
    if (confirm('确定要删除所有用户吗？\n\n此操作将删除：\n- 所有用户账号\n- 所有用户的积分记录\n- 所有订单记录\n\n此操作不可恢复！')) {
        if (confirm('再次确认：真的要删除所有用户吗？此操作无法撤销！')) {
            DB.users = [];
            DB.orders = [];
            DB.pointsLog = [];
            saveData();
            alert('已清除所有本地用户数据');
            if (DB.isAdmin) loadAdmin();
        }
    }
}

// ==================== 登录相关 ===================

function showUserLogin() {
    console.log('showUserLogin 被调用');
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('admin-login-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'none';
}

function showAdminLogin() {
    console.log('showAdminLogin 被调用');
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('admin-login-page').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}

// 将函数暴露到 window 对象，确保全局可访问
window.showUserLogin = showUserLogin;
window.showAdminLogin = showAdminLogin;

console.log('✅ app.js 已加载，登录函数已定义：', typeof showAdminLogin);

async function userLogin(userName) {
    const user = await DB.getUserByName(userName);
    if (!user) {
        alert('用户名不存在，请联系管理员获取正确的用户名');
        return;
    }

    login(user.id, user.name, false);
}

async function adminLogin(password) {
    const admin = await DB.getAdmin();

    if (!admin || admin.password !== password) {
        alert('管理员密码错误');
        return;
    }

    login('admin', '管理员', true);
}

function login(userId, userName, isAdmin) {
    if (isAdmin) {
        DB.currentUser = { id: 'admin', name: '管理员', points: 0 };
        DB.isAdmin = true;
    } else {
        DB.currentUser = { id: userId, name: userName, points: 0 };
        DB.isAdmin = false;
    }

    // 保存登录状态到 localStorage
    localStorage.setItem('pointsMallCurrentUser', JSON.stringify({
        id: userId,
        userName: userName,
        isAdmin: isAdmin
    }));

    // 显示主应用
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('admin-login-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';

    // 控制管理后台导航显示
    document.getElementById('admin-nav-link').style.display = isAdmin ? 'block' : 'none';

    updateUI();
    showPage(isAdmin ? 'admin' : 'home');
}

function logout() {
    DB.currentUser = null;
    DB.isAdmin = false;
    localStorage.removeItem('pointsMallCurrentUser');
    showUserLogin();
}

// ==================== 初始化 ===================

document.addEventListener('DOMContentLoaded', async function() {
    await initData();

    // 检查是否有已登录用户
    const savedUser = localStorage.getItem('pointsMallCurrentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);

            if (user.isAdmin) {
                await adminLogin('PointsMall@2026Demo');
            } else {
                await userLogin(user.userName);
            }
        } catch (e) {
            console.error('解析登录用户失败:', e);
            localStorage.removeItem('pointsMallCurrentUser');
            showUserLogin();
        }
    } else {
        showUserLogin();
    }

    // 用户登录表单
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const userName = document.getElementById('login-user-name').value.trim();
        userLogin(userName);
    });

    // 管理员登录表单
    document.getElementById('admin-login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;
        adminLogin(password);
    });

    // 导航链接点击事件
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showPage(this.dataset.page);
        });
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
});

// ==================== 导出功能 ===================

// 导出积分变动记录
async function exportPointsLog() {
    try {
        const allLogs = await DB.getAllPointsLog();
        const allUsers = await DB.getUsers();
        const userMap = {};
        allUsers.forEach(user => {
            userMap[user.id] = user.name;
        });

        if (allLogs.length === 0) {
            alert('暂无积分变动记录');
            return;
        }

        // 准备CSV数据
        const csvHeader = '用户名,变动类型,变动数量,变动原因,变动时间,余额\n';
        const csvData = allLogs.map(log => {
            const userName = userMap[log.user_id] || '未知用户';
            const typeText = log.change > 0 ? '增加' : '扣减';
            const time = formatTime(log.created_at);
            return `${userName},${typeText},${log.change},${log.reason},${time},${log.balance}`;
        }).join('\n');

        const csvContent = csvHeader + csvData;

        // 创建下载链接
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `积分变动记录_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`已导出 ${allLogs.length} 条积分变动记录`);
    } catch (error) {
        console.error('导出积分记录失败:', error);
        alert('导出失败，请重试');
    }
}

// 导出兑换记录
async function exportOrders() {
    try {
        const allOrders = await DB.getOrders();

        if (allOrders.length === 0) {
            alert('暂无兑换记录');
            return;
        }

        // 准备CSV数据
        const csvHeader = '用户名,礼品名称,消耗积分,领取方式,订单状态,兑换时间\n';
        const csvData = allOrders.map(order => {
            const statusText = getOrderStatusText(order.status);
            const deliveryMethod = order.delivery_method_text || '-';
            const time = formatTime(order.created_at);
            return `${order.user_name},${order.gift_name},${order.points},${deliveryMethod},${statusText},${time}`;
        }).join('\n');

        const csvContent = csvHeader + csvData;

        // 创建下载链接
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `礼品兑换记录_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`已导出 ${allOrders.length} 条兑换记录`);
    } catch (error) {
        console.error('导出兑换记录失败:', error);
        alert('导出失败，请重试');
    }
}

// ==================== 模板下载 ====================

// 下载礼品批量导入模板
window.downloadTemplate = function(event) {
    event.preventDefault();
    const csvContent = '\ufeff礼品名称,礼品描述,所需积分,库存数量,上架状态\n精美水杯,高品质不锈钢水杯,保温效果好,100,50,true\n蓝牙耳机,无线蓝牙耳机,音质清晰,500,30,true';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', '礼品导入模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// 下载用户批量导入模板
window.downloadUserTemplate = function(event) {
    event.preventDefault();
    const csvContent = '\ufeff用户名,账号类型,观看时长,初始积分\n张三,集团,120,100\n李四,云智,60,50';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', '用户导入模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// 下载用户批量删除模板
window.downloadDeleteUserTemplate = function(event) {
    event.preventDefault();
    const csvContent = '\ufeff用户名\n张三\n李四';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', '用户删除模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ==================== 批量导入用户 ====================

// 批量导入用户表单处理
document.getElementById('batch-user-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('batch-user-csv');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择CSV文件');
        return;
    }
    
    try {
        let users = [];
        
        if (file.name.endsWith('.csv')) {
            // 读取CSV文件
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            // 跳过表头，从第二行开始解析
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // 处理CSV中的逗号（简单处理，假设字段不包含逗号）
                const columns = line.split(',');
                if (columns.length < 4) {
                    console.warn(`第 ${i + 1} 行格式不正确，跳过`);
                    continue;
                }
                
                const userName = columns[0].trim();
                const accountType = columns[1].trim();
                const watchTime = parseInt(columns[2]) || 0;
                const userPoints = parseInt(columns[3]) || 0;
                
                if (!userName) continue;
                
                users.push({
                    id: `user_${Date.now()}_${i}`,
                    name: userName,
                    account_type: accountType || '集团',
                    watch_time: watchTime,
                    points: userPoints
                });
            }
        } else {
            // Excel文件处理提示
            alert('Excel文件处理需要额外库支持，请使用CSV格式');
            return;
        }
        
        if (users.length === 0) {
            alert('未找到有效用户数据');
            return;
        }
        
        // 逐个添加用户
        let successCount = 0;
        let failCount = 0;
        let duplicateCount = 0;
        const duplicateUsers = [];
        
        for (const user of users) {
            try {
                // 检查用户名是否已存在
                const existingUser = await DB.getUserByName(user.name);
                if (existingUser) {
                    duplicateCount++;
                    duplicateUsers.push(user.name);
                    continue;
                }
                
                await DB.addUser(user);
                
                // 添加积分记录
                if (user.points > 0) {
                    await DB.addPointsLog({
                        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        user_id: user.id,
                        type: 'admin_add',
                        change: user.points,
                        balance: user.points,
                        reason: '批量导入初始积分',
                        created_at: new Date().toISOString()
                    });
                }
                
                successCount++;
            } catch (error) {
                console.error('导入用户失败:', user.name, error);
                failCount++;
            }
        }
        
        // 显示结果
        let message = `批量导入完成！\n\n`;
        message += `成功导入：${successCount} 人\n`;
        if (duplicateCount > 0) {
            message += `用户名已存在（跳过）：${duplicateCount} 人\n`;
            message += `重复的用户名：${duplicateUsers.join('、')}\n`;
        }
        if (failCount > 0) {
            message += `导入失败：${failCount} 人\n`;
        }
        
        alert(message);
        
        if (successCount > 0) {
            closeModal('batch-import-users-modal');
            await loadAdmin();
        }
    } catch (error) {
        console.error('批量导入失败:', error);
        alert('批量导入失败：' + error.message);
    }
});

// ==================== 批量删除用户 ====================

// 批量删除用户表单处理
document.getElementById('batch-delete-user-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('batch-delete-csv');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择CSV文件');
        return;
    }
    
    if (!confirm('确定要批量删除用户吗？\n\n此操作将删除：\n- 所有匹配的用户账号\n- 所有用户的积分记录\n- 所有订单记录\n\n此操作不可恢复！')) {
        return;
    }
    
    try {
        let userNames = [];
        
        if (file.name.endsWith('.csv')) {
            // 读取CSV文件
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            // 跳过表头，从第二行开始解析
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const userName = line.split(',')[0].trim();
                if (userName) {
                    userNames.push(userName);
                }
            }
        } else {
            alert('Excel文件处理需要额外库支持，请使用CSV格式');
            return;
        }
        
        if (userNames.length === 0) {
            alert('未找到有效用户数据');
            return;
        }
        
        // 逐个删除用户
        let successCount = 0;
        let notFoundCount = 0;
        const notFoundUsers = [];
        
        for (const userName of userNames) {
            try {
                const user = await DB.getUserByName(userName);
                if (!user) {
                    notFoundCount++;
                    notFoundUsers.push(userName);
                    continue;
                }
                
                await DB.deleteUser(user.id);
                successCount++;
            } catch (error) {
                console.error('删除用户失败:', userName, error);
            }
        }
        
        // 显示结果
        let message = `批量删除完成！\n\n`;
        message += `成功删除：${successCount} 人\n`;
        if (notFoundCount > 0) {
            message += `用户不存在（跳过）：${notFoundCount} 人\n`;
            message += `不存在的用户名：${notFoundUsers.join('、')}\n`;
        }
        
        alert(message);
        
        if (successCount > 0) {
            closeModal('batch-delete-users-modal');
            await loadAdmin();
        }
    } catch (error) {
        console.error('批量删除失败:', error);
        alert('批量删除失败：' + error.message);
    }
});

// ==================== 批量导入礼品 ====================

// 批量导入礼品表单处理
document.getElementById('batch-gift-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('batch-excel');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择CSV/Excel文件');
        return;
    }
    
    try {
        let gifts = [];
        
        if (file.name.endsWith('.csv')) {
            // 读取CSV文件
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            // 跳过表头，从第二行开始解析
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // 简单处理CSV
                const columns = line.split(',');
                if (columns.length < 5) {
                    console.warn(`第 ${i + 1} 行格式不正确，跳过`);
                    continue;
                }
                
                const name = columns[0].trim();
                const description = columns[1].trim();
                const points = parseInt(columns[2]) || 0;
                const stock = parseInt(columns[3]) || 0;
                const status = columns[4].trim().toLowerCase() === 'true';
                
                if (!name) continue;
                
                gifts.push({
                    id: `gift_${Date.now()}_${i}`,
                    name: name,
                    image: 'https://via.placeholder.com/400x400/CCCCCC/999999?text=' + encodeURIComponent(name),
                    description: description || '',
                    points: points,
                    stock: stock,
                    status: status
                });
            }
        } else {
            // Excel文件处理提示
            alert('Excel文件处理需要额外库支持，请使用CSV格式');
            return;
        }
        
        if (gifts.length === 0) {
            alert('未找到有效礼品数据');
            return;
        }
        
        // 逐个添加礼品
        let successCount = 0;
        let failCount = 0;
        
        for (const gift of gifts) {
            try {
                await DB.addGift(gift);
                successCount++;
            } catch (error) {
                console.error('导入礼品失败:', gift.name, error);
                failCount++;
            }
        }
        
        // 显示结果
        let message = `批量导入完成！\n\n`;
        message += `成功导入：${successCount} 个礼品\n`;
        if (failCount > 0) {
            message += `导入失败：${failCount} 个礼品\n`;
        }
        
        alert(message);
        
        if (successCount > 0) {
            closeModal('add-gift-modal');
            await loadAdmin();
            alert('提示：导入的礼品使用的是占位图，请在管理后台手动上传实际图片');
        }
    } catch (error) {
        console.error('批量导入失败:', error);
        alert('批量导入失败：' + error.message);
    }
});
