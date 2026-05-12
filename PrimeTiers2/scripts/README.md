# PrimeTiers Scripts — How to Sync Skins

## Overview

Bot pe players register karte hain aur skin URL dete hain.
Yeh scripts un skins ko website DB mein sync karte hain.

---

## Files

| Script | Kya karta hai |
|---|---|
| `skin.yml` | Bot ka `registrations.yml` content yahan paste karo |
| `parse-and-update-skins.js` | `skin.yml` se valid skin URLs website DB mein update karta hai |
| `fix-missing-skins.js` | Invalid/missing skin wale players ko fix karta hai (Mojang API + mc-heads fallback) |
| `fix-all-missing-skins.js` | Website DB mein jo bhi player bina skin ke hain unhe fix karta hai |
| `fix-mcheads-skins.js` | mc-heads fallback wale players ko Mojang se upgrade karta hai |
| `set-region-as.js` | Saare players ka region AS set karta hai |
| `botSync.js` | Auto sync — bot API se har 5 min mein data fetch karta hai |

---

## Skin Sync Process (Step by Step)

### Step 1 — Bot ka registrations.yml lao
- Minecraft server pe jao: `plugins/PrimeTiersBot/registrations.yml`
- Poora content copy karo

### Step 2 — skin.yml mein paste karo
- `scripts/skin.yml` file open karo
- Poora content replace karo (format same rehna chahiye):
```yaml
profiles:
  '1234567890123456789':
    ign: PlayerName
    account-type: Cracked
    preferred-server: ''
    gamemode: CPvP
    skin-url: https://minesk.in/abc123
    updated-at: 1234567890000
```

### Step 3 — Scripts run karo (order mein)
```bash
# Step 3a: Valid skin URLs update karo
node scripts/parse-and-update-skins.js

# Step 3b: Invalid/missing skins fix karo (Mojang API + fallback)
node scripts/fix-missing-skins.js

# Step 3c: mc-heads wale players ko upgrade karo
node scripts/fix-mcheads-skins.js

# Step 3d: Bache hue koi bhi player bina skin ke
node scripts/fix-all-missing-skins.js
```

---

## Skin URL Types (Bot mein jo milte hain)

| Type | Example | Status |
|---|---|---|
| ✅ textures.minecraft.net | `https://textures.minecraft.net/texture/abc...` | Best — direct texture |
| ✅ minesk.in | `https://minesk.in/abc123` | Good |
| ✅ render.mineskin.org | `https://render.mineskin.org/render?...` | Good |
| ✅ mineskin.org/skins | `https://mineskin.org/skins/abc123` | Good |
| ✅ namemc.com/skin | `https://namemc.com/skin/abc123` | Good |
| ✅ novaskin / skmedix | Various | Good |
| ⚠️ mc-heads.net | Set by script as fallback | Default Steve skin |
| ❌ Empty / "I don't have" | — | Script sets mc-heads fallback |
| ❌ base64 data | `data:image/png;base64,...` | Script uploads to MineSkin |
| ❌ Google/Discord links | — | Skipped |

---

## Website Frontend — Skin Display

Website `public/js/components.js` mein `getBustUrl()` function hai jo skin URL se 3D bust render karta hai:

- `mcskin:{username}:{hash}` format → `nmsr.nickac.dev/bust/{hash}`
- `textures.minecraft.net/texture/{hash}` → hash extract karke `nmsr.nickac.dev` use karta hai
- `visage.surgeplay.com` → direct use
- `mc-heads.net` → direct use (default skin)
- Koi bhi URL → `mc-heads.net/{username}` fallback

---

## Auto Sync (Webhook + Bot API)

### Webhook (Instant)
Jab bot pe kisi ko tier milta hai → bot turant website ko notify karta hai:
- `POST https://primetiers.qzz.io/api/webhook`
- Player auto-create hota hai (Mojang UUID fetch)
- Tier set hota hai
- Skin bhi set hoti hai (agar bot ke naye JAR mein hai)

### Bot API Sync (Har 5 min)
Website server `http://paid16.skilloraclouds.site:20052/api/players` se data fetch karta hai.

---

## Bot Config (plugins/PrimeTiersBot/config.yml)

```yaml
api-enabled: true
api-port: 20052

webhook-enabled: true
webhook-url: "https://primetiers.qzz.io/api/webhook"
webhook-secret: "Itbz54WhSTzEoKcZSC08jTV6SeVOLXEMgzbKrwHvwRwnl2kj"
```

---

## Region Fix

Saare players ka region `AS` set karne ke liye:
```bash
node scripts/set-region-as.js
```

---

## Notes

- `skin.yml` gitignore mein add karo (sensitive data)
- Bot ka naya JAR build karo jab bhi `plugin/` folder mein changes ho
- Webhook secret dono jagah same hona chahiye: `.env` aur `config.yml`
