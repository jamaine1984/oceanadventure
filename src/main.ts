import './styles.css';

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';

type KeyMap = Record<string, boolean>;

type MissionSignal = {
  name: string;
  position: THREE.Vector3;
  group: THREE.Group;
  collected: boolean;
  sensor?: unknown;
};

type WakeParticle = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
};

type WindStreak = {
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  offset: THREE.Vector3;
  speed: number;
};

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const loading = document.querySelector<HTMLElement>('[data-loading]');
const objectiveText = document.querySelector<HTMLElement>('[data-objective]');
const npcText = document.querySelector<HTMLElement>('[data-npc]');
const speedText = document.querySelector<HTMLElement>('[data-speed]');
const headingText = document.querySelector<HTMLElement>('[data-heading]');
const windText = document.querySelector<HTMLElement>('[data-wind]');
const fpsText = document.querySelector<HTMLElement>('[data-fps]');
const progressText = document.querySelector<HTMLElement>('[data-progress]');
const notice = document.querySelector<HTMLElement>('[data-notice]');
const musicToggle = document.querySelector<HTMLButtonElement>('[data-music-toggle]');

if (!host) {
  throw new Error('Ocean Adventure canvas host is missing.');
}

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
});
const maxRenderPixelRatio = matchMedia('(max-width: 760px)').matches ? 0.8 : 0.85;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRenderPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x87cfe9, 0.00072);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 18000);
camera.position.set(0, 10, 24);

const keys: KeyMap = {};
const tmpVector = new THREE.Vector3();
const tmpVectorB = new THREE.Vector3();
const tmpVectorC = new THREE.Vector3();
const tmpVectorD = new THREE.Vector3();
const tmpVectorE = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const waveNormal = new THREE.Vector3();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const cameraTarget = new THREE.Vector3();
const sternBase = new THREE.Vector3();
const sternLeft = new THREE.Vector3();
const sternRight = new THREE.Vector3();
const cameraOffsets = [
  new THREE.Vector3(0, 8.6, 25),
  new THREE.Vector3(0, 17, 39),
  new THREE.Vector3(18, 8, 18),
];

let water: InstanceType<typeof Water>;
let sky: InstanceType<typeof Sky>;
let sun = new THREE.Vector3();
let pmremTarget: THREE.WebGLRenderTarget | undefined;
let physicsWorld: RAPIER.World;
let boatBody: RAPIER.RigidBody;
let yacht: THREE.Group;
let yachtVisual: THREE.Object3D | undefined;
let speed = 0;
let heading = 0;
let throttleValue = 0;
let steerValue = 0;
let displaySpeed = 0;
let cameraMode = 0;
let missionIndex = 0;
let gameTime = 0;
let lastFrameTime = performance.now() * 0.001;
let lastWakeSpawn = 0;
let hiddenNoticeAt = 0;
let hudAccumulator = 0;
let fpsAccumulator = 0;
let fpsFrames = 0;
let measuredFps = 60;
let wakeSideToggle = false;
let music: OceanMusic | undefined;
let musicStarting = false;

const windDirection = new THREE.Vector3(0.58, 0, -0.82).normalize();
const windKnots = 15;
const wakeParticles: WakeParticle[] = [];
const wakeMeshPool: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = [];
const windStreaks: WindStreak[] = [];
const missionSignals: MissionSignal[] = [];
let foamTexture: THREE.CanvasTexture | undefined;
const wakeGeometry = new THREE.PlaneGeometry(1, 1);
const wakeMaterial = new THREE.MeshBasicMaterial({
  map: getFoamTexture(),
  transparent: true,
  depthWrite: false,
  opacity: 0.62,
  color: 0xe4fbff,
});

const missionCopy = [
  'Reach the first signal buoy',
  'Trace the reef passage',
  'Inspect the old survey mast',
  'Cross the bluewater channel',
  'Find the sunken beacon',
  'Return to open water',
];

const npcCopy = [
  'Mara is scanning the horizon.',
  'Mara: Current looks clean. Keep the bow steady.',
  'Mara: Reef markers ahead. Give the rocks room.',
  'Mara: Wind is building from starboard.',
  'Mara: The final signal is just past the swell line.',
  'Mara: Good run. Bring us back into clear water.',
];

