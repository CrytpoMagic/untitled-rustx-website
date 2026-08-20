// Single source of truth for prize odds — both the RNG selection and the publicly
// displayed odds read from this exact array, so displayed odds can never drift from
// the real ones. Edit weight/enabled here to rebalance; no other file needs touching.
//
// Every prize here is a real Untitled RustX store item (see Store.dc.html) so winning
// the wheel always feels like winning something you could have bought. Weapon kits are
// the jackpot tier — each one sits at ~0.10% individually.
//
// kind: "item" grants a native Rust item via ItemManager (item_shortname/amount).
// kind: "command" runs a server console command to deliver a custom kit (teas, serum,
// minicopter, resource kits) the same way a Tebex/store purchase would — {steamid} is
// substituted by the plugin.
const PRIZES = [
  // Resource Kits — common, matches the $3-$6 resource kit tier
  { id: "resource_wood", name: "Wood Kit (2,000 Wood)", kind: "command", command: "give {steamid} wood 2000", weight: 1400, rarity: "common", enabled: true },
  { id: "resource_stone", name: "Stone Kit (2,000 Stone)", kind: "command", command: "give {steamid} stones 2000", weight: 1400, rarity: "common", enabled: true },
  { id: "resource_metal", name: "Metal Kit (2,000 Metal Frags)", kind: "command", command: "give {steamid} metal.fragments 2000", weight: 1400, rarity: "common", enabled: true },
  { id: "resource_sulfur", name: "Sulfur Kit (2,000 Sulfur)", kind: "command", command: "give {steamid} sulfur 2000", weight: 1400, rarity: "common", enabled: true },
  // Medical — common/uncommon
  { id: "medical_syringe", name: "Medical Syringe", kind: "item", shortname: "syringe.medical", amount: 5, weight: 500, rarity: "common", enabled: true },
  { id: "medical_largemedkit", name: "Large Medkit", kind: "item", shortname: "largemedkit", amount: 2, weight: 500, rarity: "common", enabled: true },
  { id: "medical_bandage", name: "Bandage", kind: "item", shortname: "bandage", amount: 10, weight: 500, rarity: "common", enabled: true },
  { id: "medical_antirad", name: "Antirad Pills", kind: "item", shortname: "antiradpills", amount: 10, weight: 500, rarity: "common", enabled: true },
  // Teas — uncommon
  { id: "tea_healing", name: "Healing Tea", kind: "command", command: "givekit {steamid} tea_healing", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_maxhealth", name: "Max Health Tea", kind: "command", command: "givekit {steamid} tea_maxhealth", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_wood", name: "Wood Tea", kind: "command", command: "givekit {steamid} tea_wood", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_ore", name: "Ore Tea", kind: "command", command: "givekit {steamid} tea_ore", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_scrap", name: "Scrap Tea", kind: "command", command: "givekit {steamid} tea_scrap", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_radresist", name: "Rad Resist Tea", kind: "command", command: "givekit {steamid} tea_radresist", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_radremoval", name: "Rad Removal Tea", kind: "command", command: "givekit {steamid} tea_radremoval", weight: 250, rarity: "uncommon", enabled: true },
  { id: "tea_advhealing", name: "Advanced Healing Tea", kind: "command", command: "givekit {steamid} tea_advancedhealing", weight: 250, rarity: "uncommon", enabled: true },
  // Rare
  { id: "super_serum", name: "Super Serum", kind: "command", command: "givekit {steamid} superserum", weight: 200, rarity: "rare", enabled: true },
  { id: "minicopter", name: "Minicopter", kind: "command", command: "givekit {steamid} minicopter", weight: 120, rarity: "rare", enabled: true },
  // Weapon Kits — jackpot tier, ~0.10% each
  { id: "weapon_ak", name: "AK Kit + Ammo", kind: "command", command: "givekit {steamid} weaponkit_ak", weight: 10, rarity: "jackpot", enabled: true },
  { id: "weapon_bolt", name: "Bolt Action Kit + Ammo", kind: "command", command: "givekit {steamid} weaponkit_bolt", weight: 10, rarity: "jackpot", enabled: true },
  { id: "weapon_tommy", name: "Tommy Gun Kit + Ammo", kind: "command", command: "givekit {steamid} weaponkit_tommy", weight: 10, rarity: "jackpot", enabled: true },
  { id: "weapon_customsmg", name: "Custom SMG Kit + Ammo", kind: "command", command: "givekit {steamid} weaponkit_customsmg", weight: 10, rarity: "jackpot", enabled: true },
];

function activePrizes() {
  return PRIZES.filter((p) => p.enabled);
}

function withOdds() {
  const active = activePrizes();
  const total = active.reduce((sum, p) => sum + p.weight, 0);
  return active.map((p) => ({ ...p, oddsPercent: total > 0 ? (p.weight / total) * 100 : 0 }));
}

const crypto = require("crypto");

// Cryptographically secure weighted pick — never Math.random() for the authoritative roll.
function rollPrize() {
  const active = activePrizes();
  const total = active.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return null;
  const roll = crypto.randomInt(0, total);
  let acc = 0;
  for (const p of active) {
    acc += p.weight;
    if (roll < acc) return p;
  }
  return active[active.length - 1];
}

module.exports = { PRIZES, activePrizes, withOdds, rollPrize };
