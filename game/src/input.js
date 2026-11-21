// Wren — Night Courier: keyboard and mouse. WASD or arrows move, Shift sneaks,
// R restarts the level, M mutes, Enter confirms. The pointer is only needed to
// start the game and to click the exit gate as a "wait here" nudge; the game is
// fully playable on the keyboard alone.

export function createInput() {
  const keys = new Set();
  return {
    keys,
    click: null,
    onKeyDown(event) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    },
    onKeyUp(event) {
      keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    },
    onPointerDown(event) {
      this.click = { x: event.offsetX, y: event.offsetY };
    },
    /** The movement vector from the keys held down, -1..1 on each axis. */
    moveVector() {
      let mx = 0;
      let my = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('w') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) my += 1;
      return { mx, my, sneak: keys.has('Shift') };
    },
    pressed(key) {
      return keys.has(key);
    },
    consumeClick() {
      const c = this.click;
      this.click = null;
      return c;
    },
  };
}
