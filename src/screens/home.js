function question() {
  return state.qs[state.cq];
}

function stateBy(abbr) {
  return STATES.find((s) => s.abbr === abbr);
}

function cityBy(id) {
  return Object.values(CITY_ATLAS)
    .flat()
    .find((c) => c.id === id);
}

function showScreen(id) {
  cancelAdvance();
  if ($('result-dialog').open) $('result-dialog').close();
  for (const page of ['home', 'game', 'results']) $(page).hidden = page !== id;
  window.scrollTo(0, 0);
}

function setMode(mode) {
  state.mode = mode;
  for (const m of ['easy', 'hard']) $('mode-' + m).setAttribute('aria-pressed', String(mode === m));
  refreshHome();
}

function updateDevBadges() {
  settings.developer = false;
}

function refreshHome() {
  updateDevBadges();
  const today = easternDate(),
    done = save.dailies[state.mode]?.date === today;
  const active = save.active[state.mode]?.date === today;
  $('play-daily').textContent = done
    ? "View today's result"
    : active
      ? 'Continue today’s challenge →'
      : 'Play today’s challenge →';
  const streak = save.lastDate === today || save.lastDate === previousDate(today) ? save.streak : 0;
  $('home-status').textContent = done
    ? `Today's ${state.mode} challenge: ${save.dailies[state.mode].score.toLocaleString()} points.`
    : `10 questions · ${state.mode === 'easy' ? 'Pick a state' : 'Choose a state, then a city'} · One daily result per mode`;
  $('current-streak').textContent = `${streak} day streak`;
}

function goHome() {
  showScreen('home');
  setMode(state.mode);
}
