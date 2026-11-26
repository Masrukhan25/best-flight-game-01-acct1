// Island Courier — boot and the one loop: input is read every frame, the
// flight model advances in fixed 1/120 s steps (several in a slow frame, none
// in a fast one), and the renderer paints what is there. The game moves
// between four screens: title, play, paused, and results (crashed or the
// mission complete).
//
// ?seed=N fixes the world. ?shot=cover|runway|turn|landing (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, DEFAULT_SEED, BEST_KEY, EVENT_RING, EVENT_LANDED, EVENT_CRASH, EVENT_COMPLETE, EVENT_FUEL_EMPTY, EVENT_TAKEOFF, TARGET_SCORE, FUEL } from './config.js';
import { createTerrain } from './terrain.js';
import { createFlight } from './flight.js';
import { createRings } from './rings.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_FIRE, createInput } from './input.js';
import { createHud } from './hud.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createWeapons } from './weapons.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const terrain = createTerrain(seed);
const rings = createRings(seed);
const flight = createFlight(terrain, rings);
const hud = createHud();
const renderer = createRenderer(canvas, terrain, rings);
const audio = createAudio();
const weapons = createWeapons(renderer.scene);

const world = {
  flight,
  rings,
  terrain,
  weapons,
  reset() {
    rings.reset();
    flight.reset();
    weapons.reset();
  },
};

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const staged = stageShot(name, world);
  renderer.snapToPlane(flight);
  window.__shotState = {
    shot: name,
    status: flight.state.status,
    time: Math.round(flight.state.time * 10) / 10,
    ringsPassed: rings.passed,
    score: flight.state.score,
    hits: weapons.hits,
    pos: {
      x: Math.round(flight.state.pos.x),
      y: Math.round(flight.state.pos.y),
      z: Math.round(flight.state.pos.z),
    },
    speed: Math.round(flight.state.speed),
  };
  if (staged.screen === 'complete') {
    hud.setResults('complete', [
      `Score ${flight.state.score}`,
      `Time ${hud.fmtTime(flight.state.time)}`,
      `Fuel ${Math.max(0, Math.round((flight.state.fuel / FUEL.capacity) * 100))}% left`,
      `Targets ${weapons.hits}/${weapons.total}`,
    ]);
    hud.setScreen('complete');
  } else {
    hud.setScreen('play');
  }
  hud.update(flight, rings);
  hud.setTargets(weapons.hits, weapons.total);
  if (name === 'cover' && weapons.hits > 0) hud.flash();
  let painted = 0;
  function paint() {
    renderer.draw(flight, 1 / 60);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const status = document.getElementById('status');

  // Screen readers (and anyone watching the page's text) hear the screen changes and each ring.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = 'play';
    hud.setScreen('play');
    hud.setTargets(0, weapons.total);
    announce('Island Courier. Fly the rings, then land on the runway.');
  }

  function endGame(crashed) {
    screen = crashed ? 'over' : 'complete';
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    hud.setResults(crashed ? 'over' : 'complete', [
      `Score ${flight.state.score}`,
      `Best ${best}`,
      `Time ${hud.fmtTime(flight.state.time)}`,
      `Fuel ${Math.max(0, Math.round((flight.state.fuel / FUEL.capacity) * 100))}% left`,
      `Targets ${weapons.hits}/${weapons.total}`,
    ]);
    hud.setScreen(screen);
    announce(crashed ? `Crashed. Score ${flight.state.score}.` : `Mission complete. Score ${flight.state.score}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_RING) {
      renderer.addTrauma(0.18);
      audio.blip(880);
      hud.showMessage(`RING ${rings.passed}/5  +${400 + Math.round(flight.state.fuel)}`);
      announce(`Ring ${rings.passed} of 5.`);
    }
    if (events & EVENT_TAKEOFF) hud.showMessage('AIRBORNE — fly the rings!');
    if (events & EVENT_LANDED) {
      renderer.addTrauma(0.4);
      audio.thud();
      hud.showMessage('TOUCHDOWN — refuelled, take off again!');
    }
    if (events & EVENT_FUEL_EMPTY) hud.showMessage('FUEL EMPTY — gliding!');
    if (events & EVENT_CRASH) {
      renderer.addTrauma(1.0);
      audio.crash();
      endGame(true);
    } else if (events & EVENT_COMPLETE) {
      renderer.addTrauma(0.4);
      audio.thud();
      audio.blip(1320, 0.3);
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === 'title' || screen === 'over' || screen === 'complete') {
        audio.ensure();
        startGame();
      }
    } else if (actions & ACTION_RESTART) {
      if (screen !== 'title') {
        audio.ensure();
        startGame();
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        hud.setScreen('paused');
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        hud.setScreen('play');
        announce('Playing.');
      }
    }
    if (screen === 'play' && (actions & ACTION_FIRE)) {
      if (weapons.fire(flight.state)) audio.pew();
    }

    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        handleEvents(flight.step(STEP, input.read()));
        const hitsNow = weapons.update(STEP, flight.state);
        if (hitsNow > 0) {
          flight.state.score += hitsNow * TARGET_SCORE;
          renderer.addTrauma(0.7);
          audio.boom();
          hud.flash();
          hud.setTargets(weapons.hits, weapons.total);
          hud.showMessage(`TARGET DOWN  +${TARGET_SCORE}`);
          announce(`Target down. ${weapons.hits} of ${weapons.total}.`);
        }
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setEngine(flight.state.throttle, screen === 'play');
    renderer.draw(flight, dt);
    hud.update(flight, rings);
  }

  // Leaving the tab pauses a running game rather than letting fuel burn unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      hud.setScreen('paused');
      announce('Paused.');
    }
  });

  hud.setScreen('title');
  announce('Island Courier. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
