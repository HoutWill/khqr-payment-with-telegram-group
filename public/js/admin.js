/**
 * CAM-SHOP ADMIN & TELEGRAM MATCHER STUDIO JS
 */

let ordersCache = [];
let logsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadStatsAndOrders();
  loadLogs();
  loadSettings();
  setupSimulator();
  setupSettingsForm();

  // Search & Refresh
  document.getElementById('orderSearchInput').addEventListener('input', filterOrders);
  document.getElementById('refreshOrdersBtn').addEventListener('click', loadStatsAndOrders);
  document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);
});

// ----------------------------------------------------
// TABS SWITCHING
// ----------------------------------------------------
function setupTabs() {
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  const panels = document.querySelectorAll('.admin-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.dataset.target;
      document.getElementById(target).classList.add('active');

      if (target === 'ordersPanel') loadStatsAndOrders();
      if (target === 'logsPanel') loadLogs();
      if (target === 'settingsPanel') loadSettings();
    });
  });
}

// ----------------------------------------------------
// ORDERS & STATS
// ----------------------------------------------------
async function loadStatsAndOrders() {
  try {
    const res = await fetch('/api/admin/orders');
    const data = await res.json();
    if (data.success) {
      ordersCache = data.orders;
      updateStats(ordersCache);
      renderOrdersTable(ordersCache);
    }
  } catch (err) {
    console.error('Failed to load orders:', err);
    showToast('Failed to load orders', 'error');
  }
}

function updateStats(orders) {
  const total = orders.length;
  const paidOrders = orders.filter(o => o.status === 'PAID');
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const matchedOrders = paidOrders.filter(o => o.matchedTransaction && o.matchedTransaction.matchStrategy !== 'MANUAL_ADMIN');
  
  const revenueUsd = paidOrders.reduce((sum, o) => sum + o.totalUsd, 0);

  document.getElementById('statTotalOrders').textContent = total;
  document.getElementById('statPaidRevenue').textContent = `$${revenueUsd.toFixed(2)}`;
  document.getElementById('statMatchedCount').textContent = matchedOrders.length;
  document.getElementById('statPendingCount').textContent = pendingOrders.length;
}

function filterOrders() {
  const q = document.getElementById('orderSearchInput').value.trim().toLowerCase();
  if (!q) {
    renderOrdersTable(ordersCache);
    return;
  }

  const filtered = ordersCache.filter(o => 
    o.orderCode.toLowerCase().includes(q) ||
    (o.customerName && o.customerName.toLowerCase().includes(q)) ||
    (o.customerPhone && o.customerPhone.includes(q)) ||
    (o.matchedTransaction && o.matchedTransaction.bankRef && o.matchedTransaction.bankRef.toLowerCase().includes(q))
  );

  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const timeStr = new Date(order.createdAt).toLocaleString();
    const bankRef = order.matchedTransaction ? order.matchedTransaction.bankRef : '--';
    const isPaid = order.status === 'PAID';

    return `
      <tr>
        <td><strong style="color: var(--accent-cyan); font-family: monospace;">${order.orderCode}</strong></td>
        <td>
          <div><strong>${order.customerName || 'Customer'}</strong></div>
          <small class="text-muted">${order.customerPhone || 'No phone'}</small>
        </td>
        <td><strong>$${order.totalUsd.toFixed(2)}</strong></td>
        <td>៛${order.totalKhr.toLocaleString()}</td>
        <td><span class="status-badge ${order.status}">${order.status}</span></td>
        <td><span style="font-family: monospace; font-size: 0.8rem;">${bankRef}</span></td>
        <td><small>${timeStr}</small></td>
        <td>
          ${!isPaid ? `
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; color: var(--success-green);" onclick="orderAction('${order.id}', 'MARK_PAID')">
              <i class="fa-solid fa-check"></i> Mark Paid
            </button>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger-red);" onclick="orderAction('${order.id}', 'CANCEL')">
              <i class="fa-solid fa-xmark"></i>
            </button>
          ` : `
            <span style="color: var(--success-green); font-size: 0.8rem;"><i class="fa-solid fa-check-double"></i> Verified</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

