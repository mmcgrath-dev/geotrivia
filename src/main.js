function init() {
  loadSaved();
  STATES.forEach((place) => {
    const option = document.createElement('option');
    option.value = place.abbr;
    option.textContent = place.name;
    $('state-list').append(option);
  });
  // Difficulty, round flow, and map controls.
  for (const modeButton of document.querySelectorAll('[data-mode]'))
    modeButton.onclick = () => setMode(modeButton.dataset.mode);
  $('play-daily').onclick = startDaily;
  $('state-list').onchange = (e) => chooseState(e.target.value);
  $('back-states').onclick = allStates;
  $('submit').onclick = () => {
    if (state.answered) nextQuestion();
    else submit();
  };
  $('pause-advance').onclick = pauseAdvance;
  // Capture the tap before a map choice can act on the next question.
  $('game').addEventListener('click', (event) => {
    if (!state.answered || state.finished || suppressClick) return;
    if (event.target.closest('button, select, input, textarea, a')) return;
    event.preventDefault();
    event.stopPropagation();
    nextQuestion();
  }, true);
  window.addEventListener('resize', () => {
    if (!$('game').hidden) fitClue();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.answered && !$('game').hidden) pauseAdvance();
  });
  $('zoom-in').onclick = () => zoom(0.8);
  $('zoom-out').onclick = () => zoom(1.25);
  $('zoom-fit').onclick = fit;
  $('quit').onclick = goHome;
  $('result-home').onclick = goHome;
  // Results and help dialogs.
  $('share').onclick = openResultDialog;
  $('copy-result').onclick = shareResult;
  $('close-result').onclick = () => $('result-dialog').close();
  $('review-results').onclick = () => $('result-dialog').close();
  $('result-dialog').addEventListener('close', () => {
    if (!$('results').hidden) $('share').focus({ preventScroll: true });
  });
  $('how-button').onclick = () => $('how').showModal();
  $('close-how').onclick = () => $('how').close();
  // Initial render and daily status refresh.
  bindMapNavigation();
  drawCountry($('hero-map'), true);
  refreshHome();
  setInterval(() => {
    if (!$('home').hidden) refreshHome();
  }, 60000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
