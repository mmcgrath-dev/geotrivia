// Build the two playable clues for each shared fact.
const QUESTION_FACTS = [...BASE_FACTS, ...CULTURE_FACTS];

const QUESTIONS = QUESTION_FACTS.flatMap((fact) =>
  ['easy', 'hard'].map((mode) => ({
    id: `${fact.id}-${mode}`,
    factId: fact.id,
    mode,
    abbr: fact.abbr,
    state: STATES.find((place) => place.abbr === fact.abbr).name,
    ...(mode === 'hard' ? { city: fact.city, cityId: `${fact.abbr}:${fact.city}` } : {}),
    topic: fact.topic,
    nickname: !!fact.nickname,
    clue: fact[mode],
    fact: fact.fact,
    source: fact.source || null,
  })),
);
