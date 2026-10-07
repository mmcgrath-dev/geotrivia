// SVG elements and map geometry.
function svg(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== undefined) el.textContent = text;
  return el;
}

function cleanedPath(s) {
  // Older geometry includes wrapped Aleutian segments thousands of pixels away.
  // Exclude only those disconnected artifacts, keeping the visible island chain.
  return s.d
    .split(/(?=M)/)
    .filter((segment) => {
      const nums = segment.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
      return nums.length && nums.every((v) => Math.abs(v) < 1500);
    })
    .join(' ');
}
const MAP_PATHS = Object.fromEntries(STATES.map((s) => [s.abbr, cleanedPath(s)]));

function pathBounds(d) {
  const values = d.match(/-?\d+(?:\.\d+)?/g).map(Number),
    xs = [],
    ys = [];
  for (let i = 0; i < values.length; i += 2) {
    xs.push(values[i]);
    ys.push(values[i + 1]);
  }
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function project(abbr, city) {
  return (abbr === 'AK' ? ALASKA : abbr === 'HI' ? HAWAII : LOWER48).forward(city.lat, city.lng);
}

// Accessible map choices and country rendering.
function activate(el, fn) {
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!suppressClick) fn();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }
  });
}

function renderMap() {
  hoveredState = null;
  focusedState = null;
  const map = $('map');
  map.replaceChildren();
  fitView = { ...DEFAULT_VIEW };
  view = { ...fitView };
  applyView();
  map.setAttribute(
    'aria-label',
    state.mapState
      ? `${stateBy(state.mapState).name} map with four labeled city choices`
      : 'United States map. Select a state, or use the state list.',
  );
  if (state.mapState) drawCityMap(map, state.mapState);
  else drawCountry(map);
  syncSelection();
}

function drawCountry(map, decorative = false) {
  const palette = ['#dce4cf', '#e7e6d5', '#e0e7d7', '#d6e1ce', '#e9e3cf'];
  const group = svg('g'),
    labels = svg('g'),
    outlines = svg('g', {
      'data-state-outlines': '',
      'aria-hidden': 'true',
      'pointer-events': 'none',
    });
  STATES.forEach((s, i) => {
    const path = svg('path', {
      d: MAP_PATHS[s.abbr],
      class: 'map-state',
      'data-state': s.abbr,
      style: `--state-fill:${palette[i % palette.length]}`,
      'aria-label': s.name,
    });
    if (decorative) {
      // Keep home-map hover borders above neighboring fills, independent of the game.
      path.addEventListener('pointerenter', () => {
        outlines.replaceChildren(
          svg('path', { d: MAP_PATHS[s.abbr], class: 'map-state state-outline active' }),
        );
      });
      path.addEventListener('pointerleave', () => outlines.replaceChildren());
    } else {
      bindStateHighlight(path, s.abbr);
      if (!state.answered) activate(path, () => chooseState(s.abbr));
    }
    group.append(path);
    if (!s.tiny && !decorative)
      labels.append(svg('text', { x: s.cx, y: s.cy, class: 'state-label' }, s.abbr));
  });
  map.append(group, outlines);
  if (decorative) return;
  // Separate outlines preserve the full border without reordering focusable states.
  map.append(labels);
  const tiny = STATES.filter((s) => s.tiny).sort((a, b) => a.cy - b.cy);
  tiny.forEach((s, i) => {
    const y = 104 + i * 35,
      x = 972;
    map.append(svg('path', { d: `M${s.cx},${s.cy} L${x - 19},${y}`, class: 'city-leader' }));
    const g = svg('g', { class: 'tiny-label', 'aria-label': s.name, 'data-callout': s.abbr });
    g.append(
      svg('rect', { x: x - 19, y: y - 13, width: 38, height: 26 }),
      svg('text', { x, y }, s.abbr),
    );
    bindStateHighlight(g, s.abbr);
    if (!state.answered) activate(g, () => chooseState(s.abbr));
    map.append(g);
  });
  map.append(
    svg('text', { x: 20, y: 450, class: 'ocean-label' }, 'PACIFIC OCEAN'),
    svg(
      'text',
      { x: 857, y: 434, class: 'ocean-label', transform: 'rotate(-60 857 434)' },
      'ATLANTIC OCEAN',
    ),
    svg('text', { x: 86, y: 621, class: 'state-label' }, 'ALASKA · INSET'),
    svg('text', { x: 263, y: 621, class: 'state-label' }, 'HAWAII · INSET'),
  );
}

