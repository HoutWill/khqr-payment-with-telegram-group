/**
 * CAM-SHOP FRONTEND APPLICATION LOGIC
 * Dynamic KHQR, ABA Deep-Link & Real-Time Telegram Matcher
 */

// Application State
const state = {
  products: [],
  cart: [],
  activeCategory: 'All',
  searchQuery: '',
  exchangeRate: 4100,
  currentOrder: null,
  countdownInterval: null,
  eventSource: null,
  statusPollInterval: null
};

// DOM Elements
const elements = {
  productGrid: document.getElementById('productGrid'),
  categoryTabs: document.getElementById('categoryTabs'),
  visibleProductsCount: document.getElementById('visibleProductsCount'),
  searchInput: document.getElementById('searchInput'),
  clearSearch: document.getElementById('clearSearch'),
  headerExchangeRate: document.getElementById('headerExchangeRate'),
  
  // Cart
  cartToggleBtn: document.getElementById('cartToggleBtn'),
  cartDrawer: document.getElementById('cartDrawer'),
  cartDrawerBackdrop: document.getElementById('cartDrawerBackdrop'),
  closeCartBtn: document.getElementById('closeCartBtn'),
  cartCountBadge: document.getElementById('cartCountBadge'),
  drawerItemCount: document.getElementById('drawerItemCount'),
  cartItemsContainer: document.getElementById('cartItemsContainer'),
  cartFooter: document.getElementById('cartFooter'),
  cartSubtotalUsd: document.getElementById('cartSubtotalUsd'),
  cartShippingUsd: document.getElementById('cartShippingUsd'),
  cartTotalUsd: document.getElementById('cartTotalUsd'),
  cartTotalKhr: document.getElementById('cartTotalKhr'),
  freeShippingPromo: document.getElementById('freeShippingPromo'),
  amountForFreeShipping: document.getElementById('amountForFreeShipping'),
  proceedToCheckoutBtn: document.getElementById('proceedToCheckoutBtn'),
  startShoppingBtn: document.getElementById('startShoppingBtn'),
  
  // Checkout Modal
  checkoutModal: document.getElementById('checkoutModal'),
  closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
  checkoutStepDetails: document.getElementById('checkoutStepDetails'),
  checkoutStepPayment: document.getElementById('checkoutStepPayment'),
  checkoutStepSuccess: document.getElementById('checkoutStepSuccess'),
  checkoutForm: document.getElementById('checkoutForm'),
  miniItemCount: document.getElementById('miniItemCount'),
  miniPayableTotal: document.getElementById('miniPayableTotal'),
  
  // Payment Screen
  payOrderCode: document.getElementById('payOrderCode'),
  countdownTimer: document.getElementById('countdownTimer'),
  merchantDisplayName: document.getElementById('merchantDisplayName'),
  merchantDisplayCity: document.getElementById('merchantDisplayCity'),
  dynamicQrImage: document.getElementById('dynamicQrImage'),
  payAmountPrimary: document.getElementById('payAmountPrimary'),
  payAmountSecondary: document.getElementById('payAmountSecondary'),
  liveStatusText: document.getElementById('liveStatusText'),
  btnOpenAbaApp: document.getElementById('btnOpenAbaApp'),
  btnOpenBakongApp: document.getElementById('btnOpenBakongApp'),
  btnCopyKhqr: document.getElementById('btnCopyKhqr'),
  instructOrderCode: document.getElementById('instructOrderCode'),
  btnSimulateMatchFromModal: document.getElementById('btnSimulateMatchFromModal'),
  
  // Receipt Screen
  recOrderCode: document.getElementById('recOrderCode'),
  recPaidAt: document.getElementById('recPaidAt'),
  recCustomerName: document.getElementById('recCustomerName'),
  recBankRef: document.getElementById('recBankRef'),
  recItemsList: document.getElementById('recItemsList'),
  recSubtotal: document.getElementById('recSubtotal'),
  recShipping: document.getElementById('recShipping'),
  recTotalUsd: document.getElementById('recTotalUsd'),
  recTotalKhr: document.getElementById('recTotalKhr'),
  btnPrintReceipt: document.getElementById('btnPrintReceipt'),
  btnDoneShopping: document.getElementById('btnDoneShopping'),
  
  // Audio & Toast
  successAudio: document.getElementById('successAudio'),
  toastContainer: document.getElementById('toastContainer')
};

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadSavedCart();
  fetchProducts();
  setupEventListeners();
});

