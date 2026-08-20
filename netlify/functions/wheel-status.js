const { getSupabase, json } = require("./_supabase");
const { readCookie } = require("./_steam-session");
const { withOdds } = require("./_wheel-prizes");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  const odds = withOdds().map((p) => ({ name: p.name, rarity: p.rarity, oddsPercent: Math.round(p.oddsPercent * 100) / 100 }));

  let session = null;
  try {
    session = readCookie(event);
  } catch (e) {
    return json(500, { error: "Server misconfigured." });
  }

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: "Server misconfigured." }); }

  const { data: cfgRow } = await supabase.from("wheel_config").select("value").eq("key", "enabled").maybeSingle();
  const enabled = !cfgRow || cfgRow.value !== "false";

  if (!session) {
    return json(200, { authenticated: false, enabled, odds });
  }

  const { data: player } = await supabase
    .from("wheel_players")
    .select("next_eligible_at, persona_name")
    .eq("steam_id", session.steamId)
    .maybeSingle();

  const nextEligibleAt = player ? player.next_eligible_at : null;
  const eligible = enabled && (!nextEligibleAt || new Date(nextEligibleAt).getTime() <= Date.now());

  const { data: lastSpin } = await supabase
    .from("wheel_spins")
    .select("id, prize_name, amount, created_at, delivered")
    .eq("steam_id", session.steamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // If the last spin happened inside the current cooldown window, surface it so a
  // page refresh/crash recovers the result instead of the player thinking it vanished.
  const lastSpinRecoverable =
    lastSpin && nextEligibleAt && new Date(lastSpin.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ? { prizeName: lastSpin.prize_name, amount: lastSpin.amount, delivered: lastSpin.delivered, createdAt: lastSpin.created_at }
      : null;

  return json(200, {
    authenticated: true,
    enabled,
    odds,
    personaName: session.personaName || (player && player.persona_name) || null,
    eligible,
    nextEligibleAt,
    serverNow: new Date().toISOString(),
    lastSpin: lastSpinRecoverable,
  });
};
