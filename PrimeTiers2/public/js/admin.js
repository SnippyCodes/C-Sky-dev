const VALID_MODES = ["crystal","sword","uhc","pot","neth_pot","smp","axe","mace"];
const TIER_LABELS = {"1_0":"HT1","1_1":"LT1","2_0":"HT2","2_1":"LT2","3_0":"HT3","3_1":"LT3","4_0":"HT4","4_1":"LT4","5_0":"HT5","5_1":"LT5"};
const TIER_CLASSES = {"1_0":"tier-ht1","1_1":"tier-lt1","2_0":"tier-ht2","2_1":"tier-lt2","3_0":"tier-ht3","3_1":"tier-lt3","4_0":"tier-ht4","4_1":"tier-lt4","5_0":"tier-ht5","5_1":"tier-lt5"};
const MODE_ICONS = {
  crystal:  '<img src="/img/crystal.svg"  class="mode-img-icon" alt="Crystal"/>',
  sword:    '<img src="/img/sword.svg"    class="mode-img-icon" alt="Sword"/>',
  uhc:      '<img src="/img/uhc.svg"      class="mode-img-icon" alt="UHC"/>',
  pot:      '<img src="/img/pot.svg"      class="mode-img-icon" alt="Pot"/>',
  neth_pot: '<img src="/img/neth_pot.svg" class="mode-img-icon" alt="NethPot"/>',
  smp:      '<img src="/img/smp.svg"      class="mode-img-icon" alt="SMP"/>',
  axe:      '<img src="/img/axe.svg"      class="mode-img-icon" alt="Axe"/>',
  mace:     '<img src="/img/mace.svg"     class="mode-img-icon" alt="Mace"/>',
};
const MODE_LABELS = {crystal:"Crystal",sword:"Sword",uhc:"UHC",pot:"Pot",neth_pot:"NethPot",smp:"SMP",axe:"Axe",mace:"Mace"};
let adminState = {page:"dashboard",players:[],total:0,currentPage:1,search:"",editingPlayer:null};
function api(path,opts={}){return fetch(path,{credentials:"include",headers:{"Content-Type":"application/json"},...opts});}
function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}
function tb(tier,pos,size){const k=tier+"_"+pos;return '<span class="tier-badge '+(TIER_CLASSES[k]||"")+' '+(size||"sm")+'">'+(TIER_LABELS[k]||"?")+' </span>';}
function toast(msg,type="info"){let c=document.getElementById("toast-container");if(!c){c=document.createElement("div");c.id="toast-container";document.body.appendChild(c);}const icons={success:"",error:"",info:""};const t=document.createElement("div");t.className="toast "+type;t.innerHTML="<span>"+(icons[type]||"")+"</span><span>"+msg+"</span>";c.appendChild(t);setTimeout(()=>{t.style.opacity="0";t.style.transition="0.3s";setTimeout(()=>t.remove(),300);},3500);}

document.addEventListener("DOMContentLoaded",()=>{
  checkAuth();
  document.querySelectorAll(".admin-nav-item").forEach(item=>{
    item.addEventListener("click",e=>{
      e.preventDefault();
      const page=item.dataset.page;
      if(!page)return;
      document.querySelectorAll(".admin-nav-item").forEach(i=>i.classList.remove("active"));
      item.classList.add("active");
      document.getElementById("adminPageTitle").textContent=item.textContent.trim();
      adminState.page=page;
      loadPage(page);
    });
  });
});

async function checkAuth(){
  try{
    const res=await api("/api/admin/me");
    if(!res.ok){window.location.href="/admin/login";return;}
    const data=await res.json();
    const el=document.getElementById("adminUsername");
    if(el)el.textContent=data.username;
    const av=document.getElementById("adminAvatar");
    if(av)av.textContent=(data.username||"A")[0].toUpperCase();
    loadPage("dashboard");
  }catch(e){window.location.href="/admin/login";}
}

async function logout(){
  await api("/api/admin/logout",{method:"POST"});
  window.location.href="/admin/login";
}

function toggleSidebar(){
  document.getElementById("adminSidebar").classList.toggle("open");
  document.getElementById("adminOverlay").classList.toggle("open");
}

function loadPage(page){
  const content=document.getElementById("adminContent");
  if(!content)return;
  if(page==="dashboard")loadDashboard();
  else if(page==="players")loadPlayersPage();
  else if(page==="tiers")loadTiersPage();
  else if(page==="history")loadHistoryPage();
  else if(page==="testers")loadTestersPage();
  else if(page==="settings")loadSettingsPage();
}

/* DASHBOARD */
async function loadDashboard(){
  const content=document.getElementById("adminContent");
  content.innerHTML=`
    <div class="admin-stats-grid">
      <div class="admin-stat-card skeleton" style="height:100px"></div>
      <div class="admin-stat-card skeleton" style="height:100px"></div>
      <div class="admin-stat-card skeleton" style="height:100px"></div>
      <div class="admin-stat-card skeleton" style="height:100px"></div>
    </div>
    <div class="skeleton" style="height:300px;border-radius:16px"></div>`;
  try{
    const res=await api("/api/admin/stats");
    const s=await res.json();
    content.innerHTML=`
      <div class="admin-stats-grid">
        <div class="admin-stat-card">
          <span class="admin-stat-icon"></span>
          <div class="admin-stat-value" style="color:var(--violet-400)">${s.total_players.toLocaleString()}</div>
          <div class="admin-stat-label">Total Players</div>
        </div>
        <div class="admin-stat-card">
          <span class="admin-stat-icon"></span>
          <div class="admin-stat-value" style="color:var(--gold-400)">${s.total_tiers.toLocaleString()}</div>
          <div class="admin-stat-label">Tiers Assigned</div>
        </div>
        <div class="admin-stat-card">
          <span class="admin-stat-icon"></span>
          <div class="admin-stat-value" style="color:var(--purple-300)">${s.changes_this_week.toLocaleString()}</div>
          <div class="admin-stat-label">Changes This Week</div>
        </div>
        <div class="admin-stat-card">
          <span class="admin-stat-icon"></span>
          <div class="admin-stat-value" style="color:#10b981">${s.mode_breakdown.length}</div>
          <div class="admin-stat-label">Active Modes</div>
        </div>
      </div>
      <div class="admin-section">
        <div class="admin-section-header">
          <div class="admin-section-title">Mode Breakdown</div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Mode</th><th>Players Ranked</th></tr></thead>
            <tbody>
              ${s.mode_breakdown.map(m=>`
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <img src="/img/${m.gamemode}.svg" width="18" height="18" style="object-fit:contain;flex-shrink:0" alt="${MODE_LABELS[m.gamemode]||m.gamemode}"/>
                      <span>${MODE_LABELS[m.gamemode]||m.gamemode}</span>
                    </div>
                  </td>
                  <td><strong>${m.count}</strong></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="admin-section" style="margin-top:16px">
        <div class="admin-section-header"><div class="admin-section-title">Quick Actions</div></div>
        <div class="quick-actions">
          <button class="btn btn-primary btn-sm" onclick="showAddPlayerModal()">+ Add Player</button>
          <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-page=players]').click()">Manage Players</button>
          <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-page=history]').click()">Audit Log</button>
        </div>
      </div>`;
  }catch(e){
    content.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-muted)">Failed to load dashboard.</div>`;
  }
}