class OceanMusic {
  private context: AudioContext;
  private master: GainNode;
  private delay: DelayNode;
  private delayFeedback: GainNode;
  private sequenceTimer = 0;
  private step = 0;
  private muted = false;
  private readonly notes = [196, 246.94, 293.66, 329.63, 392, 493.88, 587.33, 659.25];

  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.0001;

    this.delay = this.context.createDelay(1.2);
    this.delay.delayTime.value = 0.34;
    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = 0.22;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.master);
    this.master.connect(this.context.destination);
  }

  async start() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(0.2, this.context.currentTime + 1.4);
    this.startPad();
    this.startWindBed();
    this.sequenceTimer = window.setInterval(() => this.playSequenceStep(), 520);
    this.playSequenceStep();
  }

  toggleMuted() {
    this.muted = !this.muted;
    const target = this.muted ? 0.0001 : 0.2;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.context.currentTime + 0.25);
    return !this.muted;
  }

  isOn() {
    return !this.muted;
  }

  private startPad() {
    const padGain = this.context.createGain();
    padGain.gain.value = 0.06;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 860;
    filter.Q.value = 0.7;
    filter.connect(this.master);

    [98, 146.83, 196].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const voiceGain = this.context.createGain();
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = 0.18;
      lfo.frequency.value = 0.045 + index * 0.015;
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);
      oscillator.connect(voiceGain);
      voiceGain.connect(padGain);
      oscillator.start();
      lfo.start();
    });

    padGain.connect(filter);
  }

  private startWindBed() {
    const seconds = 2.5;
    const buffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * seconds), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.55;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.42;
    gain.gain.value = 0.025;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  private playSequenceStep() {
    const now = this.context.currentTime;
    const noteIndex = [0, 2, 4, 6, 3, 4, 7, 5][this.step % 8];
    const bassIndex = [0, 0, 3, 3, 4, 4, 2, 2][this.step % 8];
    this.playNote(this.notes[noteIndex], now, 0.42, 0.06, 'sine');
    if (this.step % 2 === 0) {
      this.playNote(this.notes[bassIndex] * 0.5, now, 0.9, 0.045, 'triangle');
    }
    this.step += 1;
  }

  private playNote(frequency: number, start: number, duration: number, peak: number, type: OscillatorType) {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.4;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.connect(this.delay);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }
}

async function initialize() {
  await RAPIER.init();
  physicsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
  physicsWorld.timestep = 1 / 60;

  createLighting();
  await createOceanAndSky();
  createWorld();
  await createYacht();
  createPhysics();
  createInput();
  updateHud();

  loading?.classList.add('is-hidden');
  renderer.setAnimationLoop(tick);
}

function createLighting() {
  const hemi = new THREE.HemisphereLight(0xb7e8ff, 0x0a283b, 1.2);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xfff2ce, 4.2);
  sunLight.position.set(-70, 130, -80);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -90;
  sunLight.shadow.camera.right = 90;
  sunLight.shadow.camera.top = 90;
  sunLight.shadow.camera.bottom = -90;
  scene.add(sunLight);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe09b, transparent: true, opacity: 0.9 }),
  );
  glow.name = 'visible_sun';
  glow.position.set(-190, 240, -410);
  scene.add(glow);
}

async function createOceanAndSky() {
  const waterNormals = await loadWaterNormals();
  const waterGeometry = new THREE.PlaneGeometry(18000, 18000, 24, 24);

  water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x075b74,
    distortionScale: 4.2,
    fog: true,
  });
  water.name = 'reflective_ocean';
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  const renderWaterReflection = water.onBeforeRender.bind(water);
  let reflectionFrame = 0;
  water.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    reflectionFrame = (reflectionFrame + 1) % 4;
    if (reflectionFrame === 0) {
      renderWaterReflection(renderer, scene, camera, geometry, material, group);
    }
  };
  scene.add(water);

  sky = new Sky();
  sky.name = 'physical_sky';
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 8.4;
  skyUniforms.rayleigh.value = 2.4;
  skyUniforms.mieCoefficient.value = 0.006;
  skyUniforms.mieDirectionalG.value = 0.82;
  if (skyUniforms.cloudCoverage) skyUniforms.cloudCoverage.value = 0.28;
  if (skyUniforms.cloudDensity) skyUniforms.cloudDensity.value = 0.35;
  if (skyUniforms.cloudElevation) skyUniforms.cloudElevation.value = 0.42;

  setSun(8, 176);

  createClouds();
  createWindStreaks();
}

