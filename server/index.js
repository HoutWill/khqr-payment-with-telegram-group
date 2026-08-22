const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const db = require('./db');
const { generateKHQR, generateDeepLinks } = require('./khqr');
const telegramMatcher = require('./telegramMatcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize Telegram Bot
telegramMatcher.initBot();

// Start MTProto UserBot only in persistent server environments (local / Render / VPS)
if (!process.env.VERCEL) {
  try {
    const telegramUserBot = require('./telegramUserBot');
    const session = process.env.TELEGRAM_SESSION || db.getSettings().telegramSession;
    const apiId = process.env.TELEGRAM_API_ID || db.getSettings().telegramApiId;
    const apiHash = process.env.TELEGRAM_API_HASH || db.getSettings().telegramApiHash;
    const groupId = process.env.TELEGRAM_GROUP_ID || db.getSettings().telegramGroupId;

    if (session && apiId && apiHash) {
      telegramUserBot.start({
        apiId,
        apiHash,
        sessionString: session,
        targetChatId: groupId
      });
    }
  } catch (err) {
    console.warn('MTProto UserBot init skipped:', err.message);
  }
}

// Generate Random 5-Digit Order Code
function generateOrderCode() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ORD-${num}`;
}

// ----------------------------------------------------
// API ROUTER (Mounts to both /api and / for Vercel)
// ----------------------------------------------------
const api = express.Router();

// 1. PRODUCTS API
api.get('/products', (req, res) => {
  const products = db.getProducts();
  const categories = ['All', ...new Set(products.map(p => p.category))];
  res.json({ success: true, products, categories });
});

// 2. CREATE ORDER & GENERATE DYNAMIC KHQR
api.post('/orders', async (req, res) => {
  try {
    const { items, customer, currency = 'USD' } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const allProducts = db.getProducts();
    let subtotalUsd = 0;
    const orderItems = [];

    for (const item of items) {
      const product = allProducts.find(p => p.id === item.id);
      if (product) {
        const qty = parseInt(item.quantity) || 1;
        const lineTotal = product.priceUsd * qty;
        subtotalUsd += lineTotal;
        orderItems.push({
          id: product.id,
          name: product.name,
          priceUsd: product.priceUsd,
          quantity: qty,
          image: product.image,
          category: product.category,
          subtotalUsd: lineTotal
        });
      }
    }

    const settings = db.getSettings();
    const exchangeRate = settings.exchangeRateUsdToKhr || 4100;
    const shippingUsd = 0.00; // Free delivery for testing
    const totalUsd = Math.round((subtotalUsd + shippingUsd) * 100) / 100;
    const totalKhr = Math.round(totalUsd * exchangeRate);

    const orderCode = generateOrderCode();
    const now = new Date();
    const expiryMinutes = settings.orderExpiryMinutes || 15;
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();

    const khqrCurrency = currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD';
    const khqrAmount = khqrCurrency === 'KHR' ? totalKhr : totalUsd;

    const khqrString = generateKHQR({
      bakongAccountId: settings.bakongAccountId || 'abaakhppxxx@abaa',
      acquiringBank: 'ABA Bank',
      merchantName: settings.merchantName || 'CHHIV SERHOUT',
      merchantCity: settings.merchantCity || 'PHNOM PENH',
      amount: khqrAmount,
      currency: khqrCurrency,
      orderId: orderCode
    });

    // Generate High-Res QR Code Data URL (PNG)
    const qrDataUrl = await QRCode.toDataURL(khqrString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#0e1e38',
        light: '#ffffff'
      }
    });

    // Generate Banking App Deep Links
    const deepLinks = generateDeepLinks(khqrString, {
      bakongAccountId: settings.bakongAccountId,
      amount: khqrAmount,
      currency: khqrCurrency,
      orderId: orderCode
    });

    const newOrder = {
      orderCode,
      customerName: customer ? customer.name : 'Valued Customer',
      customerPhone: customer ? customer.phone : '',
      customerAddress: customer ? customer.address : '',
      notes: customer ? customer.notes : '',
      items: orderItems,
      subtotalUsd,
      shippingUsd,
      totalUsd,
      totalKhr,
      exchangeRate,
      currency: khqrCurrency,
      khqrString,
      qrDataUrl,
      deepLinks,
      status: 'PENDING',
      createdAt: now.toISOString(),
      expiresAt,
      paidAt: null,
      matchedTransaction: null
    };

    const savedOrder = db.createOrder(newOrder);

    res.status(201).json({
      success: true,
      order: savedOrder,
      merchant: {
        name: settings.merchantName || 'CHHIV SERHOUT',
        bakongId: settings.bakongAccountId || 'abaakhppxxx@abaa',
        city: settings.merchantCity || 'PHNOM PENH'
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Server error while generating KHQR order' });
  }
});

// 3. GET ORDER DETAILS & STATUS (Supports both /orders/:id and /orders/:id/status)
api.get(['/orders/:id', '/orders/:id/status'], (req, res) => {
  const orderId = req.params.id;
  let order = db.getOrderById(orderId);
  if (!order) {
    order = db.getOrderByCode(orderId);
  }

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  // Check if order expired
  if (order.status === 'PENDING' && new Date() > new Date(order.expiresAt)) {
    order = db.updateOrder(order.id, { status: 'EXPIRED' });
  }

  res.json({
    success: true,
    status: order.status,
    paidAt: order.paidAt,
    matchedTransaction: order.matchedTransaction,
    order
  });
});

// 4. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
api.get('/orders/:id/stream', (req, res) => {
  const orderId = req.params.id;
  const order = db.getOrderById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'STATUS', status: order.status, order })}\n\n`);

  // Listener for instant payment match
  const onOrderPaid = (paidOrder) => {
    if (paidOrder.id === orderId) {
      res.write(`data: ${JSON.stringify({ type: 'PAID', status: 'PAID', order: paidOrder })}\n\n`);
    }
  };

  telegramMatcher.on('orderPaid', onOrderPaid);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    telegramMatcher.off('orderPaid', onOrderPaid);
    clearInterval(heartbeat);
  });
});