/* PLAYERS PAGE */
async function loadPlayersPage(page){
  const content=document.getElementById("adminContent");
  adminState.currentPage=page||1;
  content.innerHTML=`
    <div class="admin-section">
      <div class="admin-section-header">
        <div class="admin-section-title">Players (<span id="playerCount">...</span>)</div>
        <div class="admin-section-controls">
          <div class="admin-search-bar">
            <input type="text" class="form-input" id="playerSearch" placeholder="Search username or UUID..." value="${esc(adminState.search)}" style="width:220px"/>
            <button class="btn btn-primary btn-sm" onclick="showAddPlayerModal()">+ Add Player</button>
          </div>
        </div>
      </div>
      <div id="playersTableBody">
        <div class="skeleton" style="height:300px;border-radius:0"></div>
      </div>
    </div>
    <div class="admin-pagination" id="playersPagination"></div>`;
  let searchTimeout;
  document.getElementById("playerSearch")?.addEventListener("input",e=>{
    clearTimeout(searchTimeout);
    searchTimeout=setTimeout(()=>{adminState.search=e.target.value;adminState.currentPage=1;fetchPlayers();},350);
  });
  fetchPlayers();
}

async function fetchPlayers(){
  const body=document.getElementById("playersTableBody");
  if(!body)return;
  body.innerHTML=`<div class="skeleton" style="height:300px;border-radius:0"></div>`;
  try{
    const params=new URLSearchParams({page:adminState.currentPage,limit:25});
    if(adminState.search)params.set("search",adminState.search);
    const res=await api("/api/admin/players?"+params);
    const data=await res.json();
    adminState.players=data.players;
    adminState.total=data.total;
    const countEl=document.getElementById("playerCount");
    if(countEl)countEl.textContent=data.total.toLocaleString();
    if(!data.players.length){
      body.innerHTML=`<div style="padding:48px;text-align:center;color:var(--text-muted)">No players found. <button class="btn btn-secondary btn-sm" onclick="showAddPlayerModal()">Add one?</button></div>`;
      return;
    }
    body.innerHTML=`
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Player</th><th>UUID</th><th>Region</th><th>Platform</th><th>Best Tier</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${data.players.map(p=>{
              const bestTier=Object.values(p.tiers||{}).sort((a,b)=>(a.tier*2+a.pos)-(b.tier*2+b.pos))[0];
              const tierCount=Object.keys(p.tiers||{}).length;
              return `<tr>
                <td>
                  <div class="tbl-player">
                    <div class="tbl-avatar" id="av_${p.id}">
                      <img src="${(()=>{
                        const su=p.skin_url||'';
                        // Any format — always just use mc-heads by username for the table
                        return `https://mc-heads.net/avatar/${encodeURIComponent(p.username)}/32`;
                      })()}"
                           alt="${esc(p.username)}"
                           onerror="this.remove();document.getElementById('av_${p.id}').textContent='${esc(p.username).charAt(0).toUpperCase()}'"/>
                    </div>
                    <div>
                      <div class="tbl-name">${esc(p.username)}</div>
                      <div class="tbl-sub">${tierCount} mode${tierCount!==1?"s":""}</div>
                    </div>
                  </div>
                </td>
                <td><code style="font-family:var(--font-mono);font-size:0.72rem;color:var(--violet-400)">${p.uuid.substring(0,8)}</code></td>
                <td>${p.region||""}</td>
                <td>${p.platform||"Java"}</td>
                <td>${bestTier?tb(bestTier.tier,bestTier.pos,"sm"):`<span style="color:var(--text-muted);font-size:0.8rem"></span>`}</td>
                <td>${p.is_banned?`<span class="chip chip-red">Banned</span>`:`<span class="chip chip-green">Active</span>`}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" onclick="showPlayerDetail(${p.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePlayer(${p.id},'${esc(p.username)}')">Delete</button>
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
    renderPagination(data.total,data.pages);
  }catch(e){
    body.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-muted)">Failed to load players.</div>`;
  }
}

function renderPagination(total,pages){
  const c=document.getElementById("playersPagination");
  if(!c||pages<=1){if(c)c.innerHTML="";return;}
  const cur=adminState.currentPage;
  let html=`<button class="page-btn" ${cur===1?"disabled":""} onclick="loadPlayersPage(${cur-1})"> Prev</button>`;
  for(let i=1;i<=pages;i++){
    if(i===1||i===pages||(i>=cur-2&&i<=cur+2)){
      html+=`<button class="page-btn ${i===cur?"active":""}" onclick="loadPlayersPage(${i})">${i}</button>`;
    }else if(!html.endsWith("")){html+=`<span style="color:var(--text-muted);padding:0 4px"></span>`;}
  }
  html+=`<button class="page-btn" ${cur===pages?"disabled":""} onclick="loadPlayersPage(${cur+1})">Next </button>`;
  c.innerHTML=html;
}

