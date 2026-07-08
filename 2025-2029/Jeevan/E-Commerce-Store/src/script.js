// ---- THEME TOGGLE ----
function toggleTheme() {
  const root = document.documentElement;
  const isDark = root.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = isDark ? '☀️' : '🌙';
  }
}

// Check saved theme on load
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  const icon = document.getElementById('theme-icon');

  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-mode');
    if (icon) icon.textContent = '☀️';
  } else {
    if (icon) icon.textContent = '🌙';
  }

  renderMenu();
  checkAuthStatus();
});

function checkAuthStatus() {
  const userStr = localStorage.getItem('currentUser');
  const authBtn = document.getElementById('auth-btn');
  if (userStr && authBtn) {
    const user = JSON.parse(userStr);
    authBtn.textContent = 'Logout';
    authBtn.href = '#';
    authBtn.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem('currentUser');
      window.location.reload();
    };
  }
}

// ---- MENU DATA ----
const menuData = [
  { id: 1, name: "Summit Alpine Backpack", desc: "Expedition capacity with durable waterproof materials", price: 899, rating: 4.9, time: "2 Days", badge: "Popular", badgeType: "", category: "backpacks", img: "images/Hiking Backpack.png" },
  { id: 2, name: "Pro Terrain Hiking Boots", desc: "Gore-Tex Core for ultimate weather protection", price: 1299, rating: 4.8, time: "3 Days", badge: "Bestseller", badgeType: "", category: "footwear", img: "images/hiking boots.png" },
  { id: 3, name: "Geodesic Basecamp Tent", desc: "All-Season Fortress for extreme weather", price: 1499, rating: 4.7, time: "5 Days", badge: "Sale", badgeType: "spicy", category: "tents", img: "images/tent.png" },
  { id: 4, name: "Expedition Compass Kit", desc: "Precision Grade Global Needle System", price: 299, rating: 4.8, time: "2 Days", badge: "Essential", badgeType: "veg", category: "accessories", img: "images/compass.png" },
  { id: 5, name: "Titanium Water Flask", desc: "24-Hour Hot/Cold Vacuum Seal", price: 499, rating: 4.9, time: "2 Days", badge: "Popular", badgeType: "", category: "accessories", img: "images/water bottle.png" },
  { id: 6, name: "Himalayan Down Jacket", desc: "Thermal Layer for extreme cold conditions", price: 1899, rating: 4.7, time: "3 Days", badge: "Warm 🔥", badgeType: "spicy", category: "accessories", img: "images/jacket.png" },
  { id: 7, name: "Thermal Sleeping Bag", desc: "-20°C Certified Down Insulation", price: 999, rating: 4.9, time: "4 Days", badge: "Essential", badgeType: "veg", category: "tents", img: "images/bag (1).png" },
  { id: 8, name: "Advanced Trekking Boots", desc: "Vibram Outsole for unmatched grip", price: 1199, rating: 4.8, time: "3 Days", badge: "Popular", badgeType: "", category: "footwear", img: "images/boots.png" },
  { id: 9, name: "Compact Solar Charger", desc: "Fast-charging waterproof solar power bank", price: 1299, rating: 4.6, time: "2 Days", badge: "Sale", badgeType: "spicy", category: "accessories", img: "images/solarcharger1.jpg" },
  { id: 10, name: "Pro Binoculars", desc: "Long-range high-clarity viewing", price: 2499, rating: 4.8, time: "2 Days", badge: "Essential", badgeType: "veg", category: "accessories", img: "images/binocular1.jpg" },
  { id: 11, name: "Trail Running Shoes", desc: "Lightweight, breathable running shoes", price: 899, rating: 4.7, time: "3 Days", badge: "Popular", badgeType: "", category: "footwear", img: "images/boot2.jpg" },
  { id: 12, name: "Survival First Aid Kit", desc: "Complete medical kit for emergencies", price: 699, rating: 4.8, time: "4 Days", badge: "Essential", badgeType: "veg", category: "accessories", img: "images/first aid kit.jpg" },
  { id: 13, name: "Compact Field Binoculars", desc: "Lightweight and durable field optics", price: 1599, rating: 4.5, time: "3 Days", badge: "New", badgeType: "veg", category: "accessories", img: "images/Binocular4.jpg" },
  { id: 14, name: "Alpine Trekking Shoes", desc: "High-ankle support for rugged terrains", price: 1499, rating: 4.9, time: "2 Days", badge: "Premium", badgeType: "spicy", category: "footwear", img: "images/boot4.jpg" },
  { id: 15, name: "Classic Brass Compass", desc: "Vintage design with precise navigation", price: 399, rating: 4.6, time: "2 Days", badge: "Popular", badgeType: "", category: "accessories", img: "images/compass3.png" },
  { id: 16, name: "Polarized Sunglasses", desc: "UV400 protection with glare reduction", price: 799, rating: 4.7, time: "2 Days", badge: "Sale", badgeType: "spicy", category: "accessories", img: "images/glass1.jpg" },
  { id: 17, name: "Ultimate Explorer Bundle", desc: "Complete survival and camping toolkit", price: 4999, rating: 5.0, time: "5 Days", badge: "Bestseller", badgeType: "veg", category: "accessories", img: "images/hiking kit.jpg" },
  { id: 18, name: "Ultralight Solo Tent", desc: "Compact 1-person tent for solo trips", price: 1299, rating: 4.8, time: "4 Days", badge: "Essential", badgeType: "", category: "tents", img: "images/tent 2.png" },
];

