/* PrimeTiers - Homepage JS */

document.addEventListener('DOMContentLoaded', () => {
  renderModeCards();
  renderTierGrid();
  loadPlayerFeeds();
  loadHeroLeaderboard();

  // Poll for new players every 30s — updates marquee + live feed
  setInterval(async () => {
    try {
      const res = await fetch('/api/leaderboard?limit=100');
      if (!res.ok) return;
      const players = await res.json();
      if (!Array.isArray(players) || !players.length) return;

      // Update marquee with latest data
      const livePlayers = [...players].sort((a,b) => {
        const bA = Object.values(a.modes||{}).sort((x,y)=>(x.tier*2+x.pos)-(y.tier*2+y.pos))[0];
        const bB = Object.values(b.modes||{}).sort((x,y)=>(x.tier*2+x.pos)-(y.tier*2+y.pos))[0];
        if (!bA) return 1; if (!bB) return -1;
        return (bA.tier*2+bA.pos)-(bB.tier*2+bB.pos);
      });
      renderMarqueeFromData(livePlayers.slice(0, 20));
    } catch {}
  }, 30000);
});

// MODE CARDS
function renderModeCards() {
  const container = document.getElementById('modesScroll');
  if (!container) return;

  container.innerHTML = Object.entries(MODE_CONFIG).map(([key, cfg]) => `
    <a href="/rankings?mode=${key}" class="mode-card">
      <span class="mode-icon">
        ${cfg.img ? `<img src="${cfg.img}" alt="${cfg.label}" style="width:48px;height:48px;object-fit:contain"/>` : ''}
      </span>
      <div class="mode-name">${cfg.label}</div>
      <div class="mode-count">View Rankings</div>
    </a>
  `).join('');
}