/* ADD PLAYER MODAL */
function showAddPlayerModal(){
  const html=`
    <div class="modal-header">
      <h2 class="modal-title">Add New Player</h2>
      <button class="modal-close" onclick="closeModal()"></button>
    </div>
    <form id="addPlayerForm">
      <div class="form-group">
        <label class="form-label">Player Type</label>
        <div style="display:flex;gap:8px;margin-bottom:4px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);flex:1;justify-content:center" id="typePreLabel">
            <input type="radio" name="playerType" value="premium" checked onchange="togglePlayerType('premium')" style="accent-color:#a855f7"/> Premium (UUID)
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85rem;padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);flex:1;justify-content:center" id="typeCrackLabel">
            <input type="radio" name="playerType" value="cracked" onchange="togglePlayerType('cracked')" style="accent-color:#a855f7"/> Cracked (Upload Skin)
          </label>
        </div>
      </div>
      <div class="form-group" id="uuidField">
        <label class="form-label">Minecraft UUID *</label>
        <input type="text" class="form-input" id="newUUID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
        <small style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;display:block">Find at mcuuid.net</small>
      </div>
      <div class="form-group" id="skinUploadField" style="display:none">
        <label class="form-label">Skin <span style="color:var(--text-muted);font-size:0.72rem">(upload PNG or paste URL)</span></label>
        <!-- Tab switcher -->
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button type="button" id="skinTabFile" onclick="switchSkinTab('file')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--violet-500);background:var(--violet-500);color:#fff;font-size:0.78rem;cursor:pointer">
            📁 Upload File
          </button>
          <button type="button" id="skinTabUrl" onclick="switchSkinTab('url')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-base);color:var(--text-secondary);font-size:0.78rem;cursor:pointer">
            🔗 Paste URL
          </button>
        </div>
        <!-- File upload panel -->
        <div id="skinPanelFile">
          <div style="display:flex;gap:10px;align-items:center">
            <label style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px dashed var(--border);background:var(--bg-base);cursor:pointer;font-size:0.82rem;color:var(--text-secondary);flex:1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span id="skinFileName">Choose skin PNG…</span>
              <input type="file" id="newSkinFile" accept=".png,image/png" style="display:none" onchange="onSkinFileChange(this)"/>
            </label>
            <div id="skinPreviewBox" style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.6rem;text-align:center">
              <span>No skin</span>
            </div>
          </div>
          <small style="color:var(--text-muted);font-size:0.72rem;margin-top:4px;display:block">64×64 Minecraft skin PNG — uploaded to MineSkin for 3D render</small>
        </div>
        <!-- URL input panel -->
        <div id="skinPanelUrl" style="display:none">
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" class="form-input" id="newSkinUrl" placeholder="https://minesk.in/... or any skin PNG URL" style="flex:1" oninput="onSkinUrlInput(this.value)"/>
            <div id="skinUrlPreview" style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.6rem;text-align:center">
              <span>No skin</span>
            </div>
          </div>
          <small style="color:var(--text-muted);font-size:0.72rem;margin-top:4px;display:block">Supports: minesk.in links, direct PNG URLs, textures.minecraft.net</small>
        </div>
        <div id="skinUploadStatus" style="font-size:0.72rem;margin-top:6px;color:var(--text-muted)"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Username *</label>
        <input type="text" class="form-input" id="newUsername" placeholder="Minecraft username" required maxlength="32"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Region</label>
          <select class="form-select" id="newRegion">
            <option>NA</option><option>EU</option><option>AS</option><option>SA</option><option>OC</option><option>AF</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Platform</label>
          <select class="form-select" id="newPlatform">
            <option>Java</option><option>Bedrock</option><option>Cracked</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Country Code (optional)</label>
        <input type="text" class="form-input" id="newCountry" placeholder="e.g. US, GB, DE" maxlength="4"/>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="addPlayerSubmitBtn">Add Player</button>
      </div>
    </form>`;
  openModal(html);
  document.getElementById("addPlayerForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const isCracked=document.querySelector('input[name="playerType"]:checked')?.value==="cracked";
    const username=document.getElementById("newUsername").value.trim();
    const region=document.getElementById("newRegion").value;
    const platform=document.getElementById("newPlatform").value;
    const country_code=document.getElementById("newCountry").value.trim().toUpperCase();
    if(!username){toast("Username is required","error");return;}

    let uuid=document.getElementById("newUUID").value.trim();

    // For cracked players generate an offline-mode UUID if none provided
    if(isCracked && !uuid){
      uuid="00000000-0000-0000-0000-"+Math.random().toString(16).slice(2,14).padEnd(12,"0");
    }
    if(!uuid){toast("UUID is required for premium players","error");return;}

    const submitBtn=document.getElementById("addPlayerSubmitBtn");
    let skin_url="";

    if(isCracked){
      submitBtn.disabled=true;
      submitBtn.textContent="Uploading skin…";
      const file=document.getElementById("newSkinFile")?.files[0];
      const urlInput=document.getElementById("newSkinUrl")?.value.trim();

      if(file){
        // File upload path
        const hash=await uploadSkinToMineSkin(file);
        skin_url=hash ? `nmsr:${hash}` : `nmsr:`;
      } else if(urlInput){
        // URL path — resolve via server
        submitBtn.textContent="Resolving skin…";
        const {hash}=await resolveSkinUrlToHash(urlInput,username);
        skin_url=hash ? `nmsr:${hash}` : `nmsr:`;
      } else {
        // No skin — store empty nmsr marker, NMSR will use username
        skin_url=`nmsr:`;
      }
      submitBtn.textContent="Adding player…";
    }

    try{
      const body={uuid,username,region,platform,country_code};
      if(skin_url) body.skin_url=skin_url;
      const res=await api("/api/admin/players",{method:"POST",body:JSON.stringify(body)});
      const data=await res.json();
      if(!res.ok){
        if(submitBtn){submitBtn.disabled=false;submitBtn.textContent="Add Player";}
        toast(data.error||"Failed to add player","error");return;
      }
      closeModal();
      toast("Player "+username+" added!","success");
      loadPlayersPage(1);
    }catch(err){
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent="Add Player";}
      toast("Error adding player","error");
    }
  });
}

function togglePlayerType(type){
  const uuidField=document.getElementById("uuidField");
  const skinField=document.getElementById("skinUploadField");
  const platform=document.getElementById("newPlatform");
  if(type==="cracked"){
    uuidField.style.display="none";
    skinField.style.display="";
    platform.value="Cracked";
  } else {
    uuidField.style.display="";
    skinField.style.display="none";
    if(platform.value==="Cracked") platform.value="Java";
  }
}

// Called when user picks a skin file
function onSkinFileChange(input){
  const file=input.files[0];
  if(!file) return;
  document.getElementById("skinFileName").textContent=file.name;
  // Show preview of the raw skin PNG
  const reader=new FileReader();
  reader.onload=e=>{
    const box=document.getElementById("skinPreviewBox");
    if(box) box.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated"/>`;
  };
  reader.readAsDataURL(file);
  // Reset any previous upload status
  const status=document.getElementById("skinUploadStatus");
  if(status) status.textContent="";
}

// Upload skin file to MineSkin directly from browser, returns texture hash or null
async function uploadSkinToMineSkin(file){
  const status=document.getElementById("skinUploadStatus");
  if(status){status.textContent="Uploading to MineSkin…";status.style.color="var(--text-muted)";}
  try{
    const form=new FormData();
    form.append("file",file,"skin.png");
    form.append("visibility","1");
    console.log("[Skin] Uploading",file.name,"size:",file.size,"bytes");
    const res=await fetch("https://api.mineskin.org/generate/upload",{
      method:"POST",
      headers:{"User-Agent":"PrimeTiers/1.0"},
      body:form,
    });
    console.log("[Skin] MineSkin response status:",res.status);
    if(!res.ok){
      const errText=await res.text();
      console.warn("[Skin] MineSkin error:",errText);
      if(status){status.textContent="MineSkin error ("+res.status+") — skin saved without 3D render";status.style.color="var(--gold,#f59e0b)";}
      return null;
    }
    const data=await res.json();
    console.log("[Skin] MineSkin response:",JSON.stringify(data).slice(0,200));
    // Extract texture hash from base64 texture value
    const textureValue=data?.data?.texture?.value;
    if(textureValue){
      try{
        const decoded=JSON.parse(atob(textureValue));
        const tUrl=decoded?.textures?.SKIN?.url||"";
        const m=tUrl.match(/texture\/([a-f0-9]{64})/i);
        if(m){
          console.log("[Skin] Got texture hash:",m[1]);
          if(status){status.textContent="✓ Skin uploaded! 3D render ready.";status.style.color="#22c55e";}
          return m[1];
        }
      }catch(e){console.warn("[Skin] Failed to decode texture value:",e);}
    }
    if(status){status.textContent="Uploaded but no texture hash — skin saved without 3D render";status.style.color="var(--gold,#f59e0b)";}
    return null;
  }catch(err){
    console.error("[Skin] Upload exception:",err);
    if(status){status.textContent="Upload failed: "+err.message;status.style.color="#ef4444";}
    return null;
  }
}

function previewSkin(url){
  const box=document.getElementById("skinPreviewBox");
  if(!box)return;
  if(!url){box.innerHTML='<span>No skin</span>';return;}
  box.innerHTML=`<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.65rem;color:var(--text-muted)\\'>Invalid</span>'"/>`;
}

function switchSkinTab(tab){
  const filePanel=document.getElementById("skinPanelFile");
  const urlPanel=document.getElementById("skinPanelUrl");
  const fileBtn=document.getElementById("skinTabFile");
  const urlBtn=document.getElementById("skinTabUrl");
  if(tab==="file"){
    filePanel.style.display="";urlPanel.style.display="none";
    fileBtn.style.background="var(--violet-500)";fileBtn.style.color="#fff";fileBtn.style.borderColor="var(--violet-500)";
    urlBtn.style.background="var(--bg-base)";urlBtn.style.color="var(--text-secondary)";urlBtn.style.borderColor="var(--border)";
  } else {
    filePanel.style.display="none";urlPanel.style.display="";
    urlBtn.style.background="var(--violet-500)";urlBtn.style.color="#fff";urlBtn.style.borderColor="var(--violet-500)";
    fileBtn.style.background="var(--bg-base)";fileBtn.style.color="var(--text-secondary)";fileBtn.style.borderColor="var(--border)";
  }
}

