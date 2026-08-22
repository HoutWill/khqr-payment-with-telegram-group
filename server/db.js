const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'store.json');

// Default E-Commerce Products (configured for $0.01 testing)
const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Wireless Noise-Cancelling Headphones Pro',
    priceUsd: 0.01,
    category: 'Electronics',
    rating: 4.9,
    reviewsCount: 128,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    description: 'Premium active noise-cancelling wireless over-ear headphones with 40-hour battery life and spatial audio support.',
    badge: 'Best Seller',
    stock: 24
  },
  {
    id: 'prod-2',
    name: 'Ultra-Slim Mechanical Keyboard RGB',
    priceUsd: 0.01,
    category: 'Electronics',
    rating: 4.8,
    reviewsCount: 94,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    description: 'Low-profile mechanical switches with per-key RGB backlighting and Bluetooth 5.2 multi-device connectivity.',
    badge: 'Popular',
    stock: 18
  },
  {
    id: 'prod-3',
    name: 'Titanium Smart Watch Series 8',
    priceUsd: 0.01,
    category: 'Wearables',
    rating: 4.9,
    reviewsCount: 210,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    description: 'AMOLED display, ECG & Blood Oxygen monitoring, GPS navigation, and 7-day extended battery life.',
    badge: 'Featured',
    stock: 15
  },
  {
    id: 'prod-4',
    name: 'Designer Ergonomic Water Bottle 1L',
    priceUsd: 0.01,
    category: 'Beverages',
    rating: 4.7,
    reviewsCount: 65,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
    description: 'Double-walled vacuum insulated stainless steel bottle keeping drinks icy cold for 24 hours or hot for 12 hours.',
    badge: 'Eco-Friendly',
    stock: 40
  },
  {
    id: 'prod-5',
    name: 'Premium Leather Minimalist Wallet',
    priceUsd: 0.01,
    category: 'Accessories',
    rating: 4.8,
    reviewsCount: 88,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80',
    description: 'Handcrafted full-grain leather wallet with RFID blocking protection and quick-access card ejector mechanism.',
    badge: 'Handmade',
    stock: 20
  },
  {
    id: 'prod-6',
    name: 'Fast GaN Power Adapter 65W Triple Port',
    priceUsd: 0.01,
    category: 'Electronics',
    rating: 4.9,
    reviewsCount: 160,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
    description: 'Ultra-compact Gallium Nitride fast charger for laptops, tablets, and smartphones worldwide.',
    badge: 'Trending',
    stock: 35
  }
];

const DEFAULT_SETTINGS = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '8837709483:AAFOAOSt6Z5M9yVR-o8IHQ1eluUVHjesho8',
  telegramGroupId: process.env.TELEGRAM_GROUP_ID || '-1004441499255',
  telegramEnabled: true,
  bakongAccountId: process.env.BAKONG_ACCOUNT_ID || 'abaakhppxxx@abaa',
  merchantAccountId: process.env.MERCHANT_ACCOUNT_ID || '125071714451824',
  merchantName: process.env.MERCHANT_NAME || 'CHHIV SERHOUT',
  merchantCity: process.env.MERCHANT_CITY || 'PHNOM PENH',
  merchantCategoryCode: process.env.MCC_CATEGORY || '4900',
  paywayStore: process.env.PAYWAY_STORE || 'PAYWAY@ABA',
  paywayMerchantId: process.env.PAYWAY_MERCHANT_ID || '1405768',
  merchantPhone: process.env.MERCHANT_PHONE || '031886850',
  exchangeRateUsdToKhr: parseInt(process.env.EXCHANGE_RATE_USD_TO_KHR) || 4100,
  orderExpiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES) || 15,
  autoReplyTelegram: true
};

class Database {
  constructor() {
    this.data = {
      products: DEFAULT_PRODUCTS,
      orders: [],
      telegramLogs: [],
      settings: DEFAULT_SETTINGS
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {
          products: parsed.products && parsed.products.length ? parsed.products : DEFAULT_PRODUCTS,
          orders: parsed.orders || [],
          telegramLogs: parsed.telegramLogs || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
        };
      }
    } catch (err) {
      console.warn('Database load warning (falling back to memory defaults):', err.message);
    }
  }

  save() {
    // In serverless / read-only environments (like Vercel), keep data in-memory without throwing EROFS
    if (process.env.VERCEL) {
      return;
    }
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.warn('Database save warning:', err.message);
    }
  }

  // Products
  getProducts() {
    return this.data.products;
  }

  getProductById(id) {
    return this.data.products.find(p => p.id === id);
  }

  // Orders
  getOrders() {
    return this.data.orders;
  }

  getOrderById(id) {
    return this.data.orders.find(o => o.id === id);
  }

  getOrderByCode(code) {
    return this.data.orders.find(o => o.orderCode.toUpperCase() === code.toUpperCase());
  }

  getPendingOrders() {
    return this.data.orders.filter(o => o.status === 'PENDING');
  }

  createOrder(orderData) {
    const order = {
      id: orderData.id || ('ord-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5)),
      ...orderData
    };
    this.data.orders.unshift(order);
    this.save();
    return order;
  }

  updateOrder(id, updateFields) {
    const index = this.data.orders.findIndex(o => o.id === id);
    if (index !== -1) {
      this.data.orders[index] = {
        ...this.data.orders[index],
        ...updateFields
      };
      this.save();
      return this.data.orders[index];
    }
    return null;
  }

  // Telegram Matcher Logs
  getTelegramLogs() {
    return this.data.telegramLogs;
  }

  addTelegramLog(logEntry) {
    const log = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...logEntry
    };
    this.data.telegramLogs.unshift(log);
    // Keep max 100 logs in memory
    if (this.data.telegramLogs.length > 100) {
      this.data.telegramLogs = this.data.telegramLogs.slice(0, 100);
    }
    this.save();
    return log;
  }

  // Settings
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings
    };
    this.save();
    return this.data.settings;
  }
}

const dbInstance = new Database();
module.exports = dbInstance;
