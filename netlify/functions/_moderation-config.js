// Chat moderation configuration — PG / child-safe standard. Edit lists/limits here
// without touching logic in _moderation.js. Categories, not an exhaustive phrase list —
// normalization + word-boundary/context matching does the heavy lifting.
module.exports = {
  MAX_LEN: 140,
  COOLDOWN_MS: 90000, // 1 message per identity per 90s
  DUPLICATE_WINDOW_MS: 10 * 60000,
  BURST_LIMIT: 3,
  BURST_WINDOW_MS: 10 * 60000,

  // General profanity + slurs + insults — instant block, word-boundary matched.
  BLOCKED_WORDS: [
    // slurs (racial/ethnic/religious/disability/homophobic/transphobic/misogynistic)
    "nigger","nigga","niger","nigr","negro","coon","porchmonkey","sandnigger",
    "spic","spick","wetback","beaner","chink","gook","jap","kike","kyke",
    "towelhead","raghead","paki","curry muncher","gypsy","gyp",
    "faggot","fag","fags","faggy","queer","dyke","tranny","shemale","gay","homo",
    "retard","retarded","tard","cripple","gimp","spastic","mongoloid","autistic as an insult",
    "honky","cracker","wigger",
    // profanity / vulgar
    "fuck","fucking","fucker","fucked","motherfucker","fucktard","clusterfuck",
    "shit","shitty","bullshit","shithead","dipshit","horseshit",
    "cunt","bitch","bastard","asshole","dickhead","douchebag","douche","twat","wanker","bellend",
    "dick","cock","pussy","penis","vagina","boobs","tits","testicles","balls sack",
    "whore","slut","hoe","hooker","prostitute","skank",
    "bloody hell","piss off","eat my ass","eat a dick","suck a dick","screw you","damn you",
    "moron","idiot","imbecile","dumbass","dumbfuck","jackass","nitwit",
    // self-harm shorthand
    "kys","kms","unalive yourself",
    // misc adult/shock
    "orgy","cum","jizz","fap","jerk off","wank"
  ],

  // Any of these alone are severe accusations against a person — instant block regardless
  // of surrounding words (an accusation, not a neutral dictionary reference).
  ACCUSATION_TERMS: [
    "pedo","pedos","pedophile","pedophiles","paedo","paedos","paedophile","paedophiles","p3do","pdfile",
    "groomer","groomers","predator","predators",
    "rapist","rapists","molester","molesters","murderer","murderers","killer","abuser","abusers",
    "childabuser","sexoffender","sexoffenders","terrorist","terrorists","nazi","nazis","incel"
  ],

  // Contextual combo: child terms + abuse/crime terms within a short window.
  CHILD_TERMS: ["child","children","kid","kids","minor","minors","boys","girls","littleboy","littleboys","littlegirl","littlegirls","schoolkid","schoolkids"],
  ABUSE_VERBS: ["touch","touches","touched","touching","molest","molests","molested","rape","raped","rapes","abuse","abused","abuses"],
  CRIME_CONTEXT_TERMS: ["arrested","prison","jail","registry","offender","convicted"],

  // Explicit sexual content — instant block (jokes, propositions, body descriptions, acts).
  SEXUAL_TERMS: [
    "suckmydick","suckmycock","eatmyass","yourmomsucks","gorapeyourself",
    "sex","sexual","horny","nude","nudes","porn","porno","masturbate","masturbating",
    "blowjob","handjob","anal","orgasm","erection","boner","fetish","kink","kinky",
    "onlyfans","camgirl","stripper","hentai","incest","bestiality",
    "yourmomisawhore"
  ],

  // Violence/threat combo: violent verb + a target pronoun/person within a short window.
  VIOLENCE_VERBS: ["kill","murder","stab","shoot","beat","hurt","attack","choke","strangle","torture","assault","execute","bomb"],
  TARGET_WORDS: ["you","u","him","her","them","he","she","they","everyone","everybody"],

  // Self-harm encouragement combo: harmful verb + reflexive target.
  SELF_HARM_VERBS: ["kill","hurt","harm","end","unalive"],
  SELF_HARM_TARGETS: ["yourself","urself","ur self","your self","your life"],

  // Doxxing/swatting threats — instant block.
  THREAT_TERMS: ["dox","doxx","doxxed","doxxing","swat","swatting","findyou","findwhereyoulive","where you live","i will find you","ill find you","your address","your home address","send you my location","come find you"],

  // Drug/adult substances used for shock value — instant block.
  DRUG_TERMS: ["cocaine","heroin","meth","methamphetamine","weed","marijuana","crack","fentanyl","lsd","mdma","molly","shrooms","xanax","opioid","opioids","vape","vaping","cigarettes","alcohol is great get drunk"],

  // Server/community bashing: negative-sentiment word + a reference to the server/community
  // within a short window, OR a direct discouragement phrase.
  NEGATIVE_SENTIMENT_WORDS: ["sucks","suck","trash","garbage","dogshit","dying","dead","worst","ass","bad","blows","awful","terrible","horrible","lame","crap","cancer","joke","lagging","laggy","broken","pathetic","useless","incompetent","corrupt","rigged","biased","fake","fraud","scummy","greedy","overpriced","ripoff","clout chasing","clout chase"],
  SERVER_REFERENCE_WORDS: ["server","untitled","untitledrx","website","site","admins","admin","staff","owner","community","playerbase","place","srv","mods","moderators","support","team","tebex","store"],
  DISCOURAGE_PHRASES: [
    "dont play here","dont join","leave this server","go play another server","waste of time",
    "everyone leave","stop playing here","quit this server","play somewhere else","pay to win","pay 2 win","p2w",
    "not worth it","not worth your time","stay away from this server","avoid this server","find a better server",
    "this used to be good","used to be better","going downhill","going down hill","admin abuse","staff abuse",
    "rigged against players","rigged leaderboard","fake leaderboard","fake stats","cheaters everywhere and nothing is done",
    "money grab","cash grab","just wants your money","only cares about money"
  ],

  // Scam-related content — instant block.
  SCAM_TERMS: [
    "scam","scammed","scamming","scammer",
    "ripped off","rippedoff","stole my money","refund","chargeback",
    "never received","didnt receive","did not receive",
    "never got my","didnt get my","did not get my",
    "fake store","fake tebex","phishing","stolen card","stolen credit card",
    "dont trust this store","dont buy from this store","waste of money","dont buy anything here"
  ],

  // Legacy field kept for compatibility with existing severe-combo logic in _moderation.js.
  PEDO_ACCUSATION_TERMS: ["pedo","pedos","pedophile","pedophiles","paedo","paedos","paedophile","paedophiles","p3do","pdfile","groomer","groomers","predator","predators"],
  SEXUAL_HARASSMENT_TERMS: ["suckmydick","suckmycock","eatmyass","yourmomsucks","gorapeyourself","gokillyourself","yourmomisawhore","fuckyou","fuckoff"]
};
