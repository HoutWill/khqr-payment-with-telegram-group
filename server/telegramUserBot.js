/**
 * Telegram MTProto UserBot Client (GramJS)
 * Bypasses Telegram Bot API's "Bot-to-Bot" message restriction
 * Listens to ABA Merchant Bot messages in group as a real user account
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const telegramMatcher = require('./telegramMatcher');
const db = require('./db');

class TelegramUserBot {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async start({ apiId, apiHash, sessionString, targetChatId }) {
    if (!apiId || !apiHash) {
      console.log('Telegram MTProto UserBot: apiId and apiHash required');
      return false;
    }

    try {
      const stringSession = new StringSession(sessionString || '');
      this.client = new TelegramClient(stringSession, Number(apiId), apiHash, {
        connectionRetries: 5,
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('🚀 MTProto UserBot connected successfully to Telegram!');

      // Listen for ALL messages (including ABA Merchant Bot)
      this.client.addEventHandler(async (event) => {
        const msg = event.message;
        if (!msg) return;

        const text = msg.message || msg.text || '';
        if (!text) return;

        // Check if message is relevant (contains amounts, currency, ABA keywords, or Order codes)
        console.log('📩 MTProto UserBot received message:', text.slice(0, 100).replace(/\n/g, ' '));

        // Parse and auto-verify order
        const parsed = telegramMatcher.parseMessageText(text);
        if (parsed && (parsed.orderCode || parsed.amount)) {
          const result = telegramMatcher.processTransactionMatch(parsed, 'MTPROTO_USERBOT', {
            chatId: msg.chatId ? msg.chatId.toString() : targetChatId,
            messageId: msg.id
          });

          if (result.success) {
            console.log(`🎉 MTProto UserBot SUCCESSFULLY AUTO-MATCHED Order ${result.order.orderCode} ($${result.order.totalUsd})!`);
          } else {
            console.log(`ℹ️ MTProto UserBot parsed message, match reason: ${result.reason}`);
          }
        }
      }, new NewMessage({}));

      return true;
    } catch (err) {
      console.error('Failed to start MTProto UserBot:', err.message);
      return false;
    }
  }

  async generateSession({ apiId, apiHash, phoneNumber }) {
    const stringSession = new StringSession('');
    const client = new TelegramClient(stringSession, Number(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phoneNumber || await input.text('Please enter your phone number: '),
      password: async () => await input.text('Please enter your 2FA password (if any): '),
      phoneCode: async () => await input.text('Please enter the Telegram code you received: '),
      onError: (err) => console.log(err),
    });

    const session = client.session.save();
    console.log('User Session Generated:', session);
    return session;
  }
}

const userBot = new TelegramUserBot();
module.exports = userBot;
