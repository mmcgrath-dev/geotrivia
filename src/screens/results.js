function restoreResult(result) {
  Object.assign(state, {
    kind: 'daily',
    mode: result.mode,
    date: result.date,
    score: result.score,
    hist: result.hist,
    qs: result.ids.map((id) => QUESTIONS.find((q) => q.id === id)).filter(Boolean),
    finished: true,
    newBest: false,
  });
  renderResults();
}

function renderResults() {
  showScreen('results');
  $('result-kind').textContent =
    state.kind === 'developer'
      ? 'Developer round · records unaffected'
      : `Daily challenge · ${displayDate(state.date)}`;
  $('final-score').textContent = state.score.toLocaleString();
  $('final-max').textContent =
    `of ${(state.hist.length * 1000).toLocaleString()} points · ${state.mode} mode`;
  $('result-note').textContent =
    state.kind === 'developer'
      ? 'Developer round complete. Return home to play again.'
      : state.newBest
        ? 'A new personal best!'
        : `Personal best: ${save.bestScores[state.mode].toLocaleString()} · ${state.hist.filter((r) => r.points === 1000).length} perfect answers this round`;
  $('summary').replaceChildren();
  state.hist.forEach((r, i) => {
    const details = document.createElement('details'),
      summary = document.createElement('summary'),
      title = document.createElement('span'),
      score = document.createElement('span'),
      guessDescription = document.createElement('p'),
      fact = document.createElement('p');
    title.textContent = `${i + 1}. ${r.answer}`;
    score.className = 'score';
    score.textContent = `+${r.points.toLocaleString()}`;
    summary.append(title, score);
    guessDescription.textContent = r.clue + ' Your choice: ' + r.guess + '.';
    fact.textContent = r.fact;
    details.append(summary, guessDescription, fact);
    $('summary').append(details);
  });
  $('toast').textContent = '';
  $('share-fallback').hidden = true;
  openResultDialog();
}

function openResultDialog() {
  $('share-score').textContent = state.score.toLocaleString();
  $('share-mode').textContent = `${state.mode === 'easy' ? 'Easy' : 'Hard'} · ${state.kind === 'developer' ? 'Developer round' : displayDate(state.date)}`;
  $('share-perfect').textContent = `${state.hist.filter((r) => r.points === 1000).length} of ${state.hist.length} perfect answers`;
  $('share-grid').replaceChildren();
  state.hist.forEach((r, i) => {
    const tile = document.createElement('span');
    tile.className = 'result-tile ' + (r.points === 1000 ? 'perfect' : r.points > 0 ? 'partial' : 'missed');
    tile.textContent = r.points === 1000 ? '✓' : r.points > 0 ? '−' : '×';
    tile.setAttribute('role', 'img');
    tile.setAttribute('aria-label', `Question ${i + 1}: ${r.points} points`);
    $('share-grid').append(tile);
  });
  $('toast').textContent = '';
  $('share-fallback').hidden = true;
  if (!$('result-dialog').open) $('result-dialog').showModal();
}

function resultPlayLink(href = window.location.href) {
  const url = new URL(href);
  if (!['https:', 'http:'].includes(url.protocol)) return '';
  url.search = '';
  url.hash = '';
  return url.href;
}

async function shareResult() {
  const kind = state.kind === 'developer' ? 'Developer' : displayDate(state.date);
  const link = resultPlayLink();
  const invitation = link ? `\n\nCan you beat my score? Play GeoTrivia:\n${link}` : '';
  const text = `GeoTrivia · ${kind} · ${state.mode}\n${state.score.toLocaleString()} / ${(state.hist.length * 1000).toLocaleString()}\n${state.hist.map((r) => (r.points === 1000 ? '🟩' : r.points > 0 ? '🟨' : '⬜')).join('')}${invitation}`;
  try {
    await navigator.clipboard.writeText(text);
    $('toast').textContent = 'Result copied!';
  } catch {
    $('share-fallback').hidden = false;
    $('share-text').value = text;
    $('share-text').focus();
    $('share-text').select();
    $('toast').textContent = 'Select and copy your result below.';
  }
}
