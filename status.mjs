// Queries the CS server and posts/edits a live status embed in Discord via webhook.
// Designed to run on a schedule from GitHub Actions (free, no hosting needed).

import { GameDig } from 'gamedig';

// ---- Config from environment (set in GitHub repo Secrets / Variables) ----
const WEBHOOK_URL = process.env.WEBHOOK_URL;            // required (secret)
const MESSAGE_ID  = process.env.MESSAGE_ID || '';       // optional (variable) - set after first run
const HOST        = process.env.SERVER_HOST || '57.129.61.75';
const PORT        = Number(process.env.SERVER_PORT || 27015);
const GAME_TYPE   = process.env.GAME_TYPE || 'cs16';    // cs16 = GoldSrc Counter-Strike 1.6
const LOGO_URL    = process.env.LOGO_URL || '';         // optional image URL for the thumbnail
const SERVER_NAME = process.env.SERVER_NAME || 'XPlayZM.CSBlackDevil.COM';

if (!WEBHOOK_URL) {
  console.error('Missing WEBHOOK_URL. Add it as a GitHub Actions secret.');
  process.exit(1);
}

const COLOR_ONLINE  = 0x2ecc71; // green
const COLOR_OFFLINE = 0xe74c3c; // red

function buildEmbed(state) {
  const now = Math.floor(Date.now() / 1000);

  if (!state) {
    return {
      title: `🔴 ${SERVER_NAME}`,
      description: '**Server is OFFLINE or not responding.**',
      color: COLOR_OFFLINE,
      thumbnail: LOGO_URL ? { url: LOGO_URL } : undefined,
      fields: [
        { name: 'Connect', value: `\`connect ${HOST}:${PORT}\``, inline: false },
      ],
      footer: { text: 'Last checked' },
      timestamp: new Date().toISOString(),
    };
  }

  const players = Array.isArray(state.players) ? state.players : [];
  const bots = Array.isArray(state.bots) ? state.bots : [];
  const max = state.maxplayers ?? '?';

  // Player list (names + frags), trimmed to fit Discord's field limits
  let playerList = players
    .filter((p) => (p.name ?? '').trim().length > 0)
    .sort((a, b) => (b.raw?.score ?? b.score ?? 0) - (a.raw?.score ?? a.score ?? 0))
    .map((p) => {
      const score = p.raw?.score ?? p.score ?? 0;
      const name = String(p.name).slice(0, 22).replace(/`/g, "'");
      return `\`${String(score).padStart(3)}\` ${name}`;
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
      { name: '📋 Scoreboard (frags)', value: playerList, inline: false },
    ],
    footer: { text: 'Updates automatically · last checked' },
    timestamp: new Date().toISOString(),
  };
}

async function queryServer() {
  try {
    const state = await GameDig.query({
      type: GAME_TYPE,
      host: HOST,
      port: PORT,
      socketTimeout: 5000,
      attemptTimeout: 8000,
    });
    return state;
  } catch (err) {
    console.warn(`Query failed: ${err?.message || err}`);
    return null;
  }
}

async function postNew(embed) {
  // wait=true makes Discord return the created message (so we can grab its ID)
  const res = await fetch(`${WEBHOOK_URL}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status} ${await res.text()}`);
  const msg = await res.json();
  console.log('\n=====================================================');
  console.log(' Message created. Copy this ID into a repo VARIABLE');
  console.log(' named MESSAGE_ID so future runs EDIT this message:');
  console.log(`\n   MESSAGE_ID = ${msg.id}\n`);
  console.log('=====================================================\n');
  return msg.id;
}

async function editExisting(embed) {
  const url = `${WEBHOOK_URL}/messages/${MESSAGE_ID}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (res.status === 404) {
    console.warn('Stored message not found (deleted?). Posting a new one.');
    return postNew(embed);
  }
  if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`);
  console.log('Status message updated.');
}

async function main() {
  const state = await queryServer();
  const embed = buildEmbed(state);
  if (MESSAGE_ID) {
    await editExisting(embed);
  } else {
    await postNew(embed);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
