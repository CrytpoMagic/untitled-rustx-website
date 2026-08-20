const crypto = require("crypto");
const { getSupabase, json } = require("./_supabase");

// Same one-way HMAC pattern as anonId() in _moderation.js — never stores the raw code,
// only its hash, so a leaked Supabase row can't be replayed as the code itself either
// (it can, since code IS the credential — but this at least keeps it out of logs/URLs).
function hashCode(code) {
  const secret = process.env.CHAT_MOD_SECRET || "";
  return crypto.createHmac("sha256", secret).update(code.toUpperCase().trim()).digest("hex");
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  const code = String(body.code || "").trim().toUpperCase();
  if (!code || code.length > 20) return json(400, { error: "Invalid code." });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("chat_access_codes")
      .select("code, expires_at, active")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return json(404, { error: "Code not found or already used." });
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return json(410, { error: "This code has expired." });
    }

    return json(200, { ok: true, token: hashCode(code), expiresAt: data.expires_at });
  } catch (e) {
    return json(500, { error: "Verification failed.", detail: e.message });
  }
};
