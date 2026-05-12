/* PrimeTiers — Tier List JS (pvptiers.com style, 5 columns) */

const TIER_COLS = [
  { num: 1, label: 'Tier 1', cls: 'tier-col-1', img: '/img/tier_1.svg' },
  { num: 2, label: 'Tier 2', cls: 'tier-col-2', img: '/img/tier_2.svg' },
  { num: 3, label: 'Tier 3', cls: 'tier-col-3', img: '/img/tier_3.svg' },
  { num: 4, label: 'Tier 4', cls: 'tier-col-4', img: null },
  { num: 5, label: 'Tier 5', cls: 'tier-col-5', img: null },
];

let rlState = { mode: '', region: '', search: '', allPlayers: [] };
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  rlState.mode   = params.get('mode')   || '';
  rlState.region = params.get('region') || '';
  renderModeTabs();
  setupFilters();
  loadTierList();

  // Server IP copy
  document.getElementById('rankingsIpCopy')?.addEventListener('click', () => {
    navigator.clipboard?.writeText('PrimePvP.qzz.io').then(() => {
      showToast('Server IP copied!', 'success');
    });
  });

  // Information modal
  document.getElementById('infoBtn')?.addEventListener('click', () => {
    document.getElementById('infoModalOverlay').classList.add('open');
  });
});

/* MODE TABS */
function renderModeTabs() {
  const container = document.getElementById('modeTabs');
  if (!container) return;

  const tabs = [
    { key: '', label: 'Overall', img: '/img/tier_1.svg' },
    ...Object.entries(MODE_CONFIG).map(([k, v]) => ({ key: k, label: v.label, img: v.img }))
  ];

  container.innerHTML = tabs.map(t => `
    <button class="tierlist-tab ${rlState.mode === t.key ? 'active' : ''}" data-mode="${t.key}">
      ${t.img
        ? `<img src="${t.img}" alt="${t.label}"/>`
        : `<div class="tab-overall-icon">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
               <path d="M6 9H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2"/>
               <path d="M18 9h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"/>
               <path d="M6 9v8a6 6 0 0 0 12 0V9"/>
               <path d="M6 9a6 6 0 0 1 12 0"/>
               <line x1="12" y1="17" x2="12" y2="21"/>
               <line x1="8" y1="21" x2="16" y2="21"/>
             </svg>
           </div>`
      }
      <span>${t.label}</span>
    </button>
  `).join('');

  container.querySelectorAll('.tierlist-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      rlState.mode = btn.dataset.mode;
      rlState.allPlayers = [];
      container.querySelectorAll('.tierlist-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTierList();
    });
  });
}

/* FILTERS */
function setupFilters() {
  const regionFilter = document.getElementById('regionFilter');
  const searchInput  = document.getElementById('searchInput');

  if (regionFilter) {
    regionFilter.value = rlState.region;
    regionFilter.addEventListener('change', () => {
      rlState.region = regionFilter.value;
      rlState.allPlayers = [];
      loadTierList();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        rlState.search = searchInput.value.trim().toLowerCase();
        renderTierColumns(rlState.allPlayers);
      }, 220);
    });
  }
}

/* LOAD */
async function loadTierList() {
  const content = document.getElementById('tierlistContent');
  content.innerHTML = `
    <div class="tierlist-grid">
      ${Array(5).fill('<div class="skeleton" style="height:400px;border-radius:12px"></div>').join('')}
    </div>`;

  try {
    let url = '/api/leaderboard?limit=50000';
    if (rlState.mode)   url += '&mode='   + rlState.mode;
    if (rlState.region) url += '&region=' + rlState.region;

    const res = await fetch(url);
    const players = await res.json();
    rlState.allPlayers = players;
    renderTierColumns(players);
  } catch (err) {
    content.innerHTML = `
      <div class="tierlist-empty">
        <h3>Could not load tier list</h3>
        <button class="btn btn-secondary btn-sm" onclick="loadTierList()" style="margin-top:12px">Retry</button>
      </div>`;
  }
}

