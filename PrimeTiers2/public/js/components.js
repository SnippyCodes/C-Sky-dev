/* */

//  NAVBAR 
function renderNavbar() {
  const currentPath = window.location.pathname;

  const navLinks = [
    { href: '/',           label: 'Home' },
    { href: '/rankings',   label: 'Tier List' },
    { href: '/testers',    label: 'Testers' },
    { href: '/about',      label: 'About' },
  ];

  const isActive = (href) => {
    if (href === '/') return currentPath === '/';
    return currentPath.startsWith(href);
  };

  const html = `
    <nav class="navbar" id="navbar">
      <div class="container navbar-inner">

        <a href="/" class="navbar-brand">
          <div class="navbar-logo">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#9333ea"/>
                  <stop offset="1" stop-color="#6d28d9"/>
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="10" fill="url(#logoGrad)"/>
              <!-- Trophy icon matching the logo image -->
              <g transform="translate(20,20)">
                <path d="M-9,-13 L9,-13 L7.5,4 Q0,8 -7.5,4 Z"
                      fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <path d="M-9,-9 Q-15,-7 -14,-2 Q-13,2 -9,1"
                      fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M9,-9 Q15,-7 14,-2 Q13,2 9,1"
                      fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M-2.5,4 Q-3,9 -4,12 M2.5,4 Q3,9 4,12"
                      fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <rect x="-7" y="12" width="14" height="3" rx="1.5"
                      fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              </g>
            </svg>
          </div>
          <span class="navbar-wordmark">
            <span class="wordmark-prime">Prime</span><span class="wordmark-tiers">Tiers</span>
          </span>
        </a>

        <div class="navbar-server-ip" id="serverIpChip" title="Click to copy IP">
          <img src="/img/trophy.png" width="28" height="28" style="border-radius:6px;flex-shrink:0" alt="PrimePvP"/>
          <div class="navbar-server-ip-info">
            <span class="navbar-server-ip-label">SERVER IP</span>
            <span class="navbar-server-ip-value">PrimePvP.qzz.io</span>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;flex-shrink:0"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </div>

        <div class="navbar-links" id="navLinks">
          ${navLinks.map(l => `
            <a href="${l.href}" class="nav-link ${isActive(l.href) ? 'active' : ''}">${l.label}</a>
          `).join('')}
        </div>

        <div class="navbar-actions">
          <a href="/apply" class="btn btn-secondary btn-sm">Apply</a>
          <a href="https://discord.gg/eDNEpky8Tf" target="_blank" class="btn btn-discord btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            Discord
          </a>
          <button class="navbar-hamburger" id="hamburger" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>

      </div>
    </nav>
  `;

  const navEl = document.createElement('div');
  navEl.innerHTML = html;
  document.body.insertBefore(navEl.firstElementChild, document.body.firstChild);

  // Hamburger toggle
  const hamburger = document.getElementById('hamburger');
  const navLinksEl = document.getElementById('navLinks');
  hamburger?.addEventListener('click', () => {
    navLinksEl?.classList.toggle('open');
    hamburger.classList.toggle('open');
  });

  // Scroll effect
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 10);
  });

  // Server IP copy
  document.getElementById('serverIpChip')?.addEventListener('click', () => {
    navigator.clipboard?.writeText('PrimePvP.qzz.io').then(() => {
      showToast('Server IP copied!', 'success');
    });
  });
}

