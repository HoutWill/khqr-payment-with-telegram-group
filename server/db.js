const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Sample Products
const DEFAULT_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Wireless Noise-Cancelling Headphones Pro',
    category: 'Electronics',
    priceUsd: 0.01,
    rating: 4.9,
    reviewsCount: 128,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    description: 'High-fidelity audio with active noise cancellation, 30-hour battery life, and ultra-comfortable ear cushions.',
    badge: 'Best Seller',
    stock: 25
  },
  {
    id: 'prod-2',
    name: 'Smart Fitness Watch Series 9',
    category: 'Wearables',
    priceUsd: 0.01,
    rating: 4.8,
    reviewsCount: 95,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    description: 'All-day health tracking, AMOLED display, water resistant up to 50m, and fast magnetic charging.',
    badge: 'Popular',
    stock: 18
  },
  {
    id: 'prod-3',
    name: 'Mechanical Gaming Keyboard RGB',
    category: 'Electronics',
    priceUsd: 0.01,
    rating: 4.7,
    reviewsCount: 84,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    description: 'Custom hot-swappable tactile switches, dynamic per-key RGB backlighting, and braided USB-C cable.',
    badge: 'New',
    stock: 30
  },
  {
    id: 'prod-4',
    name: 'Specialty Arabica Coffee Beans (500g)',
    category: 'Beverages',
    priceUsd: 0.01,
    rating: 5.0,
    reviewsCount: 210,
    image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80',
    description: 'Freshly roasted organic single-origin Mondulkiri highland Arabica beans with chocolate & caramel notes.',
    badge: 'Local Favorite',
    stock: 50
  },
  {
    id: 'prod-5',
    name: 'Minimalist Leather Cardholder & Wallet',
    category: 'Accessories',
    priceUsd: 0.01,
    rating: 4.6,
    reviewsCount: 42,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80',
    description: 'Genuine handcrafted top-grain leather with RFID blocking protection and slim pocket fit.',
    badge: null,
    stock: 40
  },
  {
    id: 'prod-6',
    name: '65W GaN Fast Dual USB-C Charger',
    category: 'Electronics',
    priceUsd: 0.01,
    rating: 4.9,
    reviewsCount: 160,
    image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
    description: 'Ultra-compact Gallium Nitride fast charger for laptops, tablets, and smartphones worldwide.',
    badge: 'Trending',
    stock: 35
  }
];

const DEFAULT_SETTINGS = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramGroupId: process.env.TELEGRAM_GROUP_ID || '',
  telegramEnabled: false,
  bakongAccountId: 'abaakhppxxx@abaa',
  merchantAccountId: '125071714451824',
  merchantName: 'CHHIV SERHOUT',
  merchantCity: 'PHNOM PENH',
  merchantCategoryCode: '4900',
  paywayStore: 'PAYWAY@ABA',
  paywayMerchantId: '1405768',
  merchantPhone: '031886850',
  exchangeRateUsdToKhr: 4100,
  orderExpiryMinutes: 15,
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
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database file:', err);
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database file:', err);
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
    return this.data.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getOrderById(id) {
    return this.data.orders.find(o => o.id === id);
  }

  getOrderByCode(orderCode) {
    if (!orderCode) return null;
    const clean = orderCode.trim().toUpperCase();
    return this.data.orders.find(o => o.orderCode.toUpperCase() === clean);
  }

  createOrder(order) {
    this.data.orders.unshift(order);
    this.save();
    return order;
  }

  updateOrder(id, updates) {
    const idx = this.data.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.data.orders[idx] = { ...this.data.orders[idx], ...updates };
      this.save();
      return this.data.orders[idx];
    }
    return null;
  }

  // Pending Orders for Matching
  getPendingOrders() {
    const now = new Date();
    return this.data.orders.filter(o => {
      if (o.status !== 'PENDING') return false;
      if (new Date(o.expiresAt) < now) {
        o.status = 'EXPIRED';
        return false;
      }
      return true;
    });
  }

  // Telegram Logs
  addTelegramLog(log) {
    this.data.telegramLogs.unshift({
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...log
    });
    // Keep last 100 logs
    if (this.data.telegramLogs.length > 100) {
      this.data.telegramLogs = this.data.telegramLogs.slice(0, 100);
    }
    this.save();
  }

  getTelegramLogs() {
    return this.data.telegramLogs;
  }

  // Settings
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

const db = new Database();
module.exports = db;
