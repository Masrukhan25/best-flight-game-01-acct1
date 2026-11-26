// Island Courier — the HUD. Event-driven: the DOM is touched only when a
// displayed value actually changes, never once per frame. Big numbers on a
// dark panel (white on near-black, well past 4.5:1), compass strip, artificial
// horizon, fuel bar, next-ring readout, and the four screens as a stack.
import { FUEL } from './config.js';
function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const alt = el('alt');
  const spd = el('spd');
  const hdg = el('hdg');
  const ringLabel = el('ring-label');
  const compassStrip = el('compass-strip');
  const horizonInner = el('horizon-inner');
  const fuelFill = el('fuel-fill');
  const scoreEl = el('score');
  const timeEl = el('time');
  const targetsEl = el('targets');
  const flashEl = el('flash');
  const messageEl = el('message');
  const screens = {
    title: el('screen-title'),
    paused: el('screen-pause'),
    over: el('screen-over'),
    complete: el('screen-complete'),
  };

  // Compass strip: one label every 30 degrees, 120 px each, 1440 px a lap.
  const names = ['N', '030', '060', 'E', '120', '150', 'S', '210', '240', 'W', '300', '330'];
  for (let i = 0; i < 12; i += 1) {
    const span = document.createElement('span');
    span.textContent = names[i];
    compassStrip.appendChild(span);
  }

  const cache = {};
  let messageTimer = 0;
  function setText(node, key, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.textContent = value;
    }
  }
  function setStyle(node, key, prop, value) {
    if (cache[key] !== value) {
      cache[key] = value;
      node.style[prop] = value;
    }
  }

  function update(flight, rings) {
    const s = flight.state;
    setText(alt, 'alt', String(Math.round(s.pos.y * 3.28084)));
    setText(spd, 'spd', String(Math.round(s.speed * 1.94384)));
    const headingDeg = Math.round((((s.heading * 180) / Math.PI) % 360 + 360) % 360);
    setText(hdg, 'hdg', String(headingDeg).padStart(3, '0'));
    setStyle(compassStrip, 'compass', 'transform', `translateX(${180 - headingDeg * 4}px)`);
    const bankDeg = (s.bank * 180) / Math.PI;
    const pitchDeg = (s.pitch * 180) / Math.PI;
    setStyle(horizonInner, 'horizon', 'transform', `translateY(${pitchDeg * 1.4}px) rotate(${-bankDeg}deg)`);
    const fuelPct = Math.max(0, Math.round((s.fuel / FUEL.capacity) * 100));
    setStyle(fuelFill, 'fuel', 'width', `${fuelPct}%`);
    fuelFill.classList.toggle('low', fuelPct < 25);
    setText(scoreEl, 'score', String(s.score));
    setText(timeEl, 'time', fmtTime(s.time));
    const next = rings.nextRing();
    if (next) {
      const dist = Math.round(
        Math.sqrt(
          (next.x - s.pos.x) ** 2 + (next.y - s.pos.y) ** 2 + (next.z - s.pos.z) ** 2,
        ),
      );
      setText(ringLabel, 'ring', `RING ${rings.next + 1}/5  •  ${dist} m`);
    } else {
      setText(ringLabel, 'ring', 'FINAL — LAND ON THE RUNWAY');
    }
  }

  function showMessage(text, ms = 2600) {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => messageEl.classList.add('hidden'), ms);
  }

  // Targets shot down, out of the total on the route.
  function setTargets(hit, total) {
    setText(targetsEl, 'targets', `${hit}/${total}`);
  }

  // A warm flash over the whole screen for an explosion; it fades on its own.
  let flashTimer = 0;
  function flash() {
    flashEl.style.opacity = '0.25';
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => { flashEl.style.opacity = '0'; }, 90);
  }

  function setScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].classList.toggle('hidden', key !== name);
    }
    if (name === 'play') {
      for (const key of Object.keys(screens)) screens[key].classList.add('hidden');
    }
  }

  function setResults(kind, lines) {
    const node = kind === 'complete' ? el('complete-lines') : el('over-lines');
    node.innerHTML = lines.map((l) => `${l}<br>`).join('');
  }

  return { update, showMessage, setScreen, setResults, setTargets, flash, fmtTime };
}
