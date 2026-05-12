/* PrimeTiers — Testers Page v2 */

const MODES_ORDER = ['crystal','sword','uhc','pot','neth_pot','smp','axe','mace'];
const POINTS_MAP  = {'1_0':60,'1_1':45,'2_0':30,'2_1':20,'3_0':10,'3_1':6,'4_0':4,'4_1':3,'5_0':2,'5_1':1};
const TLABELS     = {ht1:'HT1',lt1:'LT1',ht2:'HT2',lt2:'LT2',ht3:'HT3',lt3:'LT3',ht4:'HT4',lt4:'LT4',ht5:'HT5',lt5:'LT5'};
const TCLS        = {ht1:'tier-ht1',lt1:'tier-lt1',ht2:'tier-ht2',lt2:'tier-lt2',ht3:'tier-ht3',lt3:'tier-lt3',ht4:'tier-ht4',lt4:'tier-lt4',ht5:'tier-ht5',lt5:'tier-lt5'};

let allTesters = [];

document.addEventListener('DOMContentLoaded', () => {
  loadTesters();
  renderReputation();
});

async function loadTesters() {
  try {
    const res = await fetch('/api/testers');
    allTesters = await res.json();

    // Fetch Discord presence for testers with discord_id
    await fetchDiscordPresence(allTesters);

    renderStats(allTesters);
    renderTesters(allTesters);
  } catch(e) {
    document.getElementById('testersGrid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">Failed to load testers.</div>`;
  }
}

async function fetchDiscordPresence(testers) {
  // Fetch Discord online status from our server endpoint
  const withDiscord = testers.filter(t => t.discord_id);
  if (!withDiscord.length) return;
  try {
    const res = await fetch('/api/discord-presence');
    if (!res.ok) return;
    const presence = await res.json(); // { discord_id: 'online'|'offline'|'idle'|'dnd' }
    for (const t of testers) {
      if (t.discord_id && presence[t.discord_id] !== undefined) {
        t.is_online = ['online','idle','dnd'].includes(presence[t.discord_id]);
        t.discord_status = presence[t.discord_id];
      }
    }
  } catch(e) {
    // Fallback to stored is_online value
  }
}

function renderStats(testers) {
  const online = testers.filter(t => t.is_online).length;
  const total  = testers.length;
  const el = document.getElementById('testersStats');
  if (!el) return;
  el.innerHTML = `
    <div class="tester-stat">
      <div class="tester-stat-value">${total}</div>
      <div class="tester-stat-label">Total Testers</div>
    </div>
    <div class="tester-stat">
      <div class="tester-stat-value" style="color:#22c55e">${online}</div>
      <div class="tester-stat-label">Online Now</div>
    </div>
    <div class="tester-stat">
      <div class="tester-stat-value">${total - online}</div>
      <div class="tester-stat-label">Offline</div>
    </div>
  `;
}

function getBustSrc(t) {
  if (t.username) return `https://render.crafty.gg/3d/bust/${t.username}`;
  if (t.skin_url)  return t.skin_url;
  return null;
}

function getAvatarSrc(t) {
  if (t.username) return `https://mc-heads.net/avatar/${t.username}/80`;
  if (t.skin_url)  return t.skin_url;
  return null;
}

function getBestTier(tiers) {
  if (!tiers) return null;
  const entries = Object.entries(tiers);
  if (!entries.length) return null;
  return entries.sort((a,b) => (a[1].tier*2+a[1].pos) - (b[1].tier*2+b[1].pos))[0];
}

function tierBadge(tier, pos, size='sm') {
  const k = (pos===0?'ht':'lt')+tier;
  return `<span class="tier-badge ${TCLS[k]||''} ${size}">${TLABELS[k]||'?'}</span>`;
}

function statusLabel(t) {
  const map = { online:'Online', idle:'Idle', dnd:'Do Not Disturb', offline:'Offline' };
  const s = t.discord_status || (t.is_online ? 'online' : 'offline');
  return map[s] || (t.is_online ? 'Online' : 'Offline');
}

function renderTesters(testers) {
  const grid = document.getElementById('testersGrid');
  if (!testers.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)">No testers yet.</div>`;
    return;
  }

  grid.innerHTML = testers.map(t => {
    const bustSrc   = getBustSrc(t);
    const avatarSrc = getAvatarSrc(t);
    const isOnline  = t.is_online;
    const specialties = t.specialties ? t.specialties.split(',').map(s=>s.trim()).filter(Boolean) : [];

    // Mode icons from specialties
    const modeIconsHtml = specialties.map(s => {
      const mc = MODE_CONFIG[s];
      return mc ? `<img src="${mc.img}" width="18" height="18" title="${mc.label}" style="object-fit:contain"/>` : '';
    }).filter(Boolean).join('');

    // Tier badges — show best tier per specialty mode
    const tierBadgesHtml = specialties.map(s => {
      const tier = t.tiers?.[s];
      return tier ? tierBadge(tier.tier, tier.pos) : '';
    }).filter(Boolean).join('');

    return `
      <div class="tester-card ${isOnline?'is-online':''}" onclick="openTesterModal(${t.id})">
        <div class="tester-card-bust">
          ${bustSrc
            ? `<img src="${bustSrc}" alt="${escHtml(t.username)}"
                   onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
               <div class="tester-card-initials" style="display:none">${escHtml(t.username).charAt(0).toUpperCase()}</div>`
            : `<div class="tester-card-initials">${escHtml(t.username).charAt(0).toUpperCase()}</div>`
          }
          <div class="tester-card-status ${isOnline?'online':'offline'}">
            <span class="status-dot"></span>
            ${statusLabel(t)}
          </div>
        </div>
        <div class="tester-card-body">
          <div class="tester-card-name">${escHtml(t.username)}</div>
          ${modeIconsHtml ? `<div class="tester-card-modes">${modeIconsHtml}</div>` : ''}
          ${tierBadgesHtml ? `<div class="tester-card-tiers">${tierBadgesHtml}</div>` : ''}
          ${t.region ? `<div class="tester-card-region">${escHtml(t.region)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function renderReputation() {
  const el = document.getElementById('testersReputation');
  if (!el) return;
  el.innerHTML = `
    <h2>Tester Requirements</h2>
    <div class="reputation-list">
      <div class="reputation-item">
        <div class="reputation-icon" style="background:rgba(245,158,11,0.1)">🏆</div>
        <div><strong>Tier 1–3 in at least one gamemode</strong> — Must be a high-level competitive player</div>
      </div>
      <div class="reputation-item">
        <div class="reputation-icon" style="background:rgba(34,197,94,0.1)">✅</div>
        <div><strong>Verified by PrimeTiers staff</strong> — Background check and skill verification required</div>
      </div>
      <div class="reputation-item">
        <div class="reputation-icon" style="background:rgba(88,101,242,0.1)">💬</div>
        <div><strong>Active Discord member</strong> — Must be reachable and responsive in our server</div>
      </div>
      <div class="reputation-item">
        <div class="reputation-icon" style="background:rgba(168,85,247,0.1)">⚖️</div>
        <div><strong>Fair and unbiased</strong> — Testers must judge objectively without personal bias</div>
      </div>
      <div class="reputation-item">
        <div class="reputation-icon" style="background:rgba(239,68,68,0.1)">🎯</div>
        <div><strong>Consistent availability</strong> — Expected to test regularly and meet monthly quotas</div>
      </div>
    </div>
  `;
}

function openTesterModal(id) {
  const t = allTesters.find(x => x.id === id);
  if (!t) return;

  const bustSrc   = getBustSrc(t);
  const avatarSrc = getAvatarSrc(t);
  const specialties = t.specialties ? t.specialties.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const isOnline  = t.is_online;

  let totalPts = 0;
  if (t.tiers) {
    const pts = Object.values(t.tiers).map(x => POINTS_MAP[`${x.tier}_${x.pos}`]||0).sort((a,b)=>b-a);
    totalPts = pts.slice(0,3).reduce((s,p)=>s+p,0);
  }

  const tiersHtml = MODES_ORDER.map(mode => {
    const mc   = MODE_CONFIG[mode];
    const tier = t.tiers?.[mode];
    const k    = tier ? (tier.pos===0?'ht':'lt')+tier.tier : null;
    return `
      <div class="tm-mode-col">
        <div class="tm-mode-icon ${k?'tm-icon-'+k:'tm-icon-empty'}">
          ${mc?`<img src="${mc.img}" width="20" height="20" style="object-fit:contain"/>`:''}
        </div>
        <span class="tm-mode-label ${k?TCLS[k]:''}">
          ${k ? TLABELS[k] : '<span style="color:rgba(255,255,255,0.15)">—</span>'}
        </span>
      </div>`;
  }).join('');

  document.getElementById('testerModal').innerHTML = `
    <button class="tm-close" onclick="document.getElementById('testerModalOverlay').classList.remove('open')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <div class="tm-avatar-wrap">
      ${bustSrc
        ? `<img class="tm-bust" src="${bustSrc}" alt="${escHtml(t.username)}"
               onerror="this.src='${avatarSrc||''}';this.onerror=null"/>`
        : `<div class="tm-initials">${escHtml(t.username).charAt(0).toUpperCase()}</div>`
      }
      <div class="tm-status-badge ${isOnline?'online':'offline'}">
        <span class="status-dot"></span>
        ${statusLabel(t)}
      </div>
    </div>

    <div class="tm-username">${escHtml(t.username)}</div>
    <div class="tm-role">${escHtml(t.role||'Tester')}</div>
    ${t.region ? `<div class="tm-region">${escHtml(t.region)}</div>` : ''}

    ${specialties.length ? `
      <div class="tm-section-label">SPECIALTIES</div>
      <div class="tm-specialties">
        ${specialties.map(s => {
          const mc = MODE_CONFIG[s];
          const tier = t.tiers?.[s];
          return `<span class="tm-spec-chip">
            ${mc?`<img src="${mc.img}" width="14" height="14" style="object-fit:contain"/>`:''}
            ${mc?.label||s}
            ${tier ? tierBadge(tier.tier, tier.pos) : ''}
          </span>`;
        }).join('')}
      </div>` : ''}

    ${t.tiers ? `
      <div class="tm-section-label">ALL TIERS</div>
      <div class="tm-tiers-grid">${tiersHtml}</div>` : ''}

    ${totalPts > 0 ? `
      <div class="tm-section-label">TOTAL POINTS</div>
      <div class="tm-points">${totalPts} pts</div>` : ''}

    ${t.username ? `
      <div class="tm-actions">
        <a href="/player/${encodeURIComponent(t.username)}" class="btn btn-secondary btn-sm">View Profile</a>
        <a href="/compare?a=${encodeURIComponent(t.username)}" class="btn btn-secondary btn-sm">Compare</a>
      </div>` : ''}
  `;

  document.getElementById('testerModalOverlay').classList.add('open');
}

function closeTesterModal(e) {
  if (e.target === document.getElementById('testerModalOverlay')) {
    document.getElementById('testerModalOverlay').classList.remove('open');
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('testerModalOverlay')?.classList.remove('open');
});

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
