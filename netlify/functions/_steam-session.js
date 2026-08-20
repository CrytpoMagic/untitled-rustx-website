const crypto = require("crypto");

const COOKIE_NAME = "urx_steam_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret() {
  const s = process.env.STEAM_SESSION_SECRET;
  if (!s) throw new Error("STEAM_SESSION_SECRET is not configured.");
  return s;
}

// Signed, HttpOnly session cookie carrying only the SteamID64 + expiry — no server-side
// session store needed, and the frontend can never forge or read a different SteamID
// because it never sees the signing secret and the signature is checked on every request.
function sign(steamId, personaName) {
  const payload = JSON.stringify({ sid: steamId, name: personaName || null, exp: Date.now() + SESSION_TTL_MS });
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(b64).digest("base64url");
  return `${b64}.${mac}`;
}

function verify(cookieValue) {
  if (!cookieValue || !cookieValue.includes(".")) return null;
  const [b64, mac] = cookieValue.split(".");
  const expectedMac = crypto.createHmac("sha256", secret()).update(b64).digest("base64url");
  if (mac.length !== expectedMac.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    if (!payload.sid || !payload.exp || payload.exp < Date.now()) return null;
    return { steamId: payload.sid, personaName: payload.name || null };
  } catch (e) {
    return null;
  }
}

function readCookie(event) {
  const header = event.headers.cookie || event.headers.Cookie || "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE_NAME + "="));
  if (!match) return null;
  return verify(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)));
}

function setCookieHeader(steamId, personaName) {
  const token = sign(steamId, personaName);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

module.exports = { readCookie, setCookieHeader, COOKIE_NAME };
