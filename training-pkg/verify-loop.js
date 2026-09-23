const BASE = 'http://127.0.0.1:8080';

async function api(method, path, staff, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (staff) headers['x-staff-override'] = staff; // 本地预览身份
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text; }
  return { status: res.status, data };
}

(async () => {
  console.log('--- 1. 提交主题 (speaker=alice) → 开户不加分 ---');
  const topic = await api('POST', '/api/topics', 'alice', {
    title: '测试分享主题', speaker: 'alice', shareDate: '2026-09-10'
  });
  console.log('topic status', topic.status, 'id', topic.data._id);
  const tid = topic.data._id;

  console.log('--- 2. 提交课后反馈 (alice) → +20 ---');
  const fb = await api('POST', '/api/feedbacks', 'alice', {
    dateKey: '2026-09-10',
    topicScores: [{ topicId: tid, content: 5, speaker: 5, overall: 5 }],
    bestPoint: '学到了', improvement: '无', nextTopic: '进阶'
  });
  console.log('feedback status', fb.status);

  console.log('--- 3. 沉淀 (开讲完成) → 讲师 alice +100 ---');
  const dep = await api('POST', '/api/deposits', 'bob', { topicId: tid, introText: '沉淀内容' });
  console.log('deposit status', dep.status);

  console.log('--- 4. 查 alice 积分余额 (应=120) ---');
  const me = await api('GET', '/api/points/me', 'alice');
  console.log('me', JSON.stringify(me.data));

  console.log('--- 5. alice 兑换 prod_1 (100分) → 余额 20 ---');
  const redeem = await api('POST', '/api/redeem', 'alice', { productId: 'prod_1' });
  console.log('redeem status', redeem.status, redeem.data.success ? 'balance=' + redeem.data.balance : JSON.stringify(redeem.data));

  console.log('--- 6. alice 流水 ---');
  const ledger = await api('GET', '/api/points/ledger', 'alice');
  console.log('ledger count', ledger.data.length);
  ledger.data.forEach(l => console.log('  ', l.change >= 0 ? '+' : '', l.change, l.type, '-', l.reason));

  console.log('--- 7. 管理员给 alice 调分 +50 (admin=carol, 空名单=全员管理员) ---');
  const adj = await api('POST', '/api/points/adjust', 'carol', { staffName: 'alice', amount: 50, reason: '测试手动加' });
  console.log('adjust status', adj.status, JSON.stringify(adj.data.account && { balance: adj.data.account.balance }));

  console.log('--- 8. 最终 alice 余额 (应=70) ---');
  const me2 = await api('GET', '/api/points/me', 'alice');
  console.log('me', JSON.stringify(me2.data));

  console.log('--- 9. 订单列表 (admin) ---');
  const orders = await api('GET', '/api/orders', 'carol');
  console.log('orders', orders.data.length, orders.data.map(o => ({ s: o.staffName, p: o.productName, st: o.status })));

  console.log('--- 10. 兑换积分不足场景 (新用户 dave 兑换 prod_1) ---');
  const r2 = await api('POST', '/api/redeem', 'dave', { productId: 'prod_1' });
  console.log('redeem dave status', r2.status, JSON.stringify(r2.data));
})().catch(e => { console.error('ERR', e); process.exit(1); });