async function loadWaterNormals() {
  const loader = new THREE.TextureLoader();
  try {
    const texture = await loader.loadAsync('/textures/waternormals.jpg');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  } catch {
    return createProceduralNormalTexture();
  }
}

function createProceduralNormalTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.Texture();
  }
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const value =
        Math.sin((nx * 18 + ny * 7) * Math.PI * 2) * 0.5 +
        Math.sin((nx * -9 + ny * 23) * Math.PI * 2) * 0.32 +
        Math.sin((nx * 41 + ny * 37) * Math.PI * 2) * 0.18;
      const i = (y * size + x) * 4;
      image.data[i] = 128 + value * 45;
      image.data[i + 1] = 128 + value * 35;
      image.data[i + 2] = 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function setSun(elevation: number, azimuth: number) {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value.copy(sun);
  water.material.uniforms.sunDirection.value.copy(sun).normalize();

  if (pmremTarget) {
    pmremTarget.dispose();
  }
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(sky);
  pmremTarget = pmremGenerator.fromScene(envScene);
  scene.environment = pmremTarget.texture;
  scene.add(sky);
  pmremGenerator.dispose();
}

async function createYacht() {
  yacht = new THREE.Group();
  yacht.name = 'player_yacht';
  scene.add(yacht);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/expedition_yacht.glb');
  yachtVisual = gltf.scene;
  yachtVisual.name = 'blender_expedition_yacht';
  yachtVisual.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material instanceof THREE.MeshStandardMaterial) {
        node.material.envMapIntensity = 0.95;
      }
    }
  });
  yachtVisual.rotation.y = Math.PI;
  yacht.add(yachtVisual);
}

function createPhysics() {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 2, 20)
    .setLinearDamping(0.9)
    .setAngularDamping(4.5)
    .setCanSleep(false)
    .enabledRotations(false, true, false);

  boatBody = physicsWorld.createRigidBody(bodyDesc);
  const hullCollider = RAPIER.ColliderDesc.cuboid(3.0, 1.35, 9.6)
    .setFriction(0.22)
    .setRestitution(0.02)
    .setDensity(1.15);
  physicsWorld.createCollider(hullCollider, boatBody);

  createObstacleCollider(-58, -78, 16);
  createObstacleCollider(88, -24, 13);
  createObstacleCollider(34, 96, 18);
  createObstacleCollider(-118, 64, 22);

  missionSignals.forEach((signal) => {
    signal.sensor = physicsWorld.createCollider(
      RAPIER.ColliderDesc.ball(6.2).setTranslation(signal.position.x, 1.2, signal.position.z).setSensor(true),
    );
  });
}

function createObstacleCollider(x: number, z: number, radius: number) {
  physicsWorld.createCollider(
    RAPIER.ColliderDesc.cylinder(3.5, radius * 0.74)
      .setTranslation(x, 0, z)
      .setFriction(1)
      .setRestitution(0.05),
  );
}

function createWorld() {
  createIsland(new THREE.Vector3(-58, 0, -78), 22, 0.8);
  createIsland(new THREE.Vector3(88, 0, -24), 18, 1.2);
  createIsland(new THREE.Vector3(34, 0, 96), 24, 0.5);
  createIsland(new THREE.Vector3(-118, 0, 64), 28, 1.8);

  [
    new THREE.Vector3(0, 0, -70),
    new THREE.Vector3(70, 0, -120),
    new THREE.Vector3(135, 0, 26),
    new THREE.Vector3(26, 0, 162),
    new THREE.Vector3(-96, 0, 132),
  ].forEach((position, index) => {
    missionSignals.push(createSignalBuoy(position, index));
  });

  createFloatingDebris();
}