function onSkinUrlInput(url){
  const preview=document.getElementById("skinUrlPreview");
  if(!preview)return;
  if(!url){preview.innerHTML='<span style="font-size:0.6rem;color:var(--text-muted)">No skin</span>';return;}
  // Show preview if it looks like a direct image URL
  if(url.match(/\.(png|jpg|jpeg)(\?.*)?$/i)||url.includes('textures.minecraft.net')){
    preview.innerHTML=`<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.6rem;color:var(--text-muted)\\'>Preview N/A</span>'"/>`;
  } else {
    preview.innerHTML='<span style="font-size:0.6rem;color:var(--text-muted)">Link</span>';
  }
}

// Resolve a skin URL (minesk.in, direct PNG, etc.) to a texture hash via server
async function resolveSkinUrlToHash(skinUrl, username){
  const status=document.getElementById("skinUploadStatus");
  if(status){status.textContent="Resolving skin URL…";status.style.color="var(--text-muted)";}
  try{
    const res=await api("/api/admin/resolve-skin",{method:"POST",body:JSON.stringify({skin_url:skinUrl,username})});
    const data=await res.json();
    if(data.hash){
      if(status){status.textContent="✓ Skin resolved!";status.style.color="#22c55e";}
      return{hash:data.hash};
    }
    if(status){status.textContent="Could not get 3D render — skin saved without hash";status.style.color="var(--gold,#f59e0b)";}
    return{hash:null};
  }catch(e){
    if(status){status.textContent="Resolve failed — skin saved without hash";status.style.color="var(--gold,#f59e0b)";}
    return{hash:null};
  }
}

async function resolveSkinForPlayer(playerId, btn){
  const skinUrlEl=document.getElementById("editSkinUrl");
  if(btn){btn.disabled=true;btn.textContent="Resolving...";}
  try{
    const body={};
    if(skinUrlEl&&skinUrlEl.value.trim()) body.skin_url=skinUrlEl.value.trim();
    const res=await api("/api/admin/players/"+playerId+"/skin",{method:"PUT",body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok){toast(data.error||"Failed to resolve skin","error");if(btn){btn.disabled=false;btn.textContent="Fix Skin";}return;}
    if(skinUrlEl) skinUrlEl.value=data.skin_url;
    toast("Skin resolved via "+data.source+"! Save Changes to apply.","success");
    if(btn){btn.disabled=false;btn.textContent="Fix Skin";}
  }catch(e){
    toast("Error resolving skin","error");
    if(btn){btn.disabled=false;btn.textContent="Fix Skin";}
  }
}

function onEditSkinFileChange(input){
  const file=input.files[0];
  if(!file)return;
  document.getElementById("editSkinFileName").textContent=file.name;
  const reader=new FileReader();
  reader.onload=e=>{
    const preview=document.getElementById("editSkinPreview");
    if(preview) preview.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated"/>`;
  };
  reader.readAsDataURL(file);
  const status=document.getElementById("editSkinStatus");
  if(status){status.textContent="File selected — will upload on Save Changes";status.style.color="var(--text-muted)";}
}

function switchEditSkinTab(tab){
  const fp=document.getElementById("editSkinPanelFile");
  const up=document.getElementById("editSkinPanelUrl");
  const fb=document.getElementById("editSkinTabFile");
  const ub=document.getElementById("editSkinTabUrl");
  if(tab==="file"){
    fp.style.display="";up.style.display="none";
    fb.style.background="var(--violet-500)";fb.style.color="#fff";fb.style.borderColor="var(--violet-500)";
    ub.style.background="var(--bg-base)";ub.style.color="var(--text-secondary)";ub.style.borderColor="var(--border)";
  } else {
    fp.style.display="none";up.style.display="";
    ub.style.background="var(--violet-500)";ub.style.color="#fff";ub.style.borderColor="var(--violet-500)";
    fb.style.background="var(--bg-base)";fb.style.color="var(--text-secondary)";fb.style.borderColor="var(--border)";
  }
}

function onEditSkinUrlInput(url){
  const preview=document.getElementById("editSkinUrlPreview");
  if(!preview)return;
  if(!url){preview.innerHTML='<span style="font-size:0.6rem;color:var(--text-muted)">Link</span>';return;}
  if(url.match(/\.(png|jpg)(\?.*)?$/i)||url.includes('textures.minecraft.net')){
    preview.innerHTML=`<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.6rem\\'>N/A</span>'"/>`;
  }
}

async function uploadSkinToMineSkinEdit(file, username){
  const status=document.getElementById("editSkinStatus");
  if(status){status.textContent="Uploading to MineSkin…";status.style.color="var(--text-muted)";}
  try{
    const form=new FormData();
    form.append("file",file,"skin.png");
    form.append("visibility","1");
    console.log("[Skin] Uploading",file.name,"size:",file.size,"bytes for",username);
    const res=await fetch("https://api.mineskin.org/generate/upload",{
      method:"POST",headers:{"User-Agent":"PrimeTiers/1.0"},body:form,
    });
    console.log("[Skin] MineSkin status:",res.status);
    if(!res.ok){
      const errText=await res.text();
      console.warn("[Skin] MineSkin error:",errText);
      if(status){status.textContent="MineSkin error ("+res.status+"): "+errText.slice(0,80);status.style.color="#ef4444";}
      return null;
    }
    const data=await res.json();
    console.log("[Skin] MineSkin response:",JSON.stringify(data).slice(0,300));
    const textureValue=data?.data?.texture?.value;
    if(textureValue){
      try{
        const decoded=JSON.parse(atob(textureValue));
        const tUrl=decoded?.textures?.SKIN?.url||"";
        const m=tUrl.match(/texture\/([a-f0-9]{64})/i);
        if(m){
          console.log("[Skin] Got texture hash:",m[1]);
          if(status){status.textContent="✓ Skin uploaded! 3D render ready.";status.style.color="#22c55e";}
          return m[1];
        }
      }catch(e){console.warn("[Skin] Decode error:",e);}
    }
    if(status){status.textContent="Uploaded but no hash returned — check console";status.style.color="#f59e0b";}
    return null;
  }catch(err){
    console.error("[Skin] Upload exception:",err);
    if(status){status.textContent="Upload failed: "+err.message;status.style.color="#ef4444";}
    return null;
  }
}

/* PLAYER DETAIL */
async function showPlayerDetail(playerId){
  const content=document.getElementById("adminContent");
  content.innerHTML=`<div class="skeleton" style="height:500px;border-radius:16px"></div>`;
  document.getElementById("adminPageTitle").textContent="Edit Player";
  try{
    const res=await api("/api/admin/players/"+playerId);
    const player=await res.json();
    adminState.editingPlayer=player;
    const tierCards=VALID_MODES.map(mode=>{
      const t=player.tiers?.find(x=>x.gamemode===mode);
      const curTier=t?t.tier:"";
      const curPos=t?t.pos:0;
      const curRetired=t?t.retired:false;
      return `
        <div class="tier-editor-card" id="tierCard_${mode}">
          <div class="tier-editor-mode">
            <span><img src="/img/${mode}.svg" width="18" height="18" style="object-fit:contain;vertical-align:middle;flex-shrink:0" alt="${MODE_LABELS[mode]||mode}"/></span>
            <span>${MODE_LABELS[mode]||mode}</span>
            ${t?tb(t.tier,t.pos,"sm"):`<span style="color:var(--text-muted);font-size:0.72rem">Unranked</span>`}
          </div>
          <div class="tier-editor-selects">
            <select id="tier_${mode}">
              <option value=""> Tier </option>
              ${[1,2,3,4,5].map(n=>`<option value="${n}" ${curTier==n?"selected":""}>Tier ${n}</option>`).join("")}
            </select>
            <select id="pos_${mode}">
              <option value="0" ${curPos==0?"selected":""}>HT (High)</option>
              <option value="1" ${curPos==1?"selected":""}>LT (Low)</option>
            </select>
          </div>
          <div class="tier-editor-retired">
            <input type="checkbox" id="retired_${mode}" ${curRetired?"checked":""}/>
            <label for="retired_${mode}">Retired</label>
          </div>
          <div class="tier-editor-actions">
            <button class="btn btn-primary btn-sm" onclick="saveTier(${playerId},'${mode}')">Save</button>
            ${t?`<button class="btn btn-danger btn-sm" onclick="deleteTier(${playerId},'${mode}')">Remove</button>`:""}
          </div>
        </div>`;
    }).join("");
    const historyRows=player.history?.length?player.history.map(h=>`
      <tr>
        <td><img src="/img/${h.gamemode}.svg" width="16" height="16" style="object-fit:contain;vertical-align:middle;flex-shrink:0" alt="${MODE_LABELS[h.gamemode]||h.gamemode}"/> ${MODE_LABELS[h.gamemode]||h.gamemode}</td>
        <td>
          <div class="history-change">
            ${h.old_tier?tb(h.old_tier,h.old_pos,"sm"):`<span style="color:var(--text-muted)">New</span>`}
            <span style="color:var(--text-muted)"></span>
            ${tb(h.new_tier,h.new_pos,"sm")}
          </div>
        </td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${esc(h.changed_by_name||"System")}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${new Date(h.changed_at).toLocaleDateString()}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${esc(h.notes||"")}</td>
      </tr>`).join(""):`<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">No history yet</td></tr>`;
    content.innerHTML=`
      <div style="margin-bottom:16px">
        <button class="btn btn-secondary btn-sm" onclick="loadPlayersPage()"> Back to Players</button>
      </div>
      <div class="player-detail-header">
        <div class="player-detail-avatar">
          <img src="${(()=>{
            const su=player.skin_url||'';
            // nmsr:{hash} or mcskin:{user}:{hash} — use NMSR bust
            const hashM=su.startsWith('nmsr:')?su.slice(5):su.startsWith('mcskin:')?su.split(':')[2]||'':null;
            if(hashM&&hashM.length>=32) return `https://nmsr.nickac.dev/bust/${hashM}`;
            // crafatar hash
            const crafM=su.match(/crafatar\.com\/(?:avatars|renders\/\w+)\/([0-9a-f]{32})(?:[^-]|$)/i);
            if(crafM) return `https://nmsr.nickac.dev/bust/${crafM[1]}`;
            // fallback
            return `https://nmsr.nickac.dev/bust/${encodeURIComponent(player.username)}`;
          })()}"
               onerror="this.src='https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/64';this.onerror=null"
               style="width:100%;height:100%;object-fit:contain"/>
        </div>
        <div class="player-detail-info">
          <div class="player-detail-name">${esc(player.username)}</div>
          <div class="player-detail-uuid">${player.uuid}</div>
          <div class="player-detail-chips">
            <span class="chip chip-purple">${player.region||"NA"}</span>
            <span class="chip chip-purple">${player.platform||"Java"}</span>
            ${player.is_banned?`<span class="chip chip-red">Banned</span>`:`<span class="chip chip-green">Active</span>`}
          </div>
        </div>
        <div class="player-detail-actions">
          <button class="btn btn-secondary btn-sm" onclick="showEditPlayerModal(${playerId})">Edit Info</button>
          <button class="btn btn-danger btn-sm" onclick="toggleBan(${playerId},${player.is_banned})">
            ${player.is_banned?"Unban":"Ban"}
          </button>
        </div>
      </div>
      <div class="admin-section" style="margin-bottom:16px">
        <div class="admin-section-header">
          <div class="admin-section-title"> Tier Management</div>
        </div>
        <div style="padding:16px">
          <div class="tier-editor-grid">${tierCards}</div>
        </div>
      </div>
      <div class="admin-section">
        <div class="admin-section-header">
          <div class="admin-section-title"> Tier History</div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Mode</th><th>Change</th><th>By</th><th>Date</th><th>Notes</th></tr></thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>
      </div>`;
  }catch(e){
    content.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-muted)">Failed to load player.</div>`;
  }
}

