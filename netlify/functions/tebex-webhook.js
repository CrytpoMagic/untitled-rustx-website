const crypto = require("crypto");
const { getSupabase, json } = require("./_supabase");

const SPONSOR_PACKAGE_NAME = "sponsor the wipe";
const MAX_NAME_LEN = 30;
const WIPE_DAYS = 7;
const ALLOWED_IPS = new Set(["18.209.80.3", "54.87.231.232"]);

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const bodyHash = crypto.createHash("sha256").update(rawBody, "utf-8").digest("hex");
  const expected = crypto.createHmac("sha256", secret).update(bodyHash).digest("hex");
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signatureHeader, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  let name = raw.replace(/<[^>]*>/g, "");
  name = name.replace(/[<>"'&`]/g, "");
  name = name.trim().slice(0, MAX_NAME_LEN);
  return name.length ? name : null;
}

function extractSponsorName(product) {
  if (!product) return null;
  if (product.custom && typeof product.custom === "object" && !Array.isArray(product.custom)) {
    if (typeof product.custom.sponsorname === "string") return product.custom.sponsorname;
  }
  if (Array.isArray(product.custom)) {
    const hit = product.custom.find(c => (c.identifier || c.key || "").toLowerCase() === "sponsorname");
    if (hit) return hit.value || hit.option || null;
  }
  if (Array.isArray(product.variables)) {
    const hit = product.variables.find(v => (v.identifier || "").toLowerCase() === "sponsorname");
    if (hit) return hit.option || hit.value || null;
  }
  return null;
}

function getClientIp(event) {
  const xff = event.headers["x-forwarded-for"] || event.headers["X-Forwarded-For"];
  if (!xff) return null;
  return xff.split(",")[0].trim();
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { allow: "POST" });

  const secret = process.env.TEBEX_WEBHOOK_SECRET;
  const rawBody = event.body || "";
  const signature = event.headers["x-signature"] || event.headers["X-Signature"];

  const clientIp = getClientIp(event);
  if (clientIp && !ALLOWED_IPS.has(clientIp)) {
    return json(404, { error: "Not found" });
  }

  if (!verifySignature(rawBody, signature, secret)) {
    return json(401, { error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return json(400, { error: "Invalid JSON" });
  }

  if (payload.type === "validation.webhook") {
    return json(200, { id: payload.id });
  }

  if (payload.type !== "payment.completed") {
    return json(200, { ok: true, ignored: payload.type });
  }

  const subject = payload.subject || {};
  const transactionId = subject.transaction_id;
  if (!transactionId) return json(200, { ok: true, ignored: "no transaction_id" });

  const products = Array.isArray(subject.products) ? subject.products : [];
  const sponsorProduct = products.find(p => (p.name || "").toLowerCase().trim() === SPONSOR_PACKAGE_NAME);
  if (!sponsorProduct) return json(200, { ok: true, ignored: "no sponsor package in transaction" });

  const rawName = extractSponsorName(sponsorProduct);
  const displayName = sanitizeName(rawName);
  if (!displayName) return json(200, { ok: true, ignored: "no valid sponsorname supplied" });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + WIPE_DAYS * 24 * 60 * 60 * 1000);

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: e.message }); }
  const { error } = await supabase.from("sponsors").upsert(
    {
      display_name: displayName,
      transaction_id: transactionId,
      package_name: sponsorProduct.name,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      active: true,
    },
    { onConflict: "transaction_id", ignoreDuplicates: true }
  );

  if (error) return json(500, { error: "Failed to store sponsor", detail: error.message });

  return json(200, { ok: true });
};