window.orderAction = async function(orderId, action) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Order updated: ${action}`, 'success');
      loadStatsAndOrders();
    }
  } catch (e) {
    showToast('Failed to perform order action', 'error');
  }
};

// ----------------------------------------------------
// TELEGRAM SIMULATOR STUDIO
// ----------------------------------------------------
function setupSimulator() {
  const textarea = document.getElementById('simMessageText');
  const simSender = document.getElementById('simSender');
  const runBtn = document.getElementById('btnRunSimulation');

  // Templates
  document.getElementById('tplAbaUsd').addEventListener('click', () => {
    textarea.value = 
`🔔 ABA Merchant: Payment Received
Amount: USD 0.01
From: SOK CHANDARA
Remark: ORD-10023
Txn ID: ABA${Math.floor(10000000 + Math.random() * 90000000)}
Date: ${new Date().toLocaleDateString()}`.trim();
  });

  document.getElementById('tplAbaKhmer').addEventListener('click', () => {
    textarea.value = 
`💰 អ្នកបានទទួលប្រាក់ / You received: $0.01
ពី / From: CHAN DARA
សំគាល់ / Memo: ORD-55102
លេខប្រតិបត្តិការ / Ref: ABA${Math.floor(10000000 + Math.random() * 90000000)}`.trim();
  });

  document.getElementById('tplBakongKhr').addEventListener('click', () => {
    textarea.value = 
`Bakong Payment Received
Amount: KHR 41
Sender: HENG VUTH
Bill: ORD-33921
Ref: BAK${Math.floor(10000000 + Math.random() * 90000000)}`.trim();
  });

  document.getElementById('tplMatchPending').addEventListener('click', () => {
    const pending = ordersCache.find(o => o.status === 'PENDING');
    if (!pending) {
      showToast('No pending orders right now. Create an order in the shop first!', 'warning');
      return;
    }
    textarea.value = 
`🔔 ABA Merchant: Payment Received
Amount: USD ${pending.totalUsd.toFixed(2)}
From: SOK CHANDARA
Remark: ${pending.orderCode}
Txn ID: ABA${Math.floor(10000000 + Math.random() * 90000000)}
Date: ${new Date().toLocaleDateString()}`.trim();
    showToast(`Loaded pending order ${pending.orderCode} ($${pending.totalUsd}) into simulator!`, 'info');
  });

  // Run Simulation
  runBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    const sender = simSender.value.trim();

    if (!text) {
      showToast('Please enter or select a simulated Telegram message', 'warning');
      return;
    }

    runBtn.disabled = true;
    runBtn.innerHTML = `<div class="spinner" style="width: 18px; height: 18px; margin: 0;"></div> Processing Match...`;

    try {
      const res = await fetch('/api/admin/simulate-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, senderName: sender })
      });

      const data = await res.json();
      renderSimulationResult(data);
      loadStatsAndOrders();
      loadLogs();

      if (data.matched) {
        showToast(`🎉 Transaction matched order ${data.result.order.orderCode}!`, 'success');
      } else {
        showToast(`Parsed, but no pending order matched: ${data.result.reason}`, 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Simulation failed to execute', 'error');
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send & Match Message`;
    }
  });
}

function renderSimulationResult(data) {
  const result = data.result || {};
  const log = result.log || {};

  const statusEl = document.getElementById('resMatchStatus');
  if (data.matched) {
    statusEl.innerHTML = `<span style="color: var(--success-green);"><i class="fa-solid fa-circle-check"></i> MATCHED & COMPLETED (Order: ${result.order.orderCode})</span>`;
  } else {
    statusEl.innerHTML = `<span style="color: var(--warning-yellow);"><i class="fa-solid fa-triangle-exclamation"></i> UNMATCHED (${result.reason || 'No pending order'})</span>`;
  }

  document.getElementById('resOrderCode').textContent = log.parsedOrderCode || 'Not specified';
  document.getElementById('resAmount').textContent = log.parsedAmount ? `${log.parsedAmount} ${log.parsedCurrency}` : 'Not found';
  document.getElementById('resCurrency').textContent = log.parsedCurrency || '--';
  document.getElementById('resSender').textContent = log.senderName || '--';
  document.getElementById('resRef').textContent = log.reference || '--';
  document.getElementById('resStrategy').textContent = log.matchStrategy || '--';

  document.getElementById('simulationOutputDetails').innerHTML = `
    <pre style="color: var(--accent-cyan); font-size: 0.78rem; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
  `;
}

