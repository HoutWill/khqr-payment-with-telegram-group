const http = require('http');
const assert = require('assert');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runE2ETest() {
  console.log('🚀 Running End-to-End Live Server Verification...\n');

  // 1. Check Products API
  console.log('1. Fetching Products...');
  const prodRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/products',
    method: 'GET'
  });
  assert.strictEqual(prodRes.status, 200);
  assert(prodRes.data.products.length >= 6);
  console.log(`✅ Fetched ${prodRes.data.products.length} products successfully!\n`);

  // 2. Create an Order
  console.log('2. Creating Order with Dynamic KHQR & ABA DeepLink...');
  const orderPayload = {
    items: [
      { id: 'prod-1', quantity: 1 }, // $49.00
      { id: 'prod-4', quantity: 2 }  // $12.00 * 2 = $24.00
    ],
    customer: {
      name: 'Vannak Sambath',
      phone: '012 999 888',
      address: 'Preah Monivong Blvd, Phnom Penh',
      notes: 'Please call before delivery'
    },
    currency: 'USD'
  };

  const orderRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, orderPayload);

  assert.strictEqual(orderRes.status, 201);
  const order = orderRes.data.order;
  console.log(`✅ Order Created: ${order.orderCode} (Total: $${order.totalUsd}, ${order.totalKhr.toLocaleString()} KHR)`);
  console.log(`   - Status: ${order.status}`);
  console.log(`   - KHQR Payload: ${order.khqrString.slice(0, 40)}...`);
  console.log(`   - ABA DeepLink: ${order.deepLinks.abaMobileScheme.slice(0, 45)}...`);
  console.log(`   - Bakong Universal Link: ${order.deepLinks.bakongUniversalLink.slice(0, 50)}...\n`);

  // 3. Verify Order Status Endpoint
  console.log('3. Checking Initial Order Status (should be PENDING)...');
  const statusRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/orders/${order.id}/status`,
    method: 'GET'
  });
  assert.strictEqual(statusRes.data.status, 'PENDING');
  console.log('✅ Initial status is PENDING\n');

  // 4. Simulate ABA Merchant Telegram Notification
  console.log('4. Simulating Incoming ABA Telegram Bot Payment Alert...');
  const telegramAlertText = `
🔔 ABA Merchant: Payment Received
Amount: USD ${order.totalUsd.toFixed(2)}
From: VANNAK SAMBATH
Remark: ${order.orderCode}
Txn ID: ABA2026082299482
Date: 22-Aug-2026 13:45
  `.trim();

  const simRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/admin/simulate-telegram',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    text: telegramAlertText,
    senderName: 'VANNAK SAMBATH'
  });

  assert.strictEqual(simRes.status, 200);
  assert.strictEqual(simRes.data.matched, true);
  console.log('✅ Telegram Alert Matched successfully!');
  console.log('   - Matched Order Code:', simRes.data.result.order.orderCode);
  console.log('   - Matched Bank Ref:', simRes.data.result.log.reference);
  console.log('   - Strategy:', simRes.data.result.matchStrategy, '\n');

  // 5. Verify Order Status Updated to PAID
  console.log('5. Verifying Order Status is now PAID in Database...');
  const updatedStatusRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/orders/${order.id}`,
    method: 'GET'
  });
  assert.strictEqual(updatedStatusRes.data.order.status, 'PAID');
  assert.strictEqual(updatedStatusRes.data.order.matchedTransaction.bankRef, 'ABA2026082299482');
  console.log(`✅ Order ${order.orderCode} is verified and marked PAID at ${updatedStatusRes.data.order.paidAt}!\n`);

  // 6. Verify Admin Orders and Logs
  console.log('6. Verifying Admin Feed and Match Logs...');
  const adminOrders = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/admin/orders', method: 'GET' });
  const adminLogs = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/admin/logs', method: 'GET' });
  assert(adminOrders.data.orders.length > 0);
  assert(adminLogs.data.logs.length > 0);
  console.log(`✅ Admin Orders (${adminOrders.data.orders.length}) & Logs (${adminLogs.data.logs.length}) verified!\n`);

  console.log('🎉 ALL LIVE E2E VERIFICATIONS PASSED SUCCESSFULLY!');
}

runE2ETest().catch(err => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});