function setupEventListeners() {
  // Search
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.clearSearch.style.display = state.searchQuery ? 'block' : 'none';
    renderProducts();
  });

  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearch.style.display = 'none';
    renderProducts();
  });

  // Cart Drawer
  elements.cartToggleBtn.addEventListener('click', openCartDrawer);
  elements.closeCartBtn.addEventListener('click', closeCartDrawer);
  elements.cartDrawerBackdrop.addEventListener('click', closeCartDrawer);
  if (elements.startShoppingBtn) {
    elements.startShoppingBtn.addEventListener('click', closeCartDrawer);
  }

  // Checkout Modal
  elements.proceedToCheckoutBtn.addEventListener('click', () => {
    closeCartDrawer();
    openCheckoutModal();
  });
  elements.closeCheckoutBtn.addEventListener('click', closeCheckoutModal);

  // Currency Radios in Checkout
  document.querySelectorAll('input[name="paymentCurrency"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.currency-option').forEach(opt => opt.classList.remove('active'));
      e.target.closest('.currency-option').classList.add('active');
    });
  });

  // Checkout Form Submit
  elements.checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  // Payment Screen Actions
  elements.btnCopyKhqr.addEventListener('click', copyKhqrPayload);
  elements.payOrderCode.addEventListener('click', copyOrderCode);
  elements.btnSimulateMatchFromModal.addEventListener('click', simulateTelegramMatchForCurrentOrder);

  // Receipt Actions
  elements.btnPrintReceipt.addEventListener('click', () => window.print());
  elements.btnDoneShopping.addEventListener('click', () => {
    closeCheckoutModal();
    clearCart();
  });
}

// ----------------------------------------------------
// PRODUCTS API & RENDERING
// ----------------------------------------------------
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      state.products = data.products;
      renderCategoryTabs(data.categories);
      renderProducts();
    }
  } catch (err) {
    console.error('Failed to load products:', err);
    elements.productGrid.innerHTML = `
      <div class="empty-grid-state">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--danger-red); margin-bottom: 12px;"></i>
        <p>Unable to load products. Please check your network connection.</p>
      </div>
    `;
  }
}

function renderCategoryTabs(categories) {
  elements.categoryTabs.innerHTML = categories.map(cat => `
    <button class="cat-tab ${cat === state.activeCategory ? 'active' : ''}" data-category="${cat}">
      ${cat === 'All' ? 'All Items' : cat}
    </button>
  `).join('');

  elements.categoryTabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.categoryTabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.dataset.category;
      renderProducts();
    });
  });
}