// Hover, focus, and answer outlines.
function bindStateHighlight(el, abbr) {
  el.addEventListener('pointerenter', () => {
    hoveredState = abbr;
    renderStateOutlines();
  });
  el.addEventListener('pointerleave', () => {
    if (hoveredState === abbr) hoveredState = null;
    renderStateOutlines();
  });
  el.addEventListener('focus', () => {
    focusedState = abbr;
    renderStateOutlines();
  });
  el.addEventListener('blur', () => {
    if (focusedState === abbr) focusedState = null;
    renderStateOutlines();
  });
}

function renderStateOutlines() {
  const layer = $('map').querySelector('[data-state-outlines]');
  if (!layer) return;
  layer.replaceChildren();
  const outline = (abbr, kind) =>
    layer.append(svg('path', { d: MAP_PATHS[abbr], class: `map-state state-outline ${kind}` }));
  for (const kind of ['wrong', 'selected', 'correct'])
    document.querySelectorAll('#map [data-state]').forEach((el) => {
      if (el.classList.contains(kind)) outline(el.getAttribute('data-state'), kind);
    });
  for (const abbr of new Set([focusedState, hoveredState]))
    if (abbr && (!state.answered || abbr !== question().abbr)) outline(abbr, 'active');
}

// City maps and label placement.
function drawCityMap(map, abbr) {
  const d = MAP_PATHS[abbr],
    b = pathBounds(d);
  const scale = Math.min(640 / b.w, 425 / b.h),
    tx = 445 - (b.x + b.w / 2) * scale,
    ty = 306 - (b.y + b.h / 2) * scale;
  const shape = svg('path', {
    d,
    class: 'map-state',
    transform: `translate(${tx} ${ty}) scale(${scale})`,
    style: '--state-fill:#dce5cb;pointer-events:none',
  });
  map.append(shape);
  const cities = CITY_ATLAS[abbr].map((c, i) => {
    const p = project(abbr, c);
    return { ...c, n: i + 1, x: p.x * scale + tx, y: p.y * scale + ty };
  });
  const placed = [];
  cities.forEach((c) => {
    const width = Math.max(105, c.name.length * 7.9 + 31),
      height = 34;
    const offsets = [
      [18, -38],
      [18, 10],
      [-width - 18, -38],
      [-width - 18, 10],
      [18, -80],
      [18, 52],
      [-width - 18, -80],
      [-width - 18, 52],
    ];
    let box;
    for (const [dx, dy] of offsets) {
      const candidate = {
        x: Math.max(30, Math.min(940 - width, c.x + dx)),
        y: Math.max(83, Math.min(538, c.y + dy)),
        w: width,
        h: height,
      };
      const overlaps = placed.some(
        (p) =>
          candidate.x < p.x + p.w + 8 &&
          candidate.x + width + 8 > p.x &&
          candidate.y < p.y + p.h + 8 &&
          candidate.y + height + 8 > p.y,
      );
      const coversDot = cities.some(
        (p) =>
          p.x > candidate.x - 9 &&
          p.x < candidate.x + width + 9 &&
          p.y > candidate.y - 9 &&
          p.y < candidate.y + height + 9,
      );
      if (!overlaps && !coversDot) {
        box = candidate;
        break;
      }
    }
    if (!box) box = { x: 760, y: 110 + c.n * 80, w: width, h: height };
    placed.push(box);
    map.append(
      svg('path', {
        d: `M${c.x},${c.y} L${Math.max(box.x, Math.min(box.x + box.w, c.x))},${box.y + 17}`,
        class: 'city-leader',
      }),
    );
    const g = svg('g', { class: 'city-choice', 'data-city': c.id, 'aria-label': c.name });
    g.append(
      svg('circle', { cx: c.x, cy: c.y, r: 8, class: 'city-dot' }),
      svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h }),
      svg('text', { x: box.x + 11, y: box.y + 22 }, `${c.n}  ${c.name}`),
    );
    if (!state.answered) activate(g, () => chooseCity(c.id));
    map.append(g);
  });
  drawStateName(map, abbr, shape, { scale, tx, ty }, cities, placed);
  map.append(
    svg('text', { x: 909, y: 536, class: 'compass' }, 'N'),
    svg('path', { d: 'M909 547 L903 563 L909 559 L915 563 Z', fill: '#789a8f' }),
    svg(
      'text',
      { x: 470, y: 609, class: 'state-label' },
      `${stateBy(abbr).name.toUpperCase()} · SELECT A LABELED CITY`,
    ),
  );
}

