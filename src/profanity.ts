// Word-boundary profanity check. Uses \b so "assassin", "classic", "bass" etc. are safe.
// Covers clear slurs and explicit profanity only — not borderline words.

const RAW = [
  // explicit profanity
  'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fucks', 'motherfucker', 'motherfucking',
  'shit', 'shits', 'shitting', 'shitty', 'bullshit',
  'cunt', 'cunts',
  'cock', 'cocks',
  'dick', 'dicks',
  'pussy', 'pussies',
  'bitch', 'bitches', 'bitching',
  'bastard', 'bastards',
  'whore', 'whores',
  'slut', 'sluts',
  'piss', 'pissed',
  'twat', 'twats',
  'wank', 'wanker', 'wankers',
  // racial / ethnic slurs
  'nigger', 'niggers', 'nigga', 'niggas',
  'faggot', 'faggots',
  'retard', 'retards', 'retarded',
  'kike', 'kikes',
  'spic', 'spics',
  'chink', 'chinks',
  'wetback', 'wetbacks',
  'coon', 'coons',
  'tranny', 'trannies',
  // other harmful
  'rape', 'raping', 'rapist', 'raped',
  'pedo', 'pedophile', 'pedophiles',
];

// Build a fuzzy pattern per word: \b + each letter joined by [^a-zA-Z]* + \b
// This catches spacing/separator evasions like "fu ck", "f.u.c.k", "f_u_c_k"
// while word boundaries prevent false positives in words like "scunthorpe" or "grapes".
function wordToFuzzyPattern(word: string): string {
  const chars = word.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return '\\b' + chars.join('[^a-zA-Z]*') + '\\b';
}

const PATTERN = new RegExp(
  '(' + RAW.map(wordToFuzzyPattern).join('|') + ')',
  'i'
);

export function containsProfanity(text: string): boolean {
  return PATTERN.test(text);
}

export function profanityError(): Response {
  return new Response(
    JSON.stringify({ error: 'This text contains language that is not allowed.' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
}
