(() => {
  'use strict';
  const THREE = window.THREE;
  const ASSET = './sky-island-assets/sky-island-assets/';
  const canvas = document.getElementById('world');
  const gameRoot = document.getElementById('game');
  const startPanel = document.getElementById('startPanel');
  const helpPanel = document.getElementById('helpPanel');
  const pauseHint = document.getElementById('pauseHint');
  const weatherButton = document.getElementById('weatherButton');
  const hotbarElement = document.getElementById('hotbar');
  const toastElement = document.getElementById('toast');
  const targetLabel = document.getElementById('targetLabel');
  const worldStatus = document.getElementById('worldStatus');
  const collectProgress = document.getElementById('collectProgress');
  const flowerProgress = document.getElementById('flowerProgress');
  const badgeLine = document.getElementById('badgeLine');
  const rainTint = document.getElementById('rainTint');
  const flashElement = document.getElementById('lightningFlash');
  const rainbowOverlay = document.getElementById('rainbowOverlay');
  const energyValueElement = document.getElementById('energyValue');
  const deathPanel = document.getElementById('deathPanel');
  const ENERGY_MAX = 5;
  const energy = window.GameSystems.createEnergySystem(ENERGY_MAX);
  const weatherCycle = window.GameSystems.createWeatherCycle({interval:30,duration:15});
  const inventory = {grass: 5, dirt: 8, stone: 4, planks: 7, leaves: 3, flower: 3};
  const items = [
    {id:'grass', label:'草地', icon:'grass.png'},
    {id:'dirt', label:'泥土', icon:'dirt.png'},
    {id:'stone', label:'石頭', icon:'stone.png'},
    {id:'planks', label:'木板', icon:'planks.png'},
    {id:'leaves', label:'樹葉', icon:'leaves.png'},
    {id:'flower', label:'花朵', icon:null}
  ];
  const blockName = {grass:'草地',dirt:'泥土',stone:'石頭',log:'原木',leaves:'樹葉',planks:'木板',sand:'砂岩',brick:'磚塊'};
  const world = new Map();
  const flowerPatches = [];
  const cloudGroups = [];
  const droppedItems = [];
  const meshLookup = [];
  const blockMeshes = [];
  const hotbarSlots = [];
  const keys = Object.create(null);
  const raycaster = new THREE.Raycaster();
  raycaster.far = 5.4;
  const center = new THREE.Vector2(0, 0);
  const clock = new THREE.Clock();
  let selectedSlot = 0;
  let pointerLocked = false;
  let fallbackMode = false;
  let fallbackDragging = false;
  let fallbackX = 0;
  let fallbackY = 0;
  let started = false;
  let yaw = 0;
  let pitch = -0.12;
  let mineDown = false;
  let mineKey = '';
  let mineStartedAt = 0;
  let mineDuration = 0.8;
  let crackOverlay = null;
  let lastToast = 0;
  let rainOn = false;
  let lightningTimer = 6;
  let flashTimer = 0;
  let rainParticles = null;
  let rainbowTimer = 0;
  let canopy = null;
  let canopyClock = 0;
  let dayNightElapsed = 0;
  let frameTime = 0;
  let fpsFrames = 0;
  let reportedSlow = false;
  let currentAim = null;
  let collectedForQuest = 0;
  let plantedForQuest = 0;
  let collectorBadge = false;
  let gardenerBadge = false;
  let caveChest = null;
  let caveLantern = null;
  let caveFound = false;
  let caveRewardClaimed = false;

  if (!THREE) {
    document.querySelector('.start-panel p').textContent = '遊戲程式庫載入失敗，請重新整理頁面。';
    document.getElementById('startButton').disabled = true;
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe0f4');
  scene.fog = new THREE.Fog('#bfe0f4', 38, 88);
  const daySkyColor = new THREE.Color('#bfe0f4');
  const nightSkyColor = new THREE.Color('#53627d');
  const camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.rotation.order = 'YXZ';
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:false, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const hemisphere = new THREE.HemisphereLight(0xeaf8ff, 0x82956f, 1.75);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.25);
  sun.position.set(-8, 18, 10);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa5cce0, 0.7);
  fill.position.set(8, 5, -9);
  scene.add(fill);

  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  function loadTexture(path) {
    if (!textureCache.has(path)) {
      const texture = textureLoader.load(ASSET + path);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(path, texture);
    }
    return textureCache.get(path);
  }
  const tex = {
    grassTop:loadTexture('textures/16px/grass_top.png'), grassSide:loadTexture('textures/16px/grass_side.png'),
    dirt:loadTexture('textures/16px/dirt.png'), stone:loadTexture('textures/16px/stone.png'),
    logSide:loadTexture('textures/16px/log_side.png'), logTop:loadTexture('textures/16px/log_top.png'),
    leaves:loadTexture('textures/16px/leaves.png'), planks:loadTexture('textures/16px/planks.png'),
    sand:loadTexture('textures/16px/sand.png'), brick:loadTexture('textures/16px/brick.png')
  };
  const materials = {
    grass:[new THREE.MeshLambertMaterial({map:tex.grassSide}),new THREE.MeshLambertMaterial({map:tex.grassSide}),new THREE.MeshLambertMaterial({map:tex.grassTop}),new THREE.MeshLambertMaterial({map:tex.dirt}),new THREE.MeshLambertMaterial({map:tex.grassSide}),new THREE.MeshLambertMaterial({map:tex.grassSide})],
    dirt:new THREE.MeshLambertMaterial({map:tex.dirt}), stone:new THREE.MeshLambertMaterial({map:tex.stone}),
    log:[new THREE.MeshLambertMaterial({map:tex.logSide}),new THREE.MeshLambertMaterial({map:tex.logSide}),new THREE.MeshLambertMaterial({map:tex.logTop}),new THREE.MeshLambertMaterial({map:tex.logTop}),new THREE.MeshLambertMaterial({map:tex.logSide}),new THREE.MeshLambertMaterial({map:tex.logSide})],
    leaves:new THREE.MeshLambertMaterial({map:tex.leaves}), planks:new THREE.MeshLambertMaterial({map:tex.planks}), sand:new THREE.MeshLambertMaterial({map:tex.sand}), brick:new THREE.MeshLambertMaterial({map:tex.brick})
  };
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);

  const coordKey = (x,y,z) => `${x},${y},${z}`;
  function putBlock(x,y,z,type) { world.set(coordKey(x,y,z), {x,y,z,type}); }
  function getBlock(x,y,z) { return world.get(coordKey(x,y,z)); }
  function removeBlock(x,y,z) { return world.delete(coordKey(x,y,z)); }

  function addFloatingIsland(cx,cz,topY,radius) {
    for(let dx=-radius;dx<=radius;dx++) for(let dz=-radius;dz<=radius;dz++) {
      const distance=dx*dx+dz*dz;
      if(distance<=radius*radius+1) putBlock(cx+dx,topY-1,cz+dz,'dirt');
      if(distance<=(radius-1)*(radius-1)+.5) putBlock(cx+dx,topY-2,cz+dz,'stone');
      if(distance<=radius*radius) putBlock(cx+dx,topY,cz+dz,'grass');
    }
    putBlock(cx,topY+1,cz,'planks');
  }

  function createCaveReward() {
    caveChest=new THREE.Group();
    const base=new THREE.Mesh(new THREE.BoxGeometry(.72,.38,.62),materials.planks);
    base.position.y=.2;caveChest.add(base);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(.76,.16,.66),materials.log);
    lid.position.y=.47;caveChest.add(lid);
    const latch=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.08),materials.brick);
    latch.position.set(0,.39,.35);caveChest.add(latch);
    caveChest.position.set(1.15,3.5,-3.2);scene.add(caveChest);
    caveLantern=new THREE.PointLight(0xffd899,.9,6,2);
    caveLantern.position.set(-1.1,4.5,-3.1);scene.add(caveLantern);
  }

  function makeWorld() {
    const radiusByY = {1:1.7,2:2.7,3:3.8,4:4.8,5:5.7,6:6.5,7:7.15,8:7.4};
    for (let y=1; y<=8; y++) {
      const radius = radiusByY[y];
      for (let x=-8; x<=8; x++) for (let z=-8; z<=8; z++) {
        const wobble = Math.sin(x*1.7+z*.73)*.22 + Math.cos(z*1.23-x*.46)*.19;
        if (Math.hypot(x,z) > radius + wobble) continue;
        let type;
        if (y===8) type = 'grass';
        else if (y>=6) type = 'dirt';
        else type = 'stone';
        if (y===3 && Math.abs(x+z)%5===0) type = 'dirt';
        putBlock(x,y,z,type);
      }
    }
    // A small tree, built from the supplied wood and leaf textures.
    for (let y=9; y<=12; y++) putBlock(-4,y,-2,'log');
    for (let x=-6; x<=-2; x++) for (let z=-4; z<=0; z++) for (let y=11; y<=13; y++) {
      const d = Math.abs(x+4)+Math.abs(z+2)+Math.max(0,y-12);
      if (d<=4 && !(x===-4 && z===-2 && y<=12)) putBlock(x,y,z,'leaves');
    }
    // A tiny island cabin and porch.
    for (let x=1; x<=5; x++) for (let z=-4; z<=0; z++) putBlock(x,9,z,'planks');
    for (let y=10; y<=11; y++) {
      for (let x=1; x<=5; x++) {
        putBlock(x,y,-4,'planks'); putBlock(x,y,0,'planks');
      }
      for (let z=-3; z<=-1; z++) {
        putBlock(1,y,z,'planks'); putBlock(5,y,z,'planks');
      }
      // A doorway in the front wall.
      removeBlock(3,y,-4);
    }
    for (let x=0; x<=6; x++) for (let z=-5; z<=1; z++) putBlock(x,12,z,'planks');
    for (let x=2; x<=4; x++) for (let z=-7; z<=-5; z++) putBlock(x,9,z,'planks');

    // The porch awning is a group of supplied planks; rain makes it gently lift and settle.
    canopy = new THREE.Group();
    for (let x=0; x<=6; x++) for (let z=-7; z<=-5; z++) {
      const awningBlock = new THREE.Mesh(cubeGeometry, materials.planks);
      awningBlock.position.set(x, 10.2, z);
      awningBlock.castShadow = false;
      canopy.add(awningBlock);
    }
    scene.add(canopy);
    // Scatter a few logs and stone accents along the island edge.
    putBlock(-6,9,2,'log'); putBlock(6,9,2,'log'); putBlock(6,9,-2,'stone');
    // Two fixed satellite islands stay within the assignment's 32-cube world limit.
    addFloatingIsland(10,0,9,2);
    addFloatingIsland(-10,-1,9,2);
    // A leaf block hides a narrow shaft leading into a small room inside the island.
    for(let x=-2;x<=2;x++) for(let z=-5;z<=-1;z++) for(let y=4;y<=5;y++) removeBlock(x,y,z);
    for(let y=6;y<=7;y++) removeBlock(0,y,-3);
    putBlock(0,8,-3,'leaves');
    refreshWorld();
    createCaveReward();
    createClouds();
  }

  function refreshWorld() {
    for (const mesh of blockMeshes) { scene.remove(mesh); mesh.dispose?.(); }
    blockMeshes.length = 0;
    for (const type of Object.keys(materials)) meshLookup[type] = [];
    const grouped = new Map();
    for (const block of world.values()) {
      if (!grouped.has(block.type)) grouped.set(block.type, []);
      grouped.get(block.type).push(block);
    }
    const dummy = new THREE.Object3D();
    for (const [type, blocks] of grouped) {
      const mesh = new THREE.InstancedMesh(cubeGeometry, materials[type], blocks.length);
      mesh.name = `blocks-${type}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      blocks.forEach((block,index) => {
        dummy.position.set(block.x,block.y,block.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(index,dummy.matrix);
        meshLookup[type][index] = block;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.blockType = type;
      scene.add(mesh);
      blockMeshes.push(mesh);
    }
  }

  function createClouds() {
    const cloudMaterial = new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.72});
    const cloudGeometry = new THREE.SphereGeometry(1,8,6);
    [[-17,17,-8,3.3],[16,19,-14,4],[1,22,-26,4.3],[-23,12,7,3.6]].forEach(([x,y,z,s])=>{
      const group = new THREE.Group();
      for (let i=0;i<5;i++) {
        const puff = new THREE.Mesh(cloudGeometry,cloudMaterial);
        puff.scale.set(s*(.48+Math.random()*.35),s*(.23+Math.random()*.17),s*(.32+Math.random()*.22));
        puff.position.set((i-2)*s*.38,Math.sin(i*2)*s*.09,Math.cos(i)*s*.12);
        group.add(puff);
      }
      group.position.set(x,y,z); scene.add(group);cloudGroups.push(group);
    });
  }

  function buildHotbar() {
    items.forEach((item,index)=>{
      const slot=document.createElement('button'); slot.type='button'; slot.className='slot'; slot.setAttribute('aria-label',`${index+1} ${item.label}`);
      slot.innerHTML = item.icon ? `<span class="slot-number">${index+1}</span><img src="${ASSET}icons/${item.icon}" alt=""><span class="slot-count"></span><span class="slot-name">${item.label}</span>` : `<span class="slot-number">${index+1}</span><span class="flower-icon">🌼</span><span class="slot-count"></span><span class="slot-name">${item.label}</span>`;
      slot.addEventListener('click',()=>selectSlot(index)); hotbarElement.append(slot); hotbarSlots.push(slot);
    });
    updateHotbar();
  }
  function updateHotbar() {
    hotbarSlots.forEach((slot,index)=>{
      slot.classList.toggle('selected',index===selectedSlot);
      slot.querySelector('.slot-count').textContent = inventory[items[index].id] ?? 0;
    });
    updateQuestUI();
  }
  function updateQuestUI() {
    if(!collectProgress||!flowerProgress||!badgeLine)return;
    collectProgress.textContent=`${Math.min(collectedForQuest,10)} / 10`;
    flowerProgress.textContent=`${Math.min(plantedForQuest,3)} / 3`;
    collectProgress.closest('.quest-row')?.classList.toggle('done',collectorBadge);
    flowerProgress.closest('.quest-row')?.classList.toggle('done',gardenerBadge);
    const badges=[];
    if(collectorBadge)badges.push('🏅 收集達人');
    if(gardenerBadge)badges.push('🏅 小小花農');
    badgeLine.innerHTML=badges.length?`<span>${badges.join('　')}</span>`:'完成任務，拿到小徽章';
  }
  function recordBlockCollected() {
    collectedForQuest++;
    const wonBadge=collectedForQuest>=10&&!collectorBadge;
    if(wonBadge){collectorBadge=true;showToast('任務完成：收集達人 🏅');}
    updateQuestUI();
    return wonBadge;
  }
  function selectSlot(index) { selectedSlot=(index+items.length)%items.length; updateHotbar(); showToast(`已選擇：${items[selectedSlot].label}`); }
  function changeInventory(id,amount) {
    inventory[id]=Math.max(0,(inventory[id]||0)+amount);
    updateHotbar();
  }
  function showToast(message) {
    toastElement.textContent=message; toastElement.classList.add('show');
    clearTimeout(lastToast); lastToast=setTimeout(()=>toastElement.classList.remove('show'),1450);
  }

  function makeFlower(x,y,z) {
    const flower = new THREE.Group();
    // A blocky flower assembled only from the course pack: wood, leaves and sand textures.
    const stem = new THREE.Mesh(new THREE.BoxGeometry(.12,.48,.12),materials.log);
    stem.position.y=.24; flower.add(stem);
    const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(.25,.1,.16),materials.leaves);
    leftLeaf.position.set(-.13,.22,0); leftLeaf.rotation.z=-.25; flower.add(leftLeaf);
    const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(.25,.1,.16),materials.leaves);
    rightLeaf.position.set(.13,.31,0); rightLeaf.rotation.z=.25; flower.add(rightLeaf);
    const petals=[[.16,.58,0],[-.16,.58,0],[0,.58,.16],[0,.58,-.16]];
    petals.forEach(([px,py,pz])=>{const petal=new THREE.Mesh(new THREE.BoxGeometry(.19,.16,.19),materials.sand);petal.position.set(px,py,pz);flower.add(petal);});
    const centerPetal=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.16),materials.brick);
    centerPetal.position.set(0,.63,0);flower.add(centerPetal);
    flower.position.set(x,y,z);flower.userData.rainSeconds=0;flower.userData.growthStage=0;scene.add(flower);flowerPatches.push(flower);
    return flower;
  }

  const rainCount = 430;
  const rainPositions = new Float32Array(rainCount*3);
  const rainVelocities = new Float32Array(rainCount);
  const rainGeometry = new THREE.BufferGeometry();
  for(let i=0;i<rainCount;i++){
    rainPositions[i*3]=(Math.random()-.5)*32;
    rainPositions[i*3+1]=12+Math.random()*16;
    rainPositions[i*3+2]=(Math.random()-.5)*32;
    rainVelocities[i]=9+Math.random()*6;
  }
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rainMaterial = new THREE.PointsMaterial({color:0xdaf4ff,size:.075,transparent:true,opacity:.83,sizeAttenuation:true,depthWrite:false});
  rainParticles = new THREE.Points(rainGeometry,rainMaterial); rainParticles.visible=false; scene.add(rainParticles);
  const boltMaterial = new THREE.LineBasicMaterial({color:0xe5f6ff,transparent:true,opacity:.95});
  let boltMesh = null;

  function makeLightning() {
    const side = Math.random()<.5 ? -1 : 1;
    let x = camera.position.x + side*(5+Math.random()*6);
    let z = camera.position.z - 5 - Math.random()*8;
    const start = new THREE.Vector3(x,24,z);
    const points=[start];
    for(let i=0;i<8;i++) points.push(new THREE.Vector3(x+(Math.random()-.5)*2,24-(i+1)*2.2,z+(Math.random()-.5)*1.4));
    const geometry=new THREE.BufferGeometry().setFromPoints(points);
    boltMesh=new THREE.Line(geometry,boltMaterial);scene.add(boltMesh);flashTimer=.13;
    flashElement.style.opacity='.62';
    setTimeout(()=>{flashElement.style.opacity='0';},110);
    setTimeout(()=>{if(boltMesh){scene.remove(boltMesh);boltMesh.geometry.dispose();boltMesh=null;}},230);
  }
  function setRain(value) {
    const wasRaining=rainOn;
    rainOn=value; rainParticles.visible=value; rainTint.classList.toggle('active',value);
    weatherButton.classList.toggle('rainy',value);
    weatherButton.innerHTML=value?'<span class="weather-icon">☔</span><span>下雨中</span><kbd>R</kbd>':'<span class="weather-icon">☀</span><span>晴朗</span><kbd>R</kbd>';
    worldStatus.textContent=value?'下雨中 · 閃電與屋簷':'晴朗 · 固定世界（32 格內）';
    showToast(value?'雨滴落下來了':'雨停了，雲朵散開');
    if(value) lightningTimer=1+Math.random()*2;
    if(wasRaining&&!value){rainbowTimer=10;rainbowOverlay.classList.add('active');}
  }

  function updateEnergyDisplay() {
    energyValueElement.textContent='♥'.repeat(energy.value)+'♡'.repeat(ENERGY_MAX-energy.value);
    energyValueElement.setAttribute('aria-label',`能量 ${energy.value} / ${ENERGY_MAX}`);
  }

  function endGame() {
    started=false;mineDown=false;player.velocityY=0;weatherCycle.stop();
    if(rainOn)setRain(false);
    if(document.pointerLockElement)document.exitPointerLock();
    fallbackMode=false;helpPanel.classList.add('hidden');pauseHint.classList.add('hidden');
    deathPanel.classList.remove('hidden');
  }

  function loseEnergy(reason) {
    const result=energy.damage();
    updateEnergyDisplay();
    if(result.dead){showToast('能量用完了');endGame();return true;}
    showToast(`${reason}，能量 -1（${result.value}/${ENERGY_MAX}）`);
    return false;
  }

  function beginGame() {
    deathPanel.classList.add('hidden');startPanel.classList.add('hidden');
    energy.reset();updateEnergyDisplay();weatherCycle.start();
    dayNightElapsed=0;
    if(rainOn)setRain(false);
    startPosition();player.velocityY=0;player.onGround=false;
    started=true;requestLock();
  }

  const player = {velocityY:0,onGround:false,walkTime:0};
  const EYE_HEIGHT=1.62;
  const MAX_STEP_HEIGHT=.55;
  function startPosition() { camera.position.set(0,8.5+EYE_HEIGHT,5.8); camera.rotation.set(pitch,yaw,0,'YXZ'); }
  function cellAt(value) { return Math.floor(value+.5); }
  function occupied(x,y,z) { return world.has(coordKey(x,y,z)); }
  function surfaceAt(x,z) {
    const cx=cellAt(x),cz=cellAt(z);
    return window.GameSystems.findSurfaceY(occupied,cx,cz,31);
  }
  function collides(x,y,z) {
    const foot=y-EYE_HEIGHT+.08, head=y-.2;
    const minX=cellAt(x-.23),maxX=cellAt(x+.23),minZ=cellAt(z-.23),maxZ=cellAt(z+.23);
    const minY=cellAt(foot),maxY=cellAt(head);
    for(let bx=minX;bx<=maxX;bx++) for(let bz=minZ;bz<=maxZ;bz++) for(let by=minY;by<=maxY;by++) if(occupied(bx,by,bz)) return true;
    return false;
  }
  function getAim() {
    raycaster.setFromCamera(center,camera);
    const hits=raycaster.intersectObjects(blockMeshes,false);
    if(!hits.length) return null;
    const hit=hits[0], block=meshLookup[hit.object.userData.blockType]?.[hit.instanceId];
    return block?{hit,block,key:coordKey(block.x,block.y,block.z)}:null;
  }
  function updateCrack(stage,block) {
    if(!crackOverlay){
      const crackMats=[];
      for(let i=0;i<6;i++) crackMats.push(new THREE.MeshBasicMaterial({map:loadTexture(`textures/16px/destroy_stage_${stage}.png`),transparent:true,alphaTest:.04,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide}));
      crackOverlay=new THREE.Mesh(new THREE.BoxGeometry(1.012,1.012,1.012),crackMats); scene.add(crackOverlay);
    }
    const texture=loadTexture(`textures/16px/destroy_stage_${stage}.png`);
    crackOverlay.material.forEach(material=>{material.map=texture;material.needsUpdate=true;});
    crackOverlay.position.set(block.x,block.y,block.z); crackOverlay.visible=true;
  }
  function clearCrack(){if(crackOverlay)crackOverlay.visible=false;mineKey='';}

  function dropBlock(block) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.32,.32,.32),materials[block.type]);
    mesh.position.set(block.x,block.y+.35,block.z);mesh.rotation.set(.18,.4,.12);scene.add(mesh);
    droppedItems.push({mesh,type:block.type,vy:0,phase:Math.random()*Math.PI*2});
  }
  function breakBlock(block) {
    removeBlock(block.x,block.y,block.z); dropBlock(block); refreshWorld(); clearCrack();
    showToast(`${blockName[block.type]||'方塊'}掉了下來`);
  }
  function placeBlock() {
    const aim=getAim(); if(!aim){showToast('看著一個方塊再放置');return;}
    const item=items[selectedSlot], block=aim.block;
    if(item.id==='flower'){
      if(inventory.flower<=0){showToast('花朵用完了，不能再種');return;}
      if(aim.hit.face.normal.y<.5 || block.type!=='grass'){showToast('花只能種在草地上');return;}
      const x=block.x,y=block.y+1,z=block.z;
      if(occupied(x,y,z)){showToast('這格已經被占住了');return;}
      makeFlower(x,y-.5,z);changeInventory('flower',-1);plantedForQuest++;
      const earnedBadge=plantedForQuest>=3&&!gardenerBadge;
      if(earnedBadge)gardenerBadge=true;
      updateQuestUI();showToast(earnedBadge?'小花種好了！任務完成：小小花農 🏅':'小花種好了');return;
    }
    if((inventory[item.id]||0)<=0){showToast(`${item.label}已經用完`);return;}
    const normal=aim.hit.face.normal;
    const x=block.x+Math.round(normal.x),y=block.y+Math.round(normal.y),z=block.z+Math.round(normal.z);
    if(occupied(x,y,z)){showToast('這格已經有方塊了');return;}
    if(y<0||y>31||x< -16||x>15||z< -16||z>15){showToast('不能放在這個位置');return;}
    // Do not place a block inside the player's body.
    if(Math.abs(camera.position.x-x)<.78&&Math.abs(camera.position.z-z)<.78&&camera.position.y-EYE_HEIGHT<y+.65&&camera.position.y>.5+y){showToast('不能把方塊放在自己身上');return;}
    putBlock(x,y,z,item.id);changeInventory(item.id,-1);refreshWorld();showToast(`${item.label}放好了`);
  }

  function updateMining(now,dt) {
    currentAim=getAim();
    if(currentAim){targetLabel.textContent=blockName[currentAim.block.type]||'方塊';targetLabel.classList.add('visible');}
    else targetLabel.classList.remove('visible');
    if(!mineDown||(!pointerLocked&&!fallbackMode)||!currentAim){clearCrack();return;}
    if(mineKey!==currentAim.key){mineKey=currentAim.key;mineStartedAt=now;mineDuration=currentAim.block.type==='stone'?1.9:(currentAim.block.type==='leaves'?.48:.78);}
    const progress=Math.min(1,(now-mineStartedAt)/1000/mineDuration);
    updateCrack(Math.min(9,Math.floor(progress*10)),currentAim.block);
    if(progress>=1){breakBlock(currentAim.block);mineStartedAt=now;}
  }

  function updateDrops(dt) {
    const feet=camera.position.y-EYE_HEIGHT;
    for(let i=droppedItems.length-1;i>=0;i--){
      const item=droppedItems[i];
      const target={x:camera.position.x,y:feet+.7,z:camera.position.z};
      let arrived=false;
      if(item.collecting){
        const step=window.GameSystems.moveToward(item.mesh.position,target,8*dt);
        item.mesh.position.set(step.position.x,step.position.y,step.position.z);
        arrived=step.arrived;
      }else{
        item.vy-=12*dt; item.mesh.position.y+=item.vy*dt;
        const ground=surfaceAt(item.mesh.position.x,item.mesh.position.z);
        if(Number.isFinite(ground)&&item.mesh.position.y-.16<ground){item.mesh.position.y=ground+.16;item.vy=Math.max(0,-item.vy*.22);if(Math.abs(item.vy)<.4)item.vy=0;}
        if(item.vy===0&&Number.isFinite(ground))item.mesh.position.y=ground+.2+Math.sin(item.phase)*.055;
        const dx=item.mesh.position.x-target.x,dy=item.mesh.position.y-target.y,dz=item.mesh.position.z-target.z;
        if(Math.hypot(dx,dy,dz)<1.45){item.collecting=true;item.vy=0;}
      }
      item.mesh.rotation.y+=dt*.8;item.phase+=dt*2;
      if(arrived){
        changeInventory(item.type,1);const wonBadge=recordBlockCollected();
        scene.remove(item.mesh);item.mesh.geometry.dispose();droppedItems.splice(i,1);
        if(!wonBadge)showToast(`撿到${blockName[item.type]||'方塊'} × 1`);
      }
    }
  }

  function updateRain(dt) {
    if(!rainOn)return;
    const pos=rainGeometry.attributes.position;
    for(let i=0;i<rainCount;i++){
      let x=rainPositions[i*3],y=rainPositions[i*3+1],z=rainPositions[i*3+2];
      const nextY=y-rainVelocities[i]*dt;
      const nearPlayer=Math.hypot(x-camera.position.x,z-camera.position.z)<.4;
      let hit=false;
      if(nearPlayer){
        const ground=surfaceAt(x,z);
        const sheltered=Number.isFinite(ground)&&ground>camera.position.y-EYE_HEIGHT+1.72;
        hit=window.GameSystems.rainDropHitsPlayer(
          {x,y,z},{x,y:nextY,z},
          {x:camera.position.x,y:camera.position.y-EYE_HEIGHT,z:camera.position.z},
          sheltered
        );
      }
      y=nextY;
      if(hit){
        loseEnergy('被雨滴到');
        y=-3;
        if(!started)return;
      }
      if(y<-2){x=(Math.random()-.5)*32;y=26+Math.random()*6;z=(Math.random()-.5)*32;}
      rainPositions[i*3]=x;rainPositions[i*3+1]=y;rainPositions[i*3+2]=z;
    }
    pos.needsUpdate=true;rainGeometry.computeBoundingSphere();
  }

  function updatePlayer(dt) {
    if(!started||!helpPanel.classList.contains('hidden'))return;
    let strafe=(keys.KeyD?1:0)-(keys.KeyA?1:0);
    let forward=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    const length=Math.hypot(strafe,forward)||1;strafe/=length;forward/=length;
    const speed=keys.ShiftLeft||keys.ShiftRight?7.4:5.1;
    const dx=(Math.cos(yaw)*strafe-Math.sin(yaw)*forward)*speed*dt;
    const dz=(Math.sin(yaw)*strafe-Math.cos(yaw)*forward)*speed*dt;
    if(!collides(camera.position.x+dx,camera.position.y,camera.position.z))camera.position.x+=dx;
    if(!collides(camera.position.x,camera.position.y,camera.position.z+dz))camera.position.z+=dz;
    if(keys.Space&&player.onGround){player.velocityY=7;player.onGround=false;}
    player.velocityY-=18*dt;
    const proposedY=camera.position.y+player.velocityY*dt;
    const ground=surfaceAt(camera.position.x,camera.position.z);
    const currentFoot=camera.position.y-EYE_HEIGHT;
    // Only step onto small ledges. Tall trees and roofs require an actual jump.
    if(proposedY-EYE_HEIGHT<=ground&&ground<=currentFoot+MAX_STEP_HEIGHT){camera.position.y=ground+EYE_HEIGHT;player.velocityY=0;player.onGround=true;}
    else if(!collides(camera.position.x,proposedY,camera.position.z)){camera.position.y=proposedY;player.onGround=false;}
    else {player.velocityY=0;}
    if(camera.position.y<-4){
      const dead=loseEnergy('掉出島嶼');
      if(!dead){startPosition();player.velocityY=0;player.onGround=false;showToast('已回到島上');}
    }
    player.walkTime+=(Math.abs(dx)+Math.abs(dz))*3;
    camera.position.y+=player.onGround?Math.sin(player.walkTime)*.012:0;
  }

  function updateWeather(dt) {
    for(const event of weatherCycle.update(dt)){
      if(event==='rain-start')setRain(true);
      else if(event==='rain-stop')setRain(false);
    }
    if(rainbowTimer>0){
      rainbowTimer=Math.max(0,rainbowTimer-dt);
      if(rainbowTimer===0)rainbowOverlay.classList.remove('active');
    }
    if(rainOn){
      canopyClock+=dt;
      canopy.position.y=Math.sin(canopyClock*3.2)*.22;
      lightningTimer-=dt;
      if(lightningTimer<=0){makeLightning();lightningTimer=4+Math.random();}
    } else if(canopy){canopy.position.y+=(0-canopy.position.y)*Math.min(1,dt*2);}
  }

  function updateGarden(dt) {
    if(!rainOn)return;
    let grewFlower=false;
    for(const flower of flowerPatches){
      if(flower.userData.growthStage>=2)continue;
      flower.userData.rainSeconds+=dt;
      if(flower.userData.rainSeconds>=10){
        flower.userData.rainSeconds-=10;flower.userData.growthStage++;
        flower.scale.y=1+flower.userData.growthStage*.3;
        const recovery=energy.restore();
        updateEnergyDisplay();
        if(!grewFlower){showToast(recovery.restored?'小花長高了，能量 +1':'小花長高了，能量已滿');grewFlower=true;}
      }
    }
  }

  function updateDayNight() {
    const darkness=window.GameSystems.getDayNightDarkness(dayNightElapsed);
    scene.background.copy(daySkyColor).lerp(nightSkyColor,darkness);
    scene.fog.color.copy(scene.background);
    sun.intensity=2.25-darkness*1.45;
    hemisphere.intensity=1.75-darkness*.9;
    fill.intensity=.7-darkness*.32;
  }

  function updateCave() {
    if(!caveFound&&camera.position.y<7&&camera.position.x>-2.8&&camera.position.x<2.8&&camera.position.z>-5.8&&camera.position.z<-1){
      caveFound=true;showToast('發現島下的秘密洞穴！');
    }
    if(caveRewardClaimed||!caveChest)return;
    const dx=camera.position.x-caveChest.position.x;
    const dy=camera.position.y-(caveChest.position.y+.7);
    const dz=camera.position.z-caveChest.position.z;
    if(Math.hypot(dx,dy,dz)<2.5){
      caveRewardClaimed=true;changeInventory('stone',5);
      scene.remove(caveChest);scene.remove(caveLantern);
      showToast('密室寶箱：石頭 × 5');
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    const elapsed=clock.getDelta();
    const dt=Math.min(elapsed,.045);if(started)dayNightElapsed+=dt;
    updatePlayer(dt);updateDrops(dt);updateRain(dt);updateWeather(dt);updateGarden(dt);updateDayNight();updateCave();updateMining(performance.now(),dt);
    if(flashTimer>0)flashTimer-=dt;
    fpsFrames++;frameTime+=elapsed;
    if(frameTime>3){const fps=window.GameSystems.getFramesPerSecond(fpsFrames,frameTime);if(fps<30&&!reportedSlow){reportedSlow=true;showToast('提示：可縮小瀏覽器視窗，改善畫面流暢度');}fpsFrames=0;frameTime=0;}
    renderer.render(scene,camera);
  }

  function requestLock(){
    started=true;
    fallbackMode=true;
    startPanel.classList.add('hidden');
    pauseHint.classList.add('hidden');
    fallbackX=window.innerWidth/2;fallbackY=window.innerHeight/2;
    if(!canvas.requestPointerLock)return;
    try{
      const request=canvas.requestPointerLock();
      if(request&&typeof request.catch==='function')request.catch(()=>{fallbackMode=true;pauseHint.classList.add('hidden');});
    }catch(_error){fallbackMode=true;pauseHint.classList.add('hidden');}
  }
  function syncPointerLock(){
    pointerLocked=document.pointerLockElement===canvas;
    if(pointerLocked){fallbackMode=false;started=true;pauseHint.classList.add('hidden');startPanel.classList.add('hidden');helpPanel.classList.add('hidden');}
    else if(started&&helpPanel.classList.contains('hidden')){fallbackMode=true;pauseHint.classList.add('hidden');mineDown=false;fallbackDragging=false;clearCrack();}
    else if(started){pauseHint.classList.add('hidden');mineDown=false;fallbackDragging=false;clearCrack();}
  }
  function openHelp(){if(document.pointerLockElement)document.exitPointerLock();fallbackMode=false;helpPanel.classList.remove('hidden');pauseHint.classList.add('hidden');}
  function closeHelp(){helpPanel.classList.add('hidden');if(started)requestLock();}

  document.addEventListener('pointerlockchange',syncPointerLock);
  document.getElementById('startButton').addEventListener('click',beginGame);
  document.getElementById('restartButton').addEventListener('click',()=>window.location.reload());
  document.getElementById('helpButton').addEventListener('click',openHelp);
  document.getElementById('closeHelpButton').addEventListener('click',closeHelp);
  document.getElementById('resumeButton').addEventListener('click',closeHelp);

  document.addEventListener('mousemove',event=>{
    if(!pointerLocked&&!fallbackMode)return;
    const dx=pointerLocked?event.movementX:event.clientX-fallbackX;
    const dy=pointerLocked?event.movementY:event.clientY-fallbackY;
    if(!pointerLocked){fallbackX=event.clientX;fallbackY=event.clientY;}
    yaw-=dx*(pointerLocked?.0022:.008);
    pitch-=dy*(pointerLocked?.0022:.008);
    pitch=Math.max(-1.48,Math.min(1.48,pitch));
    camera.rotation.set(pitch,yaw,0,'YXZ');
  });
  document.addEventListener('mousedown',event=>{
    if(!started||!helpPanel.classList.contains('hidden'))return;
    if(event.button===0){
      mineDown=true;
      if(!pointerLocked){fallbackMode=true;fallbackDragging=true;fallbackX=event.clientX;fallbackY=event.clientY;}
    }else if(event.button===2){placeBlock();}
  });
  document.addEventListener('mouseup',event=>{if(event.button===0){mineDown=false;fallbackDragging=false;clearCrack();}});
  document.addEventListener('contextmenu',event=>event.preventDefault());
  document.addEventListener('keydown',event=>{
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
    keys[event.code]=true;
    if(event.repeat)return;
    if(/^Digit[1-6]$/.test(event.code))selectSlot(Number(event.code.slice(-1))-1);
    if(event.code==='KeyR'&&helpPanel.classList.contains('hidden'))setRain(!rainOn);
    if(event.code==='Escape'&&started&&!helpPanel.classList.contains('hidden'))closeHelp();
  });
  document.addEventListener('keyup',event=>{keys[event.code]=false;});
  window.addEventListener('blur',()=>{mineDown=false;clearCrack();Object.keys(keys).forEach(key=>keys[key]=false);});
  document.getElementById('weatherButton').addEventListener('click',()=>setRain(!rainOn));
  document.getElementById('fullscreenButton').addEventListener('click',()=>{if(!document.fullscreenElement)gameRoot.requestFullscreen?.();else document.exitFullscreen?.();});
  window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));});
  window.addEventListener('wheel',event=>{if(pointerLocked)selectSlot(selectedSlot+(event.deltaY>0?1:-1));},{passive:true});

  buildHotbar();makeWorld();startPosition();updateEnergyDisplay();loop();
})();






