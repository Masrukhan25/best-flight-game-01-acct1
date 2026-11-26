[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Masrukhan25/best-flight-game-01-acct1/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Masrukhan25/best-flight-game-01-acct1/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Island Courier — Best Flight Game

A 3D island-courier flight game built for the make.fun best-flight-game bounty. Fly the mail plane across tropical islands, pass all 5 delivery rings, blast the red target balloons on the way for bonus points, then land on the island runway before your fuel runs out.

## Play

Open `game/index.html` in a desktop browser (or serve `game/` with `node serve.ts` and open http://localhost:8080). No network, no build step.

- **W/S** — throttle up / down
- **A/D** or **←/→** — bank and turn
- **↑/↓** — pitch up / down
- **Mouse** — steers too (move to nudge turn and pitch)
- **Space / click** — fire the cannon
- **P / Esc** — pause, **R** — restart, **Space / click** — start

Three red-and-white target balloons hang on the mission route. Hit one and it pops into a fireball — orange fire, grey smoke, a shockwave and a hard flash — worth +250 points each. Targets are a bonus only: the five rings and the landing still decide the mission. Fuel burns with throttle; touch down on the runway early to refuel and take off again. Land after all 5 rings for the mission complete. Below stall speed the plane sinks — keep your speed up in the turns.

## How it is built

Three.js r187 (vendored under `game/vendor/`), plain ES modules, no build step. The world is one seeded procedural heightfield — islands, beaches, a mountain, palms, drifting clouds — and the flight model reads its ground height from the same function the terrain is drawn from. Physics runs at a fixed 120 Hz; the chase camera smooths exponentially and takes an FOV kick with speed; landings and crashes answer with trauma-based shake, hit feedback and synthesised WebAudio sound.

The plane is built from primitives: a tapered fuselage with livery stripes, a glossy two-seat canopy, a low wing with orange tips and navigation lights, a tail with a striped fin, a spinning propeller with a blur disc, and landing gear with hubcaps. The light is ACES tone-mapped: a hemisphere sky/ground fill plus one warm directional sun whose shadow camera follows the plane, a gradient sky dome with a sun disc, foam rings where the sea meets each shore, and fog that matches the horizon.

Screenshots are real gameplay frames: `?shot=cover|runway|turn|landing&seed=N` plays the rules forward with an autopilot and paints the frame. The cover catches a balloon popping in front of the next ring; the runway shot is a low pass down the strip; the turn shot flies a huge orange hoop; the landing shot is the mission-complete panel on the runway.