/* RENDER — Overall = leaderboard list, Mode = tier columns */
function renderTierColumns(players) {
  const content = document.getElementById('tierlistContent');
  const search  = rlState.search;

  let filtered = players;
  if (search) filtered = players.filter(p => p.username.toLowerCase().includes(search));

  if (!filtered.length) {
    content.innerHTML = `
      <div class="tierlist-empty">
        <h3>${search ? 'No players match "' + esc(search) + '"' : 'No players ranked yet'}</h3>
        <p>${search ? 'Try a different search.' : 'Be the first to get tested!'}</p>
        ${!search ? '<a href="/apply" class="btn btn-primary btn-sm" style="margin-top:12px">Apply for Testing</a>' : ''}
      </div>`;
    return;
  }

  if (!rlState.mode) {
    renderOverallList(filtered);
  } else {
    renderModeColumns(filtered);
  }
}

/* OVERALL LEADERBOARD LIST */
function renderOverallList(players) {
  const content = document.getElementById('tierlistContent');

  const sorted = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));

  const POINTS_MAP = {'1_0':60,'1_1':45,'2_0':30,'2_1':20,'3_0':10,'3_1':6,'4_0':4,'4_1':3,'5_0':2,'5_1':1};
  const MODES_ORDER = ['crystal','sword','uhc','pot','neth_pot','smp','axe','mace'];

  function rankSvg(rank) {
    if (rank === 1) return '/img/1-shimmer.svg';
    if (rank === 2) return '/img/2-shimmer.svg';
    if (rank === 3) return '/img/3-shimmer.svg';
    return '/img/other.svg';
  }

  function rankCls(rank) {
    if (rank === 1) return 'ol-rank-1';
    if (rank === 2) return 'ol-rank-2';
    if (rank === 3) return 'ol-rank-3';
    return 'ol-rank-other';
  }

  const rows = sorted.map((player, i) => {
    const rank = i + 1;
    const bust = getBustUrl(player.uuid, player.username, player.skin_url);
    const avatar = getAvatarUrl(player.uuid, player.username, player.skin_url);

    const modeEntries = Object.entries(player.modes || {});
    const pts = modeEntries.map(([,t]) => POINTS_MAP[t.tier+'_'+t.pos]||0).sort((a,b)=>b-a);
    const totalPts = pts.slice(0,3).reduce((s,p)=>s+p,0);

    const TLABELS  = {ht1:'HT1',lt1:'LT1',ht2:'HT2',lt2:'LT2',ht3:'HT3',lt3:'LT3',ht4:'HT4',lt4:'LT4',ht5:'HT5',lt5:'LT5'};
    const LBLCLS   = {ht1:'ol-lbl-ht1',lt1:'ol-lbl-lt1',ht2:'ol-lbl-ht2',lt2:'ol-lbl-lt2',ht3:'ol-lbl-ht3',lt3:'ol-lbl-lt3',ht4:'ol-lbl-ht4',lt4:'ol-lbl-lt4',ht5:'ol-lbl-ht5',lt5:'ol-lbl-lt5'};
    const ICONCLS  = {ht1:'ol-icon-ht1',lt1:'ol-icon-lt1',ht2:'ol-icon-ht2',lt2:'ol-icon-lt2',ht3:'ol-icon-ht3',lt3:'ol-icon-lt3',ht4:'ol-icon-ht4',lt4:'ol-icon-lt4',ht5:'ol-icon-ht5',lt5:'ol-icon-lt5'};

    const tierBadges = MODES_ORDER.map(mode => {
      const t = player.modes?.[mode];
      const cfg = MODE_CONFIG[mode];
      if (!t) return `
        <div class="ol-mode-col">
          <div class="ol-mode-icon-empty">
            <span style="font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.2)">?</span>
          </div>
        </div>`;
      const tierKey = (t.pos===0?'ht':'lt')+t.tier;
      return `
        <div class="ol-mode-col">
          <div class="ol-mode-icon ${ICONCLS[tierKey]||''}">
            ${cfg ? `<img src="${cfg.img}" width="18" height="18" style="object-fit:contain"/>` : ''}
          </div>
          <span class="ol-mode-label ${LBLCLS[tierKey]||''}">${TLABELS[tierKey]||'?'}</span>
        </div>`;
    }).join('');

    return `
      <div class="ol-row" onclick="showPlayerPopup('${esc(player.username)}')">
        <div class="ol-rank-wrap ${rankCls(rank)}">
          <img src="${rankSvg(rank)}" class="ol-rank-bg-img" alt=""/>
          <span class="ol-rank-num">${rank}.</span>
          <img src="${bust}" class="ol-rank-avatar" alt="${esc(player.username)}"
               onerror="this.src='${avatar}';this.onerror=null" loading="lazy"/>
        </div>
        <div class="ol-row-inner">
          <div class="ol-info">
            <div class="ol-name">${esc(player.username)}</div>
            <div class="ol-pts">
              <img src="${getPlayerBadge(totalPts).img}" width="13" height="13" style="object-fit:contain;vertical-align:middle"/>
              <span class="${getPlayerBadge(totalPts).cls}" style="font-weight:600">${getPlayerBadge(totalPts).name}</span>
              <span style="color:var(--text-muted)"> (${totalPts} points)</span>
            </div>
          </div>
          <div class="ol-region">
            <span class="ol-region-badge ol-region-${player.region||"unknown"}">${player.region||''}</span>
          </div>
          <div class="ol-tiers">${tierBadges}</div>
        </div>
      </div>`;
  }).join('');

  // Header — just text labels, no icons
  const headerModes = `<span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted)">TIERS</span>`;

  content.innerHTML = `
    <div class="ol-wrap">
      <div class="ol-table">
        <div class="ol-header">
          <div class="ol-header-rank">#</div>
          <div class="ol-header-player">PLAYER</div>
          <div class="ol-header-region">REGION</div>
          <div class="ol-header-tiers">${headerModes}</div>
        </div>
        <div class="ol-body">${rows}</div>
      </div>
    </div>`;
}

