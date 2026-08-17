// Chat moderation configuration — edit lists/limits here without touching logic.
module.exports = {
  MAX_LEN: 140,
  COOLDOWN_MS: 60000, // 1 message per identity per minute
  DUPLICATE_WINDOW_MS: 5 * 60000, // block exact/near-duplicate repeats from same identity within this window
  BURST_LIMIT: 6, // max messages per identity within BURST_WINDOW_MS
  BURST_WINDOW_MS: 10 * 60000,

  // Word-boundary matched slurs/harassment terms (checked against normalized, de-leeted text).
  BLOCKED_WORDS: [
    "nigger","nigga","niger","nigr","negro",
    "faggot","fag","fags","faggy",
    "retard","retarded","tard",
    "spic","spick","wetback",
    "chink","gook","jap",
    "kike","kyke",
    "tranny","shemale",
    "cunt",
    "coon","porchmonkey","sandnigger",
    "beaner","towelhead","raghead",
    "honky","dyke",
    "kys"
  ],

  // Terms used in the contextual severe-combo checks below (kept separate so they can be tuned).
  PEDO_ACCUSATION_TERMS: ["pedo","pedophile","paedo","paedophile","p3do","pdfile"],
  CHILD_TERMS: ["child","children","kid","kids","minor","minors","littleboy","littleboys","littlegirl","littlegirls","schoolkid","schoolkids"],
  ABUSE_VERBS: ["touch","touches","touched","touching","molest","molests","molested","rape","raped","rapes","abuse","abused","abuses"],
  CRIME_CONTEXT_TERMS: ["arrested","prison","jail","registry","offender","convicted"],

  // Explicit sexual harassment phrase fragments (word-boundary, not raw substrings).
  SEXUAL_HARASSMENT_TERMS: [
    "suckmydick","suckmycock","eatmyass","yourmomsucks",
    "gorapeyourself","gokillyourself"
  ]
};
