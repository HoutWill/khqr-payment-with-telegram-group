const EventEmitter = require('events');
let TelegramBot = null;
try {
  TelegramBot = require('node-telegram-bot-api');
} catch (e) {
  console.log('node-telegram-bot-api not loaded');
}

let GramJS = null;
try {
  GramJS = require('telegram');
} catch (e) {
  console.log('GramJS not loaded');
}

const db = require('./db');

class TelegramMatcher extends EventEmitter {
  constructor() {
    super();
    this.bot = null;
    this.botToken = null;
    this.groupId = null;
    this.isPolling = false;
    this.gramClient = null;
  }

  /**
   * Initialize or update Telegram Bot connection
   */
  initBot() {
    const settings = db.getSettings();
    const token = settings.telegramBotToken ? settings.telegramBotToken.trim() : '';
    const groupId = settings.telegramGroupId ? settings.telegramGroupId.trim() : '';
    const enabled = settings.telegramEnabled;

    if (!TelegramBot) {
      console.warn('TelegramBot package not available.');
      return;
    }

    // If disabled or missing token, shut down existing bot
    if (!enabled || !token) {
      if (this.bot && this.isPolling) {
        try {
          this.bot.stopPolling();
        } catch (err) {
          console.error('Error stopping telegram polling:', err);
        }
        this.isPolling = false;
        this.bot = null;
      }
      console.log('Telegram Bot listener is currently inactive or not configured.');
      return;
    }

    // In Vercel serverless environment, instantiate without polling
    if (process.env.VERCEL) {
      if (token && (!this.bot || this.botToken !== token)) {
        this.botToken = token;
        this.groupId = groupId;
        this.bot = new TelegramBot(token, { polling: false });
        console.log('🤖 Telegram Bot ready for Vercel Webhooks (polling disabled)');
      }
      return;
    }

    // Reinitialize if token changed or bot not started
    if (this.botToken !== token || !this.bot) {
      if (this.bot && this.isPolling) {
        try { this.bot.stopPolling(); } catch (e) {}
      }

      this.botToken = token;
      this.groupId = groupId;

      try {
        this.bot = new TelegramBot(token, { polling: true });
        this.isPolling = true;

        console.log('🤖 Telegram Bot listener started successfully for group:', groupId || 'Any group');

        // 1. Listen for Group Messages
        this.bot.on('message', (msg) => {
          this.handleIncomingTelegramMessage(msg);
        });

        // 2. Listen for Channel Posts (in case ABA alerts to a Channel)
        this.bot.on('channel_post', (msg) => {
          this.handleIncomingTelegramMessage(msg);
        });

        // 3. Command Handlers
        this.setupBotCommands();

        this.bot.on('polling_error', (err) => {
          console.warn('Telegram polling notice:', err.message);
        });
      } catch (err) {
        console.error('Failed to initialize Telegram Bot:', err.message);
      }
    }
  }

