// Discord bot snippet: posts/updates live Untitled RustX player count + status.
// Requires: npm install discord.js node-fetch (or use built-in fetch on Node 18+)

const BATTLEMETRICS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImQ5Mjk3ZTAzZDAzYWU1ZmEiLCJpYXQiOjE3ODUzNTMyMjgsIm5iZiI6MTc4NTM1MzIyOCwiaXNzIjoiaHR0cHM6Ly93d3cuYmF0dGxlbWV0cmljcy5jb20iLCJzdWIiOiJ1cm46dXNlcjoxMjI2ODI1In0.r8PAaSXNGfPwJMSV_4h_ry6Ltwg9Ec8HTRFRBsuFhDs';
const SERVER_ID = '40070748';
const CHANNEL_ID = 'YOUR_DISCORD_CHANNEL_ID'; // channel to post status in

async function getServerStatus() {
  const res = await fetch(`https://api.battlemetrics.com/servers/${SERVER_ID}`, {
    headers: { Authorization: `Bearer ${BATTLEMETRICS_TOKEN}` },
  });
  const json = await res.json();
  const attrs = json?.data?.attributes;
  if (!attrs) return null;
  return {
    online: attrs.status === 'online',
    players: attrs.players,
    maxPlayers: attrs.maxPlayers,
    name: attrs.name,
  };
}

// Example: run every 60s and update a channel's pinned message, or a bot's presence.
// Assumes you already have a discord.js Client instance called `client` and it's logged in.
async function updateStatusMessage(client) {
  const status = await getServerStatus();
  if (!status) return;

  const channel = await client.channels.fetch(CHANNEL_ID);
  const text = status.online
    ? `🟢 **Untitled RustX** — ${status.players}/${status.maxPlayers} players online`
    : `🔴 **Untitled RustX** — Server offline`;

  // Simple approach: just send a new message each interval, or edit a stored message ID.
  channel.send(text);

  // Optional: set the bot's own "Watching X players" presence
  client.user.setActivity(`${status.players}/${status.maxPlayers} players`, { type: 3 }); // 3 = WATCHING
}

// Example wiring (put this in your bot's index.js after client.login):
// client.once('ready', () => {
//   updateStatusMessage(client);
//   setInterval(() => updateStatusMessage(client), 60000);
// });

module.exports = { getServerStatus, updateStatusMessage };
