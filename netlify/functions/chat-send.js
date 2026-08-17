const { getSupabase, json } = require("./_supabase");
const { moderate, anonId, cfg } = require("./_moderation");

function sanitize(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/<[^>]*>/g, "");
  s = s.slice(0, cfg.MAX_LEN);
  return s;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  const message = sanitize(body.message);

  // Basic non-content rules kept separate from the moderation module (not abuse categories).
  if (/https?:\/\//i.test(message) || /\bwww\./i.test(message) || /discord\.gg/i.test(message)) {
    return json(400, { error: "Links are not allowed." });
  }
  if (/@/.test(message)) return json(400, { error: "@ mentions are not allowed." });

  const result = moderate(message);
  if (result.blocked) {
    return json(400, { error: "Message blocked by chat moderation." });
  }

  // Server-derived anonymous identity — cannot be spoofed via request body.
  const id = anonId(event);

  try {
    const supabase = getSupabase();

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
