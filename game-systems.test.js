const test = require('node:test');
const assert = require('node:assert/strict');
let gameSystems = {};
try {
  gameSystems = require('../game-systems.js');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
const { createEnergySystem, createWeatherCycle, rainDropHitsPlayer, getDayNightDarkness, findSurfaceY, moveToward, getFramesPerSecond } = gameSystems;

test('energy begins at five, loses one per hit or fall, and resets after death', () => {
  const energy = createEnergySystem(5);
  assert.equal(energy.value, 5);
  assert.deepEqual(energy.damage(), { value: 4, dead: false });
  assert.deepEqual(energy.damage(), { value: 3, dead: false });
  assert.deepEqual(energy.damage(), { value: 2, dead: false });
  assert.deepEqual(energy.damage(), { value: 1, dead: false });
  assert.deepEqual(energy.damage(), { value: 0, dead: true });
  assert.deepEqual(energy.damage(), { value: 0, dead: true });
  energy.reset();
  assert.equal(energy.value, 5);
});

test('a growing flower restores one energy, up to the five-energy maximum', () => {
  const energy = createEnergySystem(5);
  energy.damage();
  assert.deepEqual(energy.restore(), { value: 5, restored: true });
  assert.deepEqual(energy.restore(), { value: 5, restored: false });
  energy.damage();
  assert.deepEqual(energy.restore(), { value: 5, restored: true });
});

test('automatic rain starts after 30 seconds, lasts 15 seconds, and repeats every 30 seconds', () => {
  const weather = createWeatherCycle({ interval: 30, duration: 15 });
  assert.deepEqual(weather.update(60), []);
  weather.start();
  assert.deepEqual(weather.update(29.9), []);
  assert.deepEqual(weather.update(0.1), ['rain-start']);
  assert.deepEqual(weather.update(14.9), []);
  assert.deepEqual(weather.update(0.1), ['rain-stop']);
  assert.deepEqual(weather.update(14.9), []);
  assert.deepEqual(weather.update(0.1), ['rain-start']);
  weather.stop();
  assert.deepEqual(weather.update(60), []);
});

test('a falling raindrop hits an exposed player once, but not a sheltered player', () => {
  const previous = { x: 0, y: 2, z: 0 };
  const next = { x: 0.1, y: 1, z: 0 };
  const player = { x: 0, y: 0, z: 0 };
  assert.equal(rainDropHitsPlayer(previous, next, player), true);
  assert.equal(rainDropHitsPlayer(previous, next, player, true), false);
  assert.equal(rainDropHitsPlayer(previous, next, { x: 2, y: 0, z: 0 }), false);
});

test('day and night are measured from game start and complete a two-minute cycle', () => {
  assert.equal(getDayNightDarkness(0), 0);
  assert.equal(getDayNightDarkness(60), 1);
  assert.equal(getDayNightDarkness(120), 0);
});

test('surface detection includes the highest allowed block row', () => {
  const blocks = new Set(['0,31,0', '0,7,0']);
  assert.equal(findSurfaceY((x, y, z) => blocks.has(`${x},${y},${z}`), 0, 0), 31.5);
  assert.equal(findSurfaceY(() => false, 0, 0), -Infinity);
});

test('a picked-up drop moves toward the player and reports arrival', () => {
  assert.deepEqual(moveToward({x:0,y:0,z:0}, {x:2,y:0,z:0}, 0.5), {
    position:{x:0.5,y:0,z:0}, arrived:false
  });
  assert.deepEqual(moveToward({x:1.8,y:0,z:0}, {x:2,y:0,z:0}, 0.5), {
    position:{x:2,y:0,z:0}, arrived:true
  });
});

test('frame rate uses real elapsed time instead of capped physics time', () => {
  assert.equal(getFramesPerSecond(10, 1), 10);
  assert.equal(getFramesPerSecond(10, 0), 0);
});
