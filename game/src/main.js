// Wren — Night Courier: boot, the fixed-step loop and the screens. The game is
// a small state machine: title, play, level clear, victory, caught. A ?shot=
// query stages one deterministic scene instead of playing (see shots.js), so
// screenshots are real renders of the game's own code.

import { FIELD, STEP, BEST_KEY } from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, stepWorld } from './world.js';
import { render, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL, SCREEN_WIN, SCREEN_CAUGHT } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput();
const audio = createAudio();

function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const best = JSON.parse(raw);
    if (typeof best.time === 'number' && typeof best.loot === 'number') return best;
  } catch {
    // A private window or a blocked store: play without a best line.
  }
  return null;
}

function saveBest(best) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Best result is a nicety, not a requirement.
  }
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}

function announce(text) {
  statusEl.textContent = text;
}

const session = {
  levelIndex: 0,
  world: createWorld(0),
  screen: SCREEN_TITLE,
  levelTime: 0,
  completedTime: 0,
  lootTotal: 0,
  caughtTime: 0,
  best: loadBest(),
  clickTarget: null,
  now: 0,
};

function startLevel(index) {
  session.levelIndex = index;
  session.world = createWorld(index);
  session.screen = SCREEN_PLAY;
  session.levelTime = 0;
  session.clickTarget = null;
  announce(`Level ${index + 1}: ${LEVELS[index].name}. Reach the gate unseen.`);
}

function restartLevel() {
  session.world = createWorld(session.levelIndex);
  session.screen = SCREEN_PLAY;
  session.levelTime = 0;
  session.clickTarget = null;
  announce(`Level ${session.levelIndex + 1} restarted.`);
}

function finishLevel() {
  session.completedTime += session.levelTime;
  session.lootTotal += session.world.lootGot;
  if (session.levelIndex >= LEVELS.length - 1) {
    const total = session.completedTime;
    session.screen = SCREEN_WIN;
    if (!session.best || session.lootTotal > session.best.loot || (session.lootTotal === session.best.loot && total < session.best.time)) {
      session.best = { time: total, loot: session.lootTotal };
      saveBest(session.best);
    }
    announce(`All levels clear. Total time ${total.toFixed(0)} seconds, ${session.lootTotal} of 9 moonstones.`);
  } else {
    session.screen = SCREEN_LEVEL;
    announce(`${LEVELS[session.levelIndex].name} cleared.`);
  }
}

function playEventSounds() {
  for (const event of session.world.events) {
    if (event.type === 'step') audio.step(event.soft);
    else if (event.type === 'pickup') audio.pickup();
    else if (event.type === 'suspicious') audio.suspicious();
    else if (event.type === 'alert') audio.alert();
    else if (event.type === 'bark') audio.bark();
    else if (event.type === 'heard') audio.heard();
    else if (event.type === 'caught') audio.caught();
    else if (event.type === 'win') audio.win();
  }
  session.world.events.length = 0;
}

function view() {
  return {
    state: session.world,
    screen: session.screen,
    levelTime: session.levelTime,
    totalTime: session.completedTime + session.levelTime,
    lootTotal: session.lootTotal + session.world.lootGot,
    best: session.best,
    now: session.now,
    caughtTime: session.caughtTime,
    muted: audio.muted,
  };
}

function handleKeys() {
  if (input.pressed('m')) {
    input.keys.delete('m');
    const muted = audio.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }
  if (input.pressed('r') && session.screen !== SCREEN_TITLE) {
    input.keys.delete('r');
    restartLevel();
  }
  if (input.pressed('Enter')) {
    input.keys.delete('Enter');
    if (session.screen === SCREEN_TITLE) {
      audio.unlock();
      session.completedTime = 0;
      session.lootTotal = 0;
      startLevel(0);
    } else if (session.screen === SCREEN_LEVEL) {
      startLevel(session.levelIndex + 1);
    } else if (session.screen === SCREEN_WIN) {
      session.completedTime = 0;
      session.lootTotal = 0;
      startLevel(0);
    }
  }
  if (input.pressed('Escape') && session.screen !== SCREEN_TITLE) {
    input.keys.delete('Escape');
    session.screen = SCREEN_TITLE;
    announce('Wren, Night Courier. Press Enter to begin.');
  }
}

function clickToField(offsetX, offsetY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (offsetX / rect.width) * FIELD.width,
    y: (offsetY / rect.height) * FIELD.height,
  };
}

function step(dt) {
  session.now += dt;
  handleKeys();
  const click = input.consumeClick();
  if (click) {
    audio.unlock();
    if (session.screen === SCREEN_TITLE) {
      session.completedTime = 0;
      session.lootTotal = 0;
      startLevel(0);
    } else if (session.screen === SCREEN_LEVEL) {
      startLevel(session.levelIndex + 1);
    } else if (session.screen === SCREEN_WIN) {
      session.completedTime = 0;
      session.lootTotal = 0;
      startLevel(0);
    } else if (session.screen === SCREEN_PLAY) {
      session.clickTarget = clickToField(click.x, click.y);
    }
  }
  if (session.screen === SCREEN_CAUGHT) {
    session.caughtTime += dt;
    if (session.caughtTime > 1.4) restartLevel();
    return;
  }
  if (session.screen !== SCREEN_PLAY) return;
  const move = input.moveVector();
  let inputVec = move;
  if (move.mx === 0 && move.my === 0 && session.clickTarget) {
    const dx = session.clickTarget.x - session.world.player.x;
    const dy = session.clickTarget.y - session.world.player.y;
    if (Math.hypot(dx, dy) < 10) {
      session.clickTarget = null;
    } else {
      inputVec = { mx: dx, my: dy, sneak: false };
    }
  } else if (move.mx !== 0 || move.my !== 0) {
    session.clickTarget = null;
  }
  session.levelTime += dt;
  stepWorld(session.world, inputVec, dt);
  playEventSounds();
  if (session.world.caught) {
    session.screen = SCREEN_CAUGHT;
    session.caughtTime = 0;
    announce('Spotted! The level starts over.');
  } else if (session.world.won) {
    finishLevel();
  }
}

function frame(time) {
  const now = time / 1000;
  const dt = Math.min(0.1, now - (frame.last || now));
  frame.last = now;
  let left = dt;
  while (left > 0) {
    const stepDt = Math.min(STEP, left);
    step(stepDt);
    left -= stepDt;
  }
  render(ctx, view());
  requestAnimationFrame(frame);
}

// A screenshot scene: stage it once, render it once, report it in the title.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot);
  render(ctx, staged.view);
  document.title = `shot:${shot}:${staged.result}`;
  window.__shotReady = true;
} else {
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('keydown', (event) => input.onKeyDown(event));
  window.addEventListener('keyup', (event) => input.onKeyUp(event));
  canvas.addEventListener('pointerdown', (event) => input.onPointerDown(event));
  announce('Wren, Night Courier. Press Enter to begin.');
  requestAnimationFrame(frame);
}
