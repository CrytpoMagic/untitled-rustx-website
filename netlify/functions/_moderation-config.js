// Chat moderation configuration — edit lists/limits here without touching logic.
module.exports = {
  MAX_LEN: 140,
  COOLDOWN_MS: 90000, // 1 message per identity per 90s — stricter
  DUPLICATE_WINDOW_MS: 10 * 60000,
  BURST_LIMIT: 3, // max messages per identity within BURST_WINDOW_MS — stricter
  BURST_WINDOW_MS: 10 * 60000,

  // Word-boundary matched slurs/harassment terms (checked against normalized, de-leeted text).
  BLOCKED_WORDS: [
    "nigger","nigga","niger","nigr","negro",
    "faggot","fag","fags","faggy","gay",
    "retard","retarded","tard","idiot","moron","stupid","dumb","dumbass",
    "spic","spick","wetback",
    "chink","gook","jap",
    "kike","kyke",
    "tranny","shemale",
    "cunt","pussy","dick","cock","bitch","bastard","asshole","dickhead",
    "coon","porchmonkey","sandnigger",
    "beaner","towelhead","raghead",
    "honky","dyke",
    "kys","kms",
    "whore","slut","hoe",
    "cripple","gimp"
  ],

  // Terms used in the contextual severe-combo checks below (kept separate so they can be tuned).
  PEDO_ACCUSATION_TERMS: ["pedo","pedos","pedophile","pedophiles","paedo","paedos","paedophile","paedophiles","p3do","pdfile","groomer","groomers","predator","predators"],
  CHILD_TERMS: ["child","children","kid","kids","minor","minors","littleboy","littleboys","littlegirl","littlegirls","schoolkid","schoolkids"],
  ABUSE_VERBS: ["touch","touches","touched","touching","molest","molests","molested","rape","raped","rapes","abuse","abused","abuses"],
  CRIME_CONTEXT_TERMS: ["arrested","prison","jail","registry","offender","convicted"],

  // Explicit sexual harassment phrase fragments (word-boundary, not raw substrings).
  SEXUAL_HARASSMENT_TERMS: [
    "suckmydick","suckmycock","eatmyass","yourmomsucks",
    "gorapeyourself","gokillyourself","yourmomisawhore","fuckyou","fuckoff"
  ]
};