function renderProducts() {
  let filtered = state.products;

  if (state.activeCategory !== 'All') {
    filtered = filtered.filter(p => p.category === state.activeCategory);
  }

  if (state.searchQuery) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(state.searchQuery) ||
      p.description.toLowerCase().includes(state.searchQuery) ||
      p.category.toLowerCase().includes(state.searchQuery)
    );
  }

  elements.visibleProductsCount.textContent = filtered.length;

  if (filtered.length === 0) {
    elements.productGrid.innerHTML = `
      <div class="empty-grid-state">
        <i class="fa-solid fa-box-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 12px;"></i>
        <h4>No products found</h4>
        <p>Try searching for something else or pick a different category.</p>
      </div>
    `;
    return;
  }

  elements.productGrid.innerHTML = filtered.map(product => {
    const khrPrice = Math.round(product.priceUsd * state.exchangeRate).toLocaleString();
    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-image-box">
          <img src="${product.image}" alt="${product.name}" loading="lazy">
          ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
          <span class="product-category">${product.category}</span>
        </div>
        <div class="product-body">
          <div class="product-rating">
            <i class="fa-solid fa-star"></i>
            <strong>${product.rating}</strong>
            <span class="review-count">(${product.reviewsCount} reviews)</span>
          </div>
          <h3 class="product-title">${product.name}</h3>
          <p class="product-desc">${product.description}</p>
          <div class="product-footer">
            <div class="price-container">
              <span class="price-usd">$${product.priceUsd.toFixed(2)}</span>
              <span class="price-khr">៛${khrPrice} KHR</span>
            </div>
            <button class="btn-add-cart" onclick="addToCart('${product.id}')">
              <i class="fa-solid fa-cart-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// CART MANAGEMENT
// ----------------------------------------------------
function loadSavedCart() {
  try {
    const saved = localStorage.getItem('cam_shop_cart');
    if (saved) {
      state.cart = JSON.parse(saved);
      updateCartUI();
    }
  } catch (e) {}
}

function saveCart() {
  localStorage.setItem('cam_shop_cart', JSON.stringify(state.cart));
  updateCartUI();
}

window.addToCart = function(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      priceUsd: product.priceUsd,
      image: product.image,
      quantity: 1
    });
  }

  saveCart();
  showToast(`Added <strong>${product.name}</strong> to cart!`, 'success');
  openCartDrawer();
};

window.updateItemQty = function(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.id !== productId);
  }
  saveCart();
};

window.removeFromCart = function(productId) {
  state.cart = state.cart.filter(i => i.id !== productId);
  saveCart();
  showToast('Item removed from cart', 'info');
};

function clearCart() {
  state.cart = [];
  saveCart();
}

function updateCartUI() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  elements.cartCountBadge.textContent = totalCount;
  elements.drawerItemCount.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  if (state.cart.length === 0) {
    elements.cartItemsContainer.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon"><i class="fa-solid fa-cart-arrow-down"></i></div>
        <h4>Your cart is empty</h4>
        <p>Explore our catalog and add some awesome gear!</p>
        <button class="btn btn-primary start-shopping-btn" onclick="closeCartDrawer()">Browse Store</button>
      </div>
    `;
    elements.cartFooter.style.display = 'none';
    return;
  }

  elements.cartFooter.style.display = 'block';

  // Render items
  elements.cartItemsContainer.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-name" title="${item.name}">${item.name}</div>
        <div class="cart-item-price">$${item.priceUsd.toFixed(2)}</div>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="updateItemQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="updateItemQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Remove item">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  // Calculations
  const subtotalUsd = state.cart.reduce((sum, item) => sum + (item.priceUsd * item.quantity), 0);
  const shippingUsd = 0; // Free shipping
  const totalUsd = subtotalUsd + shippingUsd;
  const totalKhr = Math.round(totalUsd * state.exchangeRate);

  elements.cartSubtotalUsd.textContent = `$${subtotalUsd.toFixed(2)}`;
  elements.cartShippingUsd.textContent = 'FREE';
  elements.cartTotalUsd.textContent = `$${totalUsd.toFixed(2)}`;
  elements.cartTotalKhr.textContent = `៛${totalKhr.toLocaleString()} KHR`;

  elements.freeShippingPromo.style.display = 'none';
}

function openCartDrawer() {
  elements.cartDrawer.classList.add('active');
  elements.cartDrawerBackdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  elements.cartDrawer.classList.remove('active');
  elements.cartDrawerBackdrop.classList.remove('active');
  document.body.style.overflow = '';
}

// ----------------------------------------------------
// CHECKOUT & PAYMENT FLOW
// ----------------------------------------------------
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Your cart is empty!', 'warning');
    return;
  }

  showCheckoutStep('details');

  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalUsd = state.cart.reduce((sum, item) => sum + (item.priceUsd * item.quantity), 0);
  const shippingUsd = 0;
  const totalUsd = subtotalUsd + shippingUsd;

  elements.miniItemCount.textContent = totalCount;
  elements.miniPayableTotal.textContent = `$${totalUsd.toFixed(2)}`;

  elements.checkoutModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  elements.checkoutModal.classList.remove('active');
  document.body.style.overflow = '';
  cleanupLiveListeners();
}

function showCheckoutStep(step) {
  elements.checkoutStepDetails.classList.remove('active');
  elements.checkoutStepPayment.classList.remove('active');
  elements.checkoutStepSuccess.classList.remove('active');

  if (step === 'details') elements.checkoutStepDetails.classList.add('active');
  if (step === 'payment') elements.checkoutStepPayment.classList.add('active');
  if (step === 'success') elements.checkoutStepSuccess.classList.add('active');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const customer = {
    name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    address: document.getElementById('customerAddress').value.trim(),
    notes: document.getElementById('customerNotes').value.trim()
  };

  const currencyInput = document.querySelector('input[name="paymentCurrency"]:checked');
  const currency = currencyInput ? currencyInput.value : 'USD';

  const btn = document.getElementById('generateKhqrBtn');
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner" style="width: 20px; height: 20px; margin: 0;"></div> Generating Dynamic KHQR...`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: state.cart,
        customer,
        currency
      })
    });

    const data = await res.json();
    if (data.success) {
      state.currentOrder = data.order;
      renderPaymentScreen(data.order);
      showCheckoutStep('payment');
      startLiveOrderListeners(data.order.id);
    } else {
      showToast(data.message || 'Error generating order', 'error');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Failed to create order. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-qrcode"></i> <span>Generate KHQR & Pay with ABA</span>`;
  }
}