//  FOOTER 
function renderFooter() {
  const html = `
    <footer class="footer">
      <div class="container footer-inner">
        <div class="footer-col">
          <div class="footer-brand">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="footerLogoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop stop-color="#9333ea"/><stop offset="1" stop-color="#6d28d9"/>
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="10" fill="url(#footerLogoGrad)"/>
              <g transform="translate(20,20)">
                <path d="M-9,-13 L9,-13 L7.5,4 Q0,8 -7.5,4 Z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <path d="M-9,-9 Q-15,-7 -14,-2 Q-13,2 -9,1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M9,-9 Q15,-7 14,-2 Q13,2 9,1" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <path d="M-2.5,4 Q-3,9 -4,12 M2.5,4 Q3,9 4,12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <rect x="-7" y="12" width="14" height="3" rx="1.5" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>
              </g>
            </svg>
            <span class="footer-wordmark"><span class="wordmark-prime">Prime</span><span class="wordmark-tiers">Tiers</span></span>
          </div>
          <p class="footer-tagline">Where the Best Are Ranked</p>
          <a href="https://discord.gg/eDNEpky8Tf" target="_blank" class="btn btn-discord btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            Join Discord
          </a>
          <div class="footer-socials">
            <a href="https://discord.gg/eDNEpky8Tf" target="_blank" aria-label="Discord" title="Discord">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            </a>
            <a href="https://www.youtube.com/@PrimeTierList" target="_blank" aria-label="YouTube" title="YouTube">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Navigate</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/rankings">Tier List</a></li>
            <li><a href="/apply">Apply for Testing</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="/testers">Testers</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/compare">Compare Players</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/cookies">Cookie Policy</a></li>
            <li><a href="mailto:contact@primetiers.qzz.io">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">
          <span> 2025 PrimeTiers. All rights reserved.</span>
          <span>Built for the competitive Minecraft community.</span>
        </div>
      </div>
    </footer>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
}

//  TOAST 
function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '[OK]', error: '[ERR]', info: '[i]', warning: '[!]' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '[i]'}</span><span>${message}</span>`;

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

//  TIER UTILS 
const TIER_CONFIG = {
  ht1: { label: 'HT1', class: 'tier-ht1', name: 'High Tier 1', desc: 'Top 0.5% � Elite',        points: 60 },
  lt1: { label: 'LT1', class: 'tier-lt1', name: 'Low Tier 1',  desc: 'Top 2% � Near-Elite',     points: 45 },
  ht2: { label: 'HT2', class: 'tier-ht2', name: 'High Tier 2', desc: 'Top 8% � Advanced',       points: 30 },
  lt2: { label: 'LT2', class: 'tier-lt2', name: 'Low Tier 2',  desc: 'Top 18% � Strong',        points: 20 },
  ht3: { label: 'HT3', class: 'tier-ht3', name: 'High Tier 3', desc: 'Top 35% � Intermediate',  points: 10 },
  lt3: { label: 'LT3', class: 'tier-lt3', name: 'Low Tier 3',  desc: 'Top 55% � Developing',    points: 6  },
  ht4: { label: 'HT4', class: 'tier-ht4', name: 'High Tier 4', desc: 'Top 75% � Beginner+',     points: 4  },
  lt4: { label: 'LT4', class: 'tier-lt4', name: 'Low Tier 4',  desc: 'Top 90% � Beginner',      points: 3  },
  ht5: { label: 'HT5', class: 'tier-ht5', name: 'High Tier 5', desc: 'Top 97% � New',           points: 2  },
  lt5: { label: 'LT5', class: 'tier-lt5', name: 'Low Tier 5',  desc: 'Unranked / Learning',     points: 1  },
};

function getTierKey(tier, pos) {
  const prefix = pos === 0 || pos === '0' ? 'ht' : 'lt';
  return `${prefix}${tier}`;
}

function getTierConfig(tier, pos) {
  const key = getTierKey(tier, pos);
  return TIER_CONFIG[key] || TIER_CONFIG.lt5;
}

function renderTierBadge(tier, pos, size = 'md') {
  const cfg = getTierConfig(tier, pos);
  return `<span class="tier-badge ${cfg.class} ${size}">${cfg.label}</span>`;
}

function getPoints(tier, pos) {
  return getTierConfig(tier, pos).points;
}

//  MODE CONFIG 
const MODE_CONFIG = {
  crystal:  { label: "Crystal",       img: "/img/crystal.svg",  color: "#67e8f9" },
  sword:    { label: "Sword",         img: "/img/sword.svg",    color: "#f87171" },
  uhc:      { label: "UHC",           img: "/img/uhc.svg",      color: "#ef4444" },
  pot:      { label: "Pot",           img: "/img/pot.svg",      color: "#a78bfa" },
  neth_pot: { label: "Netherite Pot", img: "/img/neth_pot.svg", color: "#fb923c" },
  smp:      { label: "SMP",           img: "/img/smp.svg",      color: "#4ade80" },
  axe:      { label: "Axe",           img: "/img/axe.svg",      color: "#fbbf24" },
  mace:     { label: "Mace",          img: "/img/mace.svg",     color: "#c084fc" },
};

// PLAYER CARD
function renderPlayerCard(player) {
  const bustUrl = getBustUrl(player.uuid, player.username, player.skin_url);
  const avatarUrl = getAvatarUrl(player.uuid, player.username, player.skin_url);

  // Handle both player.modes (leaderboard API) and player.tiers (players API)
  const rawModes = player.modes || player.tiers || {};
  const modeEntries = Object.entries(rawModes).filter(([k]) => k && k !== 'undefined');
  if (!modeEntries.length) return '';

  // Sort by best tier first
  const sorted = modeEntries.sort((a, b) =>
    (a[1].tier * 2 + a[1].pos) - (b[1].tier * 2 + b[1].pos)
  );

  // Build mode+tier items (up to 3)
  const modeItemsHtml = sorted.slice(0, 3).map(([modeKey, t]) => {
    const mc = MODE_CONFIG[modeKey];
    const tk = (t.pos === 0 ? 'ht' : 'lt') + t.tier;
    const tc = TIER_CONFIG[tk] || TIER_CONFIG.lt5;
    return `
      <div class="pc-mode-item">
        ${mc ? `<img src="${mc.img}" width="14" height="14" style="object-fit:contain;opacity:0.85" alt="${mc.label}"/>` : ''}
        <span class="tier-badge ${tc.class} sm">${tc.label}</span>
      </div>`;
  }).join('');

  return `
    <div class="player-card" onclick="window.location='/player/${encodeURIComponent(player.username)}'">
      <div class="player-card-bust">
        <img src="${bustUrl}" alt="${escapeHtml(player.username)}"
             onerror="this.src='${avatarUrl}';this.onerror=null"
             loading="lazy"/>
      </div>
      <div class="player-card-name">${escapeHtml(player.username)}</div>
      <div class="player-card-modes-row">${modeItemsHtml}</div>
      ${player.region ? `<div class="player-card-meta"><span class="player-card-region">${player.region}</span></div>` : ''}
    </div>
  `;
}

//  PARTICLES 
function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let particles = [];
  let W, H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = [
    'rgba(139,92,246,0.5)',
    'rgba(167,139,250,0.4)',
    'rgba(192,132,252,0.35)',
    'rgba(88,101,242,0.4)',
  ];

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: Math.random() * 0.4 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
}

