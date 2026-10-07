// Answer reveal timing.
const CORRECT_PAUSE_MS = 2000;
const MISSED_PAUSE_MS = 4000;
let advanceTimer = null;

function cancelAdvance() {
  clearTimeout(advanceTimer);
  advanceTimer = null;
}

function pauseAdvance() {
  cancelAdvance();
  $('pause-advance').hidden = true;
  $('selection-caption').textContent = 'Answer revealed · paused';
}

function fitClue() {
  const clue = $('clue');
  clue.style.fontSize = '';
  let size = parseFloat(getComputedStyle(clue).fontSize);
  while (size > 14 && (clue.scrollHeight > clue.clientHeight || clue.scrollWidth > clue.clientWidth)) {
    clue.style.fontSize = `${--size}px`;
  }
}

// Scoring and round setup.
function pointsFor(mode, abbr, cityId, q) {
  return mode === 'easy'
    ? abbr === q.abbr
      ? 1000
      : 0
    : cityId === q.cityId
      ? 1000
      : abbr === q.abbr
        ? 250
        : 0;
}

function startDaily() {
  const today = easternDate(),
    done = save.dailies[state.mode];
  if (done?.date === today) {
    restoreResult(done);
    return;
  }
  const active = save.active[state.mode];
  if (
    active?.date === today &&
    Array.isArray(active.ids) &&
    active.ids.every((id) => QUESTIONS.some((q) => q.id === id))
  ) {
    Object.assign(state, {
      kind: 'daily',
      date: today,
      qs: active.ids.map((id) => QUESTIONS.find((q) => q.id === id)),
      hist: active.hist || [],
      cq: (active.hist || []).length,
      score: active.score || 0,
      finished: false,
      newBest: false,
    });
    if (state.cq >= state.qs.length) finishRound();
    else {
      showScreen('game');
      updateDevBadges();
      loadQuestion();
    }
  } else startRound('daily');
}

function startRound(kind, replay = false) {
  if (!['daily', 'developer'].includes(kind)) return;
  const date = easternDate();
  const qs =
    kind === 'daily' || replay
      ? dailyQuestions(state.mode, date)
      : chooseQuestions(state.mode, Math.floor(Math.random() * 4294967296));
  if (!qs.length) return;
  Object.assign(state, {
    kind,
    date,
    qs,
    cq: 0,
    score: 0,
    hist: [],
    finished: false,
    newBest: false,
  });
  if (kind === 'daily') saveActive();
  showScreen('game');
  updateDevBadges();
  loadQuestion();
}

// Question display and state/city selection.
function loadQuestion() {
  cancelAdvance();
  $('pause-advance').hidden = true;
  Object.assign(state, {
    selectedState: null,
    selectedCity: null,
    mapState: null,
    answered: false,
  });
  $('question-count').textContent = `${state.cq + 1} / ${state.qs.length}`;
  $('score').textContent = state.score.toLocaleString();
  $('game-mode').textContent = state.mode === 'easy' ? 'Easy' : 'Hard';
  $('question-topic').textContent = TOPICS[question().topic];
  $('clue').textContent = question().clue;
  fitClue();
  $('round-kind').textContent =
    state.kind === 'developer' ? 'Developer · unlimited' : 'Daily · ' + displayDate(state.date);
  $('answer').hidden = true;
  $('choose-panel').hidden = false;
  $('state-list').value = '';
  $('selection-caption').textContent = 'Your selection';
  $('selection-name').textContent = 'Choose a state to begin';
  $('submit').textContent = state.mode === 'easy' ? 'Confirm state' : 'Confirm city';
  $('submit').disabled = true;
  updateProgress();
  renderMap();
  renderChoices();
  $('clue').focus({ preventScroll: true });
}

function updateProgress() {
  const count = state.hist.length;
  $('progress-fill').style.width = `${(count / state.qs.length) * 100}%`;
  $('progress').setAttribute('aria-valuemax', state.qs.length);
  $('progress').setAttribute('aria-valuenow', count);
}

function chooseState(abbr) {
  if (state.answered || !stateBy(abbr) || suppressClick) return;
  state.selectedState = abbr;
  state.selectedCity = null;
  if (state.mode === 'hard') state.mapState = abbr;
  $('state-list').value = abbr;
  $('selection-name').textContent =
    stateBy(abbr).name + (state.mode === 'hard' ? ' — choose a city' : '');
  $('submit').disabled = state.mode === 'hard';
  if (state.mode === 'hard') renderMap();
  else syncSelection();
  renderChoices();
  if (state.mode === 'hard') $('city-list').querySelector('button')?.focus({ preventScroll: true });
  else $('submit').focus({ preventScroll: true });
}

function chooseCity(id) {
  if (state.answered || suppressClick) return;
  const city = CITY_ATLAS[state.mapState]?.find((c) => c.id === id);
  if (!city) return;
  state.selectedCity = id;
  state.selectedState = state.mapState;
  $('selection-name').textContent = `${city.name}, ${stateBy(state.mapState).name}`;
  $('submit').disabled = false;
  syncSelection();
  renderChoices();
  $('submit').focus({ preventScroll: true });
}

function allStates() {
  if (!state.answered) {
    state.selectedState = null;
    state.selectedCity = null;
    $('submit').disabled = true;
    $('selection-name').textContent = 'Choose a state to begin';
  }
  state.mapState = null;
  $('state-list').value = '';
  renderMap();
  renderChoices();
  if (!state.answered) $('state-list').focus({ preventScroll: true });
}

