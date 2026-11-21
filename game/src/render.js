// Wren — Night Courier: everything the player sees. The world is drawn as
// vector shapes on one canvas: a tiled floor, walls, crates, bushes, shadows,
// lantern glow, vision cones, guards, the dog, the exit gate and the loot.
// The HUD and the title, level, victory and caught screens are drawn here too.

import { FIELD, FONT, PLAYER, GUARD, DOG, SEARCHLIGHT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
  ctx.stroke();
}

function drawGuard(ctx, g, palette) {
  // Vision cone first, so the guard stands on top of it.
  drawCone(ctx, g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle, palette.cone, palette.coneEdge);
  ctx.fillStyle = '#c94f43';
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b64c';
  ctx.beginPath();
  ctx.arc(g.x, g.y, g.radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Spear pointing where the guard looks.
  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x + Math.cos(g.angle) * g.radius, g.y + Math.sin(g.angle) * g.radius);
  ctx.lineTo(g.x + Math.cos(g.angle) * (g.radius + 14), g.y + Math.sin(g.angle) * (g.radius + 14));
  ctx.stroke();
  // "?" while staring, "!" while hunting.
  if (g.state === 'stare' || g.state === 'hunt') {
    ctx.fillStyle = g.state === 'hunt' ? '#ff5a4e' : '#ffd76a';
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(g.state === 'hunt' ? '!' : '?', g.x, g.y - g.radius - 8);
  }
}