function renderPaymentScreen(order) {
  elements.payOrderCode.innerHTML = `${order.orderCode} <i class="fa-regular fa-copy"></i>`;
  elements.instructOrderCode.textContent = order.orderCode;

  // QR Image (Use authentic ABA Merchant Card)
  elements.dynamicQrImage.src = '/images/merchant_khqr_cropped.png';

  // Amounts
  if (order.currency === 'KHR') {
    elements.payAmountPrimary.textContent = `៛${order.totalKhr.toLocaleString()} KHR`;
    elements.payAmountSecondary.textContent = `≈ $${order.totalUsd.toFixed(2)} USD`;
  } else {
    elements.payAmountPrimary.textContent = `$${order.totalUsd.toFixed(2)}`;
    elements.payAmountSecondary.textContent = `≈ ៛${order.totalKhr.toLocaleString()} KHR`;
  }

  // Deep links for Mobile Banking Apps
  if (order.deepLinks) {
    elements.btnOpenAbaApp.href = order.deepLinks.abaMobileScheme;
    elements.btnOpenBakongApp.href = order.deepLinks.bakongUniversalLink;
  }

  // Countdown
  startCountdown(order.expiresAt);
}

// ----------------------------------------------------
// REAL-TIME PAYMENT STREAM & MATCHING
// ----------------------------------------------------
function startLiveOrderListeners(orderId) {
  cleanupLiveListeners();

  // 1. Server-Sent Events (SSE)
  try {
    state.eventSource = new EventSource(`/api/orders/${orderId}/stream`);

    state.eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.status === 'PAID') {
          handleOrderPaymentSuccess(payload.order);
        }
      } catch (err) {}
    };

    state.eventSource.onerror = () => {
      // Fallback to polling if SSE encounters issues
      if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
      }
    };
  } catch (err) {
    console.warn('SSE not supported or failed, using polling fallback');
  }

  // 2. Polling Fallback every 2.5 seconds
  state.statusPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      const data = await res.json();
      if (data.success && data.status === 'PAID') {
        // Fetch full order for receipt
        const fullRes = await fetch(`/api/orders/${orderId}`);
        const fullData = await fullRes.json();
        handleOrderPaymentSuccess(fullData.order);
      } else if (data.status === 'EXPIRED') {
        elements.liveStatusText.textContent = '⚠️ Order expired. Please generate a new QR.';
        cleanupLiveListeners();
      }
    } catch (e) {}
  }, 2500);
}

function cleanupLiveListeners() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  if (state.statusPollInterval) {
    clearInterval(state.statusPollInterval);
    state.statusPollInterval = null;
  }
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
    state.countdownInterval = null;
  }
}

