// Queries the CS 1.6 (GoldSrc) server and posts/edits a live status embed in Discord.
import { GameDig } from 'gamedig';

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID  = process.env.MESSAGE_ID || '';
const HOST        = process.env.SERVER_HOST || '57.129.61.75';
const PORT        = Number(process.env.SERVER_PORT || 27015);
const LOGO_URL    = process.env.LOGO_URL || '';
const SERVER_NAME = process.env.SERVER_NAME || 'XPlayZM.CSBlackDevil.COM';
const CONNECT_URL = process.env.CONNECT_URL || '';
const STEAM_ICON  = 'https://logo.clearbit.com/steampowered.com';

const CANDIDATES = [...new Set([
  process.env.GAME_TYPE, 'counterstrike16', 'cs16', 'goldsrc', 'cscz',
].filter(Boolean))];

if (!WEBHOOK_URL) {
  console.error('Missing WEBHOOK_URL.');
  process.exit(1);
}

const COLOR_ONLINE = 0x2ecc71;
const COLOR_OFFLINE = 0xe74c3c;
const AD_PATTERN = /(https?:\/\/|www\.|\.pro|\.com|\.net|\.org|discord\.gg|vip\b|\bbuy\b|\bshop\b|store|\$|€|🛒)/i;

function fmtTime(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

function isReal(p) {
  const name = (p.name ?? '').trim();
  return name && !AD_PATTERN.test(name);
}

function buildScoreboard(realPlayers) {
  if (!realPlayers.length) return '```\nNo players right now.\n```';
  const header = ' #  Player               Kills    Time';
  const rows = realPlayers.slice(0, 20).map((p, i) => {
    const rank = String(i + 1).padStart(2);
    const name = String(p.name).slice(0, 18).padEnd(18);
    const kills = String(p.raw?.score ?? p.score ?? 0).padStart(4);
    const time = fmtTime(p.raw?.time ?? p.time ?? 0).padStart(8);
    return `${rank}  ${name} ${kills}  ${time}`;
  });
  let block = '```\n' + header + '\n' + rows.join('\n') + '\n```';
  if (block.length > 1024) block = block.slice(0, 1015) + '\n…```';
  return block;
}

function buildEmbed(state) {
  if (!state) {
    return {
      title: `🔴 ${SERVER_NAME}`,
      description: '**Server is OFFLINE or not responding.**',
      color: COLOR_OFFLINE,
      thumbnail: LOGO_URL ? { url: LOGO_URL } : undefined,
      fields: [{ name: 'Connect', value: `\`connect ${HOST}:${PORT}\``, inline: false }],
      footer: { text: 'Last checked', icon_url: STEAM_ICON },
      timestamp: new Date().toISOString(),
    };
  }
  const allPlayers = Array.isArray(state.players) ? state.players : [];
  const max = state.maxplayers ?? '?';
  const realPlayers = allPlayers.filter(isReal)
    .sort((a, b) => (b.raw?.score ?? b.score ?? 0) - (a.raw?.score ?? a.score ?? 0));
  const connectTarget = CONNECT_URL || `steam://connect/${HOST}:${PORT}`;
  const connectValue = `**[🎮 CONNECT WITH STEAM](${connectTarget})**\n\`connect ${HOST}:${PORT}\``;
  return {
    author: { name: 'Counter-Strike 1.6 · Click to join', icon_url: STEAM_ICON },
    title: `🟢 ${state.name || SERVER_NAME}`,
    color: COLOR_ONLINE,
    thumbnail: LOGO_URL ? { url: LOGO_URL } : undefined,
    fields: [
      { name: '👥 Players', value: `**${realPlayers.length}/${max}**`, inline: true },
      { name: '🗺️ Map', value: `\`${state.map || 'unknown'}\``, inline: true },
      { name: '🔌 Connect', value: connectValue, inline: false },
      { name: '📋 Scoreboard', value: buildScoreboard(realPlayers), inline: false },
    ],
    footer: { text: 'Updates automatically · last checked', icon_url: STEAM_ICON },
    timestamp: new Date().toISOString(),
  };
}

async function queryServer() {
  for (const type of CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const state = await GameDig.query({ type, host: HOST, port: PORT, socketTimeout: 7000, attemptTimeout: 10000 });
        console.log(`OK: queried as "${type}" -> ${state.players?.length ?? 0} players, map ${state.map}`);
        return state;
      } catch (err) {
        console.warn(`Try "${type}" attempt ${attempt} failed: ${err?.message || err}`);
      }
    }
  }
  return null;
}

async function postNew(embed) {
  const res = await fetch(`${WEBHOOK_URL}?wait=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  const msg = await res.json();
  console.log(`\n   MESSAGE_ID = ${msg.id}\n`);
  return msg.id;
}

async function editExisting(embed) {
  const res = await fetch(`${WEBHOOK_URL}/messages/${MESSAGE_ID}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  if (res.status === 404) { console.warn('Message gone, posting new.'); return postNew(embed); }
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  console.log('Status message updated.');
}

async function main() {
  const state = await queryServer();
  const embed = buildEmbed(state);
  if (MESSAGE_ID) await editExisting(embed); else await postNew(embed);
}

main().catch((err) => { console.error(err); process.exit(1); });
