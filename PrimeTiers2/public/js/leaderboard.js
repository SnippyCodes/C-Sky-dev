/* */

let lbState = { region: '', mode: '' };

document.addEventListener('DOMContentLoaded', () => {
  setupModeFilter();
  setupRegionTabs();
  loadLeaderboard();
});

function setupModeFilter() {
  const select = document.getElementById('lbModeFilter');
  if (!select) return;

  Object.entries(MODE_CONFIG).forEach(([key, cfg]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = cfg.label;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    lbState.mode = select.value;
    loadLeaderboard();
  });
}

function setupRegionTabs() {
  const tabs = document.querySelectorAll('#lbRegionTabs .mode-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      lbState.region = tab.dataset.region;
      loadLeaderboard();
    });
  });
}

async function loadLeaderboard() {
  const podium = document.getElementById('podium');
  const tableWrap = document.getElementById('lbTableWrap');

  if (podium) podium.innerHTML = `<div class="skeleton" style="height:280px;border-radius:20px;grid-column:1/-1"></div>`;
  if (tableWrap) tableWrap.innerHTML = `<div class="skeleton" style="height:400px;border-radius:16px;margin-top:24px"></div>`;

  try {
    let url = `/api/leaderboard?limit=100`;
    if (lbState.region) url += `&region=${lbState.region}`;
    if (lbState.mode) url += `&mode=${lbState.mode}`;

    const res = await fetch(url);
    const players = await res.json();

    renderPodium(players.slice(0, 3));
    renderLbTable(players.slice(3));
  } catch (err) {
    if (podium) podium.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--prime-gray-400)">Failed to load leaderboard.</div>`;
  }
}

function renderPodium(top3) {
  const container = document.getElementById('podium');
  if (!container) return;

  if (!top3.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--prime-gray-400)">No players ranked yet.</div>`;
    return;
  }

  // Visual order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]];
  const classes = ['p2', 'p1', 'p3'];
  const crowns = ['', '', ''];
  const rankNums = ['#2', '#1', '#3'];

  container.innerHTML = order.map((p, i) => {
    if (!p) return `<div></div>`;

    const bestMode = Object.values(p.modes || {}).sort((a, b) => (a.tier * 2 + a.pos) - (b.tier * 2 + b.pos))[0];
    const tierHtml = bestMode ? renderTierBadge(bestMode.tier, bestMode.pos, 'md') : '';

    const topModes = Object.entries(p.modes || {}).slice(0, 3);

    return `
      <div class="podium-card ${classes[i]}" onclick="window.location='/player/${encodeURIComponent(p.username)}'">
        <div class="podium-rank">${rankNums[i]}</div>
        <div class="podium-crown">${crowns[i]}</div>
        <div class="podium-avatar">
          <img src="${getAvatarUrl(p.uuid, p.username, p.skin_url)}" alt="${escapeHtml(p.username)}"
               onerror="this.style.display='none';this.parentElement.textContent=''"/>
        </div>
        <div class="podium-username">${escapeHtml(p.username)} ${countryFlag(p.country_code)}</div>
        ${tierHtml}
        <div class="podium-modes">
          ${topModes.map(([mode]) => `<span class="podium-mode-icon" title="${MODE_CONFIG[mode]?.label}">${MODE_CONFIG[mode]?.icon || ''}</span>`).join('')}
        </div>
        <div class="podium-points">${p.points.toLocaleString()} pts</div>
      </div>
    `;
  }).join('');
}

function renderLbTable(players) {
  const container = document.getElementById('lbTableWrap');
  if (!container) return;

  if (!players.length) {
    container.innerHTML = '';
    return;
  }

  const rows = players.map((p, i) => {
    const rank = i + 4;
    const bestMode = Object.values(p.modes || {}).sort((a, b) => (a.tier * 2 + a.pos) - (b.tier * 2 + b.pos))[0];
    const tierHtml = bestMode ? renderTierBadge(bestMode.tier, bestMode.pos, 'sm') : '"';

    return `
      <tr onclick="window.location='/player/${encodeURIComponent(p.username)}'">
        <td><span class="rank-num ${rank <= 10 ? 'top-10' : ''}">${rank}</span></td>
        <td>
          <div class="player-cell">
            <div class="player-avatar">
              <img src="${getAvatarUrl(p.uuid, p.username, p.skin_url)}" alt="${escapeHtml(p.username)}"
                   onerror="this.style.display='none';this.parentElement.textContent=''"/>
            </div>
            <div>
              <div class="player-name">${escapeHtml(p.username)}</div>
            </div>
            <span>${countryFlag(p.country_code)}</span>
          </div>
        </td>
        <td>${tierHtml}</td>
        <td><span class="points-cell">${p.points.toLocaleString()}</span></td>
        <td>${p.region || '"'}</td>
        <td>
          <a href="/player/${encodeURIComponent(p.username)}" class="btn btn-secondary btn-sm"
             onclick="event.stopPropagation()">Profile</a>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="lb-table-wrap">
      <table class="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Best Tier</th>
            <th>Points</th>
            <th>Region</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}


