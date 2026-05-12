/* */

const compareState = { p1: null, p2: null };

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const a = params.get('a');
  const b = params.get('b');

  if (a) {
    document.getElementById('player1Input').value = a;
    loadPlayer(1);
  }
  if (b) {
    document.getElementById('player2Input').value = b;
    loadPlayer(2);
  }
});

async function loadPlayer(num) {
  const input = document.getElementById(`player${num}Input`);
  const username = input?.value.trim();
  if (!username) { showToast('Enter a username', 'error'); return; }

  try {
    const res = await fetch(`/api/players?search=${encodeURIComponent(username)}&limit=5`);
    const data = await res.json();
    const player = data.players?.find(p => p.username.toLowerCase() === username.toLowerCase())
      || data.players?.[0];

    if (!player) {
      showToast(`Player "${username}" not found`, 'error');
      return;
    }

    compareState[`p${num}`] = player;
    showToast(`Loaded ${player.username}`, 'success');
    renderComparison();
  } catch (err) {
    showToast('Failed to load player', 'error');
  }
}

function renderComparison() {
  const container = document.getElementById('compareResult');
  if (!container) return;

  const { p1, p2 } = compareState;
  if (!p1 && !p2) return;

  const POINTS = { '1_0': 60, '1_1': 45, '2_0': 30, '2_1': 20, '3_0': 10, '3_1': 6, '4_0': 4, '4_1': 3, '5_0': 2, '5_1': 1 };

  const getPoints = (player) => {
    if (!player) return 0;
    return Object.values(player.tiers || {})
      .map(t => POINTS[`${t.tier}_${t.pos}`] || 0)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((s, v) => s + v, 0);
  };

  const p1Points = getPoints(p1);
  const p2Points = getPoints(p2);

  const renderPlayerHeader = (p, points) => {
    if (!p) return `<div class="compare-player-header"><div style="color:var(--prime-gray-400)">No player loaded</div></div>`;
    const bestMode = Object.values(p.tiers || {}).sort((a, b) => (a.tier * 2 + a.pos) - (b.tier * 2 + b.pos))[0];
    return `
      <div class="compare-player-header">
        <div class="compare-avatar" id="cav_${p.uuid.replace(/-/g,'')}">
          <img src="${getAvatarUrl(p.uuid, p.username, p.skin_url)}" alt="${escapeHtml(p.username)}"
               onerror="this.remove();document.getElementById('cav_${p.uuid.replace(/-/g,'')}').textContent='${escapeHtml(p.username).charAt(0).toUpperCase()}'"/>
        </div>
        <div style="font-family:var(--font-display);font-weight:700;font-size:1.1rem;margin-bottom:8px">
          ${escapeHtml(p.username)} ${countryFlag(p.country_code)}
        </div>
        ${bestMode ? renderTierBadge(bestMode.tier, bestMode.pos, 'md') : ''}
        <div style="font-family:var(--font-stats);color:var(--prime-gold-400);font-size:1.1rem;margin-top:8px">
          ${points.toLocaleString()} pts
        </div>
      </div>
    `;
  };

  const allModes = Object.keys(MODE_CONFIG);
  const modeRows = allModes.map(mode => {
    const t1 = p1?.tiers?.[mode];
    const t2 = p2?.tiers?.[mode];

    const pts1 = t1 ? (POINTS[`${t1.tier}_${t1.pos}`] || 0) : 0;
    const pts2 = t2 ? (POINTS[`${t2.tier}_${t2.pos}`] || 0) : 0;

    const w1 = pts1 > pts2;
    const w2 = pts2 > pts1;

    const cell1 = t1
      ? renderTierBadge(t1.tier, t1.pos, 'sm')
      : `<span style="color:var(--prime-gray-600);font-size:0.8rem">"</span>`;

    const cell2 = t2
      ? renderTierBadge(t2.tier, t2.pos, 'sm')
      : `<span style="color:var(--prime-gray-600);font-size:0.8rem">"</span>`;

    return `
      <div class="compare-cell ${w1 ? 'winner' : ''}">${cell1}</div>
      <div class="compare-mode-label" title="${MODE_CONFIG[mode].label}">${MODE_CONFIG[mode]?.img ? `<img src="${MODE_CONFIG[mode].img}" width="20" height="20" style="object-fit:contain" alt="${MODE_CONFIG[mode].label}"/>` : ""}</div>
      <div class="compare-cell ${w2 ? 'winner' : ''}">${cell2}</div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="compare-grid">
      ${renderPlayerHeader(p1, p1Points)}
      <div class="compare-center-header">Mode</div>
      ${renderPlayerHeader(p2, p2Points)}
      ${modeRows}
      <!-- Total row -->
      <div class="compare-cell ${p1Points > p2Points ? 'winner' : ''}" style="border-bottom:none;border-radius:0 0 0 ${p1 ? 'var(--radius-lg)' : '0'}">
        <span style="font-family:var(--font-stats);font-size:1rem;color:var(--prime-gold-400)">${p1Points.toLocaleString()}</span>
      </div>
      <div class="compare-mode-label" style="border-bottom:none;font-size:0.65rem;font-weight:700;color:var(--prime-gray-400)">TOTAL</div>
      <div class="compare-cell ${p2Points > p1Points ? 'winner' : ''}" style="border-bottom:none;border-radius:0 0 ${p2 ? 'var(--radius-lg)' : '0'} 0">
        <span style="font-family:var(--font-stats);font-size:1rem;color:var(--prime-gold-400)">${p2Points.toLocaleString()}</span>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

