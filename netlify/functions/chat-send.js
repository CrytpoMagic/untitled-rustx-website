const crypto = require("crypto");
const { getSupabase, json } = require("./_supabase");
const { moderate, anonId, cfg } = require("./_moderation");

function hashCode(code) {
  const secret = process.env.CHAT_MOD_SECRET || "";
  return crypto.createHmac("sha256", secret).update(String(code || "").toUpperCase().trim()).digest("hex");
}

function sanitize(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/<[^>]*>/g, "");
  return s;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  // Chat requires an active paid access code. The client sends the code itself (not just
  // a cached token) so we can re-verify it hasn't expired/been revoked on every message.
  const code = String(body.accessCode || "").trim().toUpperCase();
  if (!code) return json(402, { error: "Live chat requires an active access code." });

  const message = sanitize(body.message);

  if (/@/.test(message)) return json(400, { error: "@ mentions are not allowed." });

  // moderate() enforces MAX_LEN (rejects rather than truncates), link/spam filtering,
  // and every content category — all before this message can reach the database.
  const result = moderate(message);
  if (result.blocked) {
    // Log the violation and auto-ban after repeated offenses — this is what happens
    // when something slips through and a mod (or the filter itself, on a future message)
    // catches it: the offender is locked out going forward, not just this one message.
    const id0 = anonId(event);
    if (id0) {
      try {
        const supabase = getSupabase();
        await supabase.from("chat_violations").insert({ client_id: id0, category: result.category });
        const { count } = await supabase
          .from("chat_violations")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id0);
        if ((count || 0) >= 3) {
          await supabase.from("chat_bans").upsert({
            client_id: id0,
            reason: "auto: repeated moderation violations",
            violation_count: count,
            banned_at: new Date().toISOString(),
            banned_until: null,
          });
        }
      } catch (e) {}
    }
    return json(400, { error: "Message blocked by chat moderation." });
  }

  // Server-derived anonymous identity — cannot be spoofed via request body.
  const id = anonId(event);
  if (!id) {
    return json(500, { error: "Chat is temporarily unavailable." });
  }

  try {
    const supabase = getSupabase();

    const { data: ban } = await supabase
      .from("chat_bans")
      .select("banned_until")
      .eq("client_id", id)
      .maybeSingle();
    if (ban && (!ban.banned_until || new Date(ban.banned_until).getTime() > Date.now())) {
      return json(403, { error: "You have been banned from chat." });
    }

    const { data: access, error: accessErr } = await supabase
      .from("chat_access_codes")
      .select("expires_at, active")
      .eq("code", code)
      .eq("active", true)
      .maybeSingle();
    if (accessErr) throw accessErr;
    if (!access) return json(402, { error: "Invalid access code." });
    if (new Date(access.expires_at).getTime() < Date.now()) {
      return json(402, { error: "Your access code has expired." });
    }

    const { data: rl } = await supabase
      .from("chat_ratelimit")
      .select("last_message_at, recent_at, recent_count, last_message_text")
      .eq("client_id", id)
      .maybeSingle();

    const now = Date.now();

    if (rl && now - new Date(rl.last_message_at).getTime() < cfg.COOLDOWN_MS) {
      const waitMs = cfg.COOLDOWN_MS - (now - new Date(rl.last_message_at).getTime());
      return json(429, { error: "You're sending messages too quickly. Try again shortly.", retryAfterMs: waitMs });
    }

    if (rl && rl.last_message_text && now - new Date(rl.last_message_at).getTime() < cfg.DUPLICATE_WINDOW_MS) {
      if (rl.last_message_text.trim().toLowerCase() === message.trim().toLowerCase()) {
        return json(429, { error: "You're sending messages too quickly. Try again shortly." });
      }
    }

    let recentAt = rl && rl.recent_at ? new Date(rl.recent_at).getTime() : 0;
    let recentCount = rl && recentAt && now - recentAt < cfg.BURST_WINDOW_MS ? rl.recent_count || 0 : 0;
    recentCount += 1;
    if (recentCount > cfg.BURST_LIMIT) {
      return json(429, { error: "You're sending messages too quickly. Try again shortly." });
    }

    await supabase.from("chat_ratelimit").upsert({
      client_id: id,
      last_message_at: new Date(now).toISOString(),
      last_message_text: message,
      recent_at: recentAt && now - recentAt < cfg.BURST_WINDOW_MS ? rl.recent_at : new Date(now).toISOString(),
      recent_count: recentCount
    });

    const { error } = await supabase.from("chat_messages").insert({
      sender: "Website Viewer",
      origin: "website",
      message
    });
    if (error) throw error;

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: "Chat send failed", detail: e.message });
  }
};