// HERO LEADERBOARD PREVIEW
async function loadHeroLeaderboard() {
  const container = document.getElementById('heroLeaderboard');
  if (!container) return;

  try {
    const res = await fetch('/api/leaderboard?limit=5');
    if (!res.ok) throw new Error();
    const players = await res.json();
    if (!players.length) throw new Error();

    const TLABELS = {ht1:'HT1',lt1:'LT1',ht2:'HT2',lt2:'LT2',ht3:'HT3',lt3:'LT3',ht4:'HT4',lt4:'LT4',ht5:'HT5',lt5:'LT5'};
    const TCLASS  = {ht1:'tier-ht1',lt1:'tier-lt1',ht2:'tier-ht2',lt2:'tier-lt2',ht3:'tier-ht3',lt3:'tier-lt3',ht4:'tier-ht4',lt4:'tier-lt4',ht5:'tier-ht5',lt5:'tier-lt5'};

    const rankCls = r => r===1?'hlb-rank-1':r===2?'hlb-rank-2':r===3?'hlb-rank-3':'hlb-rank-n';

    const rows = players.map((p, i) => {
      const rank = i + 1;
      const bust = getBustUrl(p.uuid, p.username, p.skin_url);
      const avatar = getAvatarUrl(p.uuid, p.username, p.skin_url);

      // Top 3 modes
      const topModes = Object.entries(p.modes||{})
        .sort((a,b)=>(a[1].tier*2+a[1].pos)-(b[1].tier*2+b[1].pos))
        .slice(0,3);

      const tierBadges = topModes.map(([mode, t]) => {
        const key = (t.pos===0?'ht':'lt')+t.tier;
        return `<span class="tier-badge ${TCLASS[key]||''} sm">${TLABELS[key]||'?'}</span>`;
      }).join('');

      const pts = (p.points||0).toLocaleString();

      return `
        <div class="hlb-row" onclick="window.location='/player/${encodeURIComponent(p.username)}'">
          <div class="hlb-rank ${rankCls(rank)}">${rank}</div>
          <div class="hlb-avatar">
            <img src="${bust}" alt="${escapeHtml(p.username)}"
                 onerror="this.src='${avatar}';this.onerror=null" loading="lazy"/>
          </div>
          <div class="hlb-info">
            <div class="hlb-name">${escapeHtml(p.username)}</div>
            <div class="hlb-sub">${pts} pts · ${p.region||''}</div>
          </div>
          <div class="hlb-tiers">${tierBadges}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="hlb-header">
        <span class="hlb-title">Top Players</span>
        <span class="hlb-live">Live</span>
      </div>
      ${rows}
      <div class="hlb-footer">
        <a href="/rankings">View full leaderboard &rarr;</a>
      </div>`;

  } catch {
    // Fallback — hide the preview, show nothing
    container.style.display = 'none';
  }
}
function renderTierGrid() {
  const container = document.getElementById('tiersGrid');
  if (!container) return;

  const tiers = [
    { label: 'HT1', name: 'High Tier 1', desc: 'Top 0.5%', cls: 'tier-ht1', img: '/img/tier_1.svg' },
    { label: 'LT1', name: 'Low Tier 1',  desc: 'Top 2%',   cls: 'tier-lt1', img: '/img/tier_1.svg' },
    { label: 'HT2', name: 'High Tier 2', desc: 'Top 8%',   cls: 'tier-ht2', img: '/img/tier_2.svg' },
    { label: 'LT2', name: 'Low Tier 2',  desc: 'Top 18%',  cls: 'tier-lt2', img: '/img/tier_2.svg' },
    { label: 'HT3', name: 'High Tier 3', desc: 'Top 35%',  cls: 'tier-ht3', img: '/img/tier_3.svg' },
    { label: 'LT3', name: 'Low Tier 3',  desc: 'Top 55%',  cls: 'tier-lt3', img: '/img/tier_3.svg' },
    { label: 'HT4', name: 'High Tier 4', desc: 'Top 75%',  cls: 'tier-ht4', img: null },
    { label: 'LT4', name: 'Low Tier 4',  desc: 'Top 90%',  cls: 'tier-lt4', img: null },
    { label: 'HT5', name: 'High Tier 5', desc: 'Top 97%',  cls: 'tier-ht5', img: null },
    { label: 'LT5', name: 'Low Tier 5',  desc: 'Learning', cls: 'tier-lt5', img: null },
  ];

  const pairs = [];
  for (let i = 0; i < tiers.length; i += 2) pairs.push([tiers[i], tiers[i+1]]);

  container.innerHTML = pairs.map(([ht, lt], i) => `
    <div class="tier-col" data-reveal data-delay="${i * 50}">
      <div class="tier-chip ${ht.cls}">
        <div class="tier-chip-label">${ht.label}</div>
        <div class="tier-chip-name">${ht.name}</div>
        <div class="tier-chip-desc">${ht.desc}</div>
      </div>
      <div class="tier-chip ${lt.cls}">
        <div class="tier-chip-label">${lt.label}</div>
        <div class="tier-chip-name">${lt.name}</div>
        <div class="tier-chip-desc">${lt.desc}</div>
      </div>
    </div>
  `).join('');

  initScrollReveal();
}

// PLAYER FEEDS - paginated, 15 per page
const feedState = {
  allHT: [], allLive: [],
  htPage: 0, livePage: 0,
  htPerPage: 15, livePerPage: 15,
};

async function loadPlayerFeeds() {
  try {
    const res = await fetch('/api/leaderboard?limit=500');
    if (!res.ok) throw new Error('API error');
    const players = await res.json();

    if (!Array.isArray(players) || !players.length) {
      showEmptyState();
      return;
    }

    feedState.allHT = players.filter(p =>
      Object.values(p.modes || {}).some(t => t.tier <= 3)
    );

    feedState.allLive = [...players].sort((a, b) => {
      const bA = Object.values(a.modes||{}).sort((x,y)=>(x.tier*2+x.pos)-(y.tier*2+y.pos))[0];
      const bB = Object.values(b.modes||{}).sort((x,y)=>(x.tier*2+x.pos)-(y.tier*2+y.pos))[0];
      if (!bA) return 1; if (!bB) return -1;
      return (bA.tier*2+bA.pos) - (bB.tier*2+bB.pos);
    });

    feedState.htPage = 0;
    feedState.livePage = 0;

    renderHTGrid();
    renderLiveGrid();
    renderMarqueeFromData(feedState.allLive.slice(0, 20));

  } catch (err) {
    console.warn('Could not load player feeds:', err.message);
    showEmptyState();
  }
}

function showEmptyState() {
  const htGrid = document.getElementById('htGrid');
  const liveGrid = document.getElementById('liveGrid');
  const msg = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted)">
    No players ranked yet. <a href="/apply" style="color:var(--accent-hover)">Be the first!</a>
  </div>`;
  if (htGrid) htGrid.innerHTML = msg;
  if (liveGrid) liveGrid.innerHTML = msg;
}

function renderHTGrid() {
  const container = document.getElementById('htGrid');
  const paginationEl = document.getElementById('htPagination');
  if (!container) return;

  const total = feedState.allHT.length;
  const perPage = feedState.htPerPage;
  const page = feedState.htPage;
  const totalPages = Math.ceil(total / perPage);
  const slice = feedState.allHT.slice(page * perPage, (page + 1) * perPage);

  if (!slice.length) { container.innerHTML = ''; return; }
  container.innerHTML = slice.map(p => renderPlayerCard(p)).join('');

  if (paginationEl) renderFeedPagination(paginationEl, page, totalPages, 'ht');
}

function renderLiveGrid() {
  const container = document.getElementById('liveGrid');
  const paginationEl = document.getElementById('livePagination');
  if (!container) return;

  const total = feedState.allLive.length;
  const perPage = feedState.livePerPage;
  const page = feedState.livePage;
  const totalPages = Math.ceil(total / perPage);
  const slice = feedState.allLive.slice(page * perPage, (page + 1) * perPage);

  if (!slice.length) { container.innerHTML = ''; return; }
  container.innerHTML = slice.map(p => renderPlayerCard(p)).join('');

  if (paginationEl) renderFeedPagination(paginationEl, page, totalPages, 'live');
}

function renderFeedPagination(el, page, totalPages, type) {
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="feed-pagination">
      <button class="feed-pg-btn" onclick="changeFeedPage('${type}',-1)" ${page===0?'disabled':''}>← Prev</button>
      <span class="feed-pg-info">${page+1} / ${totalPages}</span>
      <button class="feed-pg-btn" onclick="changeFeedPage('${type}',1)" ${page>=totalPages-1?'disabled':''}>Next →</button>
    </div>`;
}

function changeFeedPage(type, dir) {
  if (type === 'ht') {
    const total = Math.ceil(feedState.allHT.length / feedState.htPerPage);
    feedState.htPage = Math.max(0, Math.min(feedState.htPage + dir, total - 1));
    renderHTGrid();
    document.getElementById('htGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    const total = Math.ceil(feedState.allLive.length / feedState.livePerPage);
    feedState.livePage = Math.max(0, Math.min(feedState.livePage + dir, total - 1));
    renderLiveGrid();
    document.getElementById('liveGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderMarqueeFromData(players) {
  const track = document.getElementById('marqueeTrack');
  if (!track || !players.length) return;

  const itemsHtml = players.map(player => {
    const modeEntries = Object.entries(player.modes || {});
    if (!modeEntries.length) return '';
    const sorted = modeEntries.sort((a,b)=>(a[1].tier*2+a[1].pos)-(b[1].tier*2+b[1].pos));
    const [bestMode, bestTierData] = sorted[0];
    const tierKey = (bestTierData.pos===0?'ht':'lt')+bestTierData.tier;
    const cfg = TIER_CONFIG[tierKey] || TIER_CONFIG.lt5;
    const modeCfg = MODE_CONFIG[bestMode];
    const bustUrl = getBustUrl(player.uuid, player.username, player.skin_url);
    return `
      <div class="marquee-item">
        <div class="m-avatar">
          <img src="${bustUrl}" alt="${escapeHtml(player.username)}"
               onerror="this.style.display='none'" loading="lazy"/>
        </div>
        <span class="m-name">${escapeHtml(player.username)}</span>
        ${modeCfg ? `<img src="${modeCfg.img}" width="13" height="13" style="object-fit:contain;opacity:0.7"/>` : ''}
        <span class="m-mode">${modeCfg?.label||bestMode}</span>
        <span class="tier-badge ${cfg.class} sm">${cfg.label}</span>
        ${player.region ? `<span style="font-size:0.68rem;color:var(--text-muted)">${player.region}</span>` : ''}
      </div>`;
  }).filter(Boolean).join('');

  if (!itemsHtml) return;

  // Duplicate for seamless infinite loop — CSS animates -50%
  track.innerHTML = itemsHtml + itemsHtml;

  // Reset animation so it restarts cleanly with new content
  track.style.animation = 'none';
  track.offsetHeight; // force reflow
  track.style.animation = '';
}