/* MODE-SPECIFIC TIER COLUMNS */
function renderModeColumns(players) {
  const content = document.getElementById('tierlistContent');
  const tierMap = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  players.forEach(player => {
    const t = player.modes?.[rlState.mode];
    if (t) tierMap[t.tier]?.push({ player, tier: t.tier, pos: t.pos });
  });

  Object.values(tierMap).forEach(arr => arr.sort((a, b) => a.pos - b.pos));

  const columns = TIER_COLS.map(col => {
    const entries = tierMap[col.num] || [];
    const rows = entries.map(({ player, pos }) => {
      const bust = getBustUrl(player.uuid, player.username, player.skin_url);
      const posLabel = pos === 0 ? 'HT' : 'LT';
      return `
          <div class="tier-player-row" onclick="showPlayerPopup('${esc(player.username)}')">
          <div class="tier-player-avatar">
            <img src="${bust}" alt="${esc(player.username)}"
                 onerror="this.src='${getAvatarUrl(player.uuid, player.username, player.skin_url)}';this.onerror=null" loading="lazy"/>
          </div>
          <span class="tier-player-name">${esc(player.username)}</span>
          <span style="font-size:0.62rem;color:var(--text-muted);flex-shrink:0">${posLabel}</span>
          <span class="tier-player-region">${player.region||''}</span>
          <span class="tier-player-arrow">›</span>
        </div>`;
    }).join('');

    return `
      <div class="tier-column ${col.cls}">
        <div class="tier-column-header">
          ${col.img ? `<img src="${col.img}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0" alt="${col.label}"/>` : '<span style="width:22px;display:inline-block"></span>'}
          <span class="tier-column-title">${col.label}</span>
          <span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto;background:rgba(255,255,255,0.06);padding:1px 7px;border-radius:20px">${entries.length}</span>
        </div>
        <div class="tier-player-list">
          ${rows || '<div class="tier-column-empty">No players</div>'}
        </div>
      </div>`;
  }).join('');

  content.innerHTML = `<div class="tierlist-grid">${columns}</div>`;
}

