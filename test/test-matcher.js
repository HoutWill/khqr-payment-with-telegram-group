const assert = require('assert');
const { generateKHQR, generateDeepLinks, calculateCRC16 } = require('../server/khqr');
const telegramMatcher = require('../server/telegramMatcher');
const db = require('../server/db');

console.log('🧪 Starting KHQR & Telegram Matcher Test Suite...\n');

// 1. Test CRC16
console.log('--- Test 1: CRC16 Calculation ---');
const sampleData = '00020101021229340018merchant_demo@abaa0108ABA Bank520459995303840540515.005802KH5915ABA DEMO STORE6010Phnom Penh62130109ORD-123456304';
const crc = calculateCRC16(sampleData);
console.log(`Calculated CRC: ${crc}`);
assert.strictEqual(typeof crc, 'string');
assert.strictEqual(crc.length, 4);
console.log('✅ CRC16 calculation passed!\n');

// 2. Test Dynamic KHQR Generation
console.log('--- Test 2: Dynamic KHQR Generation ---');
const khqrStr = generateKHQR({
  bakongAccountId: 'merchant_demo@abaa',
  merchantName: 'ABA DEMO STORE',
  merchantCity: 'Phnom Penh',
  amount: 25.50,
  currency: 'USD',
  orderId: 'ORD-98421'
});
console.log(`Generated KHQR: ${khqrStr}`);
assert(khqrStr.startsWith('000201010212'), 'Should start with dynamic EMVCo prefix');
assert(khqrStr.includes('ORD-98421'), 'Should contain order code in Tag 62');
assert(khqrStr.includes('840'), 'Should contain USD currency code 840');
console.log('✅ KHQR Generation passed!\n');

// 3. Test Deep Link Generation
console.log('--- Test 3: Deep Link Generation ---');
const deepLinks = generateDeepLinks(khqrStr, {
  bakongAccountId: 'merchant_demo@abaa',
  amount: 25.50,
  currency: 'USD',
  orderId: 'ORD-98421'
});
console.log('Generated Deep Links:', deepLinks);
assert(deepLinks.bakongUniversalLink.startsWith('https://link.bakong.org.kh/pay?khqr='), 'Valid Bakong link');
assert(deepLinks.abaMobileScheme.startsWith('abamobilebank://khqr?qr='), 'Valid ABA Scheme');
console.log('✅ Deep Link generation passed!\n');

// 4. Test Telegram ABA Bot Notification Parser
console.log('--- Test 4: Telegram Message Parser ---');

// Format A: Standard English ABA Merchant Bot notification
const text1 = `
🔔 ABA Merchant: Payment Received
Amount: USD 25.50
From: CHAN TITH
Remark: ORD-98421
Txn ID: ABA982341908
Date: 22/08/2026 13:45
`;
const parsed1 = telegramMatcher.parseMessageText(text1);
console.log('Parsed Format 1 (Standard English ABA):', parsed1);
assert.strictEqual(parsed1.amount, 25.50);
assert.strictEqual(parsed1.currency, 'USD');
assert.strictEqual(parsed1.orderCode, 'ORD-98421');
assert.strictEqual(parsed1.senderName, 'CHAN TITH');
assert.strictEqual(parsed1.reference, 'ABA982341908');

// Format B: Khmer / English ABA Bot notification
const text2 = `
💰 អ្នកបានទទួលប្រាក់ / You received: $49.00
ពី / From: SOK LEANG
សំគាល់ / Memo: ORD-10023
លេខប្រតិបត្តិការ / Ref: 89402819
`;
const parsed2 = telegramMatcher.parseMessageText(text2);
console.log('Parsed Format 2 (Khmer/English ABA):', parsed2);
assert.strictEqual(parsed2.amount, 49.00);
assert.strictEqual(parsed2.currency, 'USD');
assert.strictEqual(parsed2.orderCode, 'ORD-10023');
assert.strictEqual(parsed2.senderName, 'SOK LEANG');

// Format C: KHR Payment notification
const text3 = `
Bakong Payment Received
Amount: KHR 60,000
Sender: HENG VUTH
Bill: ORD-33921
Ref: TXN998822
`;
const parsed3 = telegramMatcher.parseMessageText(text3);
console.log('Parsed Format 3 (KHR Bakong):', parsed3);
assert.strictEqual(parsed3.amount, 60000);
assert.strictEqual(parsed3.currency, 'KHR');
assert.strictEqual(parsed3.orderCode, 'ORD-33921');

console.log('✅ Telegram Message Parser passed all templates!\n');

// 5. Test End-to-End Order Creation & Transaction Matching
console.log('--- Test 5: End-to-End Order Creation & Matching ---');
const testOrder = {
  id: 'test-order-uuid-1',
  orderCode: 'ORD-98421',
  customerName: 'Test Customer',
  totalUsd: 25.50,
  totalKhr: 104550,
  currency: 'USD',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
};

db.createOrder(testOrder);
console.log(`Created test order ${testOrder.orderCode} ($${testOrder.totalUsd})`);

// Simulate incoming ABA message for this order
const matchResult = telegramMatcher.simulateMessage(text1, 'CHAN TITH');
console.log('Match Result:', matchResult);

assert.strictEqual(matchResult.success, true);
assert.strictEqual(matchResult.order.status, 'PAID');
assert.strictEqual(matchResult.order.matchedTransaction.bankRef, 'ABA982341908');
console.log('✅ End-to-End Transaction Matching passed!\n');

console.log('🎉 All tests completed successfully!');
