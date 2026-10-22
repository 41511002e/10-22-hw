(function attachGameSystems(root, factory) {
  const systems = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = systems;
  if (root) root.GameSystems = systems;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGameSystems() {
  function createEnergySystem(maximum = 5) {
    let value = maximum;
    return {
      get value() { return value; },
      damage() {
        value = Math.max(0, value - 1);
        return {value, dead: value === 0};
      },
      restore() {
        if (value >= maximum) return {value, restored: false};
        value += 1;
        return {value, restored: true};
      },
      reset() { value = maximum; return value; }
    };
  }

  function createWeatherCycle({interval = 30, duration = 15} = {}) {
    let running = false;
    let raining = false;
    let secondsUntilChange = interval;
    const dryDuration = Math.max(0, interval - duration);

    return {
      get running() { return running; },
      get raining() { return raining; },
      start() {
        running = true;
        raining = false;
        secondsUntilChange = interval;
      },
      stop() {
        running = false;
        raining = false;
        secondsUntilChange = interval;
      },
      update(seconds) {
        const events = [];
        if (!running || !Number.isFinite(seconds) || seconds <= 0) return events;
        let remaining = seconds;
        while (remaining > 0) {
          const advance = Math.min(remaining, secondsUntilChange);
          remaining -= advance;
          secondsUntilChange -= advance;
          if (secondsUntilChange > 1e-9) break;
          if (raining) {
            raining = false;
            secondsUntilChange = dryDuration;
            events.push('rain-stop');
          } else {
            raining = true;
            secondsUntilChange = duration;
            events.push('rain-start');
          }
          if (secondsUntilChange === 0) {
            // Avoid an infinite loop for a zero-length dry period.
            secondsUntilChange = 1e-9;
          }
        }
        return events;
      }
    };
  }

  function rainDropHitsPlayer(previous, next, player, sheltered = false) {
    if (sheltered) return false;
    const radius = 0.34;
    const midpointX = (previous.x + next.x) / 2;
    const midpointZ = (previous.z + next.z) / 2;
    if (Math.hypot(midpointX - player.x, midpointZ - player.z) > radius) return false;
    const bodyBottom = player.y + 0.12;
    const bodyTop = player.y + 1.72;
    const dropTop = Math.max(previous.y, next.y);
    const dropBottom = Math.min(previous.y, next.y);
    return dropTop >= bodyBottom && dropBottom <= bodyTop;
  }

  function getDayNightDarkness(elapsedSeconds) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
    const phase = (elapsedSeconds % 120) / 120;
    return (1 - Math.cos(phase * Math.PI * 2)) * 0.5;
  }

  function findSurfaceY(hasBlock, x, z, highestBlockY = 31) {
    for (let y = highestBlockY; y >= 0; y--) {
      if (hasBlock(x, y, z)) return y + 0.5;
    }
    return -Infinity;
  }

  function moveToward(current, target, maxDistance) {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    const dz = target.z - current.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= maxDistance || distance === 0) {
      return {position:{x:target.x, y:target.y, z:target.z}, arrived:true};
    }
    const ratio = maxDistance / distance;
    return {
      position:{x:current.x + dx * ratio, y:current.y + dy * ratio, z:current.z + dz * ratio},
      arrived:false
    };
  }

  function getFramesPerSecond(frames, elapsedSeconds) {
    if (!Number.isFinite(frames) || !Number.isFinite(elapsedSeconds) || frames <= 0 || elapsedSeconds <= 0) return 0;
    return frames / elapsedSeconds;
  }

  return {createEnergySystem, createWeatherCycle, rainDropHitsPlayer, getDayNightDarkness, findSurfaceY, moveToward, getFramesPerSecond};
});
