/* PrimeTiers - Player Profile */

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const username = pathParts[1] ? decodeURIComponent(pathParts[1]) : null;
  if (!username) { showNotFound('No username specified'); return; }
  document.title = `PrimeTiers | ${username}`;
  loadProfile(username);
});

async function loadProfile(username) {
  try {
    const res = await fetch(`/api/players?search=${encodeURIComponent(username)}&limit=10`);
    const data = await res.json();
    const player = data.players?.find(p => p.username.toLowerCase() === username.toLowerCase());
    if (!player) { showNotFound(username); return; }
    renderProfile(player);
  } catch (err) {
    showNotFound(username);
  }
}

function renderProfile(player) {
  const content = document.getElementById('profileContent');
  if (!content) return;

  const POINTS = {'1_0':60,'1_1':45,'2_0':30,'2_1':20,'3_0':10,'3_1':6,'4_0':4,'4_1':3,'5_0':2,'5_1':1};
  const TLABELS = {ht1:'HT1',lt1:'LT1',ht2:'HT2',lt2:'LT2',ht3:'HT3',lt3:'LT3',ht4:'HT4',lt4:'LT4',ht5:'HT5',lt5:'LT5'};
  const LBLCLS  = {ht1:'ol-lbl-ht1',lt1:'ol-lbl-lt1',ht2:'ol-lbl-ht2',lt2:'ol-lbl-lt2',ht3:'ol-lbl-ht3',lt3:'ol-lbl-lt3',ht4:'ol-lbl-ht4',lt4:'ol-lbl-lt4',ht5:'ol-lbl-ht5',lt5:'ol-lbl-lt5'};
  const ICONCLS = {ht1:'ol-icon-ht1',lt1:'ol-icon-lt1',ht2:'ol-icon-ht2',lt2:'ol-icon-lt2',ht3:'ol-icon-ht3',lt3:'ol-icon-lt3',ht4:'ol-icon-ht4',lt4:'ol-icon-lt4',ht5:'ol-icon-ht5',lt5:'ol-icon-lt5'};

  const modeEntries = Object.entries(player.tiers || {});
  const modePoints = modeEntries.map(([mode, t]) => ({
    mode, tier: t.tier, pos: t.pos,
    points: POINTS[`${t.tier}_${t.pos}`] || 0,
  })).sort((a, b) => b.points - a.points);

  const totalPoints = modePoints.slice(0, 3).reduce((s, m) => s + m.points, 0);
  const bestMode = modePoints[0];
  const bestTierKey = bestMode ? (bestMode.pos===0?'ht':'lt')+bestMode.tier : null;
  const bestTierHtml = bestTierKey ? renderTierBadge(bestMode.tier, bestMode.pos, 'lg') : '';

  const bustUrl = getBustUrl(player.uuid, player.username, player.skin_url);
  const avatarUrl = getAvatarUrl(player.uuid, player.username, player.skin_url);

  // Tier breakdown — circle icon + label, same style as leaderboard
  const allModes = Object.keys(MODE_CONFIG);
  const tierCards = allModes.map(mode => {
    const t = player.tiers[mode];
    const cfg = MODE_CONFIG[mode];
    if (!t) {
      return `
        <div class="pf-mode-card pf-mode-untested">
          <div class="pf-mode-header">
            <div class="pf-mode-icon-wrap">
              ${cfg ? `<img src="${cfg.img}" width="20" height="20" style="object-fit:contain;opacity:0.3"/>` : ''}
            </div>
            <span class="pf-mode-name" style="opacity:0.4">${cfg?.label||mode}</span>
          </div>
          <span class="pf-mode-untested-label">Not Yet Tested</span>
        </div>`;
    }

    const tierKey = (t.pos===0?'ht':'lt')+t.tier;
    const attainedDate = t.attained ? new Date(Number(t.attained)*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : null;
    const peakKey = (t.peak_pos===0?'ht':'lt')+t.peak_tier;
    const retiredBadge = (t.retired===true||t.retired==='true') ? '<span class="chip chip-red" style="font-size:0.62rem">Retired</span>' : '';

    return `
      <div class="pf-mode-card">
        <div class="pf-mode-header">
          <div class="pf-mode-icon-wrap ${ICONCLS[tierKey]||''}">
            ${cfg ? `<img src="${cfg.img}" width="20" height="20" style="object-fit:contain"/>` : ''}
          </div>
          <span class="pf-mode-name">${cfg?.label||mode}</span>
          ${retiredBadge}
        </div>
        <div class="pf-mode-tier">
          <span class="tier-badge ${tierKey==='ht1'?'tier-ht1':tierKey==='lt1'?'tier-lt1':tierKey==='ht2'?'tier-ht2':tierKey==='lt2'?'tier-lt2':tierKey==='ht3'?'tier-ht3':tierKey==='lt3'?'tier-lt3':tierKey==='ht4'?'tier-ht4':tierKey==='lt4'?'tier-lt4':tierKey==='ht5'?'tier-ht5':'tier-lt5'} md">${TLABELS[tierKey]||'?'}</span>
        </div>
        <div class="pf-mode-meta">
          <span>Peak: <span class="tier-badge ${peakKey==='ht1'?'tier-ht1':peakKey==='lt1'?'tier-lt1':peakKey==='ht2'?'tier-ht2':peakKey==='lt2'?'tier-lt2':peakKey==='ht3'?'tier-ht3':peakKey==='lt3'?'tier-lt3':peakKey==='ht4'?'tier-ht4':peakKey==='lt4'?'tier-lt4':peakKey==='ht5'?'tier-ht5':'tier-lt5'} sm">${TLABELS[peakKey]||'?'}</span></span>
          ${attainedDate ? `<span>Since ${attainedDate}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  content.innerHTML = `
    <!-- Banner -->
    <div class="pf-banner">
      <div class="pf-banner-bg" style="background:linear-gradient(135deg,hsl(${hashCode(player.username)%360},50%,12%),hsl(${(hashCode(player.username)+80)%360},40%,8%))"></div>
      <div class="pf-banner-fade"></div>
    </div>

    <div class="container pf-header">
      <div class="pf-avatar-wrap">
        <img class="pf-avatar" src="${bustUrl}" alt="${escapeHtml(player.username)}"
             onerror="this.src='${avatarUrl}';this.onerror=null"/>
      </div>

      <div class="pf-identity">
        <h1 class="pf-username">
          ${escapeHtml(player.username)}
          ${countryFlag(player.country_code)}
        </h1>
        ${bestTierHtml ? `<div class="pf-best-tier">${bestTierHtml}</div>` : ''}
        <div class="pf-meta">
          ${player.region ? `<span>${player.region}</span>` : ''}
          ${player.platform ? `<span>${player.platform}</span>` : ''}
          ${player.created_at ? `<span>Joined ${new Date(player.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</span>` : ''}
          <span>Active ${timeAgo(player.last_active)}</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="pf-stats">
        <div class="pf-stat">
          <div class="pf-stat-value" style="color:var(--gold)">${totalPoints.toLocaleString()}</div>
          <div class="pf-stat-label">Total Points</div>
        </div>
        <div class="pf-stat">
          <div class="pf-stat-value">${modeEntries.length}</div>
          <div class="pf-stat-label">Modes Tested</div>
        </div>
        <div class="pf-stat">
          <div class="pf-stat-value">${player.region||'—'}</div>
          <div class="pf-stat-label">Region</div>
        </div>
        <div class="pf-stat">
          <div class="pf-stat-value">${player.platform||'Java'}</div>
          <div class="pf-stat-label">Platform</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="pf-actions">
        <button class="btn btn-secondary btn-sm" onclick="copyProfileLink()">Share Profile</button>
        <a href="https://discord.gg/eDNEpky8Tf" target="_blank" class="btn btn-discord btn-sm">Challenge on Discord</a>
        <a href="/compare?a=${encodeURIComponent(player.username)}" class="btn btn-secondary btn-sm">Compare</a>
      </div>
    </div>

    <div class="divider"></div>

    <div class="container" style="padding:40px 0 80px">
      <!-- Tier Breakdown -->
      <div class="pf-section">
        <h2 class="pf-section-title">Tier Breakdown</h2>
        <div class="pf-modes-grid">${tierCards}</div>
      </div>

      <!-- Player Info -->
      <div class="pf-section">
        <h2 class="pf-section-title">Player Info</h2>
        <div class="pf-info-card">
          <div class="pf-info-row">
            <div class="pf-info-item">
              <div class="pf-info-label">Minecraft UUID</div>
              <code class="pf-info-code">${player.uuid}</code>
            </div>
            <div class="pf-info-item">
              <div class="pf-info-label">API Endpoint</div>
              <code class="pf-info-code">/api/player/${player.uuid}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showNotFound(username) {
  const content = document.getElementById('profileContent');
  if (!content) return;
  content.innerHTML = `
    <div class="container" style="padding:120px 24px;text-align:center">
      <div style="font-size:3rem;margin-bottom:16px">404</div>
      <h2 style="font-size:1.5rem;margin-bottom:8px">Player Not Found</h2>
      <p style="color:var(--text-secondary);margin-bottom:24px">"${escapeHtml(username||'Unknown')}" hasn't been ranked yet.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="/rankings" class="btn btn-primary">Browse Rankings</a>
        <a href="/apply" class="btn btn-secondary">Apply for Testing</a>
      </div>
    </div>`;
}

function copyProfileLink() {
  navigator.clipboard?.writeText(window.location.href).then(() => showToast('Profile link copied!', 'success'));
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h<<5)-h)+str.charCodeAt(i); h|=0; }
  return Math.abs(h);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