  /**
   * Setup Interactive Bot Commands
   */
  setupBotCommands() {
    if (!this.bot) return;

    // /start command
    this.bot.onText(/\/start/, (msg) => {
      const welcome = 
        `🚀 <b>CAM-SHOP Payment Matcher Bot is Active!</b>\n\n` +
        `Chat ID: <code>${msg.chat.id}</code>\n` +
        `Merchant: <b>${db.getSettings().merchantName || 'CHHIV SERHOUT'}</b>\n\n` +
        `📋 <b>Available Commands:</b>\n` +
        `• <code>/pending</code> - List current active pending orders\n` +
        `• <code>/verify &lt;ORDER_CODE&gt;</code> - Manually verify an order\n` +
        `• <code>/stats</code> - View today's payment stats\n\n` +
        `💡 <i>Forward or paste any ABA Bank transaction alert into this chat to auto-verify!</i>`;

      this.bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'HTML' });
    });

    // /pending command
    this.bot.onText(/\/pending/, (msg) => {
      const pending = db.getPendingOrders();
      if (pending.length === 0) {
        return this.bot.sendMessage(msg.chat.id, `✅ <b>No pending orders!</b> All orders have been completed or expired.`, { parse_mode: 'HTML' });
      }

      let text = `⏳ <b>Active Pending Orders (${pending.length}):</b>\n━━━━━━━━━━━━━━━━━━\n`;
      pending.forEach((o, i) => {
        text += `${i + 1}. <b>${o.orderCode}</b> — <b>$${o.totalUsd.toFixed(2)}</b> (៛${o.totalKhr.toLocaleString()})\n`;
        text += `   👤 ${o.customerName || 'Customer'} | 📞 ${o.customerPhone || 'N/A'}\n\n`;
      });
      text += `💡 <i>Send ABA alert with the Order Code to auto-complete!</i>`;

      this.bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    });

    // /verify command (manual verification via Telegram)
    this.bot.onText(/\/verify\s*(.*)/, (msg, match) => {
      const targetCode = match[1] ? match[1].trim().toUpperCase() : '';
      if (!targetCode) {
        return this.bot.sendMessage(msg.chat.id, `⚠️ Please specify an order code. Example: <code>/verify ORD-87664</code>`, { parse_mode: 'HTML' });
      }

      const order = db.getOrderByCode(targetCode);
      if (!order) {
        return this.bot.sendMessage(msg.chat.id, `❌ Order <b>${targetCode}</b> not found in database.`, { parse_mode: 'HTML' });
      }

      if (order.status === 'PAID') {
        return this.bot.sendMessage(msg.chat.id, `ℹ️ Order <b>${order.orderCode}</b> is ALREADY PAID.`, { parse_mode: 'HTML' });
      }

      const paidAt = new Date().toISOString();
      const updated = db.updateOrder(order.id, {
        status: 'PAID',
        paidAt,
        matchedTransaction: {
          senderName: msg.from ? (msg.from.first_name || msg.from.username) : 'Telegram Admin',
          amount: order.totalUsd,
          currency: order.currency,
          bankRef: 'TG-ADMIN-' + Date.now().toString().slice(-6),
          matchedAt: paidAt,
          matchStrategy: 'TELEGRAM_COMMAND'
        }
      });

      this.emit('orderPaid', updated);

      const reply = 
        `✅ <b>Order Verified via Telegram!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Order:</b> <code>${updated.orderCode}</code>\n` +
        `💰 <b>Amount:</b> $${updated.totalUsd.toFixed(2)} (${updated.totalKhr.toLocaleString()} KHR)\n` +
        `👤 <b>Customer:</b> ${updated.customerName}\n` +
        `🟢 <b>Status:</b> PAID`;

      this.bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' });
    });

    // /stats command
    this.bot.onText(/\/stats/, (msg) => {
      const orders = db.getOrders();
      const paid = orders.filter(o => o.status === 'PAID');
      const pending = orders.filter(o => o.status === 'PENDING');
      const revenue = paid.reduce((sum, o) => sum + o.totalUsd, 0);

      const stats = 
        `📊 <b>CAM-SHOP Store Statistics:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📦 Total Orders: <b>${orders.length}</b>\n` +
        `🟢 Paid Orders: <b>${paid.length}</b>\n` +
        `⏳ Pending Orders: <b>${pending.length}</b>\n` +
        `💵 Total Revenue: <b>$${revenue.toFixed(2)} USD</b>\n` +
        `🏦 Merchant: <b>${db.getSettings().merchantName || 'CHHIV SERHOUT'}</b>`;

      this.bot.sendMessage(msg.chat.id, stats, { parse_mode: 'HTML' });
    });
  }

  /**
   * Parse arbitrary Telegram alert message text from ABA Bot or Bakong
   */
  parseMessageText(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const result = {
      rawText: text,
      amount: null,
      currency: 'USD',
      orderCode: null,
      senderName: null,
      reference: null,
      matched: false
    };

    // 1. Match Order Code (e.g. ORD-12345 or ORD12345 or #ORD-12345)
    const orderCodeMatch = text.match(/(?:#|\b)(ORD-?[A-Z0-9]{4,10})\b/i);
    if (orderCodeMatch) {
      let code = orderCodeMatch[1].toUpperCase();
      if (!code.includes('-') && code.startsWith('ORD')) {
        code = 'ORD-' + code.substring(3);
      }
      result.orderCode = code;
    }

    // 2. Match Currency and Amount
    // Handles $0.01, USD 0.01, 0.01 USD, 41 KHR, KHR 41, 41៛, 60,000 KHR, etc.
    const usdPattern = /(?:\$|USD)\s*([0-9]+(?:\.[0-9]{1,2})?)|([0-9]+(?:\.[0-9]{1,2})?)\s*(?:\$|USD)/i;
    const khrPattern = /(?:KHR|៛|រៀល)\s*([0-9,]+)|([0-9,]+)\s*(?:KHR|៛|រៀល)/i;

    const usdMatch = text.match(usdPattern);
    const khrMatch = text.match(khrPattern);

    if (usdMatch) {
      const rawVal = usdMatch[1] || usdMatch[2];
      result.amount = parseFloat(rawVal);
      result.currency = 'USD';
    } else if (khrMatch) {
      const rawVal = (khrMatch[1] || khrMatch[2]).replace(/,/g, '');
      result.amount = parseFloat(rawVal);
      result.currency = 'KHR';
    } else {
      const generalAmountMatch = text.match(/(?:Amount|Received|Paid|ចំនួនទឹកប្រាក់|ប្រាក់):\s*(?:[\$|USD|KHR])?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
      if (generalAmountMatch) {
        result.amount = parseFloat(generalAmountMatch[1]);
        result.currency = 'USD';
      }
    }

    // 3. Match Sender Name
    const senderMatch = text.match(/paid\s+by\s+([A-Za-z\s]+?)(?:\s*\(\*\d+\))?\s+on/i) ||
                        text.match(/(?:From|Sender|ពី|ឈ្មោះអ្នកផ្ញើ):\s*([A-Za-z0-9\s._-]+?)(?:\n|\r|Remark|Memo|Txn|Ref|Date|$)/i);
    if (senderMatch) {
      result.senderName = senderMatch[1].trim();
    }

    // 4. Match Reference / Transaction ID
    const refMatch = text.match(/(?:Trx\.\s*ID|Txn\s*ID|Transaction\s*ID|Ref|TID|Trace|លេខប្រតិបត្តិការ):\s*([A-Za-z0-9_-]+)/i);
    if (refMatch) {
      result.reference = refMatch[1].trim();
    }

    return result;
  }

  /**
   * Process a parsed message or incoming text and match against pending orders
   */
  processTransactionMatch(parsedData, source = 'TELEGRAM_BOT', extraMeta = {}) {
    if (!parsedData) return { success: false, reason: 'Invalid parsed data' };

    const pendingOrders = db.getPendingOrders();
    let matchedOrder = null;
    let matchStrategy = 'NONE';

    // Strategy 1: Match by explicit Order Code in Memo/Remark
    if (parsedData.orderCode) {
      const targetCode = parsedData.orderCode.toUpperCase();
      matchedOrder = pendingOrders.find(o => o.orderCode.toUpperCase() === targetCode);
      if (matchedOrder) {
        matchStrategy = 'ORDER_CODE_EXACT';
      }
    }

    // Strategy 2: Match by exact amount if single unique matching order within time window
    if (!matchedOrder && parsedData.amount) {
      const amountMatches = pendingOrders.filter(o => {
        if (parsedData.currency === 'USD') {
          return Math.abs(o.totalUsd - parsedData.amount) < 0.01;
        } else if (parsedData.currency === 'KHR') {
          return Math.abs(o.totalKhr - parsedData.amount) <= 100;
        }
        return false;
      });

      if (amountMatches.length === 1) {
        matchedOrder = amountMatches[0];
        matchStrategy = 'AMOUNT_EXACT_UNIQUE';
      } else if (amountMatches.length > 1) {
        matchedOrder = amountMatches[0];
        matchStrategy = 'AMOUNT_MOST_RECENT';
      }
    }

    let logEntry = {
      source,
      rawText: parsedData.rawText,
      parsedAmount: parsedData.amount,
      parsedCurrency: parsedData.currency,
      parsedOrderCode: parsedData.orderCode,
      senderName: parsedData.senderName || 'Anonymous Customer',
      reference: parsedData.reference || ('REF-' + Date.now().toString().slice(-6)),
      matchStrategy,
      matched: !!matchedOrder,
      matchedOrderId: matchedOrder ? matchedOrder.id : null,
      matchedOrderCode: matchedOrder ? matchedOrder.orderCode : null,
      meta: extraMeta
    };

    if (matchedOrder) {
      // Mark order as PAID
      const paidAt = new Date().toISOString();
      const updatedOrder = db.updateOrder(matchedOrder.id, {
        status: 'PAID',
        paidAt,
        matchedTransaction: {
          senderName: logEntry.senderName,
          amount: logEntry.parsedAmount,
          currency: logEntry.parsedCurrency,
          bankRef: logEntry.reference,
          matchedAt: paidAt,
          matchStrategy
        }
      });

      logEntry.matched = true;
      db.addTelegramLog(logEntry);

      // Emit real-time event for SSE / WebSockets
      this.emit('orderPaid', updatedOrder);

      return {
        success: true,
        order: updatedOrder,
        log: logEntry,
        matchStrategy
      };
    } else {
      db.addTelegramLog(logEntry);
      return {
        success: false,
        reason: 'No matching pending order found',
        log: logEntry
      };
    }
  }

  /**
   * Handle incoming raw Telegram message from group or channel
   */
  async handleIncomingTelegramMessage(msg) {
    // Ignore command messages (they are handled by onText)
    if (msg.text && msg.text.startsWith('/')) return;

    const text = msg.text || msg.caption || '';
    if (!text) return;

    const settings = db.getSettings();
    const configuredGroupId = settings.telegramGroupId ? String(settings.telegramGroupId).trim() : '';

    // If specific group ID is configured, filter by it
    if (configuredGroupId && String(msg.chat.id) !== configuredGroupId) {
      return;
    }

    console.log('📩 Telegram message received:', msg.chat.title || msg.chat.id, '| Text:', text.slice(0, 60));

    const parsed = this.parseMessageText(text);
    const result = this.processTransactionMatch(parsed, 'TELEGRAM_BOT', {
      chatId: msg.chat.id,
      chatTitle: msg.chat.title,
      messageId: msg.message_id,
      fromUser: msg.from ? (msg.from.username || msg.from.first_name) : 'Channel'
    });

    // Auto-reply back to Telegram group if matched
    if (result.success && settings.autoReplyTelegram && this.bot) {
      try {
        const order = result.order;
        const replyText = 
          `✅ <b>Payment Verified & Matched!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Order:</b> <code>${order.orderCode}</code>\n` +
          `💰 <b>Amount:</b> $${order.totalUsd.toFixed(2)} (${order.totalKhr.toLocaleString()} KHR)\n` +
          `👤 <b>Customer:</b> ${order.customerName || 'Online Shopper'}\n` +
          `🏦 <b>Bank Ref:</b> <code>${result.log.reference}</code>\n` +
          `⏱ <b>Status:</b> 🟢 PAID (Auto-Completed)`;

        await this.bot.sendMessage(msg.chat.id, replyText, {
          parse_mode: 'HTML',
          reply_to_message_id: msg.message_id
        });
      } catch (replyErr) {
        console.error('Failed to send Telegram auto-reply:', replyErr.message);
      }
    }
  }

  /**
   * Test / Simulate an incoming Telegram message (used by Admin Dashboard and API)
   */
  simulateMessage(text, senderName = 'ABA Merchant Simulation') {
    const parsed = this.parseMessageText(text);
    if (senderName && !parsed.senderName) {
      parsed.senderName = senderName;
    }
    return this.processTransactionMatch(parsed, 'SIMULATOR', { simulated: true });
  }
}

const matcher = new TelegramMatcher();
module.exports = matcher;
