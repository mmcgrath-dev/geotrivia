function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    $('storage-note').hidden = false;
    return false;
  }
}

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      for (const key of ['dailies', 'active', 'bestScores'])
        if (raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key]))
          save[key] = raw[key];
      for (const key of ['streak', 'bestStreak', 'games'])
        save[key] = Math.max(0, Number(raw[key]) || 0);
      save.lastDate = typeof raw.lastDate === 'string' ? raw.lastDate : null;
    } else {
      const old = JSON.parse(
        localStorage.getItem('geotrivia.v2') || localStorage.getItem('geotrivia.v1') || 'null',
      );
      // Keep legacy results separately: old pin-distance scores are not city-choice scores.
      if (old) {
        save.legacy = old;
        save.lastDate = old.date || null;
        save.streak = Math.max(0, Number(old.streak) || 0);
        save.bestStreak = Math.max(0, Number(old.best) || 0);
      }
    }
    settings.developer = false;
  } catch {
    $('storage-note').hidden = false;
  }
  for (const mode of ['easy', 'hard']) {
    save.bestScores[mode] = Math.max(0, Number(save.bestScores[mode]) || 0);
  }
}

function saveActive() {
  if (state.kind !== 'daily') return;
  save.active[state.mode] = {
    date: state.date,
    ids: state.qs.map((q) => q.id),
    hist: state.hist,
    score: state.score,
  };
  persist();
}
