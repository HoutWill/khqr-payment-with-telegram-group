# 🇰🇭 KHQR Payment Gateway with Telegram Auto-Verification

A modern, high-performance E-Commerce storefront and automated payment gateway for **Cambodia's KHQR (Bakong & ABA Bank)** with **real-time Telegram matching & verification**.

![KHQR Banner](https://img.shields.io/badge/Payment-KHQR%20Bakong%20%7C%20ABA%20PayWay-red?style=for-the-badge)
![Telegram Bot](https://img.shields.io/badge/Telegram-Matcher%20%26%20MTProto-blue?style=for-the-badge&logo=telegram)
![NodeJS](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)

---

## 🌟 Key Features

- 🛒 **Modern E-Commerce Storefront**: Responsive product grid, instant search, category filters, and slide-out cart.
- 💳 **Dynamic EMVCo KHQR Generator**: Generates genuine Bakong Universal (Tag 29) and ABA PayWay (Tag 30) QR codes with CRC16-CCITT checksums.
- 📱 **Deep Links for Banking Apps**: Instant 1-tap redirect to ABA Mobile and Bakong App.
- 🤖 **Telegram Payment Matcher**:
  - Automatically parses ABA Merchant Bot transaction alerts (USD `$0.01` and KHR `៛41+`).
  - Matches Order Codes (`ORD-XXXXX`) or exact payment amounts in real-time.
  - Server-Sent Events (SSE) stream to instantly update the customer's browser screen to **PAID**.
- ⚡ **MTProto UserBot (GramJS)**: Bypasses Telegram's bot-to-bot group message restrictions to read 100% of ABA Merchant Bot alerts automatically.
- ☁️ **Deploy Anywhere**: Ready for **Vercel** (Serverless), **Render**, **Railway**, or VPS.

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/HoutWill/khqr-payment-with-telegram-group.git
cd khqr-payment-with-telegram-group
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file based on `.env.example`:
```env
PORT=3000
NODE_ENV=production

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_GROUP_ID=-100xxxxxxxxxx
TELEGRAM_ENABLED=true
AUTO_REPLY_TELEGRAM=true

# Merchant Details
MERCHANT_NAME="CHHIV SERHOUT"
MERCHANT_ACCOUNT_ID="125071714451824"
BAKONG_ACCOUNT_ID="abaakhppxxx@abaa"
EXCHANGE_RATE_USD_TO_KHR=4100
```

### 3. Run Locally
```bash
# Start server
npm start

# Or run with auto-reload
npm run dev
```
Open **`http://localhost:3000`** in your browser!

---

## 🔐 1-Time Telegram MTProto Setup (for Direct ABA Bot Reading)
```bash
npm run login-telegram
```

---

## 🌐 Deploy to Vercel
1. Import this repository into [Vercel](https://vercel.com).
2. Set your environment variables in Vercel settings.
3. Open `https://your-domain.vercel.app/api/admin/set-telegram-webhook?url=https://your-domain.vercel.app` to link the Telegram webhook.

---

## 📜 License
MIT License. Created with ❤️ for Cambodian E-Commerce.