// 4.1 TELEGRAM WEBHOOK ENDPOINT (FOR VERCEL SERVERLESS)
api.post('/telegram-webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update && (update.message || update.channel_post)) {
      const msg = update.message || update.channel_post;
      await telegramMatcher.handleIncomingTelegramMessage(msg);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// 4.2 SET WEBHOOK HELPER
api.get('/admin/set-telegram-webhook', async (req, res) => {
  const { url } = req.query;
  const token = process.env.TELEGRAM_BOT_TOKEN || db.getSettings().telegramBotToken;
  if (!token) return res.status(400).json({ success: false, message: 'No Bot Token configured' });
  if (!url) return res.status(400).json({ success: false, message: 'Missing url parameter (e.g. ?url=https://your-shop.vercel.app)' });

  try {
    const webhookUrl = `${url.replace(/\/$/, '')}/api/telegram-webhook`;
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();
    res.json({ success: tgData.ok, result: tgData, webhookUrl });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 5. ADMIN & TELEGRAM MATCHER ENDPOINTS
api.get('/admin/orders', (req, res) => {
  const orders = db.getOrders();
  res.json({ success: true, orders });
});

api.get('/admin/logs', (req, res) => {
  const logs = db.getTelegramLogs();
  res.json({ success: true, logs });
});

api.post('/admin/simulate-telegram', (req, res) => {
  const { text, senderName } = req.body;
  if (!text) {
    return res.status(400).json({ success: false, message: 'Telegram message text is required' });
  }

  const result = telegramMatcher.simulateMessage(text, senderName);
  res.json({
    success: true,
    matched: result.matched,
    result
  });
});

api.get('/admin/settings', (req, res) => {
  const settings = db.getSettings();
  const maskedToken = settings.telegramBotToken
    ? settings.telegramBotToken.slice(0, 8) + '...' + settings.telegramBotToken.slice(-4)
    : '';

  res.json({
    success: true,
    settings: {
      ...settings,
      maskedToken,
      hasRealToken: !!settings.telegramBotToken
    }
  });
});

api.post('/admin/settings', (req, res) => {
  const {
    telegramBotToken,
    telegramGroupId,
    telegramEnabled,
    telegramApiId,
    telegramApiHash,
    telegramSession,
    bakongAccountId,
    merchantName,
    merchantCity,
    exchangeRateUsdToKhr,
    orderExpiryMinutes,
    autoReplyTelegram
  } = req.body;

  const updates = {};

  if (telegramBotToken !== undefined) updates.telegramBotToken = telegramBotToken.trim();
  if (telegramGroupId !== undefined) updates.telegramGroupId = telegramGroupId.trim();
  if (telegramEnabled !== undefined) updates.telegramEnabled = Boolean(telegramEnabled);
  if (telegramApiId !== undefined) updates.telegramApiId = telegramApiId.trim();
  if (telegramApiHash !== undefined) updates.telegramApiHash = telegramApiHash.trim();
  if (telegramSession !== undefined) updates.telegramSession = telegramSession.trim();
  if (bakongAccountId !== undefined) updates.bakongAccountId = bakongAccountId.trim();
  if (merchantName !== undefined) updates.merchantName = merchantName.trim();
  if (merchantCity !== undefined) updates.merchantCity = merchantCity.trim();
  if (exchangeRateUsdToKhr !== undefined) updates.exchangeRateUsdToKhr = Number(exchangeRateUsdToKhr);
  if (orderExpiryMinutes !== undefined) updates.orderExpiryMinutes = Number(orderExpiryMinutes);
  if (autoReplyTelegram !== undefined) updates.autoReplyTelegram = Boolean(autoReplyTelegram);

  const newSettings = db.updateSettings(updates);
  telegramMatcher.initBot();

  res.json({ success: true, settings: newSettings });
});

api.post('/admin/orders/:id/action', (req, res) => {
  const { action } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (action === 'MARK_PAID') {
    const paidAt = new Date().toISOString();
    const updated = db.updateOrder(order.id, {
      status: 'PAID',
      paidAt,
      matchedTransaction: {
        senderName: 'Admin Override',
        amount: order.totalUsd,
        currency: order.currency,
        bankRef: 'MANUAL-' + Date.now().toString().slice(-6),
        matchedAt: paidAt,
        matchStrategy: 'MANUAL_ADMIN'
      }
    });
    telegramMatcher.emit('orderPaid', updated);
    return res.json({ success: true, order: updated });
  } else if (action === 'CANCEL') {
    const updated = db.updateOrder(order.id, { status: 'CANCELLED' });
    return res.json({ success: true, order: updated });
  }

  res.status(400).json({ success: false, message: 'Invalid action' });
});

// Mount router on both /api and root (to handle all Vercel and local configurations)
app.use('/api', api);
app.use('/', api);

// Start Server (only when run directly, not when imported on Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 KHQR E-Commerce Server is running on port ${PORT}`);
    console.log(`🛒 Storefront: http://localhost:${PORT}`);
    console.log(`⚙️ Admin & Telegram Studio: http://localhost:${PORT}/admin.html`);
    console.log(`====================================================`);
  });
}

module.exports = app;