/* SAVE / DELETE TIER */
async function saveTier(playerId,mode){
  const tier=document.getElementById("tier_"+mode)?.value;
  const pos=document.getElementById("pos_"+mode)?.value;
  const retired=document.getElementById("retired_"+mode)?.checked||false;
  if(!tier){toast("Select a tier first","error");return;}
  try{
    const res=await api("/api/admin/players/"+playerId+"/tiers/"+mode,{method:"PUT",body:JSON.stringify({tier:parseInt(tier),pos:parseInt(pos),retired})});
    const data=await res.json();
    if(!res.ok){toast(data.error||"Failed to save tier","error");return;}
    toast((MODE_LABELS[mode]||mode)+" tier saved!","success");
    showPlayerDetail(playerId);
  }catch(e){toast("Error saving tier","error");}
}

async function deleteTier(playerId,mode){
  if(!confirm("Remove "+(MODE_LABELS[mode]||mode)+" tier from this player?"))return;
  try{
    const res=await api("/api/admin/players/"+playerId+"/tiers/"+mode,{method:"DELETE"});
    if(!res.ok){toast("Failed to remove tier","error");return;}
    toast("Tier removed","success");
    showPlayerDetail(playerId);
  }catch(e){toast("Error removing tier","error");}
}

async function deletePlayer(playerId,username){
  if(!confirm('Permanently delete player "'+username+'" and all their tiers? This cannot be undone.'))return;
  try{
    const res=await api("/api/admin/players/"+playerId,{method:"DELETE"});
    if(!res.ok){toast("Failed to delete player","error");return;}
    toast("Player deleted","success");
    loadPlayersPage(1);
  }catch(e){toast("Error deleting player","error");}
}

async function toggleBan(playerId,isBanned){
  const action=isBanned?"unban":"ban";
  if(!confirm("Are you sure you want to "+action+" this player?"))return;
  try{
    const res=await api("/api/admin/players/"+playerId,{method:"PUT",body:JSON.stringify({is_banned:!isBanned})});
    if(!res.ok){toast("Failed to update player","error");return;}
    toast("Player "+action+"ned","success");
    showPlayerDetail(playerId);
  }catch(e){toast("Error updating player","error");}
}