let cart = [];
let currentFilter = 'all';

function renderMenu(filter = 'all') {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  const items = filter === 'all' ? menuData : menuData.filter(d => d.category === filter);
  grid.innerHTML = items.map(d => `
    <div class="dish-card" data-id="${d.id}">
      <div class="dish-img-wrap">
        <img class="dish-img" src="${d.img}" alt="${d.name}" loading="lazy" onerror="this.src='images/mountain landscape.png'">
        ${d.badge ? `<span class="dish-badge ${d.badgeType}">${d.badge}</span>` : ''}
        <button class="dish-fav" onclick="toggleFav(this)" title="Favourite">🤍</button>
      </div>
      <div class="dish-info">
        <div class="dish-name">${d.name}</div>
        <div class="dish-desc">${d.desc}</div>
        <div class="dish-meta">
          <div class="dish-rating"><span class="star">★</span> ${d.rating}</div>
          <div class="dish-time">⏱ ${d.time}</div>
        </div>
        <div class="dish-bottom">
          <span class="dish-price">₹${d.price}</span>
          <button class="add-btn" onclick="addToCart(${d.id})">+ Add</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterMenu(category, btn) {
  currentFilter = category;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(category);
}

function toggleFav(btn) {
  btn.textContent = btn.textContent === '🤍' ? '❤️' : '🤍';
}

function addToCart(id) {
  const item = menuData.find(d => d.id === id);
  const existing = cart.find(c => c.id === id);
  if (existing) existing.qty++;
  else cart.push({ ...item, qty: 1 });
  updateCartUI();
  showToast(`🛒 ${item.name} added to cart!`);
}

function updateCartUI() {
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const count = cart.reduce((s, c) => s + c.qty, 0);
  // badge
  const badge = document.getElementById('cart-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  const navCartCount = document.getElementById('nav-cart-count');
  if (navCartCount) {
    navCartCount.textContent = count > 0 ? `(${count})` : '';
  }
  // order section
  const orderCartLabel = document.getElementById('order-cart-label');
  if (orderCartLabel) orderCartLabel.textContent = `🛒 ${count} item${count !== 1 ? 's' : ''} in cart`;
  const orderCartTotal = document.getElementById('order-cart-total');
  if (orderCartTotal) orderCartTotal.textContent = `₹${total}`;
}

function openCart() {
  const container = document.getElementById('cart-items-container');
  const footer = document.getElementById('cart-footer');
  if (!container || !footer) return;
  if (cart.length === 0) {
    container.innerHTML = `<div class="empty-cart"><span class="cart-icon">🛒</span><p>Your cart is empty.<br>Browse the gear and add some awesome items!</p></div>`;
    footer.style.display = 'none';
  } else {
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    container.innerHTML = cart.map(c => `
      <div class="cart-item">
        <img src="${c.img}" alt="${c.name}" onerror="this.src='images/mountain landscape.png'">
        <div class="cart-item-info">
          <div class="cart-item-name">${c.name}</div>
          <div class="cart-item-price">₹${c.price} each</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${c.id}, -1)">−</button>
          <span class="qty-num">${c.qty}</span>
          <button class="qty-btn" onclick="changeQty(${c.id}, 1)">+</button>
        </div>
        <button class="cart-item-remove" onclick="removeFromCart(${c.id})">🗑</button>
      </div>
    `).join('');
    document.getElementById('modal-total-price').textContent = `₹${total}`;
    footer.style.display = 'block';
  }
  document.getElementById('cart-modal').classList.add('open');
}

function closeCart() {
  const modal = document.getElementById('cart-modal');
  if (modal) modal.classList.remove('open');
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(c => c.id !== id);
  updateCartUI(); openCart();
}

function removeFromCart(id) { cart = cart.filter(c => c.id !== id); updateCartUI(); openCart(); }

function scrollToOrder() {
  closeCart();
  const orderEl = document.getElementById('order');
  if (orderEl) orderEl.scrollIntoView({ behavior: 'smooth' });
}

function submitOrder() {
  const fname = document.getElementById('fname').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!fname) { showToast('⚠️ First name is required!'); return; }
  if (fname.length < 2) { showToast('⚠️ Name is too short!'); return; }

  const phoneRegex = /^[0-9+\s-]{10,15}$/;
  if (!phoneRegex.test(phone)) { showToast('⚠️ Please enter a valid phone number (at least 10 digits).'); return; }

  if (!address || address.length < 5) { showToast('⚠️ Please enter a complete delivery address.'); return; }

  if (cart.length === 0) { showToast('⚠️ Your cart is empty!'); return; }

  const orderTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const orderId = 'ORD-' + Math.floor(Math.random() * 1000000);
  const date = new Date().toLocaleString();

  const invoiceHTML = `
    <div class="invoice-box">
      <div class="invoice-header">
        <h4>TrailForge</h4>
        <p>Order #${orderId}</p>
        <p>${date}</p>
      </div>
      <div class="invoice-items">
        ${cart.map(c => `
          <div class="invoice-item">
            <span>${c.qty}x ${c.name}</span>
            <span>₹${c.price * c.qty}</span>
          </div>
        `).join('')}
      </div>
      <div class="invoice-total">
        <span>Total Amount Paid</span>
        <span>₹${orderTotal}</span>
      </div>
    </div>
  `;

  const successContainer = document.getElementById('form-success');
  successContainer.innerHTML = `
    <div class="success-icon">🎉</div>
    <h4>Order Completed Successfully!</h4>
    <p>Your gear is being packed. Estimated delivery: <strong>3-5 days.</strong></p>
    ${invoiceHTML}
    <button class="cf-submit" style="margin-top:2rem;" onclick="window.location.reload()">Place Another Order</button>
  `;

  document.getElementById('order-form-content').style.display = 'none';
  successContainer.style.display = 'block';
  cart = []; updateCartUI();
  showToast('🎉 Order placed! Thank you!');
}

function submitContact() {
  const name = document.getElementById('cf-name').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const msg = document.getElementById('cf-message').value.trim();

  if (!name || name.length < 2) { showToast('⚠️ Please enter a valid name.'); return; }

  const phoneRegex = /^[0-9+\s-]{10,15}$/;
  if (phone && !phoneRegex.test(phone)) { showToast('⚠️ Please enter a valid phone number.'); return; }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) { showToast('⚠️ Please enter a valid email address.'); return; }

  if (!msg || msg.length < 10) { showToast('⚠️ Message is too short (minimum 10 characters).'); return; }

  showToast('✅ Message sent! We\'ll get back to you soon.');
  ['cf-name', 'cf-phone', 'cf-email', 'cf-subject', 'cf-message'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (nav) nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
}

// Scroll effects
window.addEventListener('scroll', () => {
  const nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 20);
});

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 80);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
revealEls.forEach(el => observer.observe(el));

// Close modal on overlay click
const cartModal = document.getElementById('cart-modal');
if (cartModal) {
  cartModal.addEventListener('click', function (e) {
    if (e.target === this) closeCart();
  });
}
