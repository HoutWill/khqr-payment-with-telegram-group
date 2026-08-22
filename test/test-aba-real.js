const matcher = require('../server/telegramMatcher');

// Real ABA notification formats
const messages = [
  '$0.01 paid by Serhout Chhiv (*774) on Aug 22, 03:31 PM via ABA KHQR (BKRTKHPPXXX) at CHHIV SERHOUT. Trx. ID: 1787389102',
  '៛41 paid by Serhout Chhiv (*774) on Aug 22, 03:31 PM via ABA KHQR at CHHIV SERHOUT. Trx. ID: 1787389103',
  '៛12,000 paid by MENG NIDA (*493) on Aug 22, 02:39 PM via ABA PAY at CHHIV KIHEANG. Trx. ID: 17873843',
  '🔔 ABA Merchant: Payment Received\nAmount: USD 0.01\nFrom: Serhout Chhiv\nRemark: ORD-91533\nTxn ID: ABA99482019'
];

messages.forEach((msg, idx) => {
  console.log(`\n--- Test Message ${idx + 1} ---`);
  console.log('Raw:', msg);
  console.log('Parsed:', matcher.parseMessageText(msg));
});