/* EDIT PLAYER MODAL */
function showEditPlayerModal(playerId){
  const player=adminState.editingPlayer;
  if(!player)return;
  const html=`
    <div class="modal-header">
      <h2 class="modal-title">Edit Player Info</h2>
      <button class="modal-close" onclick="closeModal()"></button>
    </div>
    <form id="editPlayerForm">
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" class="form-input" id="editUsername" value="${esc(player.username)}" required maxlength="16"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Region</label>
          <select class="form-select" id="editRegion">
            ${["NA","EU","AS","SA","OC","AF"].map(r=>`<option value="${r}" ${player.region===r?"selected":""}>${r}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Platform</label>
          <select class="form-select" id="editPlatform">
            <option value="Java" ${player.platform==="Java"?"selected":""}>Java</option>
            <option value="Bedrock" ${player.platform==="Bedrock"?"selected":""}>Bedrock</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Country Code</label>
        <input type="text" class="form-input" id="editCountry" value="${esc(player.country_code||"")}" maxlength="4"/>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="editNotes" rows="3">${esc(player.notes||"")}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Bonus Points <span style="font-size:0.72rem;color:var(--text-muted)">(added on top of tier points)</span></label>
        <input type="number" class="form-input" id="editBonusPoints" value="${player.bonus_points||0}" min="-999" max="9999" step="1"/>
      </div>
      ${player.skin_url||player.platform==="Cracked"?`
      <div class="form-group">
        <label class="form-label">Skin <span style="color:var(--text-muted);font-size:0.72rem">(upload PNG or paste URL for 3D body render)</span></label>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button type="button" id="editSkinTabFile" onclick="switchEditSkinTab('file')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--violet-500);background:var(--violet-500);color:#fff;font-size:0.78rem;cursor:pointer">
            📁 Upload File
          </button>
          <button type="button" id="editSkinTabUrl" onclick="switchEditSkinTab('url')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-base);color:var(--text-secondary);font-size:0.78rem;cursor:pointer">
            🔗 Paste URL
          </button>
        </div>
        <div id="editSkinPanelFile">
          <div style="display:flex;gap:10px;align-items:center">
            <label style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px dashed var(--border);background:var(--bg-base);cursor:pointer;font-size:0.82rem;color:var(--text-secondary);flex:1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span id="editSkinFileName">Upload new skin PNG…</span>
              <input type="file" id="editSkinFile" accept=".png,image/png" style="display:none" onchange="onEditSkinFileChange(this)"/>
            </label>
            <div id="editSkinPreview" style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center">
              <img src="${(()=>{const su=player.skin_url||'';const h=su.startsWith('nmsr:')?su.slice(5):su.startsWith('mcskin:')?su.split(':')[2]||'':'';return h&&h.length>=32?`https://nmsr.nickac.dev/bust/${h}`:`https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/48`;})()}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'"/>
            </div>
          </div>
        </div>
        <div id="editSkinPanelUrl" style="display:none">
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" class="form-input" id="editSkinUrl" placeholder="https://minesk.in/... or any skin PNG URL" style="flex:1" oninput="onEditSkinUrlInput(this.value)"/>
            <div id="editSkinUrlPreview" style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border);background:var(--bg-base);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.6rem">Link</div>
          </div>
        </div>
        <div id="editSkinStatus" style="font-size:0.72rem;margin-top:6px;color:var(--text-muted)">
          ${(()=>{const su=player.skin_url||'';const h=su.startsWith('nmsr:')?su.slice(5):su.startsWith('mcskin:')?su.split(':')[2]||'':'';return h&&h.length>=32?'<span style="color:#22c55e">✓ Has 3D skin render</span>':'<span style="color:#f59e0b">⚠ Upload PNG or paste URL to get 3D body render</span>';})()}
        </div>
      </div>`:`
      <div class="form-group">
        <label class="form-label">Skin <span style="color:var(--text-muted);font-size:0.72rem">(optional — upload PNG or URL for custom skin)</span></label>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button type="button" id="editSkinTabFile" onclick="switchEditSkinTab('file')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--violet-500);background:var(--violet-500);color:#fff;font-size:0.78rem;cursor:pointer">
            📁 Upload File
          </button>
          <button type="button" id="editSkinTabUrl" onclick="switchEditSkinTab('url')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-base);color:var(--text-secondary);font-size:0.78rem;cursor:pointer">
            🔗 Paste URL
          </button>
        </div>
        <div id="editSkinPanelFile">
          <label style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px dashed var(--border);background:var(--bg-base);cursor:pointer;font-size:0.82rem;color:var(--text-secondary)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span id="editSkinFileName">Upload skin PNG…</span>
            <input type="file" id="editSkinFile" accept=".png,image/png" style="display:none" onchange="onEditSkinFileChange(this)"/>
          </label>
        </div>
        <div id="editSkinPanelUrl" style="display:none">
          <input type="text" class="form-input" id="editSkinUrl" placeholder="https://minesk.in/... or any skin PNG URL" oninput="onEditSkinUrlInput(this.value)"/>
        </div>
        <div id="editSkinStatus" style="font-size:0.72rem;margin-top:6px;color:var(--text-muted)">Upload a skin PNG or paste URL to enable 3D body render</div>
      </div>`}
      <div style="display:flex;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>`;
  openModal(html);
  document.getElementById("editPlayerForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const submitBtn=e.target.querySelector('[type=submit]');
    try{
      // Handle skin — file upload takes priority over URL input
      let skin_url=undefined;
      const editSkinFile=document.getElementById("editSkinFile");
      const editSkinUrlInput=document.getElementById("editSkinUrl");
      const username=document.getElementById("editUsername").value.trim()||adminState.editingPlayer?.username||"";

      if(editSkinFile?.files[0]){
        submitBtn.disabled=true;submitBtn.textContent="Uploading skin…";
        const hash=await uploadSkinToMineSkinEdit(editSkinFile.files[0],username);
        skin_url=hash ? `nmsr:${hash}` : `nmsr:`;
        submitBtn.textContent="Saving…";
      } else if(editSkinUrlInput?.value.trim()){
        submitBtn.disabled=true;submitBtn.textContent="Resolving skin…";
        const skinUrlVal=editSkinUrlInput.value.trim();
        const status=document.getElementById("editSkinStatus");
        if(status){status.textContent="Resolving skin URL…";status.style.color="var(--text-muted)";}
        try{
          const res2=await api("/api/admin/resolve-skin",{method:"POST",body:JSON.stringify({skin_url:skinUrlVal,username})});
          const skinData=await res2.json();
          console.log("[Skin] resolve-skin response:",skinData);
          if(skinData.hash){
            skin_url=`nmsr:${skinData.hash}`;
            if(status){status.textContent="✓ Skin resolved via "+skinData.source+"!";status.style.color="#22c55e";}
          } else {
            skin_url=`nmsr:`;
            if(status){status.textContent="⚠ Could not resolve skin — will use default render";status.style.color="#f59e0b";}
          }
        }catch(e){
          console.error("[Skin] resolve error:",e);
          skin_url=`nmsr:`;
          if(status){status.textContent="Error: "+e.message;status.style.color="#ef4444";}
        }
        submitBtn.textContent="Saving…";
      }
      const body={
        username:document.getElementById("editUsername").value.trim(),
        region:document.getElementById("editRegion").value,
        platform:document.getElementById("editPlatform").value,
        country_code:document.getElementById("editCountry").value.trim().toUpperCase(),
        notes:document.getElementById("editNotes").value.trim(),
        bonus_points:parseInt(document.getElementById("editBonusPoints").value)||0,
      };
      if(skin_url!==undefined) body.skin_url=skin_url;
      const res=await api("/api/admin/players/"+playerId,{method:"PUT",body:JSON.stringify(body)});
      if(!res.ok){toast("Failed to update player","error");submitBtn.disabled=false;submitBtn.textContent="Save Changes";return;}
      closeModal();
      toast("Player updated!","success");
      showPlayerDetail(playerId);
    }catch(err){toast("Error updating player","error");submitBtn.disabled=false;submitBtn.textContent="Save Changes";}
  });
}

