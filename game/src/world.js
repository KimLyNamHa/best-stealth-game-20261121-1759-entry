// Wren — Night Courier: the simulation. One fixed step moves the player, walks
// the guards along their patrols, sweeps the searchlights, grows or fades the
// detection meter, and settles loot and the exit. Nothing here draws or listens;
// it only reads an input vector and returns events the main loop turns into sound.

import { FIELD, PLAYER, GUARD, DOG, SEARCHLIGHT, NOISE } from './config.js';
import { LEVELS } from './levels.js';

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** True when the segment crosses the rectangle (slab test, inclusive). */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function circleHitsRect(x, y, radius, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

/** Where a circle actually ends up after a move: walls stop it, so a move that
 * pushes into a corner returns the same spot instead of the intended one. */
export function stepPosition(state, x, y, radius, dx, dy) {
  const body = { x, y, radius };
  moveCircle(body, dx, dy, state.solids);
  return { x: body.x, y: body.y };
}

/** Move a circle against solid rectangles, axis by axis, so it slides along walls. */
function moveCircle(body, dx, dy, solids) {
  const nextX = body.x + dx;
  let blocked = false;
  for (const s of solids) {
    if (circleHitsRect(nextX, body.y, body.radius, s)) { blocked = true; break; }
  }
  if (!blocked) body.x = nextX;
  const nextY = body.y + dy;
  blocked = false;
  for (const s of solids) {
    if (circleHitsRect(body.x, nextY, body.radius, s)) { blocked = true; break; }
  }
  if (!blocked) body.y = nextY;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `angle` toward `target` by at most `maxTurn` radians. */
function turnToward(angle, target, maxTurn) {
  const d = angleDiff(target, angle);
  if (Math.abs(d) <= maxTurn) return target;
  return angle + Math.sign(d) * maxTurn;
}

function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** The border walls, added around every level. */
function borderWalls() {
  const t = 24;
  return [
    { x: 0, y: 0, w: FIELD.width, h: t },
    { x: 0, y: FIELD.height - t, w: FIELD.width, h: t },
    { x: 0, y: 0, w: t, h: FIELD.height },
    { x: FIELD.width - t, y: 0, w: t, h: FIELD.height },
  ];
}

/** A fresh simulation for a level index. */
export function createWorld(levelIndex) {
  const def = LEVELS[levelIndex];
  const solids = [...borderWalls(), ...def.walls, ...def.crates];
  return {
    levelIndex,
    def,
    solids,
    time: 0,
    player: {
      x: def.playerStart.x,
      y: def.playerStart.y,
      radius: PLAYER.radius,
      facing: -Math.PI / 2,
      sneaking: false,
      moving: false,
    },
    guards: def.guards.map((g) => ({
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      radius: GUARD.radius,
      angle: 0,
      waypoints: g.waypoints,
      wpIndex: 1 % g.waypoints.length,
      pause: 0,
      state: 'patrol',
      stateTime: 0,
      lastSeen: null,
    })),
    dog: def.dog
      ? {
          x: def.dog.waypoints[0].x,
          y: def.dog.waypoints[0].y,
          radius: DOG.radius,
          angle: 0,
          waypoints: def.dog.waypoints,
          wpIndex: 1 % def.dog.waypoints.length,
          pause: 0,
          barkCooldown: 0,
        }
      : null,
    searchlights: def.searchlights.map((s) => ({
      x: s.x,
      y: s.y,
      baseAngle: s.baseAngle,
      sweep: s.sweep,
      angle: s.baseAngle,
    })),
    loot: def.loot.map((l) => ({ x: l.x, y: l.y, taken: false })),
    lootGot: 0,
    detection: 0,
    exitProgress: 0,
    noiseTimer: 0,
    stepTimer: 0,
    caught: false,
    won: false,
    events: [],
  };
}

function inBush(state, x, y) {
  for (const b of state.def.bushes) {
    if (pointInRect(x, y, b)) return true;
  }
  return false;
}

function inShadow(state, x, y) {
  for (const s of state.def.shadows) {
    if (pointInRect(x, y, s)) return true;
  }
  return false;
}

function losBlocked(state, x1, y1, x2, y2) {
  for (const s of state.solids) {
    if (segmentHitsRect(x1, y1, x2, y2, s)) return true;
  }
  return false;
}

/**
 * Would a watcher at (x, y) facing `angle`, with this range and half-angle,
 * see the point (px, py)? Bushes hide a player standing inside them.
 */
export function coneSeesPoint(state, x, y, angle, range, halfAngle, px, py) {
  const d = dist(x, y, px, py);
  if (d > range) return false;
  if (Math.abs(angleDiff(Math.atan2(py - y, px - x), angle)) > halfAngle) return false;
  if (inBush(state, px, py)) return false;
  return !losBlocked(state, x, y, px, py);
}

/**
 * The watchers (guards and searchlights) now and a few seconds from now.
 * A guard walks its patrol and a light keeps sweeping, so a square a cone is
 * about to sweep counts as dangerous before the cone gets there. The sets are
 * computed once per step and shared by every candidate square the pilot tests.
 */
export function watcherSets(state) {
  const horizons = [0, 0.5, 1.5, 2.5, 3.5];
  const sets = [];
  const guardCopies = state.guards.map((g) => ({
    ...g,
    waypoints: g.waypoints,
    lastSeen: g.lastSeen ? { ...g.lastSeen } : null,
  }));
  const sim = { solids: state.solids };
  let stepped = 0;
  for (const horizon of horizons) {
    const target = Math.floor(horizon / (1 / 60));
    while (stepped < target) {
      for (const copy of guardCopies) updateGuard(sim, copy, 1 / 60);
      stepped += 1;
    }
    const watchers = [];
    for (const g of guardCopies) {
      watchers.push({ x: g.x, y: g.y, angle: g.angle, range: GUARD.coneRange, halfAngle: GUARD.coneHalfAngle });
    }
    for (const s of state.searchlights) {
      watchers.push({
        x: s.x,
        y: s.y,
        angle: s.baseAngle + Math.sin((state.time + horizon) * SEARCHLIGHT.sweepSpeed) * s.sweep,
        range: SEARCHLIGHT.coneRange,
        halfAngle: SEARCHLIGHT.coneHalfAngle,
      });
    }
    sets.push(watchers);
  }
  return sets;
}

/**
 * How dangerous a point is: 1 when a cone sees it in any of the watcher sets,
 * else a 0..0.5 nearness. `sets` comes from watcherSets; without it only the
 * current positions are tested.
 */
export function dangerAt(state, px, py, sets = null) {
  let worst = 0;
  const allSets = sets ?? watcherSets(state).slice(0, 1);
  for (const watchers of allSets) {
    for (const w of watchers) {
      if (coneSeesPoint(state, w.x, w.y, w.angle, w.range, w.halfAngle, px, py)) return 1;
      const d = dist(w.x, w.y, px, py);
      const near = Math.max(0, 1 - d / (w.range + 60));
      worst = Math.max(worst, near * 0.5);
    }
  }
  // A guard pauses at each waypoint and turns around there, so the cone sweeps
  // the whole circle around it: treat the ground near a waypoint as risky.
  if (!inBush(state, px, py)) {
    for (const g of state.guards) {
      for (const wp of g.waypoints) {
        if (dist(wp.x, wp.y, px, py) < 50) worst = Math.max(worst, 0.25);
      }
    }
  }
  return worst;
}

/** The nearest loot not yet taken, else the exit centre. */
export function currentTarget(state) {
  // Nearest moonstone still out there, or the exit if it is closer: once the
  // exit is near, take the win instead of backtracking across the level.
  let best = null;
  let bestDist = Infinity;
  for (const l of state.loot) {
    if (l.taken) continue;
    const d = Math.hypot(l.x - state.player.x, l.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = { x: l.x, y: l.y }; }
  }
  const e = state.def.exit;
  const exit = { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  const exitDist = Math.hypot(exit.x - state.player.x, exit.y - state.player.y);
  if (!best || exitDist < bestDist) return exit;
  return best;
}

function moveGuardToward(guard, tx, ty, speed, dt, state) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  const nx = guard.x + (dx / d) * step;
  const ny = guard.y + (dy / d) * step;
  guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), GUARD.turnRate * dt);
  moveCircle(guard, nx - guard.x, ny - guard.y, state.solids);
  return false;
}

