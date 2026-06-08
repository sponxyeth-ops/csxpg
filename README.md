# Discord Server Status (free, GitHub-hosted)

Posts a **live status panel** for your Counter-Strike server into a Discord channel —
players, current map, ping, full scoreboard, logo and connect link — and refreshes it
every ~5 minutes. Runs entirely on **GitHub Actions**, so **no PC or VPS has to stay on**
and it costs nothing on a public repo.

Server: `XPlayZM.CSBlackDevil.COM` — `57.129.61.75:27015` (CS 1.6 / GoldSrc)

---

## How it works
1. A scheduled GitHub Action runs `status.mjs` every 5 minutes.
2. The script queries your game server (A2S protocol via `gamedig`).
3. It **edits one Discord message** through a webhook, so the panel updates in place
   instead of spamming new messages.

---

## Setup (about 5 minutes)

### 1. Create the Discord webhook
- In Discord: **Server Settings → Integrations → Webhooks → New Webhook**.
- Pick the channel where the status panel should live (e.g. `#server-status`).
- Click **Copy Webhook URL**.

### 2. Put this folder on GitHub
- Create a new repository (Public = unlimited free Actions minutes).
- Upload everything in this `discord-server-status` folder to the repo root.

### 3. Add the webhook secret
Repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**:

| Name          | Value                         |
|---------------|-------------------------------|
| `WEBHOOK_URL` | the webhook URL you copied    |

### 4. Add configuration variables
Same page → **Variables** tab → **New repository variable** (these are NOT secret):

| Name          | Value (example)                          |
|---------------|------------------------------------------|
| `SERVER_HOST` | `57.129.61.75`                           |
| `SERVER_PORT` | `27015`                                  |
| `GAME_TYPE`   | `cs16`                                   |
| `SERVER_NAME` | `XPlayZM.CSBlackDevil.COM`               |
| `LOGO_URL`    | a public image URL for the logo (optional)|

> `GAME_TYPE` values: `cs16` (CS 1.6 / GoldSrc), `csgo`, `cs2`, `css` (Source).
> Full list: https://github.com/gamedig/node-gamedig#games-list

### 5. First run → grab the MESSAGE_ID
- Repo → **Actions** tab → **Discord Server Status** → **Run workflow**.
- Open the run's log. On the first run it **creates** the message and prints:

  ```
  MESSAGE_ID = 123456789012345678
  ```

- Copy that number and add it as a **Variable** named `MESSAGE_ID`.
- From now on every run **edits that same message** (the live panel). Done!

---

## Customising
- **Refresh rate:** edit the `cron` line in `.github/workflows/status.yml`.
  `*/5 * * * *` = every 5 min (GitHub's minimum; it can lag a few minutes when busy).
- **Logo:** set `LOGO_URL` to any public PNG/JPG URL (e.g. your site or an imgur link).
- **Test locally** (optional):
  ```bash
  npm install
  WEBHOOK_URL="..." SERVER_HOST="57.129.61.75" SERVER_PORT="27015" node status.mjs
  ```
  On Windows PowerShell:
  ```powershell
  $env:WEBHOOK_URL="..."; $env:SERVER_HOST="57.129.61.75"; $env:SERVER_PORT="27015"; node status.mjs
  ```

## Notes / limits
- GitHub cron is "best effort" — updates usually land within a few minutes, not to the second.
- The scoreboard (player names + frags) only shows if your server allows A2S player queries
  (most CS 1.6 servers do).
- Webhook messages can't have real buttons, so the connect link is shown as
  `steam://connect/IP` text + a copy-paste `connect` command.