function createIsland(position: THREE.Vector3, radius: number, phase: number) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = 'reef_island';
  scene.add(group);

  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xbfa56d,
    roughness: 0.82,
    metalness: 0,
  });
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c5961,
    roughness: 0.74,
  });
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d7c4b,
    roughness: 0.62,
  });
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b5535,
    roughness: 0.78,
  });

  const terrain = new THREE.CylinderGeometry(radius * 0.75, radius, 4.5, 18, 3);
  const attribute = terrain.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < attribute.count; i += 1) {
    const x = attribute.getX(i);
    const y = attribute.getY(i);
    const z = attribute.getZ(i);
    const wobble = 1 + 0.12 * Math.sin(Math.atan2(z, x) * 5 + phase);
    attribute.setXYZ(i, x * wobble, y - 2.3, z * wobble);
  }
  terrain.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(terrain, sandMaterial);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  group.add(terrainMesh);

  const foamRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, 0.25, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  foamRing.rotation.x = Math.PI / 2;
  foamRing.position.y = 0.08;
  group.add(foamRing);

  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + phase;
    const r = radius * (0.22 + 0.46 * ((i % 4) / 4));
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius * (0.08 + (i % 3) * 0.025), 1),
      rockMaterial,
    );
    rock.position.set(Math.cos(angle) * r, 0.8 + (i % 2) * 0.22, Math.sin(angle) * r);
    rock.scale.y = 0.55 + (i % 4) * 0.22;
    rock.rotation.set(phase + i, i * 0.8, phase * 0.3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  for (let i = 0; i < 3; i += 1) {
    const angle = phase + i * 2.15;
    const palm = new THREE.Group();
    palm.position.set(Math.cos(angle) * radius * 0.28, 1.4, Math.sin(angle) * radius * 0.25);
    palm.rotation.z = Math.sin(phase + i) * 0.18;
    group.add(palm);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 4.6, 9), trunkMaterial);
    trunk.position.y = 2.0;
    trunk.castShadow = true;
    palm.add(trunk);

    for (let leaf = 0; leaf < 7; leaf += 1) {
      const leafMesh = new THREE.Mesh(new THREE.ConeGeometry(0.46, 3.4, 5), leafMaterial);
      leafMesh.position.y = 4.35;
      leafMesh.rotation.z = Math.PI / 2;
      leafMesh.rotation.y = (leaf / 7) * Math.PI * 2;
      leafMesh.scale.set(1, 0.32, 1);
      leafMesh.castShadow = true;
      palm.add(leafMesh);
    }
  }
}

function createSignalBuoy(position: THREE.Vector3, index: number): MissionSignal {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = `signal_buoy_${index + 1}`;
  scene.add(group);

  const buoyMaterial = new THREE.MeshStandardMaterial({
    color: index % 2 === 0 ? 0xf46b4e : 0xf8c86d,
    metalness: 0.05,
    roughness: 0.38,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x102b38, roughness: 0.5 });
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9f4ff,
    emissive: 0x5fdcff,
    emissiveIntensity: 1.6,
    roughness: 0.16,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 2.4, 24), buoyMaterial);
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 24), buoyMaterial);
  cap.position.y = 2.98;
  cap.castShadow = true;
  group.add(cap);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.3, 12), darkMaterial);
  mast.position.y = 4.25;
  group.add(mast);

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12), lightMaterial);
  lamp.position.y = 5.52;
  group.add(lamp);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3.6, 0.025, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x9be7ff, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.28;
  group.add(halo);

  return {
    name: `Signal ${index + 1}`,
    position,
    group,
    collected: false,
  };
}

function createFloatingDebris() {
  const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5731, roughness: 0.7 });
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0xd2bd8b, roughness: 0.85 });
  const positions = [
    [-24, -36],
    [48, -62],
    [104, 60],
    [-84, 112],
    [10, 112],
  ];
  positions.forEach(([x, z], index) => {
    const crate = new THREE.Group();
    crate.name = 'floating_supply_crate';
    crate.position.set(x, sampleOceanHeight(x, z, 0) + 0.45, z);
    scene.add(crate);

    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 1.35, 2, 1, 2), crateMaterial);
    box.castShadow = true;
    box.receiveShadow = true;
    crate.add(box);

    const strapA = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.76, 0.08), ropeMaterial);
    strapA.position.z = -0.36;
    crate.add(strapA);
    const strapB = strapA.clone();
    strapB.position.z = 0.36;
    crate.add(strapB);
    crate.rotation.y = index * 0.9;
  });
}

function createClouds() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    roughness: 0.9,
    depthWrite: false,
  });
  for (let i = 0; i < 12; i += 1) {
    const group = new THREE.Group();
    const angle = (i / 12) * Math.PI * 2;
    const distance = 460 + (i % 5) * 90;
    group.position.set(Math.cos(angle) * distance, 90 + (i % 4) * 18, Math.sin(angle) * distance);
    group.rotation.y = -angle;
    scene.add(group);

    for (let p = 0; p < 4; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), material);
      puff.scale.set(12 + p * 2, 4 + (p % 2) * 2, 5 + p);
      puff.position.set((p - 2) * 10, Math.sin(p + i) * 3, Math.cos(p) * 4);
      group.add(puff);
    }
  }
}

