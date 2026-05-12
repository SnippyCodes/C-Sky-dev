/* */

const applyData = {
  username: '',
  uuid: '',
  platform: 'Java',
  region: 'NA',
  modes: [],
  discord: '',
  selfAssess: '',
};

let currentStep = 1;

document.addEventListener('DOMContentLoaded', () => {
  renderModesGrid();
});

function renderModesGrid() {
  const grid = document.getElementById('modesSelectGrid');
  if (!grid) return;

  grid.innerHTML = Object.entries(MODE_CONFIG).map(([key, cfg]) => `
    <button class="mode-select-btn" data-mode="${key}" onclick="toggleMode(this, '${key}')">
      <span class="mode-icon">${cfg.img ? `<img src="${cfg.img}" width="32" height="32" style="object-fit:contain" alt="${cfg.label}"/>` : ""}</span>
      <span class="mode-name">${cfg.label}</span>
    </button>
  `).join('');
}

function toggleMode(btn, mode) {
  btn.classList.toggle('selected');
  if (btn.classList.contains('selected')) {
    if (!applyData.modes.includes(mode)) applyData.modes.push(mode);
  } else {
    applyData.modes = applyData.modes.filter(m => m !== mode);
  }
}

function selectPlatform(el) {
  document.querySelectorAll('.platform-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  applyData.platform = el.dataset.value;
}

function nextStep(from) {
  // Validate
  if (from === 1) {
    const username = document.getElementById('applyUsername')?.value.trim();
    if (!username) { showToast('Please enter your Minecraft username', 'error'); return; }
    applyData.username = username;
    applyData.uuid = document.getElementById('applyUUID')?.value.trim();
  }
  if (from === 2) {
    if (!applyData.platform) { showToast('Please select a platform', 'error'); return; }
    applyData.region = document.getElementById('applyRegion')?.value || 'NA';
  }
  if (from === 3) {
    if (!applyData.modes.length) { showToast('Please select at least one game mode', 'error'); return; }
  }
  if (from === 4) {
    const discord = document.getElementById('applyDiscord')?.value.trim();
    if (!discord) { showToast('Please enter your Discord username', 'error'); return; }
    applyData.discord = discord;
    applyData.selfAssess = document.getElementById('applySelfAssess')?.value;
  }

  goToStep(from + 1);
}

function prevStep(from) {
  goToStep(from - 1);
}

function goToStep(step) {
  document.querySelectorAll('.apply-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`)?.classList.add('active');

  // Update progress
  document.querySelectorAll('.progress-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (n === step) s.classList.add('active');
    else if (n < step) s.classList.add('done');
  });

  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = `${(step / 5) * 100}%`;

  currentStep = step;

  if (step === 5) renderReview();
}

function renderReview() {
  const review = document.getElementById('applyReview');
  if (!review) return;

  const modeLabels = applyData.modes.map(m => `${MODE_CONFIG[m]?.label}`).join(', ');

  review.innerHTML = `
    <div class="review-row">
      <span class="review-label">Username</span>
      <span class="review-value">${escapeHtml(applyData.username)}</span>
    </div>
    ${applyData.uuid ? `
    <div class="review-row">
      <span class="review-label">UUID</span>
      <span class="review-value" style="font-family:var(--font-mono);font-size:0.8rem">${escapeHtml(applyData.uuid)}</span>
    </div>` : ''}
    <div class="review-row">
      <span class="review-label">Platform</span>
      <span class="review-value">${applyData.platform}</span>
    </div>
    <div class="review-row">
      <span class="review-label">Region</span>
      <span class="review-value">${applyData.region}</span>
    </div>
    <div class="review-row">
      <span class="review-label">Modes</span>
      <span class="review-value">${modeLabels || 'None selected'}</span>
    </div>
    <div class="review-row">
      <span class="review-label">Discord</span>
      <span class="review-value">${escapeHtml(applyData.discord)}</span>
    </div>
    ${applyData.selfAssess ? `
    <div class="review-row">
      <span class="review-label">Self-Assessment</span>
      <span class="review-value" style="text-transform:capitalize">${applyData.selfAssess}</span>
    </div>` : ''}
  `;
}

function submitApplication() {
  // In production, this would POST to an API endpoint
  // For now, show success state
  document.querySelectorAll('.apply-step').forEach(s => s.classList.remove('active'));
  document.getElementById('stepSuccess')?.classList.add('active');

  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = '100%';

  showToast('Application submitted! We\'ll be in touch.', 'success');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

