// Browser checks for the compact home screen and overlapping state borders.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      pathToFileURL(process.env.GEOTRIVIA_PAGE || path.resolve(__dirname, '../index.html'))
        .href,
    );
    for (const [width, height] of [
      [1440, 900],
      [1280, 630],
      [1024, 600],
      [390, 844],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height });
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        playBottom: document.getElementById('play-daily').getBoundingClientRect().bottom,
        statusBottom: document.getElementById('home-status').getBoundingClientRect().bottom,
      }));
      assert(size.width <= width, `Horizontal overflow at ${width}: ${JSON.stringify(size)}`);
      assert(
        size.height <= height,
        `Vertical overflow at ${width}x${height}: ${JSON.stringify(size)}`,
      );
      assert(size.playBottom <= height && size.statusBottom <= height);
      console.log(`PASS: home fits ${width}x${height}`);
    }
    await page.setViewportSize({ width: 1280, height: 630 });
    const homeCalifornia = page.locator('#hero-map [data-state="CA"]');
    await homeCalifornia.hover();
    assert.equal(
      await page.locator('#hero-map .state-outline.active').getAttribute('d'),
      await homeCalifornia.getAttribute('d'),
    );
    assert(
      await page.locator('#hero-map').evaluate((map) => {
        const layer = map.querySelector('[data-state-outlines]');
        return (
          [...map.querySelectorAll('[data-state]')].every(
            (el) => !!(el.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING),
          ) &&
          getComputedStyle(layer.firstChild).fill === 'none' &&
          getComputedStyle(layer.firstChild).pointerEvents === 'none'
        );
      }),
      'Home hover borders must paint above neighboring states without blocking input',
    );
    await page.screenshot({ path: path.resolve(__dirname, '../qa/home-outline.png') });
    await page.locator('#hero-map [data-state="NV"]').hover();
    assert.equal(await page.locator('#hero-map .state-outline.active').count(), 1);
    assert.equal(
      await page.locator('#hero-map .state-outline.active').getAttribute('d'),
      await page.locator('#hero-map [data-state="NV"]').getAttribute('d'),
    );
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#hero-map .state-outline').count(), 0);
    console.log('PASS: home map hover borders and cleanup');
    await page.screenshot({ path: path.resolve(__dirname, '../qa/home-compact.png') });
    await page.locator('#mode-hard').click();
    await page
      .locator('#mode-hard')
      .getAttribute('aria-pressed')
      .then((value) => assert.equal(value, 'true'));
    await page.locator('#mode-easy').click();
    await page.locator('#play-daily').click();
    const california = page.locator('#map [data-state="CA"]');
    assert(
      await page.evaluate(() => {
        const label = [...document.querySelectorAll('.ocean-label')].find(
          (el) => el.textContent === 'PACIFIC OCEAN',
        );
        const box = label.getBBox();
        const states = [...document.querySelectorAll('#map [data-state]')];
        for (let x = box.x; x <= box.x + box.width; x += 2)
          for (let y = box.y; y <= box.y + box.height; y += 2) {
            if (states.some((el) => el.isPointInFill(new DOMPoint(x, y)))) return false;
          }
        return true;
      }),
      'Pacific Ocean text must be entirely off land',
    );
    await page.locator('#zoom-in').click();
    const viewBeforeClick = await page.locator('#map').getAttribute('viewBox');
    const originalCalifornia = await california.elementHandle();
    await california.hover();
    assert.equal(await page.locator('.state-outline.active').count(), 1);
    const californiaPath = await california.getAttribute('d');
    assert.equal(await page.locator('.state-outline.active').getAttribute('d'), californiaPath);
    await california.click();
    assert.equal(await page.locator('#map').getAttribute('viewBox'), viewBeforeClick);
    assert(
      await originalCalifornia.evaluate((el) => el.isConnected),
      'State clicks should update the existing map',
    );
    assert.equal(
      await page.locator('#map').evaluate((el) => getComputedStyle(el).animationName),
      'none',
    );
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('.state-outline.selected').getAttribute('d'), californiaPath);
    await page.locator('#map [data-state="NV"]').focus();
    assert.equal(
      await page.locator('.state-outline.active').getAttribute('d'),
      await page.locator('#map [data-state="NV"]').getAttribute('d'),
    );
    assert(
      await page.evaluate(() => {
        const layer = document.querySelector('#map [data-state-outlines]');
        return (
          [...document.querySelectorAll('#map [data-state]')].every(
            (el) => !!(el.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING),
          ) &&
          [...layer.children].every(
            (el) =>
              getComputedStyle(el).fill === 'none' && getComputedStyle(el).pointerEvents === 'none',
          )
        );
      }),
      'Highlight outlines must paint above all state fills and allow pointer input through',
    );
    await page.locator('#submit').click();
    assert.equal(await page.locator('.state-outline.correct').count(), 1);
    await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.resolve(__dirname, '../qa/state-outline.png') });
    await page.locator('#quit').click();
    // Exercise every clue and explanation: long text must not push controls out of view.
    for (const [width, height] of [
      [1440, 900],
      [1280, 630],
      [1024, 600],
      [768, 600],
      [390, 844],
      [375, 667],
    ]) {
      await page.setViewportSize({ width, height });
      const failures = await page.evaluate(() => {
        const failures = [];
        let firstLayout;
        function check(q, stage) {
          const map = document.getElementById('map').getBoundingClientRect();
          const footer = document.querySelector('.selection').getBoundingClientRect();
          const explorer = document.querySelector('.explorer');
          const root = document.documentElement;
          const clue = document.getElementById('clue');
          const clueBand = document.querySelector('.clue-card');
          if (clueBand.scrollHeight > clueBand.clientHeight + 1 || clue.scrollWidth > clue.clientWidth + 1 || clue.scrollHeight > clue.clientHeight + 1)
            failures.push({ id: q.id, stage: 'clue overflow' });
          const layout = [map.top, map.height, footer.top, footer.height];
          if (!firstLayout) firstLayout = layout;
          if (layout.some((value, i) => Math.abs(value - firstLayout[i]) > 1))
            failures.push({ id: q.id, stage: 'layout shifted', layout, firstLayout });
          if (
            root.scrollHeight > innerHeight ||
            root.scrollWidth > innerWidth ||
            footer.bottom > innerHeight + 1 ||
            map.height < 100 ||
            explorer.scrollHeight > explorer.clientHeight + 1
          ) {
            failures.push({
              id: q.id,
              stage,
              pageHeight: root.scrollHeight,
              viewport: innerHeight,
              mapHeight: map.height,
              panelHeight: explorer.clientHeight,
              panelContent: explorer.scrollHeight,
            });
          }
        }
        settings.developer = true;
        for (const q of QUESTIONS) {
          state.mode = q.mode;
          state.kind = 'developer';
          state.qs = [q];
          state.cq = 0;
          state.hist = [];
          state.score = 0;
          state.finished = false;
          showScreen('game');
          loadQuestion();
          check(q, 'state choice');
          chooseState(q.abbr);
          if (q.mode === 'hard') {
            check(q, 'city choices');
            chooseCity(q.cityId);
          }
          submit();
          check(q, 'answer');
          // Long incorrect guesses can add another line to the answer panel.
          const other = STATES.filter((s) => s.abbr !== q.abbr)
            .flatMap((s) =>
              CITY_ATLAS[s.abbr].map((c) => ({
                abbr: s.abbr,
                city: c.id,
                length: s.name.length + c.name.length,
              })),
            )
            .sort((a, b) => b.length - a.length)[0];
          state.hist = [];
          loadQuestion();
          chooseState(other.abbr);
          if (q.mode === 'hard') chooseCity(other.city);
          submit();
          check(q, 'incorrect answer');
          const correctChoice = document.querySelector(
            q.mode === 'hard' ? '#map [data-city].correct' : '#map [data-state].correct',
          );
          if (!correctChoice || (q.mode === 'hard' && state.mapState !== q.abbr))
            failures.push({ id: q.id, stage: 'correct location not revealed' });
        }
        return failures;
      });
      assert.deepEqual(
        failures,
        [],
        `Game scrolling at ${width}x${height}: ${JSON.stringify(failures.slice(0, 5))}`,
      );
      console.log(
        `PASS: all 300 clues and answers fit ${width}x${height}, including city choices`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 630 });
    await page.evaluate(() => {
      setMode('hard');
      startRound('developer');
      chooseState('CA');
      document.getAnimations().forEach((animation) => animation.finish());
    });
    await page.screenshot({ path: path.resolve(__dirname, '../qa/game-compact.png') });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.resolve(__dirname, '../qa/game-mobile.png') });
    await page.setViewportSize({ width: 1280, height: 630 });
    await page.evaluate(() => {
      settings.developer = false;
      setMode('easy');
      startRound('daily');
      while (!state.finished) {
        chooseState(question().abbr);
        submit();
        nextQuestion();
      }
    });
    assert.equal(await page.locator('#results').isVisible(), true);
    assert(
      !/practice|sharp eye|cartographer|city expert|a week of discovery/i.test(
        await page.locator('#results').innerText(),
      ),
    );
    assert.equal(await page.locator('a').count(), 0);
    assert.equal(await page.locator('#result-dialog').isVisible(), true);
    assert.equal(await page.locator('#share-grid .result-tile').count(), 10);
    await page.screenshot({
      path: path.resolve(__dirname, '../qa/results-simple.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: path.resolve(__dirname, '../qa/results-popup-mobile.png') });
    const popup = await page.locator('#result-dialog').boundingBox();
    assert(popup.x >= 0 && popup.x + popup.width <= 375 && popup.y >= 0 && popup.y + popup.height <= 667);
    await page.locator('#review-results').click();
    assert.equal(await page.locator('#result-dialog').isVisible(), false);
    await page.locator('#share').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#result-dialog').isVisible(), false);
    const clockStart = new Date('2026-09-22T16:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
    await page.evaluate(() => {
      goHome();
      setMode('hard');
      startRound('developer');
      chooseState(question().abbr);
      chooseCity(question().cityId);
      submit();
      submit();
    });
    assert.equal(await page.evaluate(() => state.hist.length), 1);
    await page.clock.fastForward(1999);
    assert.equal(await page.evaluate(() => state.cq), 0);
    await page.clock.fastForward(1);
    assert.equal(await page.evaluate(() => state.cq), 1);
    await page.evaluate(() => { chooseState(question().abbr); chooseCity(question().cityId); submit(); });
    await page.locator('#pause-advance').click();
    await page.clock.fastForward(10000);
    assert.equal(await page.evaluate(() => state.cq), 1);
    await page.locator('#submit').click();
    assert.equal(await page.evaluate(() => state.cq), 2);
    await page.evaluate(() => { chooseState(question().abbr); chooseCity(question().cityId); submit(); goHome(); });
    await page.clock.fastForward(10000);
    assert.equal(await page.locator('#home').isVisible(), true);
    await page.evaluate(() => {
      setMode('hard'); startRound('developer');
      chooseState(question().abbr);
      chooseCity(CITY_ATLAS[question().abbr].find(city => city.id !== question().cityId).id);
    });
    await page.locator('#submit').click();
    assert.equal(await page.evaluate(() => state.hist[0].points), 250);
    assert.equal(await page.evaluate(() => state.cq), 0, 'Confirm must not also skip the reveal');
    await page.clock.fastForward(3999);
    assert.equal(await page.evaluate(() => state.cq), 0);
    await page.clock.fastForward(1);
    assert.equal(await page.evaluate(() => state.cq), 1);
    await page.evaluate(() => {
      const other = STATES.find(place => place.abbr !== question().abbr).abbr;
      chooseState(other); chooseCity(CITY_ATLAS[other][0].id); submit();
    });
    assert.equal(await page.evaluate(() => state.hist[1].points), 0);
    await page.clock.fastForward(3999);
    assert.equal(await page.evaluate(() => state.cq), 1);
    await page.clock.fastForward(1);
    assert.equal(await page.evaluate(() => state.cq), 2);
    await page.evaluate(() => { chooseState(question().abbr); chooseCity(question().cityId); submit(); });
    await page.locator('#zoom-in').click();
    assert.equal(await page.evaluate(() => state.cq), 2, 'Map controls must not advance');
    await page.locator('#pause-advance').click();
    await page.locator('#clue').click();
    assert.equal(await page.evaluate(() => state.cq), 3, 'Tap the clue to advance');
    await page.clock.fastForward(5000);
    assert.equal(await page.evaluate(() => state.cq), 3, 'Tap cancels the previous timer');
    await page.evaluate(() => { chooseState(question().abbr); chooseCity(question().cityId); submit(); });
    await page.locator('#map').click({ position: { x: 20, y: 70 } });
    assert.equal(await page.evaluate(() => state.cq), 4, 'Tap the map to advance');
    assert.equal(await page.evaluate(() => state.selectedState), null, 'Advance tap must not select an answer');
    await page.evaluate(() => {
      setMode('easy'); startRound('developer');
      while (state.cq < 9) { chooseState(question().abbr); submit(); nextQuestion(); }
      chooseState(question().abbr); submit();
    });
    await page.clock.fastForward(2000);
    assert.equal(await page.locator('#result-dialog').isVisible(), true);
    await page.evaluate(() => {
      window.copiedResult = '';
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedResult = text; } } });
    });
    await page.locator('#copy-result').click();
    assert.match(await page.evaluate(() => window.copiedResult), /GeoTrivia.*Developer.*easy/);
    assert.equal(await page.locator('#toast').innerText(), 'Result copied!');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Unavailable'); } } });
    });
    await page.locator('#copy-result').click();
    assert.equal(await page.locator('#share-fallback').isVisible(), true);
    assert.match(await page.locator('#share-text').inputValue(), /10,000 \/ 10,000/);
    console.log('PASS: automatic advance, pause, skip, home cancellation, final popup, keyboard close, and copy fallback');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: difficulty selection, map hover/click/focus/answer outlines, and no browser errors',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