export function updateGuard(state, guard, dt) {
  if (guard.state === 'stare') {
    guard.stateTime -= dt;
    if (guard.lastSeen) {
      guard.angle = turnToward(guard.angle, Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x), GUARD.turnRate * dt);
    }
    if (guard.stateTime <= 0) guard.state = 'patrol';
    return;
  }
  if (guard.state === 'hunt') {
    guard.stateTime -= dt;
    if (guard.lastSeen && moveGuardToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.alertSpeed, dt, state)) {
      guard.stateTime = Math.min(guard.stateTime, 1.0);
    }
    if (guard.stateTime <= 0) guard.state = 'return';
    return;
  }
  if (guard.state === 'return') {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < guard.waypoints.length; i += 1) {
      const d = dist(guard.x, guard.y, guard.waypoints[i].x, guard.waypoints[i].y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (moveGuardToward(guard, guard.waypoints[best].x, guard.waypoints[best].y, GUARD.patrolSpeed, dt, state)) {
      guard.wpIndex = (best + 1) % guard.waypoints.length;
      guard.state = 'patrol';
    }
    return;
  }
  // Patrol.
  if (guard.pause > 0) {
    guard.pause -= dt;
    return;
  }
  const target = guard.waypoints[guard.wpIndex];
  if (moveGuardToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, state)) {
    guard.pause = GUARD.waypointPause;
    guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
  }
}