function drawStateName(map, abbr, shape, { scale, tx, ty }, cities, placed) {
  const place = stateBy(abbr);
  const lines = place.name.length > 12 ? place.name.split(' ') : [place.name];
  const label = svg('text', { class: 'city-map-state-name', 'aria-hidden': 'true' });
  map.append(label);
  // Look for open land around the state's label anchor without moving any city choices.
  const anchor = { x: place.cx * scale + tx, y: place.cy * scale + ty };
  const candidates = [];
  for (let y = 110; y <= 510; y += 10)
    for (let x = 140; x <= 750; x += 10)
      candidates.push({ x, y, distance: Math.hypot(x - anchor.x, y - anchor.y) });
  candidates.sort((a, b) => a.distance - b.distance);
  for (const size of [24, 22, 20, 18]) {
    label.setAttribute('font-size', size);
    label.replaceChildren(
      ...lines.map((line, i) => svg('tspan', { x: 0, y: i * size * 1.15 }, line)),
    );
    const measured = label.getBBox?.();
    const width = measured?.width || Math.max(...lines.map((line) => line.length)) * size * 0.62;
    const height = measured?.height || lines.length * size * 1.15;
    for (const point of candidates) {
      const box = { x: point.x - width / 2, y: point.y - height / 2, w: width, h: height };
      if (
        placed.some(
          (p) =>
            box.x < p.x + p.w + 12 &&
            box.x + box.w + 12 > p.x &&
            box.y < p.y + p.h + 12 &&
            box.y + box.h + 12 > p.y,
        )
      )
        continue;
      if (
        cities.some(
          (c) =>
            c.x > box.x - 16 &&
            c.x < box.x + box.w + 16 &&
            c.y > box.y - 16 &&
            c.y < box.y + box.h + 16,
        )
      )
        continue;
      const onLand =
        !shape.isPointInFill ||
        [0, 0.25, 0.5, 0.75, 1].every((fx) =>
          [0, 0.5, 1].every((fy) =>
            shape.isPointInFill(
              new DOMPoint((box.x + box.w * fx - tx) / scale, (box.y + box.h * fy - ty) / scale),
            ),
          ),
        );
      if (!onLand) continue;
      label.setAttribute(
        'transform',
        `translate(${point.x} ${box.y - (measured?.y || -size * 0.8)})`,
      );
      return;
    }
  }
  // Keep an anchor fallback for unusually constrained geometry.
  label.setAttribute('transform', `translate(${anchor.x} ${anchor.y})`);
}

// Keep map highlights in sync with the current answer.
function syncSelection() {
  document.querySelectorAll('#map [data-state]').forEach((el) => {
    const abbr = el.getAttribute('data-state');
    el.classList.toggle('selected', !state.answered && abbr === state.selectedState);
    el.classList.toggle('correct', state.answered && abbr === question().abbr);
    el.classList.toggle(
      'wrong',
      state.answered && abbr === state.selectedState && abbr !== question().abbr,
    );
    if (!state.answered) el.setAttribute('aria-pressed', String(abbr === state.selectedState));
  });
  document.querySelectorAll('#map [data-city]').forEach((el) => {
    const id = el.getAttribute('data-city');
    el.classList.toggle('selected', !state.answered && id === state.selectedCity);
    el.classList.toggle('correct', state.answered && id === question().cityId);
    el.classList.toggle(
      'wrong',
      state.answered && id === state.selectedCity && id !== question().cityId,
    );
    if (!state.answered) el.setAttribute('aria-pressed', String(id === state.selectedCity));
  });
  document.querySelectorAll('#map [data-callout]').forEach((el) => {
    const abbr = el.getAttribute('data-callout');
    el.classList.toggle('selected', !state.answered && abbr === state.selectedState);
    el.classList.toggle('correct', state.answered && abbr === question().abbr);
    el.classList.toggle(
      'wrong',
      state.answered && abbr === state.selectedState && abbr !== question().abbr,
    );
    if (!state.answered) el.setAttribute('aria-pressed', String(abbr === state.selectedState));
  });
  renderStateOutlines();
}
