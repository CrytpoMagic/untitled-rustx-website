const { setCookieHeader } = require("./_steam-session");

const REDIRECT_TARGET = "https://untitledrx.com/daily-wheel.html";

// Verifies the OpenID response actually came from Steam by re-posting the exact same
// signed params back to Steam's check_authentication endpoint. A forged/tampered
// claimed_id fails this check, so the frontend can never hand us a fake SteamID.
async function verifyWithSteam(params) {
  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");
  const res = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const text = await res.text();
  return /is_valid\s*:\s*true/i.test(text);
}

async function fetchPersonaName(steamId) {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`);
    const data = await res.json();
    const player = data && data.response && data.response.players && data.response.players[0];
    return player ? player.personaname : null;
  } catch (e) {
    return null;
  }
}

exports.handler = async function (event) {
  const qs = event.queryStringParameters || {};
  const params = {};
  for (const [k, v] of Object.entries(qs)) params[k] = v;

  const claimedId = params["openid.claimed_id"] || params["openid.identity"] || "";
  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!match) {
    return { statusCode: 302, headers: { Location: "/daily-wheel.html?error=steam_login_failed" }, body: "" };
  }
  const steamId = match[1];

  let valid = false;
  try {
    valid = await verifyWithSteam(params);
  } catch (e) {
    valid = false;
  }
  if (!valid) {
    return { statusCode: 302, headers: { Location: "/daily-wheel.html?error=steam_login_failed" }, body: "" };
  }

  const personaName = await fetchPersonaName(steamId);

  return {
    statusCode: 302,
    headers: {
      Location: REDIRECT_TARGET,
      "Set-Cookie": setCookieHeader(steamId, personaName),
    },
    body: "",
  };
};