/**
 * Advance the world one fixed step. `input` is { mx, my, sneak } with mx, my
 * in -1..1. Events are appended to state.events and drained by the main loop.
 */
export function stepWorld(state, input, dt) {
  if (state.caught || state.won) return;
  state.time += dt;
  const p = state.player;

  // Player movement.
  const len = Math.hypot(input.mx, input.my);
  const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  p.sneaking = input.sneak && len > 0;
  p.moving = len > 0;
  if (len > 0) {
    const nx = (input.mx / len) * speed * dt;
    const ny = (input.my / len) * speed * dt;
    p.facing = Math.atan2(input.my, input.mx);
    moveCircle(p, nx, ny, state.solids);
  }

  // Footsteps: soft ticks while sneaking, louder ones while walking or running.
  if (p.moving) {
    state.stepTimer -= dt;
    if (state.stepTimer <= 0) {
      state.stepTimer = p.sneaking ? 0.45 : 0.32;
      state.events.push({ type: 'step', soft: p.sneaking });
    }
  }

  // Running makes noise nearby guards turn toward you.
  if (p.moving && !p.sneaking) {
    state.noiseTimer -= dt;
    if (state.noiseTimer <= 0) {
      state.noiseTimer = NOISE.interval;
      for (const g of state.guards) {
        if (dist(g.x, g.y, p.x, p.y) < NOISE.range && g.state === 'patrol') {
          g.state = 'stare';
          g.stateTime = GUARD.stareTime;
          g.lastSeen = { x: p.x, y: p.y };
          state.detection = Math.min(100, state.detection + NOISE.spike);
          state.events.push({ type: 'heard' });
        }
      }
    }
  }

  // The dog hears running and barks, which alerts every guard at once.
  if (state.dog) {
    const dog = state.dog;
    dog.barkCooldown -= dt;
    if (dog.pause > 0) {
      dog.pause -= dt;
    } else {
      const target = dog.waypoints[dog.wpIndex];
      if (moveGuardToward(dog, target.x, target.y, DOG.patrolSpeed, dt, state)) {
        dog.pause = 0.8;
        dog.wpIndex = (dog.wpIndex + 1) % dog.waypoints.length;
      }
    }
    if (p.moving && !p.sneaking && dog.barkCooldown <= 0 && dist(dog.x, dog.y, p.x, p.y) < DOG.hearRange) {
      dog.barkCooldown = DOG.barkCooldown;
      state.detection = Math.min(100, state.detection + DOG.barkSpike);
      for (const g of state.guards) {
        g.state = 'hunt';
        g.stateTime = GUARD.huntTime;
        g.lastSeen = { x: p.x, y: p.y };
      }
      state.events.push({ type: 'bark' });
    }
  }

  // Searchlights sweep back and forth.
  for (const s of state.searchlights) {
    s.angle = s.baseAngle + Math.sin(state.time * SEARCHLIGHT.sweepSpeed) * s.sweep;
  }

  // Vision: guards and searchlights grow the detection meter when they see you.
  const hidden = inBush(state, p.x, p.y);
  const shadowed = inShadow(state, p.x, p.y);
  let seen = false;
  const watchers = [];
  for (const g of state.guards) {
    watchers.push({ x: g.x, y: g.y, angle: g.angle, range: GUARD.coneRange, halfAngle: GUARD.coneHalfAngle, near: GUARD.detectNear, far: GUARD.detectFar, guard: g });
  }
  for (const s of state.searchlights) {
    watchers.push({ x: s.x, y: s.y, angle: s.angle, range: SEARCHLIGHT.coneRange, halfAngle: SEARCHLIGHT.coneHalfAngle, near: SEARCHLIGHT.detectNear, far: SEARCHLIGHT.detectFar, guard: null });
  }
  for (const w of watchers) {
    if (hidden) continue;
    if (!coneSeesPoint(state, w.x, w.y, w.angle, w.range, w.halfAngle, p.x, p.y)) continue;
    seen = true;
    const d = dist(w.x, w.y, p.x, p.y);
    const t = Math.min(1, d / w.range);
    let rate = w.near + (w.far - w.near) * t;
    if (p.sneaking) rate *= 0.5;
    if (shadowed) rate *= 0.5;
    state.detection = Math.min(100, state.detection + rate * dt);
    if (w.guard) {
      w.guard.lastSeen = { x: p.x, y: p.y };
      if (state.detection >= GUARD.alertAt && w.guard.state !== 'hunt') {
        w.guard.state = 'hunt';
        w.guard.stateTime = GUARD.huntTime;
        state.events.push({ type: 'alert' });
      } else if (state.detection >= GUARD.suspiciousAt && w.guard.state === 'patrol') {
        w.guard.state = 'stare';
        w.guard.stateTime = GUARD.stareTime;
        state.events.push({ type: 'suspicious' });
      }
    } else if (state.detection >= GUARD.alertAt) {
      // A searchlight spotted you: the nearest guard comes to look.
      let nearest = null;
      let nearestD = Infinity;
      for (const g of state.guards) {
        const gd = dist(g.x, g.y, p.x, p.y);
        if (gd < nearestD) { nearestD = gd; nearest = g; }
      }
      if (nearest && nearest.state !== 'hunt') {
        nearest.state = 'hunt';
        nearest.stateTime = GUARD.huntTime;
        nearest.lastSeen = { x: p.x, y: p.y };
        state.events.push({ type: 'alert' });
      }
    }
  }
  if (!seen) {
    state.detection = Math.max(0, state.detection - GUARD.decay * dt);
  }

  for (const g of state.guards) updateGuard(state, g, dt);

  // Loot.
  for (const l of state.loot) {
    if (!l.taken && dist(l.x, l.y, p.x, p.y) < 24) {
      l.taken = true;
      state.lootGot += 1;
      state.events.push({ type: 'pickup' });
    }
  }

  // The exit: stand in the glowing gate to slip away.
  const e = state.def.exit;
  if (pointInRect(p.x, p.y, e)) {
    state.exitProgress += dt;
    if (state.exitProgress >= PLAYER.exitChannel) {
      state.won = true;
      state.events.push({ type: 'win' });
    }
  } else {
    state.exitProgress = Math.max(0, state.exitProgress - dt * 2);
  }

  if (state.detection >= 100) {
    state.caught = true;
    state.events.push({ type: 'caught' });
  }
}