function createWindStreaks() {
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.32,
  });
  for (let i = 0; i < 36; i += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2.8, 0, 0),
      new THREE.Vector3(2.8, 0, 0),
    ]);
    const line = new THREE.Line(geometry, material.clone());
    const streak = {
      line,
      offset: new THREE.Vector3((Math.random() - 0.5) * 250, 9 + Math.random() * 32, (Math.random() - 0.5) * 250),
      speed: 12 + Math.random() * 22,
    };
    windStreaks.push(streak);
    scene.add(line);
  }
}

function createWakeParticle(position: THREE.Vector3, spread: number) {
  const mesh = wakeMeshPool.pop() ?? new THREE.Mesh(wakeGeometry, wakeMaterial.clone());
  mesh.material.opacity = 0.62;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position);
  mesh.position.y = 0.06;
  mesh.scale.set(1.8 + spread, 2.6 + spread * 1.8, 1);
  scene.add(mesh);
  wakeParticles.push({ mesh, age: 0, life: 2.8 + Math.random() * 0.8 });
}

function getFoamTexture() {
  if (foamTexture) return foamTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.5);
    gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.16)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 120; i += 1) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.18 + Math.random() * 0.42})`;
      ctx.fill();
    }
  }
  foamTexture = new THREE.CanvasTexture(canvas);
  foamTexture.colorSpace = THREE.SRGBColorSpace;
  return foamTexture;
}

function tick() {
  const now = performance.now() * 0.001;
  const rawDelta = now - lastFrameTime;
  lastFrameTime = now;
  const delta = Math.min(rawDelta, 0.05);
  gameTime += delta;
  fpsAccumulator += delta;
  fpsFrames += 1;

  if (fpsAccumulator >= 0.5) {
    measuredFps = Math.round(fpsFrames / fpsAccumulator);
    fpsAccumulator = 0;
    fpsFrames = 0;
  }

  water.material.uniforms.time.value += delta * 0.62;

  updateBoat(delta);
  updateMissions(delta);
  updateWake(delta);
  updateWind(delta);
  updateCamera(delta);
  hudAccumulator += delta;
  if (hudAccumulator >= 0.1) {
    updateHud();
    hudAccumulator = 0;
  }

  renderer.render(scene, camera);
}

function updateBoat(delta: number) {
  const rawThrottle = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 0.7 : 0);
  const rawSteer = (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0) - (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0);
  const boosting = isDown('ShiftLeft') || isDown('ShiftRight');

  throttleValue = THREE.MathUtils.damp(throttleValue, rawThrottle, 6.5, delta);
  steerValue = THREE.MathUtils.damp(steerValue, rawSteer, 8.5, delta);

  const targetAcceleration = boosting ? 24 : 17;
  speed += throttleValue * targetAcceleration * delta;
  if (rawThrottle < 0 && speed > 0) {
    speed -= (18 + speed * 0.42) * delta;
  }
  const drag = rawThrottle === 0 ? 1.6 : 0.58;
  speed -= Math.sign(speed) * Math.min(Math.abs(speed), (drag + Math.abs(speed) * 0.045) * delta);
  speed = THREE.MathUtils.clamp(speed, -8.5, boosting ? 34 : 24);

  const turnPower = THREE.MathUtils.clamp(Math.abs(speed) / 16, 0.22, 1);
  heading += steerValue * turnPower * delta * 1.55;
  displaySpeed = THREE.MathUtils.damp(displaySpeed, Math.abs(speed), 7.5, delta);

  const forward = tmpVector.set(Math.sin(heading), 0, -Math.cos(heading)).normalize();
  const sideDrift = tmpVectorB.copy(windDirection).multiplyScalar(0.22 + Math.abs(speed) * 0.01);
  const velocity = forward.multiplyScalar(speed).add(sideDrift);
  boatBody.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
  physicsWorld.timestep = delta;
  physicsWorld.step();

  const bodyPosition = boatBody.translation();
  const ocean = sampleOcean(bodyPosition.x, bodyPosition.z, gameTime);
  const y = ocean.height + 1.55;
  boatBody.setTranslation({ x: bodyPosition.x, y, z: bodyPosition.z }, true);

  const pitch = THREE.MathUtils.clamp(Math.atan2(ocean.normal.z, ocean.normal.y) * 0.62 - throttleValue * 0.04, -0.22, 0.22);
  const roll = THREE.MathUtils.clamp(-Math.atan2(ocean.normal.x, ocean.normal.y) * 0.72 - steerValue * turnPower * 0.16, -0.32, 0.32);
  yawEuler.set(pitch, heading, roll, 'YXZ');
  tmpQuaternion.setFromEuler(yawEuler);
  boatBody.setRotation(tmpQuaternion, true);

  yacht.position.set(bodyPosition.x, y, bodyPosition.z);
  yacht.quaternion.copy(tmpQuaternion);

  if (yachtVisual) {
    const bob = Math.sin(gameTime * 2.8) * 0.025 + Math.sin(gameTime * 4.1 + 1.7) * 0.015;
    yachtVisual.position.y = bob;
  }

  if (Math.abs(speed) > 3 && gameTime - lastWakeSpawn > 0.09) {
    sternBase.set(0, 0, 9.4).applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(sternBase, Math.abs(speed) * 0.08);
    const side = wakeSideToggle ? sternLeft.set(-1.75, 0, 9.8) : sternRight.set(1.75, 0, 9.8);
    side.applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(side, Math.abs(speed) * 0.045);
    wakeSideToggle = !wakeSideToggle;
    lastWakeSpawn = gameTime;
  }
}

function updateMissions(delta: number) {
  missionSignals.forEach((signal, index) => {
    const pulse = 1 + Math.sin(gameTime * 2.4 + index) * 0.08;
    signal.group.rotation.y += delta * 0.45;
    const oceanY = sampleOceanHeight(signal.position.x, signal.position.z, gameTime);
    signal.group.position.y = oceanY + Math.sin(gameTime * 1.6 + index) * 0.12;
    signal.group.scale.setScalar(signal.collected ? 0.55 : pulse);
    signal.group.visible = !signal.collected || gameTime - Math.floor(gameTime) < 0.45;
  });

  const current = missionSignals[missionIndex];
  if (!current) return;

  const distance = yacht.position.distanceTo(current.position);
  if (distance < 7.4) {
    current.collected = true;
    missionIndex += 1;
    setNotice(missionIndex >= missionSignals.length ? 'Final signal logged. Open water is yours.' : 'Signal logged. Next marker updated.');
  }
}

function updateWake(delta: number) {
  for (let i = wakeParticles.length - 1; i >= 0; i -= 1) {
    const particle = wakeParticles[i];
    particle.age += delta;
    const t = particle.age / particle.life;
    particle.mesh.position.x += windDirection.x * delta * 0.5;
    particle.mesh.position.z += windDirection.z * delta * 0.5;
    particle.mesh.position.y = 0.04 + Math.sin((gameTime + i) * 3) * 0.018;
    particle.mesh.material.opacity = Math.max(0, 0.62 * (1 - t));
    const growth = 1 + delta * (0.9 + Math.abs(speed) * 0.04);
    particle.mesh.scale.x *= growth;
    particle.mesh.scale.y *= growth;
    if (t >= 1) {
      scene.remove(particle.mesh);
      wakeMeshPool.push(particle.mesh);
      wakeParticles.splice(i, 1);
    }
  }
}

function updateWind(delta: number) {
  const boatPos = yacht.position;
  windStreaks.forEach((streak) => {
    streak.offset.addScaledVector(windDirection, streak.speed * delta);
    if (streak.offset.lengthSq() > 240 * 240) {
      streak.offset.set((Math.random() - 0.5) * 210, 10 + Math.random() * 30, (Math.random() - 0.5) * 210);
    }
    streak.line.position.copy(boatPos).add(streak.offset);
    streak.line.position.y = Math.max(streak.line.position.y, 8);
    streak.line.rotation.y = Math.atan2(windDirection.x, windDirection.z) + Math.PI / 2;
    streak.line.material.opacity = 0.12 + 0.22 * Math.sin(gameTime * 0.8 + streak.speed);
  });

  if (notice && hiddenNoticeAt && gameTime > hiddenNoticeAt) {
    notice.classList.add('is-muted');
  }
}

function updateCamera(delta: number) {
  tmpVectorC.copy(cameraOffsets[cameraMode % cameraOffsets.length]).applyQuaternion(yacht.quaternion);
  tmpVectorD.copy(yacht.position).add(tmpVectorC);
  cameraTarget.copy(yacht.position);
  cameraTarget.y += 3.5;
  camera.position.lerp(tmpVectorD, 1 - Math.pow(0.001, delta));
  camera.lookAt(cameraTarget);
}

function updateHud() {
  if (speedText) speedText.textContent = Math.round(displaySpeed * 1.94).toString();
  if (headingText) headingText.textContent = formatHeading(heading);
  if (windText) windText.textContent = windKnots.toString();
  if (fpsText) fpsText.textContent = measuredFps.toString();
  if (progressText) progressText.textContent = `${Math.min(missionIndex, missionSignals.length)}`;
  if (objectiveText) objectiveText.textContent = missionCopy[Math.min(missionIndex, missionCopy.length - 1)];
  if (npcText) npcText.textContent = npcCopy[Math.min(missionIndex, npcCopy.length - 1)];
}

function formatHeading(value: number) {
  const degrees = THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(value), 360);
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(degrees / 45) % names.length];
}

function createInput() {
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyM') {
      void ensureMusic();
    }
    keys[event.code] = true;
    if (event.code === 'KeyM' && !event.repeat) {
      void toggleMusic();
    }
    if (event.code === 'KeyC' && !event.repeat) {
      cameraMode = (cameraMode + 1) % 3;
      setNotice('Camera changed.');
    }
    if (event.code === 'KeyR' && !event.repeat) {
      resetBoat();
      setNotice('Yacht reset to open water.');
    }
  });

  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });

  document.querySelectorAll<HTMLButtonElement>('[data-hold]').forEach((button) => {
    const code = button.dataset.hold;
    if (!code) return;
    const hold = (active: boolean) => {
      keys[code] = active;
      button.classList.toggle('is-active', active);
    };
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      void ensureMusic();
      button.setPointerCapture(event.pointerId);
      hold(true);
    });
    button.addEventListener('pointerup', () => hold(false));
    button.addEventListener('pointercancel', () => hold(false));
    button.addEventListener('lostpointercapture', () => hold(false));
  });

  musicToggle?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    void toggleMusic();
  });

  window.addEventListener('resize', resize);
  setTimeout(() => {
    notice?.classList.add('is-muted');
  }, 8500);
}

async function ensureMusic() {
  if (music || musicStarting) return;
  musicStarting = true;
  try {
    music = new OceanMusic();
    await music.start();
    updateMusicToggle();
  } finally {
    musicStarting = false;
  }
}

async function toggleMusic() {
  if (!music) {
    await ensureMusic();
    setNotice('Soundtrack started.');
    return;
  }
  const isOn = music.toggleMuted();
  updateMusicToggle();
  setNotice(isOn ? 'Soundtrack resumed.' : 'Soundtrack muted.');
}

function updateMusicToggle() {
  if (!musicToggle || !music) return;
  const isOn = music.isOn();
  musicToggle.textContent = isOn ? 'Music on' : 'Music off';
  musicToggle.classList.toggle('is-on', isOn);
}

function isDown(code: string) {
  return keys[code] === true;
}

function resetBoat() {
  speed = 0;
  throttleValue = 0;
  steerValue = 0;
  displaySpeed = 0;
  heading = 0;
  boatBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  boatBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  boatBody.setTranslation({ x: 0, y: 2, z: 20 }, true);
}

function setNotice(message: string) {
  if (!notice) return;
  notice.textContent = message;
  notice.classList.remove('is-muted');
  hiddenNoticeAt = gameTime + 5;
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRenderPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function sampleOceanHeight(x: number, z: number, time: number) {
  const primary = Math.sin((x * 0.052 + z * 0.036) + time * 0.92) * 0.72;
  const cross = Math.sin((x * -0.028 + z * 0.064) + time * 0.62) * 0.46;
  const chop = Math.sin((x * 0.19 + z * -0.14) + time * 1.7) * 0.13;
  return primary + cross + chop;
}

function sampleOcean(x: number, z: number, time: number) {
  const height = sampleOceanHeight(x, z, time);
  const offset = 1.25;
  const hx = sampleOceanHeight(x + offset, z, time) - sampleOceanHeight(x - offset, z, time);
  const hz = sampleOceanHeight(x, z + offset, time) - sampleOceanHeight(x, z - offset, time);
  waveNormal.set(-hx, offset * 2, -hz).normalize();
  return { height, normal: waveNormal };
}

initialize().catch((error) => {
  console.error(error);
  if (loading) {
    loading.innerHTML = '<strong>Ocean failed to initialize</strong>';
  }
});