/* TIERS PAGE */
function loadTiersPage(){
  const content=document.getElementById("adminContent");
  content.innerHTML=`
    <div class="admin-section" style="margin-bottom:16px">
      <div class="admin-section-header">
        <div class="admin-section-title">Tier Management</div>
      </div>
      <div style="padding:20px">
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px">Search for a player to edit their tiers.</p>
        <div style="display:flex;gap:10px;max-width:400px">
          <input type="text" class="form-input" id="tierSearchInput" placeholder="Search player username..."/>
          <button class="btn btn-primary" onclick="searchPlayerForTiers()">Search</button>
        </div>
      </div>
    </div>
    <div id="tierSearchResults"></div>`;
  document.getElementById("tierSearchInput")?.addEventListener("keydown",e=>{
    if(e.key==="Enter")searchPlayerForTiers();
  });
}

async function searchPlayerForTiers(){
  const q=document.getElementById("tierSearchInput")?.value.trim();
  if(!q)return;
  const results=document.getElementById("tierSearchResults");
  results.innerHTML=`<div class="skeleton" style="height:100px;border-radius:16px"></div>`;
  try{
    const res=await api("/api/admin/players?search="+encodeURIComponent(q)+"&limit=10");
    const data=await res.json();
    if(!data.players.length){
      results.innerHTML=`<div style="padding:32px;text-align:center;color:var(--text-muted)">No players found.</div>`;
      return;
    }
    results.innerHTML=`
      <div class="admin-section">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Player</th><th>UUID</th><th>Tiers</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.players.map(p=>{
                const tierCount=Object.keys(p.tiers||{}).length;
                return `<tr>
                  <td><strong>${esc(p.username)}</strong></td>
                  <td><code style="font-family:var(--font-mono);font-size:0.72rem;color:var(--violet-400)">${p.uuid.substring(0,8)}</code></td>
                  <td>${tierCount} mode${tierCount!==1?"s":""}</td>
                  <td><button class="btn btn-primary btn-sm" onclick="showPlayerDetail(${p.id})">Edit Tiers</button></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }catch(e){
    results.innerHTML=`<div style="padding:32px;text-align:center;color:var(--text-muted)">Search failed.</div>`;
  }
}

/* HISTORY PAGE */
async function loadHistoryPage(){
  const content=document.getElementById("adminContent");
  content.innerHTML=`
    <div class="admin-section">
      <div class="admin-section-header">
        <div class="admin-section-title"> Audit Log</div>
      </div>
      <div style="padding:32px;text-align:center;color:var(--text-secondary)">
        <p style="margin-bottom:12px">Open a player profile to view their full tier change history.</p>
        <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-page=players]').click()">Go to Players</button>
      </div>
    </div>`;
}

/* SETTINGS PAGE */
function loadSettingsPage(){
  const content=document.getElementById("adminContent");
  content.innerHTML=`
    <div class="admin-section" style="max-width:480px">
      <div class="admin-section-header">
        <div class="admin-section-title"> Change Password</div>
      </div>
      <div style="padding:24px">
        <form id="changePasswordForm">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <input type="password" class="form-input" id="currentPass" required/>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" class="form-input" id="newPass" required minlength="8"/>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <input type="password" class="form-input" id="confirmPass" required/>
          </div>
          <button type="submit" class="btn btn-primary">Update Password</button>
        </form>
      </div>
    </div>`;
  document.getElementById("changePasswordForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const np=document.getElementById("newPass").value;
    const cp=document.getElementById("confirmPass").value;
    if(np!==cp){toast("Passwords do not match","error");return;}
    try{
      const res=await api("/api/admin/change-password",{method:"POST",body:JSON.stringify({
        current_password:document.getElementById("currentPass").value,
        new_password:np
      })});
      const data=await res.json();
      if(!res.ok){toast(data.error||"Failed to change password","error");return;}
      toast("Password updated!","success");
      document.getElementById("changePasswordForm").reset();
    }catch(err){toast("Error changing password","error");}
  });
}

/* MODAL HELPERS */
function openModal(html){
  const overlay=document.createElement("div");
  overlay.className="modal-overlay";
  overlay.innerHTML='<div class="modal">'+html+"</div>";
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove();});
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal(){document.querySelector(".modal-overlay")?.remove();}




/* ─── TESTERS PAGE ───────────────────────────────────────────── */
async function loadTestersPage(){
  const content=document.getElementById("adminContent");
  content.innerHTML=`
    <div class="admin-section">
      <div class="admin-section-header">
        <div class="admin-section-title">Testers</div>
        <button class="btn btn-primary btn-sm" onclick="showAddTesterModal()">+ Add Tester</button>
      </div>
      <div id="testersGrid" class="testers-admin-grid">
        <div class="skeleton" style="height:200px;border-radius:12px;grid-column:1/-1"></div>
      </div>
    </div>`;
  await fetchTesters();
}

async function fetchTesters(){
  const grid=document.getElementById("testersGrid");
  if(!grid)return;
  try{
    const res=await api("/api/admin/testers");
    const testers=await res.json();
    if(!testers.length){
      grid.innerHTML=`<div style="padding:48px;text-align:center;color:var(--text-muted);grid-column:1/-1">No testers yet. <button class="btn btn-secondary btn-sm" onclick="showAddTesterModal()">Add one?</button></div>`;
      return;
    }
    grid.innerHTML=testers.map(t=>`
      <div class="tester-admin-card">
        <div class="tester-admin-avatar">
          ${t.uuid
            ? `<img src="https://mc-heads.net/avatar/${t.username}/48" alt="${esc(t.username)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
               <div class="tester-admin-initials" style="display:none">${esc(t.username).charAt(0).toUpperCase()}</div>`
            : t.skin_url
              ? `<img src="${esc(t.skin_url)}" alt="${esc(t.username)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
                 <div class="tester-admin-initials" style="display:none">${esc(t.username).charAt(0).toUpperCase()}</div>`
              : `<div class="tester-admin-initials">${esc(t.username).charAt(0).toUpperCase()}</div>`
          }
          <span class="tester-status-dot ${t.is_online?'online':'offline'}"></span>
        </div>
        <div class="tester-admin-info">
          <div class="tester-admin-name">${esc(t.username)}</div>
          <div class="tester-admin-role">${esc(t.role||'Tester')}</div>
          ${t.uuid?`<div style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono)">${t.uuid.substring(0,8)}...</div>`:''}
        </div>
        <div class="tester-admin-actions">
          <label class="tester-online-toggle" title="${t.is_online?'Set Offline':'Set Online'}">
            <input type="checkbox" ${t.is_online?'checked':''} onchange="toggleTesterOnline(${t.id},this.checked)"/>
            <span>${t.is_online?'Online':'Offline'}</span>
          </label>
          <button class="btn btn-secondary btn-sm" onclick="showEditTesterModal(${t.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTester(${t.id},'${esc(t.username)}')">Del</button>
        </div>
      </div>`).join("");
  }catch(e){
    grid.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text-muted);grid-column:1/-1">Failed to load testers.</div>`;
  }
}

