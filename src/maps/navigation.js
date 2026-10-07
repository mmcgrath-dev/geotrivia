function applyView() {
  $('map').setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}

function zoom(factor) {
  const width = Math.max(fitView.w / 5, Math.min(fitView.w * 1.15, view.w * factor)),
    r = width / view.w;
  view = {
    x: view.x + (view.w - width) / 2,
    y: view.y + (view.h - view.h * r) / 2,
    w: width,
    h: view.h * r,
  };
  applyView();
}

function fit() {
  view = { ...fitView };
  applyView();
}

function bindMapNavigation() {
  const map = $('map');
  map.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      suppressClick = false;
      gesture = { x: e.clientX, y: e.clientY, view: { ...view }, moved: false };
    } else {
      gesture = null;
      suppressClick = true;
    }
  });
  window.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const old = [...pointers.values()];
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const now = [...pointers.values()],
        before = Math.hypot(old[0].x - old[1].x, old[0].y - old[1].y),
        after = Math.hypot(now[0].x - now[1].x, now[0].y - now[1].y);
      if (before && after) zoom(before / after);
      return;
    }
    if (!gesture) return;
    const dx = e.clientX - gesture.x,
      dy = e.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 6) {
      gesture.moved = true;
      suppressClick = true;
      map.classList.add('dragging');
    }
    if (gesture.moved) {
      const ratio = Math.max(view.w / map.clientWidth, view.h / map.clientHeight);
      view.x = gesture.view.x - dx * ratio;
      view.y = gesture.view.y - dy * ratio;
      applyView();
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) {
      gesture = null;
      map.classList.remove('dragging');
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  map.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.12 : 0.89);
    },
    { passive: false },
  );
  map.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom(0.8);
    } else if (e.key === '-') {
      e.preventDefault();
      zoom(1.25);
    } else if (
      e.target === map &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
    ) {
      e.preventDefault();
      const step = view.w * 0.06;
      view.x += e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      view.y += e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      applyView();
    }
  });
}
