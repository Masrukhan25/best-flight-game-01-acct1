// Island Courier — keyboard and mouse input. Keys are the authority; the mouse
// nudges the same turn/pitch channels and decays back to centre, so a parked
// mouse never holds a turn. Actions are edge-triggered and consumed once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_FIRE = 8;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseTurn = 0;
  let mousePitch = 0;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'Space') actions |= ACTION_FIRE;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyR') actions |= ACTION_RESTART;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
    actions |= ACTION_FIRE;
  });
  window.addEventListener('mousemove', (e) => {
    mouseTurn += e.movementX * 0.0016;
    mousePitch += -e.movementY * 0.0016;
  });

  function read() {
    const turn = clamp(
      ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0) -
        ((keys.has('KeyA') || keys.has('ArrowLeft')) ? 1 : 0) + mouseTurn,
      -1, 1,
    );
    const pitch = clamp(
      (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0) + mousePitch,
      -1, 1,
    );
    mouseTurn *= 0.82;
    mousePitch *= 0.82;
    return {
      throttleUp: keys.has('KeyW'),
      throttleDown: keys.has('KeyS'),
      turn,
      pitch,
    };
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { read, takeActions };
}
