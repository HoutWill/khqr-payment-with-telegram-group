require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error('❌ Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('====================================================');
  console.log('🔐 TELEGRAM MTPROTO 1-TIME LOGIN GENERATOR');
  console.log('====================================================');
  console.log(`Using API ID: ${apiId}`);
  console.log(`Using API Hash: ${apiHash}\n`);

  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await askQuestion('📱 Enter your Telegram Phone Number (e.g. +85512345678): '),
    password: async () => await askQuestion('🔑 Enter your 2FA Cloud Password (if enabled, or press enter): '),
    phoneCode: async () => await askQuestion('📩 Enter the 5-digit Telegram Code you received in Telegram app: '),
    onError: (err) => console.error('Error during login:', err.message),
  });

  const sessionString = client.session.save();
  console.log('\n====================================================');
  console.log('🎉 LOGIN SUCCESSFUL! Session generated.');
  console.log('====================================================\n');

  // Save to .env
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('TELEGRAM_SESSION=')) {
      envContent = envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION=${sessionString}`);
    } else {
      envContent += `\nTELEGRAM_SESSION=${sessionString}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Saved TELEGRAM_SESSION directly to your .env file!');
  }

  // Save to store.json
  const storePath = path.join(__dirname, '..', 'data', 'store.json');
  if (fs.existsSync(storePath)) {
    try {
      const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      if (!storeData.settings) storeData.settings = {};
      storeData.settings.telegramApiId = String(apiId);
      storeData.settings.telegramApiHash = apiHash;
      storeData.settings.telegramSession = sessionString;
      fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf8');
      console.log('✅ Updated store.json settings!');
    } catch (e) {}
  }

  console.log('\n🚀 You are now ready! Your server will now automatically read all ABA Merchant Bot messages directly from your Telegram group with zero restrictions.\n');

  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Login failed:', err);
  rl.close();
  process.exit(1);
});
