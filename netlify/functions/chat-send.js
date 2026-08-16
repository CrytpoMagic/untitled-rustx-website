const { getSupabase, json } = require("./_supabase");

const BLOCKED_WORDS = ["nigger","nigga","faggot","fag","retard","spic","chink","kike","tranny","cunt"];
const MAX_LEN = 140;
const COOLDOWN_MS = 60000;

function sanitize(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/<[^>]*>/g, "");
  s = s.slice(0, MAX_LEN);
  return s;
}

function violatesRules(text) {
  const lower = text.toLowerCase();
  if (/https?:\/\//i.test(text) || /\bwww\./i.test(text)) return "links are not allowed";
  if (/@/.test(text)) return "@ mentions are not allowed";
  if (/discord\.gg/i.test(text)) return "invite links are not allowed";
  for (const w of BLOCKED_WORDS) {
    if (lower.includes(w)) return "message blocked by chat filter";
  }
  if (!text) return "message is empty";
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Invalid JSON" }); }

  const clientId = String(body.clientId || "").slice(0, 80);
  if (!clientId) return json(400, { error: "Missing clientId" });

  const message = sanitize(body.message);
  const violation = violatesRules(message);
  if (violation) return json(400, { error: violation });

  try {
    const supabase = getSupabase();

    const { data: rl } = await supabase
      .from("chat_ratelimit")
      .select("last_message_at")
      .eq("client_id", clientId)
      .maybeSingle();

    if (rl && Date.now() - new Date(rl.last_message_at).getTime() < COOLDOWN_MS) {
      const waitMs = COOLDOWN_MS - (Date.now() - new Date(rl.last_message_at).getTime());
      return json(429, { error: "Slow down — 1 message per minute", retryAfterMs: waitMs });
    }

    await supabase.from("chat_ratelimit").upsert({ client_id: clientId, last_message_at: new Date().toISOString() });

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
