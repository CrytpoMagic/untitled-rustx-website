const crypto = require("crypto");
const cfg = require("./_moderation-config");

// --- normalization: defeats spacing/punctuation/leet evasion WITHOUT collapsing whole
// messages into one blob (that's what causes Scunthorpe-style false positives, e.g.
// "scunthorpe" containing "cunt"). Punctuation becomes a token separator, not deletion,
// and only RUNS of single-character tokens get reconstructed into a candidate word —
// that catches "p.e.d.o" / "k y s" while leaving real multi-letter words untouched.
function normalize(text) {
  let s = String(text || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[@]/g, "a").replace(/[4]/g, "a");
  s = s.replace(/[3]/g, "e");
  s = s.replace(/[1]/g, "i");
  s = s.replace(/[0]/g, "o");
  s = s.replace(/[$5]/g, "s");
  s = s.replace(/[7]/g, "t");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/(.)\1{2,}/g, "$1$1");
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);

  const reconstructed = [];
  let buf = "";
  for (const t of tokens) {
    if (t.length === 1) { buf += t; }
    else { if (buf) { reconstructed.push(buf); buf = ""; } reconstructed.push(t); }
  }
  if (buf) reconstructed.push(buf);

  return { spaced: tokens.join(" "), tokens, reconstructed };
}

function hasWord(list, tokens, reconstructed) {
  const set = new Set(tokens);
  for (const w of list) {
    if (set.has(w)) return true;
    if (reconstructed.includes(w)) return true;
  }
  return false;
}

// Detects accusation-style combinations (e.g. "X touches kids", "X arrested ... minors")
// without relying on one exact phrase — child terms + abuse/crime terms within a short
// token window, so unrelated sentences aren't caught.
function severeComboHit(tokens, reconstructed) {
  if (hasWord(cfg.PEDO_ACCUSATION_TERMS, tokens, reconstructed)) return true;

  const idxOf = (list) => tokens.reduce((acc, t, i) => (list.includes(t) ? acc.concat(i) : acc), []);
  const childIdx = idxOf(cfg.CHILD_TERMS);
  const abuseIdx = idxOf(cfg.ABUSE_VERBS);
  const crimeIdx = idxOf(cfg.CRIME_CONTEXT_TERMS);
  const WINDOW = 6;
  const near = (aIdx, bIdx) => aIdx.some((a) => bIdx.some((b) => Math.abs(a - b) <= WINDOW));

  if (childIdx.length && abuseIdx.length && near(childIdx, abuseIdx)) return true;
  if (childIdx.length && crimeIdx.length && near(childIdx, crimeIdx)) return true;
  return false;
}

function moderate(rawText) {
  const text = String(rawText || "").slice(0, cfg.MAX_LEN);
  if (!text.trim()) return { blocked: true, category: "empty" };

  const { tokens, reconstructed } = normalize(text);

  if (severeComboHit(tokens, reconstructed)) return { blocked: true, category: "severe_accusation" };
  if (hasWord(cfg.BLOCKED_WORDS, tokens, reconstructed)) return { blocked: true, category: "slur" };
  if (hasWord(cfg.SEXUAL_HARASSMENT_TERMS, tokens, reconstructed)) return { blocked: true, category: "sexual_harassment" };

  return { blocked: false, text };
}

// One-way anonymous identity: HMAC of IP + a server-only secret. Never derived from
// anything the client sends, so it can't be spoofed by changing a body field, and the
// raw IP is never stored — only this hash.
function anonId(event) {
  const secret = process.env.CHAT_MOD_SECRET || process.env.LEADERBOARD_INGEST_SECRET || "fallback-dev-secret";
  const ip =
    (event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0] ||
      "unknown").trim();
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

module.exports = { moderate, anonId, normalize, cfg };
