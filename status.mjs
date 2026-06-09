// Queries the CS 1.6 (GoldSrc) server and posts/edits a live status embed in Discord.
// Robust: tries multiple gamedig game IDs + retries until the server answers.
import { GameDig } from 'gamedig';

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MESSAGE_ID  = process.env.MESSAGE_ID || '';
const HOST        = process.env.SERVER_HOST || '57.129.61.75';
const PORT        = Number(process.env.SERVER_PORT || 27015);
const LOGO_URL    = process.env.LOGO_URL || '';
const SERVER_NAME = process.env.SERVER_NAME || 'XPlayZM.CSBlackDevil.COM';

const CANDIDATES = [...new Set([
  process.env.GAME_TYPE,
  'counterstrike16',
  'cs16',
  'goldsrc',
  'cscz',
].filter(Boolean))];

if (!WEBHOOK_URL) {
  console.error('Missing WEBHOOK_URL. Add it as a GitHub Actions secret or variable.');
  process.exit(1);
}

const COLOR_ONLINE  = 0x2ecc71;
const COLOR_OFFLINE = 0xe74c3c;

function fmtTime(secs) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function buildEmbed(state) {
  if (!state) {
    return {
      title: `🔴 ${SERVER_NAME}`,
      description: '**Server is OFFLINE or not responding.**',
      color: COLOR_OFFLINE,
      thumbnail: LOGO_URL ? { url: LOGO_URL } : undefined,
      fields: [{ name: 'Connect', value: `\`connect ${HOST}:${PORT}\``, inline: false }],
      footer: { text: 'Last checked' },
      timestamp: new Date().toISOString(),
    };
  }

  const players = Array.isArray(state.players) ? state.players : [];
  const bots = Array.isArray(state.bots) ? state.bots : [];
  const max = state.maxplayers ?? '?';

  let playerList = players
    .filter((p) => (p.name ?? '').trim().length > 0)
    .sort((a, b) => (b.raw?.score ?? b.score ?? 0) - (a.raw?.score ?? a.score ?? 0))
    .map((p) => {
      const score = p.raw?.score ?? p.score ?? 0;
      const time = fmtTime(p.raw?.time ?? p.time ?? 0);
      const name = String(p.name).slice(0, 20).replace(/`/g, "'");
      return `\`${String(score).padStart(3)}k\` \`${time.padStart(7)}\` ${name}`;
    })
    .join('\n');

  if (!playerList) playerList = '_No players right now_';
  if (playerList.length > 1020) playerList = playerList.slice(0, 1010) + '\n…';

  return {
    title: `🟢 ${state.name || SERVER_NAME}`,
    color: COLOR_ONLINE,
    thumbnail: LOGO_URL ? { url: LOGO_URL } : undefined,
    fields: [
      { name: '👥 Players', value: `**${players.length}/${max}**${bots.length ? ` (+${bots.length} bots)` : ''}`, inline: true },
      { name: '🗺️ Map', value: `\`${state.map || 'unknown'}\``, inline: true },
      { name: '📶 Ping', value: `${state.ping ?? '?'} ms`, inline: true },
      { name: '🔌 Connect', value: `\`connect ${HOST}:${PORT}\`\nsteam://connect/${HOST}:${PORT}`, inline: false },
      { name: '📋 Scoreboard — `kills` `time` name', value: playerList, inline: false },
    ],
    footer: { text: 'Updates automatically · last checked' },
    timestamp: new Date().toISOString(),
  };
}

async function queryServer() {
  for (const type of CANDIDATES) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const state = await GameDig.query({
          type,
          host: HOST,
          port: PORT,
          socketTimeout: 7000,
          attemptTimeout: 10000,
        });
        console.log(`OK: queried as "${type}" -> ${state.players?.length ?? 0} players, map ${state.map}`);
        return state;
      } catch (err) {
        console.warn(`Try "${type}" attempt ${attempt} failed: ${err?.message || err}`);
      }
    }
  }
  console.warn('All query attempts failed. Server may be down or blocking datacenter IPs.');
  return null;
}

async function postNew(embed) {
  const res = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  const msg = await res.json();
  console.log('\n=====================================================');
  console.log(' Add this as a repo VARIABLE named MESSAGE_ID so future');
  console.log(' runs edit this message instead of posting new ones:');
  console.log(`\n   MESSAGE_ID = ${msg.id}\n`);
  console.log('=====================================================\n');
  return msg.id;
}

async function editExisting(embed) {
  const res = await fetch(`${WEBHOOK_URL}/messages/${MESSAGE_ID}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (res.status === 404) { console.warn('Stored message gone, posting a new one.'); return postNew(embed); }
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  console.log('Status message updated.');
}

async function main() {
  const state = await queryServer();
  const embed = buildEmbed(state);
  if (MESSAGE_ID) await editExisting(embed); else await postNew(embed);
}

main().catch((err) => { console.error(err); process.exit(1); });