//  COUNTER ANIMATION 
function animateCounter(el, target, duration = 1400) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        animateCounter(el, parseInt(el.dataset.counter));
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}

//  SCROLL REVEAL 
function initScrollReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, parseInt(delay));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  els.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

//  MODAL HELPERS 
function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

//  AVATAR / BUST HELPERS 

/**
 * Extract texture hash from any skin_url format.
 * Handles: mcskin:{user}:{hash}, nmsr:{hash}, crafatar URLs, Discord proxy URLs, Mojang texture URLs.
 * Returns 64-char hex hash or 32-char MineSkin hash, or null.
 */
function extractTextureHash(skin_url) {
  if (!skin_url) return null;
  // New format: nmsr:{hash}
  if (skin_url.startsWith('nmsr:')) return skin_url.slice(5) || null;
  // Legacy format: mcskin:{username}:{hash}
  if (skin_url.startsWith('mcskin:')) {
    const hash = skin_url.split(':')[2] || '';
    return hash.length >= 32 ? hash : null;
  }
  // Crafatar URL with 32-char MineSkin hash (no dashes)
  const crafatarM = skin_url.match(/crafatar\.com\/(?:avatars|renders\/\w+)\/([0-9a-f]{32})(?:[^-]|$)/i);
  if (crafatarM) return crafatarM[1];
  // Mojang texture URL
  const textureM = skin_url.match(/textures\.minecraft\.net\/texture\/([a-f0-9]{64})/i);
  if (textureM) return textureM[1];
  // Discord proxy containing Mojang texture hash (double-encoded)
  const discordM = skin_url.match(/texture(?:%252F|%2F|\/)+([a-f0-9]{64})/i);
  if (discordM) return discordM[1];
  return null;
}

/**
 * Extract username from a Discord CDN proxy of a visage/render URL.
 */
function extractDiscordUsername(skin_url) {
  if (!skin_url || !skin_url.includes('discordapp.net/external')) return null;
  try {
    const match = skin_url.match(/\/https?\/([^?]+)/);
    if (!match) return null;
    const parts = match[1].split('/');
    const original = 'https://' + parts[0] + '/' + decodeURIComponent(parts.slice(1).join('/'));
    const vm = original.match(/visage\.surgeplay\.com\/bust\/([^/?]+)/i);
    return vm ? decodeURIComponent(vm[1]) : null;
  } catch(e) { return null; }
}

function getAvatarUrl(uuid, username, skin_url) {
  // Always mc-heads by username — proper Minecraft head, transparent bg, works for all
  const name = username || uuid;
  if (!name) return '/img/default-avatar.svg';
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
}

function getBustUrl(uuid, username, skin_url) {
  // Texture hash available — NMSR renders the actual custom skin in 3D
  const hash = extractTextureHash(skin_url);
  if (hash) return `https://nmsr.nickac.dev/bust/${hash}`;
  // Discord proxy of visage — use NMSR with same username
  const discordUser = extractDiscordUsername(skin_url);
  if (discordUser) return `https://nmsr.nickac.dev/bust/${encodeURIComponent(discordUser)}`;
  // Fallback — NMSR by username (3D render using Mojang skin for premium, Steve for cracked)
  const name = username || uuid;
  if (!name) return '/img/default-bust.svg';
  return `https://nmsr.nickac.dev/bust/${encodeURIComponent(name)}`;
}

function getSkinHeadUrl(uuid, username, skin_url) {
  const name = username || uuid;
  if (!name) return '/img/default-avatar.svg';
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
}

//  COUNTRY FLAG 
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

//  ESCAPE HTML 
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

//  INIT 
document.addEventListener('DOMContentLoaded', () => {
  // Skip navbar/footer/particles on admin pages  they have their own layout
  const isAdmin = window.location.pathname.startsWith('/admin');
  if (!isAdmin) {
    renderNavbar();
    renderFooter();
    // particles disabled
  }
  initCounters();
  initScrollReveal();
});