function drawDog(ctx, dog) {
  ctx.fillStyle = '#8a6a42';
  ctx.beginPath();
  ctx.ellipse(dog.x, dog.y, dog.radius + 3, dog.radius - 2, dog.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dog.x + Math.cos(dog.angle) * 8, dog.y + Math.sin(dog.angle) * 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a4026';
  ctx.beginPath();
  ctx.arc(dog.x - Math.sin(dog.angle) * 5, dog.y + Math.cos(dog.angle) * 5, 3, 0, Math.PI * 2);
  ctx.arc(dog.x + Math.sin(dog.angle) * 5, dog.y - Math.cos(dog.angle) * 5, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, p) {
  // A hooded courier: dark cloak, pale face, a small satchel.
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7fd4ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 4, p.y + Math.sin(p.facing) * 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(p.x - Math.cos(p.facing) * 8, p.y - Math.sin(p.facing) * 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The whole frame: world, HUD and the current screen overlay. */
export function render(ctx, view) {
  const { state, screen } = view;
  const pal = state.def.palette;
  const W = FIELD.width;
  const H = FIELD.height;

  // Floor: two-tone tiles so motion reads at a glance.
  ctx.fillStyle = pal.floor;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = pal.floorAlt;
  const tile = 80;
  for (let ty = 0; ty < H / tile; ty += 1) {
    for (let tx = 0; tx < W / tile; tx += 1) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }

  // Shadows: dark ground where you are half as easy to spot.
  for (const s of state.def.shadows) {
    ctx.fillStyle = pal.shadow;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }

  // Lantern glow.
  for (const l of state.def.lanterns) {
    const glow = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 90);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.lantern;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // The exit gate, glowing, with a ring showing the channel progress.
  const e = state.def.exit;
  const pulse = 0.75 + 0.25 * Math.sin(state.time * 3);
  ctx.fillStyle = pal.accent;
  ctx.globalAlpha = 0.25 * pulse;
  ctx.fillRect(e.x - 8, e.y - 8, e.w + 16, e.h + 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.accent;
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 + 5);
  if (state.exitProgress > 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 34, -Math.PI / 2, -Math.PI / 2 + (state.exitProgress / PLAYER.exitChannel) * Math.PI * 2);
    ctx.stroke();
  }

  // Moonstone loot: small glowing diamonds.
  for (const l of state.loot) {
    if (l.taken) continue;
    const bob = Math.sin(state.time * 2 + l.x) * 2;
    ctx.fillStyle = 'rgba(180, 230, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(l.x, l.y + bob, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfe6ff';
    ctx.beginPath();
    ctx.moveTo(l.x, l.y + bob - 10);
    ctx.lineTo(l.x + 7, l.y + bob);
    ctx.lineTo(l.x, l.y + bob + 10);
    ctx.lineTo(l.x - 7, l.y + bob);
    ctx.closePath();
    ctx.fill();
  }

  // Searchlight cones and posts.
  for (const s of state.searchlights) {
    drawCone(ctx, s.x, s.y, s.angle, SEARCHLIGHT.coneRange, SEARCHLIGHT.coneHalfAngle, pal.cone, pal.coneEdge);
  }

  // Crates: solid cover that blocks sight and movement.
  for (const c of state.def.crates) {
    ctx.fillStyle = pal.crate;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = pal.crateTop;
    ctx.fillRect(c.x, c.y, c.w, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }

  // Walls.
  for (const w of [...state.solids]) {
    if (w.w === FIELD.width || w.h === FIELD.height) continue;
    ctx.fillStyle = pal.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = pal.wallTop;
    if (w.w >= w.h) ctx.fillRect(w.x, w.y, w.w, 6);
    else ctx.fillRect(w.x, w.y, 6, w.h);
  }
  // Border walls.
  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, W, 24);
  ctx.fillRect(0, H - 24, W, 24);
  ctx.fillRect(0, 0, 24, H);
  ctx.fillRect(W - 24, 0, 24, H);

  // The dog, and its hearing circle while you run nearby.
  if (state.dog) {
    const d = Math.hypot(state.dog.x - state.player.x, state.dog.y - state.player.y);
    if (state.player.moving && !state.player.sneaking && d < 320) {
      ctx.strokeStyle = 'rgba(255, 120, 90, 0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(state.dog.x, state.dog.y, DOG.hearRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawDog(ctx, state.dog);
  }

  for (const g of state.guards) drawGuard(ctx, g, pal);
  for (const s of state.searchlights) {
    ctx.fillStyle = '#8b93a3';
    ctx.beginPath();
    ctx.arc(s.x, s.y, SEARCHLIGHT.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  drawPlayer(ctx, state.player);

  // Bushes canopy over everything: you are hidden inside one.
  for (const b of state.def.bushes) {
    ctx.fillStyle = pal.bush;
    ctx.globalAlpha = 0.82;
    roundRect(ctx, b.x, b.y, b.w, b.h, 14);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.bushTop;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(b.x + 12 + i * 17, b.y + 14 + (i % 2) * 26, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHud(ctx, view);

  if (screen === SCREEN_TITLE) drawTitle(ctx, view);
  if (screen === SCREEN_LEVEL) drawLevel(ctx, view);
  if (screen === SCREEN_WIN) drawWin(ctx, view);
  if (screen === SCREEN_CAUGHT) drawCaught(ctx, view);
}

function drawHud(ctx, view) {
  const { state } = view;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, 44);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${state.levelIndex + 1}. ${state.def.name}`, 36, 29);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bfe6ff';
  ctx.fillText(`◆ ${state.lootGot} / ${state.loot.length} moonstones`, FIELD.width / 2, 29);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#eef1f5';
  ctx.fillText(formatTime(view.levelTime), FIELD.width - 36, 29);
  // Detection meter: a bar that fills red as you are spotted.
  const bw = 260;
  const bx = FIELD.width / 2 - bw / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, bx, 52, bw, 10, 5);
  ctx.fill();
  const frac = state.detection / 100;
  ctx.fillStyle = frac > 0.7 ? '#ff5a4e' : frac > 0.35 ? '#ffd76a' : '#7fd4ff';
  if (frac > 0) {
    roundRect(ctx, bx, 52, bw * frac, 10, 5);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(238,241,245,0.8)';
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(state.detection > 70 ? 'SEEN!' : state.detection > 35 ? 'suspicious…' : 'unseen', FIELD.width / 2, 76);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(238,241,245,0.65)';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('WASD move · Shift sneak · R restart · M sound', 36, FIELD.height - 12);
  if (state.player.sneaking) {
    ctx.fillStyle = '#7fd4ff';
    ctx.textAlign = 'right';
    ctx.fillText('sneaking — slow and silent', FIELD.width - 36, FIELD.height - 12);
  }
}

function overlay(ctx) {
  ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawTitle(ctx, view) {
  overlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 84px ${FONT}`;
  ctx.fillText('WREN', FIELD.width / 2, 240);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `28px ${FONT}`;
  ctx.fillText('— Night Courier —', FIELD.width / 2, 285);
  ctx.fillStyle = '#b9c0cc';
  ctx.font = `19px ${FONT}`;
  ctx.fillText('Slip past the guards. Take the moonstones. Reach the gate unseen.', FIELD.width / 2, 340);
  ctx.fillText('Bushes hide you. Shadows halve their sight. Running makes noise.', FIELD.width / 2, 372);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `bold 22px ${FONT}`;
  const blink = Math.sin(view.now * 3) > -0.2;
  if (blink) ctx.fillText('Press Enter or click to begin', FIELD.width / 2, 450);
  ctx.fillStyle = '#8b93a3';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('WASD / arrows to move · hold Shift to sneak · R restart · M sound', FIELD.width / 2, 510);
  if (view.best) {
    ctx.fillStyle = '#7fd4ff';
    ctx.fillText(`Best: ${formatTime(view.best.time)} · ${view.best.loot}/9 moonstones`, FIELD.width / 2, 545);
  }
}

function drawLevel(ctx, view) {
  overlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7fd4ff';
  ctx.font = `bold 54px ${FONT}`;
  ctx.fillText('Unseen.', FIELD.width / 2, 300);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`${view.state.def.name} cleared in ${formatTime(view.levelTime)} · ${view.state.lootGot}/${view.state.loot.length} moonstones`, FIELD.width / 2, 355);
  ctx.fillStyle = '#b9c0cc';
  ctx.font = `19px ${FONT}`;
  ctx.fillText('Press Enter for the next level', FIELD.width / 2, 420);
}

function drawWin(ctx, view) {
  overlay(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText('The city sleeps.', FIELD.width / 2, 280);
  ctx.fillStyle = '#eef1f5';
  ctx.font = `26px ${FONT}`;
  ctx.fillText('Wren slips away with the moonstones.', FIELD.width / 2, 330);
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`Total time ${formatTime(view.totalTime)} · ${view.lootTotal}/9 moonstones`, FIELD.width / 2, 390);
  if (view.best) {
    ctx.fillStyle = '#7fd4ff';
    ctx.fillText(`Best: ${formatTime(view.best.time)} · ${view.best.loot}/9 moonstones`, FIELD.width / 2, 430);
  }
  ctx.fillStyle = '#b9c0cc';
  ctx.font = `19px ${FONT}`;
  ctx.fillText('Press Enter to play again', FIELD.width / 2, 490);
}

function drawCaught(ctx, view) {
  const flash = Math.max(0, 1 - view.caughtTime / 0.6);
  ctx.fillStyle = `rgba(200, 30, 20, ${0.25 + flash * 0.35})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText('SPOTTED!', FIELD.width / 2, 320);
  ctx.font = `22px ${FONT}`;
  ctx.fillText('The guards saw you. The level starts over.', FIELD.width / 2, 375);
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText('Press R to try again', FIELD.width / 2, 430);
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
}
