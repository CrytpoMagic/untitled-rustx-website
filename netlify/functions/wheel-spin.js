const { getSupabase, json } = require("./_supabase");
const { readCookie } = require("./_steam-session");
const { rollPrize } = require("./_wheel-prizes");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let session;
  try {
    session = readCookie(event);
  } catch (e) {
    return json(500, { error: "Server misconfigured." });
  }
  if (!session) return json(401, { error: "Sign in through Steam first." });

  let supabase;
  try { supabase = getSupabase(); } catch (e) { return json(500, { error: "Server misconfigured." }); }

  let keyRole = "unknown";
  try {
    const parts = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").split(".");
    if (parts[1]) keyRole = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8")).role || "no-role-claim";
  } catch (e) { keyRole = "decode-failed"; }

  const { data: cfgRow } = await supabase.from("wheel_config").select("value").eq("key", "enabled").maybeSingle();
  if (cfgRow && cfgRow.value === "false") {
    return json(503, { error: "The daily wheel is temporarily offline." });
  }

  // wheel_try_spin does the eligibility check + claim atomically inside Postgres (row
  // lock on the UPDATE). Whichever of N simultaneous requests gets the row lock first
  // wins; every other request sees eligible=false, even if fired in the same millisecond.
  const { data: claimRows, error: claimErr } = await supabase.rpc("wheel_try_spin", {
    p_steam_id: session.steamId,
    p_persona: session.personaName || null,
  });
  if (claimErr) {
    console.error("[wheel-spin] wheel_try_spin RPC error:", JSON.stringify(claimErr));
    return json(500, { error: "Something went wrong. Your spin was NOT consumed. Please try again.", debug: claimErr.message });
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim || !claim.eligible) {
    return json(409, { error: "Daily spin already claimed.", nextEligibleAt: claim ? claim.next_eligible_at : null });
  }

  const prize = rollPrize();
  if (!prize) return json(500, { error: "No prizes are currently configured." });

  const { data: spinRow, error: insertErr } = await supabase
    .from("wheel_spins")
    .insert({
      steam_id: session.steamId,
      prize_id: prize.id,
      prize_name: prize.name,
      kind: prize.kind,
      item_shortname: prize.shortname || null,
      amount: prize.amount || 0,
      command: prize.command || null,
    })
    .select("id, prize_name, amount, created_at")
    .single();

  if (insertErr) {
    console.error("[wheel-spin] wheel_spins insert error:", JSON.stringify(insertErr));
    // Eligibility was already atomically claimed inside Postgres above — the win is
    // real and can't be replayed as a second spin. Surfacing a "secured" message
    // rather than a raw error keeps the source of truth on the backend, per spec.
    return json(200, {
      ok: true,
      recovered: false,
      warning: "Your reward was already secured server-side. Refresh the page to view your result.",
      debug: insertErr.message + " | keyRole=" + keyRole,
    });
  }

  return json(200, {
    ok: true,
    prize: { name: prize.name, rarity: prize.rarity },
    spinId: spinRow.id,
    nextEligibleAt: claim.next_eligible_at,
  });
};