function renderChoices() {
  const zoomed = !!state.mapState,
    answered = state.answered;
  $('back-states').hidden = !zoomed;
  $('map-title').textContent = zoomed ? stateBy(state.mapState).name : 'United States';
  $('map-kicker').textContent = answered
    ? 'The story behind the clue'
    : zoomed
      ? 'A closer look'
      : 'Your next discovery';
  $('steps').replaceChildren();
  const labels =
    state.mode === 'hard' ? ['1 State', '2 City', '3 Reveal'] : ['1 State', '2 Reveal'];
  const current = answered ? labels.length - 1 : zoomed ? 1 : 0;
  labels.forEach((label, i) => {
    const el = document.createElement('span');
    el.className = 'step' + (i === current ? ' active' : '');
    el.textContent = label;
    $('steps').append(el);
  });
  $('choose-panel').hidden = answered;
  if (answered) return;
  $('choice-eyebrow').textContent = zoomed ? 'Choose a labeled city' : 'Explore the map';
  $('choice-title').textContent = zoomed ? stateBy(state.mapState).name : 'Which state?';
  $('choice-help').textContent = zoomed
    ? 'Select a city on the map or below. You can change states before confirming.'
    : state.mode === 'easy'
      ? 'Click a state or use the list below. Correct state: 1,000 points.'
      : 'Choose a state to explore its cities. Your first click only opens the map; it does not submit an answer.';
  $('state-list').hidden = zoomed;
  $('state-list-label').hidden = zoomed;
  $('city-list').replaceChildren();
  if (zoomed)
    CITY_ATLAS[state.mapState].forEach((city, i) => {
      const cityButton = document.createElement('button');
      cityButton.setAttribute('aria-pressed', String(state.selectedCity === city.id));
      const cityNumber = document.createElement('span');
      cityNumber.className = 'city-number';
      cityNumber.textContent = i + 1;
      const cityName = document.createElement('span');
      cityName.textContent = city.name;
      cityButton.append(cityNumber, cityName);
      cityButton.onclick = () => chooseCity(city.id);
      $('city-list').append(cityButton);
    });
  $('map-hint').textContent = zoomed
    ? 'Correct city: 1,000 · right state: 250'
    : 'Tip: the small Northeast states also have larger labels.';
}

// Answer feedback and round completion.
function submit() {
  if (state.answered) return;
  if (!state.selectedState || (state.mode === 'hard' && !state.selectedCity)) return;
  const q = question(),
    points = pointsFor(state.mode, state.selectedState, state.selectedCity, q);
  state.answered = true;
  state.score += points;
  state.hist.push({
    id: q.id,
    clue: q.clue,
    answer: state.mode === 'easy' ? q.state : `${q.city}, ${q.state}`,
    guess:
      state.mode === 'easy'
        ? stateBy(state.selectedState).name
        : `${cityBy(state.selectedCity).name}, ${stateBy(state.selectedState).name}`,
    points,
    fact: q.fact,
    abbr: q.abbr,
    cityId: q.cityId || null,
  });
  $('score').textContent = state.score.toLocaleString();
  $('score').classList.remove('score-bump');
  void $('score').clientWidth;
  $('score').classList.add('score-bump');
  updateProgress();
  saveActive();
  $('answer').hidden = false;
  $('answer-verdict').textContent =
    points === 1000
      ? 'You found it'
      : points === 250
        ? 'Right state, another city'
        : 'A new place to remember';
  $('answer-title').textContent = state.mode === 'easy' ? q.state : q.city;
  $('answer-points').textContent = `+${points.toLocaleString()} points`;
  $('answer-explanation').textContent = q.fact;
  $('answer-guess').textContent = `Your choice: ${state.hist.at(-1).guess}.`;
  const delay = points === 1000 ? CORRECT_PAUSE_MS : MISSED_PAUSE_MS;
  $('selection-caption').textContent = `Continuing in ${delay / 1000} seconds`;
  $('pause-advance').hidden = false;
  $('selection-name').textContent = state.hist.at(-1).answer;
  $('submit').textContent = state.cq === state.qs.length - 1 ? 'See results →' : 'Next question →';
  // Reveal the correct city immediately, even when the guess was in another state.
  state.mapState = state.mode === 'hard' ? q.abbr : null;
  renderMap();
  renderChoices();
  $('submit').focus({ preventScroll: true });
  advanceTimer = setTimeout(nextQuestion, delay);
}

function nextQuestion() {
  cancelAdvance();
  if (!state.answered || state.finished || $('game').hidden) return;
  state.cq++;
  if (state.cq >= state.qs.length) finishRound();
  else loadQuestion();
}

function finishRound() {
  cancelAdvance();
  if (state.finished) {
    renderResults();
    return;
  }
  state.finished = true;
  if (state.kind !== 'developer') {
    save.games++;
    // Only full ten-question rounds qualify for comparable personal records.
    state.newBest = state.qs.length === 10 && state.score > save.bestScores[state.mode];
    if (state.newBest) save.bestScores[state.mode] = state.score;
    if (state.kind === 'daily') {
      save.dailies[state.mode] = {
        date: state.date,
        mode: state.mode,
        score: state.score,
        hist: state.hist,
        ids: state.qs.map((q) => q.id),
      };
      delete save.active[state.mode];
      if (!save.lastDate || state.date > save.lastDate) {
        save.streak = save.lastDate === previousDate(state.date) ? save.streak + 1 : 1;
        save.lastDate = state.date;
        save.bestStreak = Math.max(save.bestStreak, save.streak);
      }
    }
    persist();
  }
  renderResults();
}
