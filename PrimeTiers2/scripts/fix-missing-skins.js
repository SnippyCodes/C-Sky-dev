/**
 * fix-missing-skins.js
 * 
 * For players with no/invalid skin URL:
 * 
 * 1. base64 skin data → upload to MineSkin → get texture URL
 * 2. Premium + no skin → Mojang API UUID → visage.surgeplay.com bust
 * 3. Cracked + no skin → mc-heads.net avatar (username fallback)
 * 
 * Run: node scripts/fix-missing-skins.js
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../server/db/pool');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isValidSkinUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (u === '' || u === "''" || u === '""') return false;
  if (!u.startsWith('http://') && !u.startsWith('https://')) return false;
  const junk = [
    'google.com/search', 'discord.com/channels', 'share.google',
    'minecraft.wiki', 'gamepedia', 'planetminecraft.com/skin/',
    'data:image', 'blob:', 'content://', 'tlauncher.org/catalog/skins/13',
    'kommodo.ai', 'ibb.co', 'imgur.com/DA0', 'i.imgur.com/Xh6',
    'tse2.mm.bing', 'encrypted-tbn0', 'images-ext-1.discordapp',
    'xyrios.com', 'skinmc.net/profile/ItzRealMe',
    'minecraft.novaskin.me/post/1002883041',
    'minotar.net/skin/Dream', 'novask.in/t/skeppy',
    'minecraft.novaskin.me/player/',
    'minecraft.novaskin.me/post/hnH9jwX9mqq1AuhebPU4/flamefrags',
    'skins4minecraft.com/alex',
    'static.planetminecraft.com/files/resource_media/skin/steve',
    'minecraft.wiki/images/thumb/Alex',
    'www.minecraftskins.net/static/preview/elderlysteve',
    'gamepedia.cursecdn.com/minecraft_gamepedia/d/d7/Steve',
  ];
  for (const j of junk) { if (u.includes(j)) return false; }
  return true;
}

function parseRegistrationsYml(content) {
  const players = [];
  const lines = content.replace(/\r/g, '').split('\n');
  let currentIgn = null, currentSkin = null, currentType = 'Cracked';
  let inProfiles = false, inEntry = false;

  for (const line of lines) {
    if (line.trim() === 'profiles:') { inProfiles = true; continue; }
    if (!inProfiles) continue;
    if (/^  ['"]?\d{15,20}['"]?:/.test(line)) {
      if (currentIgn) players.push({ ign: currentIgn, skinUrl: currentSkin || '', accountType: currentType });
      currentIgn = null; currentSkin = null; currentType = 'Cracked'; inEntry = true; continue;
    }
    if (!inEntry) continue;
    const im = line.match(/^    ign:\s*(.+)$/);
    const sm = line.match(/^    skin-url:\s*(.*)$/);
    const am = line.match(/^    account-type:\s*(.+)$/);
    if (im) currentIgn  = im[1].trim().replace(/^['"]|['"]$/g, '');
    if (sm) currentSkin = sm[1].trim().replace(/^['"]|['"]$/g, '');
    if (am) currentType = am[1].trim().replace(/^['"]|['"]$/g, '');
  }
  if (currentIgn) players.push({ ign: currentIgn, skinUrl: currentSkin || '', accountType: currentType });
  return players;
}

// Fetch UUID from Mojang
async function fetchMojangUUID(username) {
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch { return null; }
}

// Upload base64 PNG to MineSkin, return texture hash URL or null
async function uploadBase64ToMineSkin(base64Data) {
  try {
    // Strip data:image/png;base64, prefix if present
    const b64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length < 100) return null;

    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'image/png' }), 'skin.png');
    form.append('visibility', '1');

    const res = await fetch('https://api.mineskin.org/generate/upload', {
      method: 'POST',
      headers: { 'User-Agent': 'PrimeTiers/1.0' },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const textureValue = data?.data?.texture?.value;
    if (textureValue) {
      const decoded = JSON.parse(Buffer.from(textureValue, 'base64').toString());
      const tUrl = decoded?.textures?.SKIN?.url || '';
      const hashMatch = tUrl.match(/texture\/([a-f0-9]{64})/i);
      if (hashMatch) {
        return `https://textures.minecraft.net/texture/${hashMatch[1]}`;
      }
    }
    return null;
  } catch { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const ymlPath = path.join(__dirname, 'skin.yml');
  if (!fs.existsSync(ymlPath)) { console.error('❌ skin.yml not found!'); process.exit(1); }

  const content  = fs.readFileSync(ymlPath, 'utf8');
  const allPlayers = parseRegistrationsYml(content);
  const needFix  = allPlayers.filter(p => !isValidSkinUrl(p.skinUrl) && p.ign && p.ign !== 'null');

  console.log(`📋 Total parsed: ${allPlayers.length}`);
  console.log(`🔧 Need skin fix: ${needFix.length}`);
  console.log('');

  let updated = 0, skipped = 0, notFound = 0, failed = 0;

  for (const player of needFix) {
    try {
      const res = await pool.query(
        `SELECT id, username, skin_url, platform FROM players WHERE username ILIKE $1 LIMIT 1`,
        [player.ign]
      );

      if (res.rows.length === 0) { notFound++; continue; }
      const dbPlayer = res.rows[0];

      // Skip if already has a valid skin in DB
      if (dbPlayer.skin_url && dbPlayer.skin_url.trim() !== '') { skipped++; continue; }

      let newSkinUrl = null;
      const rawSkin = player.skinUrl.trim();

      // ── Case 1: base64 image data ──────────────────────────────────────────
      if (rawSkin.startsWith('data:image') || /^[A-Za-z0-9+/]{100,}={0,2}$/.test(rawSkin)) {
        console.log(`🔄 ${player.ign} — uploading base64 to MineSkin...`);
        newSkinUrl = await uploadBase64ToMineSkin(rawSkin);
        if (newSkinUrl) {
          console.log(`✅ ${player.ign} → MineSkin texture URL`);
        } else {
          console.log(`⚠️  ${player.ign} — MineSkin upload failed, using fallback`);
        }
        await sleep(2000); // MineSkin rate limit
      }

      // ── Case 2: Premium player — Mojang UUID ──────────────────────────────
      if (!newSkinUrl && player.accountType.toLowerCase() === 'premium') {
        const uuid = await fetchMojangUUID(player.ign);
        if (uuid) {
          newSkinUrl = `https://visage.surgeplay.com/bust/${uuid}?overlay`;
          console.log(`✅ ${player.ign} (Premium) → Mojang UUID skin`);
        } else {
          newSkinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(player.ign)}/64`;
          console.log(`⚠️  ${player.ign} (Premium) — Mojang not found, mc-heads fallback`);
        }
        await sleep(300); // Mojang rate limit
      }

      // ── Case 3: Cracked player — mc-heads fallback ────────────────────────
      if (!newSkinUrl) {
        newSkinUrl = `https://mc-heads.net/avatar/${encodeURIComponent(player.ign)}/64`;
        console.log(`ℹ️  ${player.ign} (Cracked) → mc-heads fallback`);
      }

      // Update DB
      await pool.query(
        `UPDATE players SET skin_url = $1, last_active = NOW() WHERE id = $2`,
        [newSkinUrl, dbPlayer.id]
      );
      updated++;

    } catch (err) {
      console.error(`❌ ${player.ign}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('─────────────────────────────────────────');
  console.log(`✅ Updated:    ${updated}`);
  console.log(`⏭️  Skipped:    ${skipped} (already had skin in DB)`);
  console.log(`⚠️  Not found:  ${notFound} (not in website DB)`);
  console.log(`❌ Failed:     ${failed}`);
  console.log('─────────────────────────────────────────');

  await pool.end();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