// ----------------------------------------------------
// MATCH LOGS
// ----------------------------------------------------
async function loadLogs() {
  try {
    const res = await fetch('/api/admin/logs');
    const data = await res.json();
    if (data.success) {
      logsCache = data.logs;
      renderLogsTable(logsCache);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No logs recorded yet</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const timeStr = new Date(log.timestamp).toLocaleTimeString();
    return `
      <tr>
        <td><small>${timeStr}</small></td>
        <td><span class="bank-tag" style="font-size: 0.72rem;">${log.source}</span></td>
        <td><strong style="color: var(--accent-cyan); font-family: monospace;">${log.parsedOrderCode || '--'}</strong></td>
        <td>${log.parsedAmount ? `${log.parsedAmount} ${log.parsedCurrency}` : '--'}</td>
        <td>${log.senderName || '--'}</td>
        <td><small style="font-family: monospace;">${log.reference || '--'}</small></td>
        <td>
          ${log.matched ? `
            <span class="status-badge PAID"><i class="fa-solid fa-check"></i> ${log.matchedOrderCode}</span>
          ` : `
            <span class="status-badge EXPIRED"><i class="fa-solid fa-xmark"></i> Unmatched</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// SETTINGS
// ----------------------------------------------------
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (data.success) {
      const s = data.settings;
      if (s.telegramBotToken) document.getElementById('setTelegramToken').value = s.telegramBotToken;
      if (s.telegramGroupId) document.getElementById('setTelegramGroup').value = s.telegramGroupId;
      document.getElementById('setTelegramEnabled').checked = !!s.telegramEnabled;
      document.getElementById('setAutoReply').checked = s.autoReplyTelegram !== false;
      if (s.telegramApiId) document.getElementById('setTelegramApiId').value = s.telegramApiId;
      if (s.telegramApiHash) document.getElementById('setTelegramApiHash').value = s.telegramApiHash;
      if (s.telegramSession) document.getElementById('setTelegramSession').value = s.telegramSession;
      document.getElementById('setBakongId').value = s.bakongAccountId || '';
      document.getElementById('setMerchantName').value = s.merchantName || '';
      document.getElementById('setMerchantCity').value = s.merchantCity || 'Phnom Penh';
      document.getElementById('setExchangeRate').value = s.exchangeRateUsdToKhr || 4100;
      document.getElementById('setExpiry').value = s.orderExpiryMinutes || 15;
    }
  } catch (e) {
    console.error(e);
  }
}

function setupSettingsForm() {
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      telegramBotToken: document.getElementById('setTelegramToken').value,
      telegramGroupId: document.getElementById('setTelegramGroup').value,
      telegramEnabled: document.getElementById('setTelegramEnabled').checked,
      autoReplyTelegram: document.getElementById('setAutoReply').checked,
      telegramApiId: document.getElementById('setTelegramApiId').value,
      telegramApiHash: document.getElementById('setTelegramApiHash').value,
      telegramSession: document.getElementById('setTelegramSession').value,
      bakongAccountId: document.getElementById('setBakongId').value,
      merchantName: document.getElementById('setMerchantName').value,
      merchantCity: document.getElementById('setMerchantCity').value,
      exchangeRateUsdToKhr: document.getElementById('setExchangeRate').value,
      orderExpiryMinutes: document.getElementById('setExpiry').value
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved and Telegram bot updated successfully!', 'success');
      }
    } catch (err) {
      showToast('Failed to save settings', 'error');
    }
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  if (type === 'error') icon = 'fa-circle-xmark';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
