// Runs the actual game logic with a small DOM harness. No browser or user saves.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const allElements = [];
class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.attributes = {};
    this.children = [];
    this.hidden = false;
    this.style = {};
    this.clientWidth = 900;
    this.clientHeight = 550;
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.listeners = {};
    this.classList = {
      add: (...names) => this.setClasses([...this.classes(), ...names]),
      remove: (...names) => this.setClasses(this.classes().filter((c) => !names.includes(c))),
      toggle: (name, on) => {
        on = on ?? !this.classes().includes(name);
        this.setClasses(on ? [...this.classes(), name] : this.classes().filter((c) => c !== name));
      },
      contains: (name) => this.classes().includes(name),
    };
    allElements.push(this);
  }
  classes() {
    return (this.attributes.class || '').split(/\s+/).filter(Boolean);
  }
  setClasses(names) {
    this.attributes.class = [...new Set(names)].join(' ');
  }
  set className(value) {
    this.attributes.class = value;
  }
  get className() {
    return this.attributes.class || '';
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] ?? null;
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((c) => [
      ...(matches(c, selector) ? [c] : []),
      ...c.querySelectorAll(selector),
    ]);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  focus() {}
  select() {}
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
  }
}
function matches(el, selector) {
  if (selector.startsWith('[')) return el.getAttribute(selector.slice(1, -1)) !== null;
  return el.tagName === selector;
}
const nodes = Object.fromEntries(
  [...shell.matchAll(/<([a-z0-9-]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => {
    const el = new Element(m[1]);
    el.hidden = /\bhidden\b/.test(m[0]);
    el.setAttribute('id', m[2]);
    return [m[2], el];
  }),
);
for (const mode of ['easy', 'hard']) nodes['mode-' + mode].setAttribute('data-mode', mode);
const document = {
  readyState: 'loading',
  getElementById: (id) => nodes[id] || null,
  createElement: (tag) => new Element(tag),
  createElementNS: (_, tag) => new Element(tag),
  addEventListener() {},
  querySelectorAll(selector) {
    if (selector.startsWith('#')) {
      const [id, sub] = selector.split(' ');
      return nodes[id.slice(1)].querySelectorAll(sub);
    }
    return allElements.filter((el) => matches(el, selector));
  },
};
const memory = new Map();
const timers = new Map();
let timerId = 0;
const localStorage = { getItem: (k) => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
const context = vm.createContext({
  document,
  window: { scrollTo() {}, addEventListener() {} },
  localStorage,
  navigator: {},
  getComputedStyle: () => ({ fontSize: '18' }),
  console,
  setInterval() {},
  setTimeout(fn) {
    timers.set(++timerId, fn);
    return timerId;
  },
  clearTimeout(id) {
    timers.delete(id);
  },
  Date,
  Math,
  Intl,
  Set,
  Map,
});
const source = [...shell.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)]
  .map((m) => fs.readFileSync(path.join(root, 'src', m[1]), 'utf8'))
  .join('\n');
new vm.Script(source).runInContext(context);
const run = (code) => vm.runInContext(code, context);
const result = run(`({STATES,QUESTIONS,CITY_ATLAS,QUESTION_FACTS})`);
assert.equal(result.STATES.length, 50);
assert.equal(result.QUESTIONS.length, 300);
assert.equal(new Set(result.QUESTIONS.map((q) => q.id)).size, 300);
assert.equal(result.QUESTIONS.filter((q) => q.mode === 'easy').length, 150);
assert.equal(result.QUESTIONS.filter((q) => q.mode === 'hard').length, 150);
for (const q of result.QUESTIONS) {
  assert(q.fact && !q.fact.includes('?'), `explanation still a question: ${q.id}: ${q.fact}`);
  if (q.mode === 'hard')
    assert(
      result.CITY_ATLAS[q.abbr].some((c) => c.id === q.cityId),
      `unselectable answer ${q.id}`,
    );
  else assert(!q.cityId, `easy clue points at a city: ${q.id}`);
}
for (const s of result.STATES) assert.equal(result.CITY_ATLAS[s.abbr].length, 4);
assert.equal(result.QUESTION_FACTS.length, 150);
for (const fact of result.QUESTION_FACTS) {
  const pair = result.QUESTIONS.filter((q) => q.factId === fact.id);
  assert.equal(pair.length, 2);
  assert.deepEqual(Array.from(pair, (q) => q.mode).sort(), ['easy', 'hard']);
  assert.equal(pair[0].abbr, pair[1].abbr);
  assert.equal(pair[0].topic, pair[1].topic);
  assert(!fact.easy.includes('{place}') && !fact.hard.includes('{place}'));
  assert(fact.easy.startsWith('Which state') || fact.easy.startsWith('In which state'), fact.id);
  assert(fact.hard.startsWith('Which city') || fact.hard.startsWith('In which city'), fact.id);
}
run('init()');
for (const mode of ['easy', 'hard']) {
  const a = run(`dailyQuestions('${mode}','2026-09-14').map(q=>q.id).join('|')`),
    b = run(`dailyQuestions('${mode}','2026-09-14').map(q=>q.id).join('|')`);
  assert.equal(a, b);
  assert.equal(a.split('|').length, 10);
  assert(run(`dailyQuestions('${mode}','2026-09-14').every(q=>q.mode==='${mode}')`));
  assert.equal(run(`new Set(dailyQuestions('${mode}','2026-09-14').map(q=>q.abbr)).size`), 10);
}
// Simulate a full year: every daily round must stay varied and the modes cannot repeat a fact.
for (let day = 0; day < 366; day++) {
  const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
  const rounds = run(`['easy','hard'].map(mode=>dailyQuestions(mode,'${date}'))`);
  assert.equal(
    new Set(rounds.flat().map((q) => q.factId)).size,
    20,
    `Cross-mode duplicate on ${date}`,
  );
  for (const round of rounds) {
    assert.equal(round.length, 10);
    assert.equal(new Set(round.map((q) => q.abbr)).size, 10);
    assert(round.filter((q) => q.nickname).length <= 1, `Too many nicknames on ${date}`);
    for (const topic of ['sports', 'geography', 'history', 'arts', 'pop'])
      assert.equal(round.filter((q) => q.topic === topic).length, 2, `${topic} on ${date}`);
  }
}
// Include the rollout, year boundaries, leap day, and cross-mode repeats.
const recentDays = [];
for (let day = 0; day < 550; day++) {
  const date = new Date(Date.UTC(2026, 8, 22 + day)).toISOString().slice(0, 10);
  const rounds = run(`['hard','easy'].map(mode=>dailyQuestions(mode,'${date}'))`);
  const ids = rounds.flat().map((q) => q.factId);
  if (date >= '2026-09-24') {
    assert.equal(new Set(ids).size, 20);
    assert(
      ids.every((id) => recentDays.every((prior) => !prior.includes(id))),
      `Recent repeat on ${date}`,
    );
    for (const round of rounds) {
      assert.equal(new Set(round.map((q) => q.abbr)).size, 10);
      assert(round.filter((q) => q.nickname).length <= 1);
      for (const topic of ['sports', 'geography', 'history', 'arts', 'pop'])
        assert.equal(round.filter((q) => q.topic === topic).length, 2);
    }
  }
  recentDays.push(ids);
  if (recentDays.length > 2) recentDays.shift();
}
const expectedRotation = run("dailyQuestions('easy','2026-09-26').map(q=>q.id).join()");
run('dailyCache.clear()');
assert.equal(run("dailyQuestions('easy','2026-09-26').map(q=>q.id).join()"), expectedRotation);
assert.equal(
  run("dailyQuestions('easy','2026-09-23').map(q=>q.id).join()"),
  run("legacyDailyQuestions('easy','2026-09-23').map(q=>q.id).join()"),
);
console.log('PASS: 550 days of balanced rotation with a two-day fact exclusion across both modes.');
for (let seed = 0; seed < 100; seed++) {
  const round = run(`chooseQuestions('easy',${seed})`);
  assert(round.filter((q) => q.nickname).length <= 1);
  for (const topic of ['sports', 'geography', 'history', 'arts', 'pop'])
    assert.equal(round.filter((q) => q.topic === topic).length, 2);
}
// Score rules and state-scoped city selection, including change-state clearing.
run(`setMode('hard');startRound('developer');chooseState('CA');chooseCity('CA:San Francisco')`);
assert.equal(run('state.selectedCity'), 'CA:San Francisco');
assert.equal(nodes.submit.disabled, false);
run(`chooseState('NY')`);
assert.equal(run('state.selectedCity'), null);
assert.equal(nodes.submit.disabled, true);
run(`chooseCity('CA:San Francisco')`);
assert.equal(run('state.selectedCity'), null);
run(`chooseCity('NY:Albany')`);
assert.equal(run('state.selectedCity'), 'NY:Albany');
run(`allStates()`);
assert.equal(run('state.mapState'), null);
assert.equal(run('state.selectedCity'), null);
const q = result.QUESTIONS.find((q) => q.mode === 'hard');
assert.equal(
  run(
    `pointsFor('hard',${JSON.stringify(q.abbr)},${JSON.stringify(q.cityId)},QUESTIONS.find(q=>q.id===${JSON.stringify(q.id)}))`,
  ),
  1000,
);
assert.equal(
  run(
    `pointsFor('hard',${JSON.stringify(q.abbr)},'another',QUESTIONS.find(q=>q.id===${JSON.stringify(q.id)}))`,
  ),
  250,
);
assert.equal(
  run(`pointsFor('hard','ZZ','another',QUESTIONS.find(q=>q.id===${JSON.stringify(q.id)}))`),
  0,
);
// Unlimited developer rounds never write to official progress, even when perfect.
const before = run('JSON.stringify(save)');
for (let repeat = 0; repeat < 3; repeat++) {
  run(`startRound('developer')`);
  for (let i = 0; i < 10; i++) {
    run(`chooseState(question().abbr);chooseCity(question().cityId);submit();nextQuestion()`);
  }
  assert.equal(run('state.score'), 10000);
  assert.equal(run('JSON.stringify(save)'), before);
}
// Daily saving, reload/resume, and completed-round gate.
run(
  `settings.developer=false;setMode('easy');startDaily();chooseState(question().abbr);submit();goHome();startDaily()`,
);
assert.equal(run('state.cq'), 1);
assert.equal(run('state.score'), 1000);
while (!run('state.finished')) run(`chooseState(question().abbr);submit();nextQuestion()`);
assert.equal(run('save.dailies.easy.score'), 10000);
assert.equal(run('save.streak'), 1);
run(`goHome();startDaily()`);
assert.equal(nodes.results.hidden, false);
assert.equal(run('state.finished'), true);
run(`settings.developer=true;goHome();startDaily()`);
assert.equal(run('state.kind'), 'daily');
assert.equal(nodes.results.hidden, false);
// Daily and developer rounds are the only supported kinds; replay preserves today's bank.
const unchanged = run('JSON.stringify(state)');
run(`startRound('practice')`);
assert.equal(run('JSON.stringify(state)'), unchanged);
run(`setMode('hard');startRound('developer',true)`);
assert.equal(
  run('state.qs.map(q=>q.id).join()'),
  run("dailyQuestions('hard').map(q=>q.id).join()"),
);
assert(!shell.includes('review-missed'));
assert(!shell.includes('id="badges"'));
assert(!shell.includes('<a '));
// Geometry/labels: all cities render, finite positions, no overlapping label boxes.
for (const s of result.STATES) {
  run(`startRound('developer');chooseState('${s.abbr}')`);
  const choices = nodes.map.querySelectorAll('[data-city]');
  assert.equal(choices.length, 4, `${s.abbr} city count`);
  const boxes = choices.map((c) => c.children.find((el) => el.tagName === 'rect').attributes);
  for (const c of choices) {
    const dot = c.children.find((el) => el.tagName === 'circle');
    const x = +dot.attributes.cx,
      y = +dot.attributes.cy;
    assert(
      Number.isFinite(x) && x >= 0 && x <= 960 && Number.isFinite(y) && y >= 0 && y <= 600,
      `${s.abbr} out of view ${x},${y}`,
    );
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert(
        !(
          +a.x < +b.x + +b.width &&
          +a.x + +a.width > +b.x &&
          +a.y < +b.y + +b.height &&
          +a.y + +a.height > +b.y
        ),
        `${s.abbr} overlapping city labels`,
      );
    }
}
console.log(
  'PASS: 150 paired facts / 300 clues, all 50 state/city maps, deterministic daily, city selection, scoring, developer isolation/replay, daily resume, and records.',
);

// The delivered file must contain the same code that was tested.
if (process.argv.includes('--bundle')) {
  const build = require('node:child_process').execFileSync(
    process.execPath,
    [path.join(root, 'scripts/build.cjs')],
    { encoding: 'utf8', maxBuffer: 1000000 },
  );
  const delivered = fs.readFileSync(path.join(root, 'geotrivia.html'), 'utf8');
  assert.equal(
    fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
    delivered,
    'Root entry point must match the standalone game',
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'publish/index.html'), 'utf8'),
    delivered,
    'Netlify upload must match the standalone game',
  );
  assert.equal(
    delivered.trim().replaceAll('\r\n', '\n'),
    build.trim().replaceAll('\r\n', '\n'),
    'Delivered HTML differs from tested sources',
  );
  const script = delivered.match(/<script>([\s\S]*)<\/script>/)[1];
  new vm.Script(script);
  assert(!delivered.includes('/* GAME_JS */'));
  assert(!delivered.includes('fonts.googleapis'));
  console.log('PASS: standalone HTML matches tested sources and parses successfully.');
}
// Optional static SVG renders for map geometry and label inspection.
if (process.argv.includes('--render')) {
  const sharp = require('C:/Users/micha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
  function encode(v) {
    return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  }
  function serialize(el) {
    return `<${el.tagName} ${Object.entries(el.attributes)
      .map(([k, v]) => `${k}="${encode(v)}"`)
      .join(' ')}>${encode(el.textContent)}${el.children.map(serialize).join('')}</${el.tagName}>`;
  }
  fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
  const css = fs.readFileSync(path.join(root, 'src/styles/game.css'), 'utf8');
  const jobs = [];
  for (const abbr of [null, 'CA', 'NY', 'AK', 'HI', 'RI']) {
    run(`startRound('developer');${abbr ? `chooseState('${abbr}')` : ''}`);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="707" viewBox="-25 -15 1035 665"><style>${css}</style><rect x="-25" y="-15" width="1035" height="665" fill="#e0ece7"/>${nodes.map.children.map(serialize).join('')}</svg>`;
    svg = svg.replace(/style="--state-fill:([^;"]+)[^"]*"/g, 'fill="$1"');
    jobs.push(
      sharp(Buffer.from(svg))
        .png()
        .toFile(path.join(root, 'qa', `${abbr || 'US'}-map.png`)),
    );
  }
  Promise.all(jobs).then(() => console.log('Static map previews rendered in qa/.'));
}