/* ─── PLAYER POPUP ───────────────────────────────────────────── */
function showPlayerPopup(username) {
  const playerData = rlState.allPlayers.find(p => p.username === username);
  if (!playerData) return;

  const POINTS_MAP = {'1_0':60,'1_1':45,'2_0':30,'2_1':20,'3_0':10,'3_1':6,'4_0':4,'4_1':3,'5_0':2,'5_1':1};
  const TLABELS   = {ht1:'HT1',lt1:'LT1',ht2:'HT2',lt2:'LT2',ht3:'HT3',lt3:'LT3',ht4:'HT4',lt4:'LT4',ht5:'HT5',lt5:'LT5'};
  const LBLCLS    = {ht1:'ol-lbl-ht1',lt1:'ol-lbl-lt1',ht2:'ol-lbl-ht2',lt2:'ol-lbl-lt2',ht3:'ol-lbl-ht3',lt3:'ol-lbl-lt3',ht4:'ol-lbl-ht4',lt4:'ol-lbl-lt4',ht5:'ol-lbl-ht5',lt5:'ol-lbl-lt5'};
  const ICONCLS   = {ht1:'ol-icon-ht1',lt1:'ol-icon-lt1',ht2:'ol-icon-ht2',lt2:'ol-icon-lt2',ht3:'ol-icon-ht3',lt3:'ol-icon-lt3',ht4:'ol-icon-ht4',lt4:'ol-icon-lt4',ht5:'ol-icon-ht5',lt5:'ol-icon-lt5'};
  const MODES_ORDER = ['crystal','sword','uhc','pot','neth_pot','smp','axe','mace'];

  // Points & rank
  const modeEntries = Object.entries(playerData.modes || {});
  const modePoints = modeEntries
    .map(([m, t]) => ({ mode: m, tier: t.tier, pos: t.pos, pts: POINTS_MAP[t.tier+'_'+t.pos]||0 }))
    .sort((a, b) => b.pts - a.pts);
  const totalPoints = modePoints.slice(0,3).reduce((s,m) => s+m.pts, 0);

  const sorted = [...rlState.allPlayers].sort((a,b) => (b.points||0)-(a.points||0));
  const rank = sorted.findIndex(p => p.username === username) + 1;

  // Best tier
  const best = modePoints[0];
  const bestTierKey = best ? (best.pos===0?'ht':'lt')+best.tier : null;
  const bestTierHtml = bestTierKey
    ? `<span class="tier-badge ${bestTierKey==='ht1'?'tier-ht1':bestTierKey==='lt1'?'tier-lt1':bestTierKey==='ht2'?'tier-ht2':bestTierKey==='lt2'?'tier-lt2':bestTierKey==='ht3'?'tier-ht3':'tier-lt3'} md">${TLABELS[bestTierKey]||''}</span>`
    : '';

  // Bust avatar
  const bustUrl = getBustUrl(playerData.uuid, playerData.username, playerData.skin_url);
  const avatarUrl = getAvatarUrl(playerData.uuid, playerData.username, playerData.skin_url);

  // Rank badge in position row — use shimmer SVG
  const rankSvgUrl = rank===1?'/img/1-shimmer.svg':rank===2?'/img/2-shimmer.svg':rank===3?'/img/3-shimmer.svg':'/img/other.svg';

  // Tiers grid — circle icon + label below, all 8 modes
  const tiersHtml = MODES_ORDER.map(mode => {
    const t = playerData.modes?.[mode];
    const cfg = MODE_CONFIG[mode];
    if (!t) return `
      <div class="popup-mode-col">
        <div class="popup-mode-icon-empty">
          <span style="font-size:0.7rem;color:rgba(255,255,255,0.2)">?</span>
        </div>
      </div>`;
    const tierKey = (t.pos===0?'ht':'lt')+t.tier;
    return `
      <div class="popup-mode-col">
        <div class="popup-mode-icon ${ICONCLS[tierKey]||''}">
          ${cfg ? `<img src="${cfg.img}" width="20" height="20" style="object-fit:contain"/>` : ''}
        </div>
        <span class="popup-mode-label ${LBLCLS[tierKey]||''}">${TLABELS[tierKey]||'?'}</span>
      </div>`;
  }).join('');

  const html = `
    <div class="player-popup-overlay" id="playerPopupOverlay" onclick="closePlayerPopup(event)">
      <div class="player-popup">

        <!-- Close -->
        <button class="player-popup-close" onclick="document.getElementById('playerPopupOverlay').remove()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <!-- Avatar circle -->
        <div class="popup-avatar-wrap">
          <img class="popup-avatar" src="${bustUrl}" alt="${esc(username)}"
               onerror="this.src='${avatarUrl}';this.onerror=null"/>
        </div>

        <!-- Username -->
        <div class="popup-username">${esc(username)}</div>

        <!-- Badge pill -->
        <div class="popup-badge-wrap">
          <div class="popup-badge-pill ${getPlayerBadge(totalPoints).cls}">
            <img src="${getPlayerBadge(totalPoints).img}" width="18" height="18" style="object-fit:contain;flex-shrink:0"/>
            <span>${getPlayerBadge(totalPoints).name}</span>
          </div>
        </div>

        <!-- Region · Platform -->
        <div class="popup-region">${playerData.region||''} ${playerData.platform ? '· '+playerData.platform : ''}</div>

        <!-- POSITION -->
        <div class="popup-section-label">POSITION</div>
        <div class="popup-position-row">
          <div class="popup-pos-badge" style="position:relative;width:52px;height:36px;flex-shrink:0;overflow:hidden;border-radius:4px">
            <img src="${rankSvgUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill"/>
            <span style="position:relative;z-index:2;font-family:var(--font-display);font-size:1rem;font-weight:700;color:#fff;padding-left:8px;line-height:36px">${rank}.</span>
          </div>
          <span class="popup-pos-label">
            <img src="/img/tier_1.svg" width="16" height="16" style="object-fit:contain;vertical-align:middle;margin-right:4px"/>
            OVERALL
          </span>
          <span class="popup-pos-pts">(${totalPoints} points)</span>
        </div>

        <!-- TIERS -->
        <div class="popup-section-label">TIERS</div>
        <div class="popup-tiers-grid">${tiersHtml}</div>

        <!-- Actions -->
        <div class="popup-actions">
          <a href="/player/${encodeURIComponent(username)}" class="btn btn-secondary btn-sm">View Full Profile</a>
          <a href="/compare?a=${encodeURIComponent(username)}" class="btn btn-secondary btn-sm">Compare</a>
        </div>

      </div>
    </div>`;

  document.getElementById('playerPopupOverlay')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function closePlayerPopup(e) {
  if (e.target.id === 'playerPopupOverlay') document.getElementById('playerPopupOverlay')?.remove();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('playerPopupOverlay')?.remove();
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}


/* ─── INFO MODAL ─────────────────────────────────────────────── */
function closeInfoModal(e) {
  if (e.target === document.getElementById('infoModalOverlay')) {
    document.getElementById('infoModalOverlay').classList.remove('open');
  }
}

function switchInfoTab(tab) {
  document.getElementById('contentTitles').style.display = tab === 'titles' ? '' : 'none';
  document.getElementById('contentPoints').style.display = tab === 'points' ? '' : 'none';
  document.getElementById('tabTitles').classList.toggle('active', tab === 'titles');
  document.getElementById('tabPoints').classList.toggle('active', tab === 'points');
}

/* ─── BADGE CALCULATION ──────────────────────────────────────── */
const BADGE_THRESHOLDS = [
  { min: 150, name: 'Combat Grandmaster', img: '/img/combat_grandmaster.webp', cls: 'info-badge-grandmaster' },
  { min: 100, name: 'Combat Master',      img: '/img/combat_master.webp',      cls: 'info-badge-master'      },
  { min: 60,  name: 'Combat Ace',         img: '/img/combat_ace.svg',          cls: 'info-badge-ace'         },
  { min: 30,  name: 'Combat Specialist',  img: '/img/combat_specialist.svg',   cls: 'info-badge-specialist'  },
  { min: 15,  name: 'Combat Cadet',       img: '/img/combat_cadet.svg',        cls: 'info-badge-cadet'       },
  { min: 6,   name: 'Combat Novice',      img: '/img/combat_novice.svg',       cls: 'info-badge-novice'      },
  { min: 0,   name: 'Rookie',             img: '/img/rookie.svg',              cls: 'info-badge-rookie'      },
];

function getPlayerBadge(totalPoints) {
  return BADGE_THRESHOLDS.find(b => totalPoints >= b.min) || BADGE_THRESHOLDS[BADGE_THRESHOLDS.length - 1];
}

function renderBadgeChip(totalPoints) {
  const badge = getPlayerBadge(totalPoints);
  return `<span class="player-badge-chip ${badge.cls}" title="${badge.name}">
    <img src="${badge.img}" width="14" height="14" style="object-fit:contain"/>
    ${badge.name}
  </span>`;
}