function handleOrderPaymentSuccess(order) {
  cleanupLiveListeners();
  state.currentOrder = order;

  // Play audio chime
  try {
    elements.successAudio.currentTime = 0;
    elements.successAudio.play().catch(() => {});
  } catch (e) {}

  showToast(`🎉 Payment verified for ${order.orderCode}!`, 'success');
  renderReceipt(order);
  showCheckoutStep('success');
  clearCart();
}

function renderReceipt(order) {
  elements.recOrderCode.textContent = order.orderCode;
  elements.recPaidAt.textContent = order.paidAt ? new Date(order.paidAt).toLocaleString() : new Date().toLocaleString();
  elements.recCustomerName.textContent = order.customerName || 'Valued Shopper';
  
  const bankRef = order.matchedTransaction ? order.matchedTransaction.bankRef : ('ABA-' + Date.now().toString().slice(-6));
  elements.recBankRef.textContent = bankRef;

  elements.recItemsList.innerHTML = (order.items || []).map(item => `
    <div class="rec-item-row">
      <span class="rec-item-name">${item.quantity}x ${item.name}</span>
      <span class="rec-item-price">$${(item.priceUsd * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  elements.recSubtotal.textContent = `$${order.subtotalUsd.toFixed(2)}`;
  elements.recShipping.textContent = order.shippingUsd === 0 ? 'FREE' : `$${order.shippingUsd.toFixed(2)}`;
  elements.recTotalUsd.textContent = `$${order.totalUsd.toFixed(2)}`;
  elements.recTotalKhr.textContent = `៛${order.totalKhr.toLocaleString()} KHR`;
}

// ----------------------------------------------------
// COUNTDOWN TIMER & UTILITIES
// ----------------------------------------------------
function startCountdown(expiresAt) {
  if (state.countdownInterval) clearInterval(state.countdownInterval);

  const target = new Date(expiresAt).getTime();

  function update() {
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) {
      elements.countdownTimer.textContent = '00:00';
      elements.liveStatusText.textContent = '❌ Payment time expired';
      clearInterval(state.countdownInterval);
      return;
    }

    const mins = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
    const secs = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
    elements.countdownTimer.textContent = `${mins}:${secs}`;
  }

  update();
  state.countdownInterval = setInterval(update, 1000);
}

function copyKhqrPayload() {
  if (!state.currentOrder || !state.currentOrder.khqrString) return;
  navigator.clipboard.writeText(state.currentOrder.khqrString).then(() => {
    showToast('KHQR String copied to clipboard!', 'info');
  }).catch(() => {});
}

function copyOrderCode() {
  if (!state.currentOrder || !state.currentOrder.orderCode) return;
  navigator.clipboard.writeText(state.currentOrder.orderCode).then(() => {
    showToast(`Order Code ${state.currentOrder.orderCode} copied!`, 'info');
  }).catch(() => {});
}

// Quick Test Simulator Button on Checkout Screen
async function simulateTelegramMatchForCurrentOrder() {
  if (!state.currentOrder) return;

  const order = state.currentOrder;
  const simulatedText = `
🔔 ABA Merchant: Payment Received
Amount: USD ${order.totalUsd.toFixed(2)}
From: SOK CHANDARA
Remark: ${order.orderCode}
Txn ID: ABA${Math.floor(10000000 + Math.random() * 90000000)}
Date: ${new Date().toLocaleDateString()}
  `.trim();

  showToast('Simulating ABA Telegram notification...', 'info');

  try {
    const res = await fetch('/api/admin/simulate-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: simulatedText,
        senderName: 'SOK CHANDARA'
      })
    });

    const data = await res.json();
    if (data.matched) {
      showToast('Telegram Bot matched transaction! Updating order...', 'success');
    } else {
      showToast('Match simulation triggered', 'info');
    }
  } catch (err) {
    showToast('Failed to simulate telegram payment', 'error');
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  if (type === 'error') icon = 'fa-circle-xmark';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