function testerModalHtml(t={}){
  const modes=[
    {key:'crystal',label:'Crystal'},{key:'sword',label:'Sword'},{key:'uhc',label:'UHC'},
    {key:'pot',label:'Pot'},{key:'neth_pot',label:'NethPot'},{key:'smp',label:'SMP'},
    {key:'axe',label:'Axe'},{key:'mace',label:'Mace'}
  ];
  const selected=(t.specialties||'').split(',').map(s=>s.trim()).filter(Boolean);
  return `
    <div class="modal-header">
      <h2 class="modal-title">${t.id?'Edit':'Add'} Tester</h2>
      <button class="modal-close" onclick="closeModal()"></button>
    </div>
    <form id="testerForm">
      <div class="form-group">
        <label class="form-label">Minecraft Username *</label>
        <div style="display:flex;gap:8px">
          <input type="text" class="form-input" id="tf_username" value="${esc(t.username||'')}" required maxlength="16" placeholder="e.g. Notch" style="flex:1"/>
          <button type="button" class="btn btn-secondary btn-sm" onclick="fetchTesterTiers()" style="white-space:nowrap">Fetch Tiers</button>
        </div>
        <div id="tf_tier_status" style="font-size:0.72rem;color:var(--text-muted);margin-top:4px"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Minecraft UUID <span style="color:var(--text-muted);font-size:0.72rem">(for skin)</span></label>
        <input type="text" class="form-input" id="tf_uuid" value="${esc(t.uuid||'')}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/>
      </div>
      <div class="form-group">
        <label class="form-label">Custom Skin URL <span style="color:var(--text-muted);font-size:0.72rem">(if no UUID)</span></label>
        <input type="text" class="form-input" id="tf_skin_url" value="${esc(t.skin_url||'')}" placeholder="https://..."/>
      </div>
      <div class="form-group">
        <label class="form-label">Discord User ID</label>
        <input type="text" class="form-input" id="tf_discord_id" value="${esc(t.discord_id||'')}" placeholder="123456789012345678"/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Role</label>
          <input type="text" class="form-input" id="tf_role" value="${esc(t.role||'Tester')}" placeholder="Head Tester"/>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="tf_active">
            <option value="true" ${t.is_active!==false?'selected':''}>Active</option>
            <option value="false" ${t.is_active===false?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Specialties <span style="color:var(--text-muted);font-size:0.72rem">(select modes)</span></label>
        <div class="tester-mode-checkboxes" id="tf_modes">
          ${modes.map(m=>`
            <label class="tester-mode-check ${selected.includes(m.key)?'checked':''}">
              <input type="checkbox" value="${m.key}" ${selected.includes(m.key)?'checked':''}
                     onchange="this.closest('label').classList.toggle('checked',this.checked)"/>
              <img src="/img/${m.key}.svg" width="14" height="14" style="object-fit:contain"/>
              ${m.label}
            </label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="tf_notes" rows="2">${esc(t.notes||'')}</textarea>
      </div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${t.id?'Save Changes':'Add Tester'}</button>
      </div>
    </form>`;
}

async function fetchTesterTiers(){
  const username=document.getElementById("tf_username").value.trim();
  if(!username){toast("Enter username first","error");return;}
  const status=document.getElementById("tf_tier_status");
  status.textContent="Fetching...";status.style.color="var(--text-muted)";
  try{
    const res=await fetch(`/api/players?search=${encodeURIComponent(username)}&limit=5`);
    const data=await res.json();
    const player=data.players?.find(p=>p.username.toLowerCase()===username.toLowerCase())||data.players?.[0];
    if(!player||!Object.keys(player.tiers||{}).length){
      status.textContent="No tiers found for this player.";status.style.color="var(--red,#ef4444)";return;
    }
    // Auto-fill UUID if found
    if(player.uuid&&!document.getElementById("tf_uuid").value){
      document.getElementById("tf_uuid").value=player.uuid;
    }
    // Check mode boxes that player has tiers in
    const modes=Object.keys(player.tiers||{});
    document.querySelectorAll("#tf_modes input[type=checkbox]").forEach(cb=>{
      const has=modes.includes(cb.value);
      cb.checked=has;
      cb.closest("label").classList.toggle("checked",has);
    });
    const tierSummary=modes.map(m=>{
      const t=player.tiers[m];
      const k=(t.pos===0?"HT":"LT")+t.tier;
      return `${m}:${k}`;
    }).join(", ");
    status.textContent=`✓ Found: ${tierSummary}`;status.style.color="#22c55e";
  }catch(e){
    status.textContent="Failed to fetch.";status.style.color="var(--red,#ef4444)";
  }
}

function getSelectedModes(){
  return [...document.querySelectorAll("#tf_modes input:checked")].map(cb=>cb.value).join(", ");
}

function showAddTesterModal(){
  openModal(testerModalHtml());
  document.getElementById("testerForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const body={
      username:document.getElementById("tf_username").value.trim(),
      uuid:document.getElementById("tf_uuid").value.trim(),
      skin_url:document.getElementById("tf_skin_url").value.trim(),
      discord_id:document.getElementById("tf_discord_id").value.trim(),
      role:document.getElementById("tf_role").value.trim()||"Tester",
      specialties:getSelectedModes(),
      is_active:document.getElementById("tf_active").value==="true",
      notes:document.getElementById("tf_notes").value.trim(),
    };
    try{
      const res=await api("/api/admin/testers",{method:"POST",body:JSON.stringify(body)});
      if(!res.ok){const err=await res.json();toast(err.error||"Failed to add tester","error");return;}
      closeModal();toast("Tester added!","success");fetchTesters();
    }catch(e){toast("Error: "+e.message,"error");}
  });
}

async function showEditTesterModal(id){
  try{
    const res=await api("/api/admin/testers");
    const testers=await res.json();
    const t=testers.find(x=>x.id===id);
    if(!t)return;
    openModal(testerModalHtml(t));
    document.getElementById("testerForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const body={
        username:document.getElementById("tf_username").value.trim(),
        uuid:document.getElementById("tf_uuid").value.trim(),
        skin_url:document.getElementById("tf_skin_url").value.trim(),
        discord_id:document.getElementById("tf_discord_id").value.trim(),
        role:document.getElementById("tf_role").value.trim()||"Tester",
        specialties:getSelectedModes(),
        is_active:document.getElementById("tf_active").value==="true",
        notes:document.getElementById("tf_notes").value.trim(),
      };
      try{
        const r=await api("/api/admin/testers/"+id,{method:"PUT",body:JSON.stringify(body)});
        if(!r.ok){const err=await r.json();toast(err.error||"Failed to update","error");return;}
        closeModal();toast("Tester updated!","success");fetchTesters();
      }catch(e){toast("Error: "+e.message,"error");}
    });
  }catch(e){toast("Error loading tester","error");}
}

async function toggleTesterOnline(id,online){
  try{
    await api("/api/admin/testers/"+id,{method:"PUT",body:JSON.stringify({is_online:online})});
    toast(online?"Set Online":"Set Offline","success");
    fetchTesters();
  }catch(e){toast("Error","error");}
}

async function deleteTester(id,name){
  if(!confirm(`Delete tester "${name}"?`))return;
  try{
    await api("/api/admin/testers/"+id,{method:"DELETE"});
    toast("Tester deleted","success");fetchTesters();
  }catch(e){toast("Error","error");}
}
