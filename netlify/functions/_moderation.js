const crypto = require("crypto");
const cfg = require("./_moderation-config");

// Common homoglyph/unicode lookalikes trolls use to dodge filters (Cyrillic, Greek, etc).
const HOMOGLYPHS = {
  "а":"a","е":"e","о":"o","р":"p","с":"c","х":"x","у":"y","і":"i","ѕ":"s","ⅼ":"l",
  "α":"a","ο":"o","ρ":"p","ν":"v","κ":"k","τ":"t","υ":"u","β":"b"
};

// --- normalization: defeats spacing/punctuation/leet/unicode/contraction evasion WITHOUT
// collapsing whole messages into one blob (that's what causes Scunthorpe-style false
// positives, e.g. "scunthorpe" containing "cunt"). Punctuation becomes a token separator,
// not deletion, and only RUNS of single-character tokens get reconstructed into a
// candidate word — that catches "p.e.d.o" / "k y s" while leaving real multi-letter
// words untouched.
function collapseAll(s) {
  return s.replace(/(.)\1+/g, "$1");
}
function normalize(text) {
  let s = String(text || "").toLowerCase().normalize("NFKC").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[\u0370-\u04FF]/g, (ch) => HOMOGLYPHS[ch] || ch);
  s = s.replace(/['\u2019]/g, ""); // contractions: "don't" -> "dont" (join, don't split)
  s = s.replace(/[@]/g, "a").replace(/[4]/g, "a");
  s = s.replace(/[3]/g, "e");
  s = s.replace(/[1]/g, "i");
  s = s.replace(/[0]/g, "o");
  s = s.replace(/[$5]/g, "s");
  s = s.replace(/[7]/g, "t");
  s = s.replace(/[^a-z0-9\s]/g, " ");
  s = s.replace(/(.)\1+/g, "$1"); // collapse ANY repeated-letter run to defeat "fuuuck"/"asss" tricks
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);

  const reconstructed = [];
  let buf = "";
  for (const t of tokens) {
    if (t.length === 1) { buf += t; }
    else { if (buf) { reconstructed.push(collapseAll(buf)); buf = ""; } reconstructed.push(t); }
  }
  if (buf) reconstructed.push(collapseAll(buf));

  return { spaced: tokens.join(" "), tokens, reconstructed };
}

function hasWord(list, tokens, reconstructed, spaced) {
  const set = new Set(tokens);
  for (const w of list) {
    if (w.includes(" ")) {
      const wCollapsed = w.split(" ").map(collapseAll).join(" ");
      const re = new RegExp("\\b" + wCollapsed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
      if (re.test(spaced)) return true;
      continue;
    }
    const wc = collapseAll(w);
    if (set.has(wc)) return true;
    if (reconstructed.includes(wc)) return true;
  }
  return false;
}

function idxOf(tokens, list) {
  const collapsedList = list.map(collapseAll);
  return tokens.reduce((acc, t, i) => (collapsedList.includes(t) ? acc.concat(i) : acc), []);
}
function near(aIdx, bIdx, window) {
  return aIdx.some((a) => bIdx.some((b) => Math.abs(a - b) <= window));
}

function severeComboHit(tokens, reconstructed, spaced) {
  if (hasWord(cfg.PEDO_ACCUSATION_TERMS, tokens, reconstructed, spaced)) return true;

  const childIdx = idxOf(tokens, cfg.CHILD_TERMS);
  const abuseIdx = idxOf(tokens, cfg.ABUSE_VERBS);
  const crimeIdx = idxOf(tokens, cfg.CRIME_CONTEXT_TERMS);
  if (childIdx.length && abuseIdx.length && near(childIdx, abuseIdx, 6)) return true;
  if (childIdx.length && crimeIdx.length && near(childIdx, crimeIdx, 6)) return true;
  return false;
}

function violenceThreatHit(tokens) {
  const vIdx = idxOf(tokens, cfg.VIOLENCE_VERBS);
  const tIdx = idxOf(tokens, cfg.TARGET_WORDS);
  return vIdx.length > 0 && tIdx.length > 0 && near(vIdx, tIdx, 4);
}

function selfHarmHit(spaced, tokens) {
  const vIdx = idxOf(tokens, cfg.SELF_HARM_VERBS);
  if (!vIdx.length) return false;
  return cfg.SELF_HARM_TARGETS.some((t) => spaced.includes(collapseAll(t)));
}

function serverBashingHit(tokens, reconstructed, spaced) {
  if (hasWord(cfg.DISCOURAGE_PHRASES, tokens, reconstructed, spaced)) return true;
  const check = (arr) => {
    const negIdx = idxOf(arr, cfg.NEGATIVE_SENTIMENT_WORDS);
    const refIdx = idxOf(arr, cfg.SERVER_REFERENCE_WORDS);
    return negIdx.length && refIdx.length && near(negIdx, refIdx, 6);
  };
  return check(tokens) || check(reconstructed);
}

// Link/spam filtering: any domain-like pattern, raw IP, or known shortener/invite pattern.
const LINK_PATTERNS = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(com|net|org|io|gg|tv|xyz|info|co|me|link|click|ru|cn|to|shop|store)\b/i,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /discord\.gg|discordapp\.com|bit\.ly|tinyurl/i
];
function hasLink(rawText) {
  return LINK_PATTERNS.some((re) => re.test(rawText));
}

function moderate(rawText) {
  const original = String(rawText || "");
  if (original.length > cfg.MAX_LEN) return { blocked: true, category: "too_long" };
  if (!original.trim()) return { blocked: true, category: "empty" };
  if (hasLink(original)) return { blocked: true, category: "link" };

  const text = original;
  const { spaced, tokens, reconstructed } = normalize(text);

  if (severeComboHit(tokens, reconstructed, spaced)) return { blocked: true, category: "severe_accusation" };
  if (hasWord(cfg.ACCUSATION_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "accusation" };
  if (hasWord(cfg.BLOCKED_WORDS, tokens, reconstructed, spaced)) return { blocked: true, category: "profanity_or_slur" };
  if (hasWord(cfg.SEXUAL_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "sexual" };
  if (hasWord(cfg.SEXUAL_HARASSMENT_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "sexual_harassment" };
  if (hasWord(cfg.THREAT_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "threat" };
  if (hasWord(cfg.DRUG_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "drugs" };
  if (violenceThreatHit(tokens)) return { blocked: true, category: "violence" };
  if (selfHarmHit(spaced, tokens)) return { blocked: true, category: "self_harm" };
  if (serverBashingHit(tokens, reconstructed, spaced)) return { blocked: true, category: "server_bashing" };
  if (hasWord(cfg.SCAM_TERMS, tokens, reconstructed, spaced)) return { blocked: true, category: "scam" };

  return { blocked: false, text };
}

// One-way anonymous identity: HMAC of IP + a server-only secret. Never derived from
// anything the client sends, so it can't be spoofed by changing a body field, and the
// raw IP is never stored — only this hash.
function anonId(event) {
  const secret = process.env.CHAT_MOD_SECRET;
  if (!secret) {
    console.error("[moderation] CHAT_MOD_SECRET is not configured — refusing to derive an identity.");
    return null;
  }
  const ip =
    (event.headers["x-nf-client-connection-ip"] ||
      (event.headers["x-forwarded-for"] || "").split(",")[0] ||
      "unknown").trim();
  return crypto.createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

module.exports = { moderate, anonId, normalize, cfg };
