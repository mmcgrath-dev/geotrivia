function easternDate(when = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(when);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function displayDate(key) {
  const [year, month, day] = key.split('-');
  return `${month}/${day}/${year}`;
}

function previousDate(key) {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function hash(text) {
  let n = 2166136261;
  for (const ch of text) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shuffle(items, rnd) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function chooseQuestions(mode, seed, excludedFacts = new Set()) {
  const rnd = seeded(seed),
    topics = shuffle(Object.keys(TOPICS), rnd);
  const candidates = Object.fromEntries(
    topics.map((topic) => [
      topic,
      shuffle(
        QUESTIONS.filter(
          (q) => q.mode === mode && q.topic === topic && !excludedFacts.has(q.factId),
        ),
        rnd,
      ),
    ]),
  );
  const slots = shuffle([...topics, ...topics], rnd),
    selected = [],
    usedStates = new Set();
  // Backtracking keeps the category and geographic limits exact, even if early picks clash.
  function fill(index, nicknames) {
    if (index === slots.length) return true;
    for (const q of candidates[slots[index]]) {
      if (usedStates.has(q.abbr) || (q.nickname && nicknames === 1)) continue;
      selected.push(q);
      usedStates.add(q.abbr);
      if (fill(index + 1, nicknames + Number(q.nickname))) return true;
      selected.pop();
      usedStates.delete(q.abbr);
    }
    return false;
  }
  if (!fill(0, 0)) throw new Error('The question bank cannot supply a balanced round.');
  return selected;
}

function legacyDailyQuestions(mode, date) {
  // Build both modes together, regardless of which one the player opens first.
  const first = hash(DATA_VERSION + '|' + date) % 2 ? 'easy' : 'hard',
    second = first === 'easy' ? 'hard' : 'easy';
  const firstSet = chooseQuestions(first, hash(DATA_VERSION + '|' + date + '|' + first));
  if (mode === first) return firstSet;
  return chooseQuestions(
    second,
    hash(DATA_VERSION + '|' + date + '|' + second),
    new Set(firstSet.map((q) => q.factId)),
  );
}

// Preserve published rounds; new rounds exclude both modes from the previous two days.
const ROTATION_START = '2026-09-24';
const dailyCache = new Map();

function dailyQuestions(mode, date = easternDate()) {
  if (date < ROTATION_START) return legacyDailyQuestions(mode, date);
  if (!dailyCache.size) {
    let prior = previousDate(ROTATION_START);
    for (let i = 0; i < 2; i++, prior = previousDate(prior)) {
      dailyCache.set(prior, {
        easy: legacyDailyQuestions('easy', prior),
        hard: legacyDailyQuestions('hard', prior),
      });
    }
  }
  const cursor = new Date(ROTATION_START + 'T12:00:00Z');
  for (
    let key = ROTATION_START;
    key <= date;
    cursor.setUTCDate(cursor.getUTCDate() + 1), key = cursor.toISOString().slice(0, 10)
  ) {
    if (dailyCache.has(key)) continue;
    const yesterday = previousDate(key);
    const excluded = new Set(
      [yesterday, previousDate(yesterday)].flatMap((day) =>
        Object.values(dailyCache.get(day))
          .flat()
          .map((q) => q.factId),
      ),
    );
    const first = hash(DATA_VERSION + '|' + key) % 2 ? 'easy' : 'hard';
    const second = first === 'easy' ? 'hard' : 'easy';
    // Retry the pair together if the first round leaves no balanced second round.
    for (let attempt = 0; attempt < 64; attempt++) {
      try {
        const firstSet = chooseQuestions(
          first,
          hash(`${DATA_VERSION}|rotation|${key}|${first}|${attempt}`),
          excluded,
        );
        const secondSet = chooseQuestions(
          second,
          hash(`${DATA_VERSION}|rotation|${key}|${second}|${attempt}`),
          new Set([...excluded, ...firstSet.map((q) => q.factId)]),
        );
        dailyCache.set(key, { [first]: firstSet, [second]: secondSet });
        break;
      } catch (error) {
        if (attempt === 63) throw error;
      }
    }
  }
  return [...dailyCache.get(date)[mode]];
}
