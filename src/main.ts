import './styles.css';

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { WEATHER_PRESETS, cloneSeaState, dampSeaState, type WeatherKey } from './sea-config';
import { BOAT_CATALOG, UPGRADE_CATALOG, defaultProgress, loadProgress, saveProgress, upgradeCost, type BoatKey, type UpgradeKey } from './progression';

type KeyMap = Record<string, boolean>;
type PlayerMode = 'helm' | 'swim';

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

type FishAgent = {
  radius: number;
  speed: number;
  phase: number;
  height: number;
};

const gameRoot = document.querySelector<HTMLElement>('#game-root');
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
const modeToggle = document.querySelector<HTMLButtonElement>('[data-mode-toggle]');
const modeText = document.querySelector<HTMLElement>('[data-mode]');
const depthText = document.querySelector<HTMLElement>('[data-depth]');
const airText = document.querySelector<HTMLElement>('[data-air]');
const airStatus = document.querySelector<HTMLElement>('.air-status');
const weatherButtons = document.querySelectorAll<HTMLButtonElement>('[data-weather]');
const creditsText = document.querySelector<HTMLElement>('[data-credits]');
const harbor = document.querySelector<HTMLElement>('[data-harbor]');
const harborCredits = document.querySelector<HTMLElement>('[data-harbor-credits]');
const rewardText = document.querySelector<HTMLElement>('[data-reward]');
const expeditionsText = document.querySelector<HTMLElement>('[data-expeditions]');
const upgradeList = document.querySelector<HTMLElement>('[data-upgrade-list]');
const fleetList = document.querySelector<HTMLElement>('[data-fleet-list]');
const nextExpeditionButton = document.querySelector<HTMLButtonElement>('[data-next-expedition]');
const contractTitle = document.querySelector<HTMLElement>('[data-contract-title]');
const pauseToggle = document.querySelector<HTMLButtonElement>('[data-pause-toggle]');
const pauseMenu = document.querySelector<HTMLElement>('[data-pause-menu]');
const resumeButton = document.querySelector<HTMLButtonElement>('[data-resume]');
const qualityButtons = document.querySelectorAll<HTMLButtonElement>('[data-quality]');

if (!gameRoot || !host) {
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
const tmpVectorF = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();
const waveNormal = new THREE.Vector3();
const yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const cameraTarget = new THREE.Vector3();
const sternBase = new THREE.Vector3();
const sternLeft = new THREE.Vector3();
const sternRight = new THREE.Vector3();
const cameraOffsets = [
  new THREE.Vector3(0, 10.5, 32),
  new THREE.Vector3(0, 21, 49),
  new THREE.Vector3(25, 11, 24),
];
const marinaPosition = new THREE.Vector3(0, 0, 28);

let water: InstanceType<typeof Water>;
let underwaterSurface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
let sky: InstanceType<typeof Sky>;
let sun = new THREE.Vector3();
let pmremTarget: THREE.WebGLRenderTarget | undefined;
let hemisphereLight: THREE.HemisphereLight;
let sunLight: THREE.DirectionalLight;
let underwaterLight: THREE.PointLight;
let sunGlow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
let physicsWorld: RAPIER.World;
let boatBody: RAPIER.RigidBody;
let swimmerBody: RAPIER.RigidBody;
let yacht: THREE.Group;
let yachtVisual: THREE.Object3D | undefined;
let swimmer: THREE.Group;
let swimmerVisual: THREE.Object3D | undefined;
let swimmerLeftLeg: THREE.Object3D | undefined;
let swimmerRightLeg: THREE.Object3D | undefined;
let swimmerLeftArm: THREE.Object3D | undefined;
let swimmerRightArm: THREE.Object3D | undefined;
let recoveryBeacon: THREE.Group;
let bubblePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
let bubblePositions = new Float32Array(0);
let rainLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
let rainPositions = new Float32Array(0);
let cloudMaterial: THREE.SpriteMaterial;
let causticMaterial: THREE.ShaderMaterial | undefined;
let causticsMesh: THREE.Mesh | undefined;
let fishSchool: THREE.InstancedMesh | undefined;
let fishAgents: FishAgent[] = [];
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
let playerMode: PlayerMode = 'helm';
let swimYaw = 0;
let swimSpeed = 0;
let oxygen = 100;
let cameraUnderwater = false;
let lightningFlash = 0;
let nextLightningAt = 7;
let weatherKey: WeatherKey = 'bluewater';
let currentSea = cloneSeaState(WEATHER_PRESETS.bluewater);
let targetSea = cloneSeaState(WEATHER_PRESETS.bluewater);
const progress = loadProgress();
let expeditionComplete = false;
let rewardGranted = false;
let awaitingHarbor = false;
let awaitingDiveRecovery = false;
let gamepadThrottle = 0;
let gamepadSteer = 0;
let gamepadBoost = false;
let gamepadVertical = 0;
let gamepadConnected = false;
let previousGamepadButtons: boolean[] = [];
let renderScale = maxRenderPixelRatio;
let qualityCheckAt = 8;
let isPaused = false;
let manualQuality = false;
const expeditionContracts: Array<{ name: string; reward: number; weather: WeatherKey; briefing: string }> = [
  { name: 'Bluewater Survey', reward: 850, weather: 'bluewater', briefing: 'Chart the outer markers and recover the lost research beacon.' },
  { name: 'Storm Relay', reward: 1150, weather: 'storm', briefing: 'Restore the navigation relay before the storm closes the channel.' },
  { name: 'Golden Reef Research', reward: 1000, weather: 'calm', briefing: 'Document the reef route and retrieve its deep-water sensor.' },
];
let activeContractIndex = progress.expeditions % expeditionContracts.length;

const windDirection = new THREE.Vector3(0.58, 0, -0.82).normalize();
const currentWaterColor = new THREE.Color(WEATHER_PRESETS.bluewater.waterColor);
const currentFogColor = new THREE.Color(WEATHER_PRESETS.bluewater.fogColor);
const currentCloudColor = new THREE.Color(WEATHER_PRESETS.bluewater.cloudColor);
const underwaterBackground = new THREE.Color(0x073744);
const waterWaveUniforms = {
  uWaveTime: { value: 0 },
  uPrimaryWave: {
    value: new THREE.Vector4(
      currentSea.primaryFrequencyX,
      currentSea.primaryFrequencyZ,
      currentSea.primaryAmplitude,
      currentSea.primarySpeed,
    ),
  },
  uCrossWave: {
    value: new THREE.Vector4(
      currentSea.crossFrequencyX,
      currentSea.crossFrequencyZ,
      currentSea.crossAmplitude,
      currentSea.crossSpeed,
    ),
  },
  uChopWave: {
    value: new THREE.Vector4(
      currentSea.chopFrequencyX,
      currentSea.chopFrequencyZ,
      currentSea.chopAmplitude,
      currentSea.chopSpeed,
    ),
  },
};
const wakeParticles: WakeParticle[] = [];
const wakeMeshPool: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = [];
const windStreaks: WindStreak[] = [];
const missionSignals: MissionSignal[] = [];
const surfaceOnlyObjects: THREE.Object3D[] = [];
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
  private ambienceFilter: BiquadFilterNode;
  private windGain: GainNode;
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
    this.ambienceFilter = this.context.createBiquadFilter();
    this.ambienceFilter.type = 'lowpass';
    this.ambienceFilter.frequency.value = 18000;
    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0.025;

    this.delay = this.context.createDelay(1.2);
    this.delay.delayTime.value = 0.34;
    this.delayFeedback = this.context.createGain();
    this.delayFeedback.gain.value = 0.22;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.master);
    this.master.connect(this.ambienceFilter);
    this.ambienceFilter.connect(this.context.destination);
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

  setEnvironment(submerged: boolean, stormAmount: number) {
    const now = this.context.currentTime;
    const cutoff = submerged ? 720 : 18000 - stormAmount * 5200;
    this.ambienceFilter.frequency.setTargetAtTime(cutoff, now, 0.32);
    this.windGain.gain.setTargetAtTime(0.018 + stormAmount * 0.052, now, 0.5);
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
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.42;
    source.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.master);
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
  const qaMode = location.hostname === 'localhost' ? new URLSearchParams(location.search).get('qa') : null;
  if (qaMode === 'reset') {
    Object.assign(progress, defaultProgress());
    saveProgress(progress);
  }
  await RAPIER.init();
  physicsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
  physicsWorld.timestep = 1 / 60;

  createLighting();
  await createOceanAndSky();
  createWorld();
  await createYacht();
  await createSwimmer();
  createPhysics();
  createInput();
  selectWeather(expeditionContracts[activeContractIndex].weather, false);
  updateHud();

  if (qaMode === 'harbor' || qaMode === 'fleet') {
    progress.credits = Math.max(progress.credits, qaMode === 'fleet' ? 2500 : expeditionContracts[activeContractIndex].reward);
    rewardGranted = true;
    expeditionComplete = true;
    renderHarbor();
    harbor?.classList.add('is-open');
    harbor?.setAttribute('aria-hidden', 'false');
  } else if (qaMode === 'dive') {
    missionIndex = missionSignals.length;
    missionSignals.forEach((signal) => { signal.collected = true; });
    awaitingDiveRecovery = true;
    const diveStart = recoveryBeacon.position.clone().add(new THREE.Vector3(0, 2.2, 10));
    yacht.position.set(diveStart.x, sampleOceanHeight(diveStart.x, diveStart.z, gameTime), diveStart.z);
    boatBody.setTranslation({ x: yacht.position.x, y: yacht.position.y, z: yacht.position.z }, true);
    enterSwimMode();
    swimmer.position.copy(diveStart);
    swimmerBody.setTranslation({ x: diveStart.x, y: diveStart.y, z: diveStart.z }, true);
  }

  loading?.classList.add('is-hidden');
  renderer.setAnimationLoop(tick);
}

function createLighting() {
  hemisphereLight = new THREE.HemisphereLight(0xb7e8ff, 0x0a283b, 1.2);
  scene.add(hemisphereLight);

  sunLight = new THREE.DirectionalLight(0xfff2ce, 4.2);
  sunLight.position.set(-70, 130, -80);
  scene.add(sunLight);

  underwaterLight = new THREE.PointLight(0x6de6e1, 0, 54, 1.5);
  scene.add(underwaterLight);

  sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(4.5, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe09b, transparent: true, opacity: 0.9 }),
  );
  sunGlow.name = 'visible_sun';
  sunGlow.position.set(-190, 240, -410);
  scene.add(sunGlow);
}

async function createOceanAndSky() {
  const waterNormals = await loadWaterNormals();
  const waterGeometry = new THREE.PlaneGeometry(4000, 4000, 192, 192);

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
  water.material.side = THREE.DoubleSide;
  water.material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waterWaveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWaveTime;
        uniform vec4 uPrimaryWave;
        uniform vec4 uCrossWave;
        uniform vec4 uChopWave;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        float worldZ = -position.y;
        transformed.z += sin(position.x * uPrimaryWave.x + worldZ * uPrimaryWave.y + uWaveTime * uPrimaryWave.w) * uPrimaryWave.z;
        transformed.z += sin(position.x * uCrossWave.x + worldZ * uCrossWave.y + uWaveTime * uCrossWave.w) * uCrossWave.z;
        transformed.z += sin(position.x * uChopWave.x + worldZ * uChopWave.y + uWaveTime * uChopWave.w) * uChopWave.z;`,
      );
  };
  water.material.needsUpdate = true;
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

  const underwaterSurfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b8493,
    transparent: true,
    opacity: 0.76,
    roughness: 0.28,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
  });
  underwaterSurfaceMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waterWaveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWaveTime;
        uniform vec4 uPrimaryWave;
        uniform vec4 uCrossWave;
        uniform vec4 uChopWave;`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        float worldZ = -position.y;
        transformed.z += sin(position.x * uPrimaryWave.x + worldZ * uPrimaryWave.y + uWaveTime * uPrimaryWave.w) * uPrimaryWave.z;
        transformed.z += sin(position.x * uCrossWave.x + worldZ * uCrossWave.y + uWaveTime * uCrossWave.w) * uCrossWave.z;
        transformed.z += sin(position.x * uChopWave.x + worldZ * uChopWave.y + uWaveTime * uChopWave.w) * uChopWave.z;`,
      );
  };
  underwaterSurface = new THREE.Mesh(waterGeometry.clone(), underwaterSurfaceMaterial);
  underwaterSurface.name = 'underwater_wave_ceiling';
  underwaterSurface.rotation.x = -Math.PI / 2;
  underwaterSurface.position.y = 0.025;
  underwaterSurface.visible = false;
  underwaterSurface.renderOrder = 2;
  scene.add(underwaterSurface);

  sky = new Sky();
  sky.name = 'physical_sky';
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = currentSea.turbidity;
  skyUniforms.rayleigh.value = currentSea.rayleigh;
  skyUniforms.mieCoefficient.value = currentSea.mieCoefficient;
  skyUniforms.mieDirectionalG.value = currentSea.mieDirectionalG;
  if (skyUniforms.cloudCoverage) skyUniforms.cloudCoverage.value = 0.28;
  if (skyUniforms.cloudDensity) skyUniforms.cloudDensity.value = 0.35;
  if (skyUniforms.cloudElevation) skyUniforms.cloudElevation.value = 0.42;

  setSun(currentSea.sunElevation, currentSea.sunAzimuth);

  createClouds();
  createWindStreaks();
  createStormRain();
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
  sunGlow.position.copy(sun).multiplyScalar(620);
  sunLight.position.copy(sun).multiplyScalar(500);

  if (pmremTarget) {
    pmremTarget.dispose();
  }
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const skyWasVisible = sky.visible;
  sky.visible = true;
  envScene.add(sky);
  pmremTarget = pmremGenerator.fromScene(envScene);
  scene.environment = pmremTarget.texture;
  scene.add(sky);
  sky.visible = skyWasVisible;
  pmremGenerator.dispose();
}

async function createYacht() {
  yacht = new THREE.Group();
  yacht.name = 'player_yacht';
  scene.add(yacht);

  await loadActiveYacht();
}

async function loadActiveYacht() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(BOAT_CATALOG[progress.activeBoat].model);
  const nextVisual = gltf.scene;
  nextVisual.name = `blender_${progress.activeBoat}_yacht`;
  if (yachtVisual) yacht.remove(yachtVisual);
  yachtVisual = nextVisual;
  yachtVisual.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material instanceof THREE.MeshStandardMaterial) {
        node.material.envMapIntensity = 1.15;
      }
    }
  });
  yachtVisual.rotation.y = Math.PI;
  if (progress.activeBoat === 'voyager') yachtVisual.scale.setScalar(1.08);
  yacht.add(yachtVisual);
}

async function createSwimmer() {
  swimmer = new THREE.Group();
  swimmer.name = 'player_diver';
  swimmer.visible = false;
  scene.add(swimmer);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/explorer_diver.glb');
  swimmerVisual = gltf.scene;
  swimmerVisual.name = 'blender_explorer_diver';
  swimmerVisual.rotation.y = Math.PI;
  swimmerVisual.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
      node.material.envMapIntensity = 0.72;
    }
  });
  swimmer.add(swimmerVisual);
  swimmerLeftLeg = swimmerVisual.getObjectByName('diver_left_leg');
  swimmerRightLeg = swimmerVisual.getObjectByName('diver_right_leg');
  swimmerLeftArm = swimmerVisual.getObjectByName('diver_left_arm');
  swimmerRightArm = swimmerVisual.getObjectByName('diver_right_arm');
  createBubbleField();
}

function createPhysics() {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 0.2, 20)
    .setLinearDamping(0.9)
    .setAngularDamping(4.5)
    .setCanSleep(false)
    .enabledRotations(false, true, false);

  boatBody = physicsWorld.createRigidBody(bodyDesc);
  const hullCollider = RAPIER.ColliderDesc.cuboid(3.35, 1.7, 13.5)
    .setFriction(0.22)
    .setRestitution(0.02)
    .setDensity(1.15);
  physicsWorld.createCollider(hullCollider, boatBody);

  swimmerBody = physicsWorld.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0),
  );
  physicsWorld.createCollider(RAPIER.ColliderDesc.capsule(0.62, 0.32).setSensor(true), swimmerBody);

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
  createMarina();
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
  createUnderwaterWorld();
  createRecoveryBeacon();
}

function createRecoveryBeacon() {
  recoveryBeacon = new THREE.Group();
  recoveryBeacon.name = 'sunken_research_beacon';
  const target = missionSignals[missionSignals.length - 1].position;
  recoveryBeacon.position.set(target.x + 7, seabedHeight(target.x + 7, target.z - 4) + 1.2, target.z - 4);
  scene.add(recoveryBeacon);

  const metal = new THREE.MeshStandardMaterial({ color: 0xd6e2e5, metalness: 0.72, roughness: 0.28 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe2a936, metalness: 0.42, roughness: 0.38 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x85f5ff, emissive: 0x2adceb, emissiveIntensity: 4, roughness: 0.16 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 0.7, 18), yellow);
  base.position.y = 0.35;
  recoveryBeacon.add(base);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.82, 2.8, 16), metal);
  core.position.y = 1.85;
  core.rotation.z = 0.12;
  recoveryBeacon.add(core);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), glow);
  lamp.position.y = 3.45;
  recoveryBeacon.add(lamp);
  const scanRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.045, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x74eef4, transparent: true, opacity: 0.64, depthWrite: false }),
  );
  scanRing.rotation.x = Math.PI / 2;
  scanRing.position.y = 1.5;
  recoveryBeacon.add(scanRing);
  recoveryBeacon.userData.scanRing = scanRing;
}

function createMarina() {
  const marina = new THREE.Group();
  marina.name = 'aurora_marina';
  marina.position.copy(marinaPosition);
  scene.add(marina);

  const pierMaterial = new THREE.MeshStandardMaterial({ color: 0x8d6844, roughness: 0.72, metalness: 0.04 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xe7edf0, roughness: 0.36, metalness: 0.15 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x155c6d, roughness: 0.38, metalness: 0.2 });
  const glowMaterial = new THREE.MeshStandardMaterial({ color: 0xffe5a3, emissive: 0xffb64d, emissiveIntensity: 3 });

  [-8.5, 8.5].forEach((x) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 34), pierMaterial);
    pier.position.set(x, 0.45, 0);
    marina.add(pier);
    for (let z = -15; z <= 15; z += 6) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.2, 10), trimMaterial);
      post.position.set(x + Math.sign(x) * 1.15, -0.8, z);
      marina.add(post);
    }
  });

  const office = new THREE.Mesh(new THREE.BoxGeometry(12, 4.6, 7), trimMaterial);
  office.position.set(-18, 3.05, 7);
  marina.add(office);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.7, 8.2), roofMaterial);
  roof.position.set(-18, 5.65, 7);
  marina.add(roof);

  const arch = new THREE.Group();
  arch.position.z = -17;
  [-5.2, 5.2].forEach((x) => {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 7.2, 14), trimMaterial);
    column.position.set(x, 3.2, 0);
    arch.add(column);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), glowMaterial);
    lamp.position.set(x, 6.9, 0);
    arch.add(lamp);
  });
  const header = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.7, 0.7), roofMaterial);
  header.position.y = 6.35;
  arch.add(header);
  marina.add(arch);

  const dockRing = new THREE.Mesh(
    new THREE.RingGeometry(13, 15, 64),
    new THREE.MeshBasicMaterial({ color: 0x7eeaf1, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
  );
  dockRing.rotation.x = -Math.PI / 2;
  dockRing.position.set(0, 0.18, -3);
  marina.add(dockRing);
  surfaceOnlyObjects.push(dockRing);
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
  surfaceOnlyObjects.push(foamRing);

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
  surfaceOnlyObjects.push(halo);

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

function createUnderwaterWorld() {
  const seabedGeometry = new THREE.PlaneGeometry(3200, 3200, 128, 128);
  const positions = seabedGeometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getY(index);
    positions.setZ(index, seabedHeight(x, z) + 18);
  }
  seabedGeometry.computeVertexNormals();
  const seabed = new THREE.Mesh(
    seabedGeometry,
    new THREE.MeshStandardMaterial({ color: 0x486e68, roughness: 0.92, metalness: 0 }),
  );
  seabed.name = 'explorable_seabed';
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = -18;
  seabed.receiveShadow = true;
  scene.add(seabed);

  causticMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpacity;
      void main() {
        vec2 p = vUv * 180.0;
        float a = sin(p.x + uTime * 1.6) + sin(p.y * 1.14 - uTime * 1.1);
        float b = sin((p.x + p.y) * 0.72 + uTime * 1.35);
        float bands = smoothstep(1.46, 1.9, a + b);
        gl_FragColor = vec4(0.2, 0.78, 0.72, bands * uOpacity);
      }
    `,
  });
  const causticGeometry = seabedGeometry.clone();
  const causticPositions = causticGeometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < causticPositions.count; index += 1) {
    causticPositions.setZ(index, causticPositions.getZ(index) + 0.045);
  }
  causticsMesh = new THREE.Mesh(causticGeometry, causticMaterial);
  causticsMesh.name = 'animated_underwater_caustics';
  causticsMesh.rotation.x = -Math.PI / 2;
  causticsMesh.position.y = -18;
  causticsMesh.visible = false;
  scene.add(causticsMesh);

  const kelpGeometry = new THREE.ConeGeometry(0.16, 2.7, 5, 2);
  const kelp = new THREE.InstancedMesh(
    kelpGeometry,
    new THREE.MeshStandardMaterial({ color: 0x176b57, roughness: 0.78, side: THREE.DoubleSide }),
    76,
  );
  kelp.name = 'kelp_field';
  const coral = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0xd17863, roughness: 0.72 }),
    42,
  );
  coral.name = 'reef_coral';
  const rocks = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x334c4e, roughness: 0.94 }),
    50,
  );
  rocks.name = 'seabed_rocks';

  for (let index = 0; index < 76; index += 1) {
    const x = Math.sin(index * 12.9898) * 92 + Math.sin(index * 2.3) * 28;
    const z = 20 + Math.cos(index * 9.133) * 94 + Math.cos(index * 1.7) * 25;
    const height = 0.68 + ((index * 17) % 11) / 15;
    tmpMatrix.compose(
      tmpVector.set(x, seabedHeight(x, z) + 1.35 * height, z),
      tmpQuaternion.setFromAxisAngle(tmpVectorB.set(0, 1, 0), index * 1.7),
      tmpVectorC.set(0.72 + (index % 5) * 0.08, height, 0.72 + (index % 3) * 0.1),
    );
    kelp.setMatrixAt(index, tmpMatrix);
  }
  kelp.instanceMatrix.needsUpdate = true;

  for (let index = 0; index < 42; index += 1) {
    const x = Math.sin(index * 5.47) * 84;
    const z = 20 + Math.cos(index * 7.31) * 86;
    const scale = 0.6 + (index % 7) * 0.12;
    tmpMatrix.compose(
      tmpVector.set(x, seabedHeight(x, z) + scale * 0.42, z),
      tmpQuaternion.setFromEuler(yawEuler.set(index * 0.3, index * 0.9, index * 0.18)),
      tmpVectorB.set(scale, scale * (0.7 + (index % 3) * 0.2), scale),
    );
    coral.setMatrixAt(index, tmpMatrix);
  }
  coral.instanceMatrix.needsUpdate = true;

  for (let index = 0; index < 50; index += 1) {
    const x = Math.sin(index * 3.17) * 118;
    const z = 20 + Math.cos(index * 4.91) * 120;
    const scale = 0.55 + (index % 9) * 0.17;
    tmpMatrix.compose(
      tmpVector.set(x, seabedHeight(x, z) + scale * 0.38, z),
      tmpQuaternion.setFromEuler(yawEuler.set(index * 0.6, index * 0.36, index * 0.24)),
      tmpVectorB.set(scale * 1.35, scale * 0.65, scale),
    );
    rocks.setMatrixAt(index, tmpMatrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(kelp, coral, rocks);

  const fishGeometry = new THREE.ConeGeometry(0.26, 0.9, 6);
  fishGeometry.rotateZ(Math.PI / 2);
  fishSchool = new THREE.InstancedMesh(
    fishGeometry,
    new THREE.MeshStandardMaterial({ color: 0x79d8d0, roughness: 0.42, metalness: 0.05 }),
    28,
  );
  fishSchool.name = 'reef_fish_school';
  fishAgents = Array.from({ length: 28 }, (_, index) => ({
    radius: 18 + (index % 8) * 5.2,
    speed: 0.11 + (index % 5) * 0.018,
    phase: index * 0.87,
    height: -7.5 - (index % 6) * 1.2,
  }));
  scene.add(fishSchool);
}

function createBubbleField() {
  const count = 72;
  bubblePositions = new Float32Array(count * 3);
  bubblePositions.fill(-1000);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(13, 11, 2, 16, 16, 14);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.28, 'rgba(184,245,255,0.45)');
    gradient.addColorStop(0.72, 'rgba(91,210,231,0.12)');
    gradient.addColorStop(1, 'rgba(91,210,231,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  bubblePoints = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: texture,
      color: 0xc8f7ff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      size: 0.24,
      sizeAttenuation: true,
    }),
  );
  bubblePoints.name = 'diver_bubbles';
  bubblePoints.visible = false;
  scene.add(bubblePoints);
}

function createStormRain() {
  const count = 320;
  rainPositions = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainLines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xc5e9f3, transparent: true, opacity: 0, depthWrite: false }),
  );
  rainLines.name = 'storm_rain';
  rainLines.visible = false;
  scene.add(rainLines);
  for (let index = 0; index < count; index += 1) resetRainDrop(index, true);
}

function createClouds() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 22; index += 1) {
      const x = 28 + ((index * 47) % 202);
      const y = 45 + Math.sin(index * 1.73) * 22;
      const radius = 20 + (index % 6) * 7;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.72)');
      gradient.addColorStop(0.48, 'rgba(255,255,255,0.42)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cloudMaterial = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: currentSea.cloudOpacity,
    depthWrite: false,
  });
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const distance = 300 + (i % 5) * 74;
    const cloud = new THREE.Sprite(cloudMaterial);
    cloud.name = 'weather_cloud';
    cloud.position.set(Math.cos(angle) * distance, 78 + (i % 4) * 17, Math.sin(angle) * distance);
    cloud.scale.set(150 + (i % 4) * 34, 58 + (i % 3) * 13, 1);
    scene.add(cloud);
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

  if (isPaused) {
    renderer.render(scene, camera);
    return;
  }

  updateGamepad();
  updateAdaptiveQuality();
  updateWeather(delta);
  water.material.uniforms.time.value += delta * currentSea.waterSpeed;

  updateBoat(delta);
  updateSwimmer(delta);
  updateUnderwaterWorld(delta);
  updateMissions(delta);
  updateWake(delta);
  updateWind(delta);
  updateCamera(delta);
  updateRain(delta);
  updateEnvironment();
  hudAccumulator += delta;
  if (hudAccumulator >= 0.1) {
    updateHud();
    hudAccumulator = 0;
  }

  renderer.render(scene, camera);
}

function updateBoat(delta: number) {
  const helmActive = playerMode === 'helm';
  const keyboardThrottle = helmActive
    ? (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 0.72 : 0)
    : 0;
  const keyboardSteer = helmActive
    ? (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0) - (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0)
    : 0;
  const rawThrottle = Math.abs(keyboardThrottle) > 0.01 ? keyboardThrottle : gamepadThrottle;
  const rawSteer = Math.abs(keyboardSteer) > 0.01 ? keyboardSteer : gamepadSteer;
  const boosting = helmActive && (isDown('ShiftLeft') || isDown('ShiftRight') || gamepadBoost);

  throttleValue = THREE.MathUtils.damp(throttleValue, rawThrottle, 6.5, delta);
  steerValue = THREE.MathUtils.damp(steerValue, rawSteer, 8.5, delta);

  const engineMultiplier = 1 + progress.upgrades.engine * 0.08;
  const boatStats = BOAT_CATALOG[progress.activeBoat];
  const targetAcceleration = (boosting ? 25 : 18) * engineMultiplier * boatStats.speed;
  speed += throttleValue * targetAcceleration * delta;
  if (rawThrottle < 0 && speed > 0) {
    speed -= (18 + speed * 0.42) * delta;
  }
  const weatherDrag = 1 + currentSea.rain * 0.24;
  const drag = (rawThrottle === 0 ? 1.45 : 0.54) * weatherDrag;
  speed -= Math.sign(speed) * Math.min(Math.abs(speed), (drag + Math.abs(speed) * 0.042) * delta);
  const stormPenalty = currentSea.rain * Math.max(0.03, 0.14 - progress.upgrades.hull * 0.035);
  const forwardLimit = (boosting ? 32 : 23) * engineMultiplier * boatStats.speed * (1 - stormPenalty);
  speed = THREE.MathUtils.clamp(speed, -8.5, forwardLimit);

  const turnPower = THREE.MathUtils.clamp(Math.abs(speed) / 16, 0.22, 1);
  heading += steerValue * turnPower * delta * 1.55 * boatStats.handling;
  displaySpeed = THREE.MathUtils.damp(displaySpeed, Math.abs(speed), 7.5, delta);

  const forward = tmpVector.set(Math.sin(heading), 0, -Math.cos(heading)).normalize();
  const sideDrift = tmpVectorB
    .copy(windDirection)
    .multiplyScalar((0.08 + currentSea.windKnots * 0.01) * (1 + Math.abs(speed) * 0.012));
  const velocity = forward.multiplyScalar(speed).add(sideDrift);
  boatBody.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
  physicsWorld.timestep = delta;
  physicsWorld.step();

  const bodyPosition = boatBody.translation();
  const ocean = sampleOcean(bodyPosition.x, bodyPosition.z, gameTime);
  const y = ocean.height + 0.18;
  boatBody.setTranslation({ x: bodyPosition.x, y, z: bodyPosition.z }, true);

  const pitch = THREE.MathUtils.clamp(
    Math.atan2(ocean.normal.z, ocean.normal.y) * 0.76 - throttleValue * 0.035,
    -0.42,
    0.42,
  );
  const roll = THREE.MathUtils.clamp(
    -Math.atan2(ocean.normal.x, ocean.normal.y) * 0.88 - steerValue * turnPower * 0.15,
    -0.52,
    0.52,
  );
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
    sternBase.set(0, 0, 15.4).applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(sternBase, Math.abs(speed) * 0.08);
    const side = wakeSideToggle ? sternLeft.set(-2.25, 0, 15.8) : sternRight.set(2.25, 0, 15.8);
    side.applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(side, Math.abs(speed) * 0.045);
    wakeSideToggle = !wakeSideToggle;
    lastWakeSpawn = gameTime;
  }
}

function updateSwimmer(delta: number) {
  if (playerMode !== 'swim') return;

  const keyboardForward = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 0.65 : 0);
  const keyboardTurn = (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0) - (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0);
  const forwardInput = Math.abs(keyboardForward) > 0.01 ? keyboardForward : gamepadThrottle;
  const turnInput = Math.abs(keyboardTurn) > 0.01 ? keyboardTurn : gamepadSteer;
  const keyboardVertical = (isDown('Space') ? 1 : 0) - (isDown('ControlLeft') || isDown('ControlRight') ? 1 : 0);
  const verticalInput = Math.abs(keyboardVertical) > 0.01 ? keyboardVertical : gamepadVertical;
  const boosting = isDown('ShiftLeft') || isDown('ShiftRight') || gamepadBoost;
  const targetSwimSpeed = forwardInput * (boosting ? 7.2 : 4.4);

  swimYaw += turnInput * delta * (boosting ? 1.55 : 1.2);
  swimSpeed = THREE.MathUtils.damp(swimSpeed, targetSwimSpeed, 4.8, delta);
  const forward = tmpVectorF.set(Math.sin(swimYaw), 0, -Math.cos(swimYaw));
  swimmer.position.addScaledVector(forward, swimSpeed * delta);
  swimmer.position.y += verticalInput * (boosting ? 4.8 : 3.1) * delta;

  const surface = sampleOceanHeight(swimmer.position.x, swimmer.position.z, gameTime);
  const floor = seabedHeight(swimmer.position.x, swimmer.position.z) + 1.05;
  swimmer.position.y = THREE.MathUtils.clamp(swimmer.position.y, floor, surface + 0.15);
  const depth = Math.max(0, surface - swimmer.position.y);
  const airDrain = 0.82 / (1 + progress.upgrades.tank * 0.25);
  oxygen = THREE.MathUtils.clamp(oxygen + (depth < 0.35 ? 14 : -airDrain) * delta, 0, 100);

  swimmer.rotation.set(-verticalInput * 0.2, swimYaw, -turnInput * 0.12, 'YXZ');
  const kick = Math.sin(gameTime * (boosting ? 9 : 6.5)) * Math.min(1, Math.abs(swimSpeed) / 3.2);
  animateSwimmerPart(swimmerLeftLeg, kick * 0.2);
  animateSwimmerPart(swimmerRightLeg, -kick * 0.2);
  animateSwimmerPart(swimmerLeftArm, -kick * 0.08);
  animateSwimmerPart(swimmerRightArm, kick * 0.08);
  swimmerBody.setTranslation(
    { x: swimmer.position.x, y: swimmer.position.y, z: swimmer.position.z },
    true,
  );

  if (oxygen <= 0.01) {
    returnToHelm('Mara recovered the diver. Air supply restored.');
  }
}

function animateSwimmerPart(part: THREE.Object3D | undefined, offset: number) {
  if (!part) return;
  if (typeof part.userData.baseSwimRotation !== 'number') {
    part.userData.baseSwimRotation = part.rotation.y;
  }
  part.rotation.y = part.userData.baseSwimRotation + offset;
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

  if (recoveryBeacon) {
    const ring = recoveryBeacon.userData.scanRing as THREE.Mesh | undefined;
    if (ring) {
      ring.rotation.z += delta * 0.65;
      ring.scale.setScalar(1 + Math.sin(gameTime * 2.2) * 0.12);
    }
  }

  const current = missionSignals[missionIndex];
  if (!current) {
    if (awaitingDiveRecovery && playerMode === 'swim') {
      const distance = swimmer.position.distanceTo(recoveryBeacon.position);
      if (distance < 4.2) {
        awaitingDiveRecovery = false;
        awaitingHarbor = true;
        recoveryBeacon.visible = false;
        setNotice('Research beacon secured. Board Aurora and return to the marina.');
      }
    }
    if (awaitingHarbor && playerMode === 'helm') {
      const distance = yacht.position.distanceTo(marinaPosition);
      if (distance < 18 && Math.abs(speed) < 4.2) completeExpedition();
    }
    return;
  }

  const activePosition = playerMode === 'helm' ? yacht.position : swimmer.position;
  const distance = Math.hypot(activePosition.x - current.position.x, activePosition.z - current.position.z);
  if (distance < 7.4) {
    current.collected = true;
    missionIndex += 1;
    if (missionIndex >= missionSignals.length) {
      awaitingDiveRecovery = true;
      setNotice('Final signal found. Dive below and recover the research beacon.');
    } else {
      setNotice('Signal logged. Next marker updated.');
    }
  }
}

function completeExpedition() {
  if (expeditionComplete) return;
  expeditionComplete = true;
  awaitingHarbor = false;
  awaitingDiveRecovery = false;
  speed = 0;
  throttleValue = 0;
  if (!rewardGranted) {
    progress.credits += expeditionContracts[activeContractIndex].reward;
    progress.expeditions += 1;
    rewardGranted = true;
    saveProgress(progress);
  }
  renderHarbor();
  harbor?.classList.add('is-open');
  harbor?.setAttribute('aria-hidden', 'false');
  setNotice(`Expedition complete. ${expeditionContracts[activeContractIndex].reward} credits awarded.`);
}

function renderHarbor() {
  const contract = expeditionContracts[activeContractIndex];
  if (creditsText) creditsText.textContent = progress.credits.toString();
  if (harborCredits) harborCredits.textContent = progress.credits.toString();
  if (rewardText) rewardText.textContent = rewardGranted ? contract.reward.toString() : '0';
  if (contractTitle) contractTitle.textContent = contract.name;
  if (expeditionsText) expeditionsText.textContent = `${progress.expeditions} expedition${progress.expeditions === 1 ? '' : 's'} completed`;
  renderFleet();
  if (!upgradeList) return;
  upgradeList.replaceChildren();
  (Object.keys(UPGRADE_CATALOG) as UpgradeKey[]).forEach((key) => {
    const item = UPGRADE_CATALOG[key];
    const level = progress.upgrades[key];
    const cost = upgradeCost(key, level);
    const maxed = level >= item.maxLevel;
    const article = document.createElement('article');
    article.className = 'upgrade';
    article.innerHTML = `<div><span>${item.name}</span><strong>${item.description}</strong></div><div class="upgrade__level" aria-label="Level ${level} of ${item.maxLevel}">${Array.from({ length: item.maxLevel }, (_, index) => `<i class="${index < level ? 'is-filled' : ''}"></i>`).join('')}</div>`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.upgrade = key;
    button.disabled = maxed || progress.credits < cost;
    button.textContent = maxed ? 'Max level' : `${cost} credits`;
    button.addEventListener('click', () => purchaseUpgrade(key));
    article.append(button);
    upgradeList.append(article);
  });
}

function renderFleet() {
  if (!fleetList) return;
  fleetList.replaceChildren();
  (Object.keys(BOAT_CATALOG) as BoatKey[]).forEach((key) => {
    const boat = BOAT_CATALOG[key];
    const owned = progress.ownedBoats.includes(key);
    const active = progress.activeBoat === key;
    const article = document.createElement('article');
    article.className = `fleet-boat${active ? ' is-active' : ''}`;
    article.innerHTML = `<div class="fleet-boat__silhouette" data-boat-silhouette="${key}"><span>${key === 'aurora' ? 'A42' : 'VX'}</span></div><div><span>${boat.name}</span><strong>${boat.role}</strong><small>Speed ${Math.round(boat.speed * 100)} / Handling ${Math.round(boat.handling * 100)}</small></div>`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.boat = key;
    button.disabled = active || (!owned && progress.credits < boat.price);
    button.textContent = active ? 'Equipped' : owned ? 'Equip' : `${boat.price} credits`;
    button.addEventListener('click', () => { void purchaseOrEquipBoat(key); });
    article.append(button);
    fleetList.append(article);
  });
}

async function purchaseOrEquipBoat(key: BoatKey) {
  const boat = BOAT_CATALOG[key];
  if (!progress.ownedBoats.includes(key)) {
    if (progress.credits < boat.price) return;
    progress.credits -= boat.price;
    progress.ownedBoats.push(key);
  }
  progress.activeBoat = key;
  saveProgress(progress);
  await loadActiveYacht();
  renderHarbor();
  setNotice(`${boat.name} equipped for the next expedition.`);
}

function purchaseUpgrade(key: UpgradeKey) {
  const item = UPGRADE_CATALOG[key];
  const level = progress.upgrades[key];
  const cost = upgradeCost(key, level);
  if (level >= item.maxLevel || progress.credits < cost) return;
  progress.credits -= cost;
  progress.upgrades[key] += 1;
  saveProgress(progress);
  renderHarbor();
  setNotice(`${item.name} upgraded to level ${progress.upgrades[key]}.`);
}

function launchNextExpedition() {
  expeditionComplete = false;
  rewardGranted = false;
  activeContractIndex = progress.expeditions % expeditionContracts.length;
  awaitingHarbor = false;
  awaitingDiveRecovery = false;
  missionIndex = 0;
  missionSignals.forEach((signal) => {
    signal.collected = false;
    signal.group.visible = true;
  });
  recoveryBeacon.visible = true;
  harbor?.classList.remove('is-open');
  harbor?.setAttribute('aria-hidden', 'true');
  resetBoat();
  const contract = expeditionContracts[activeContractIndex];
  selectWeather(contract.weather, false);
  setNotice(`${contract.name} launched. ${contract.briefing}`);
  updateHud();
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

function updateWeather(delta: number) {
  dampSeaState(currentSea, targetSea, delta);
  const colorBlend = 1 - Math.exp(-1.8 * delta);
  currentWaterColor.lerp(tmpColor.set(targetSea.waterColor), colorBlend);
  currentFogColor.lerp(tmpColor.set(targetSea.fogColor), colorBlend);
  currentCloudColor.lerp(tmpColor.set(targetSea.cloudColor), colorBlend);
  windDirection.set(currentSea.windX, 0, currentSea.windZ).normalize();
  waterWaveUniforms.uWaveTime.value = gameTime;
  waterWaveUniforms.uPrimaryWave.value.set(
    currentSea.primaryFrequencyX,
    currentSea.primaryFrequencyZ,
    currentSea.primaryAmplitude,
    currentSea.primarySpeed,
  );
  waterWaveUniforms.uCrossWave.value.set(
    currentSea.crossFrequencyX,
    currentSea.crossFrequencyZ,
    currentSea.crossAmplitude,
    currentSea.crossSpeed,
  );
  waterWaveUniforms.uChopWave.value.set(
    currentSea.chopFrequencyX,
    currentSea.chopFrequencyZ,
    currentSea.chopAmplitude,
    currentSea.chopSpeed,
  );

  water.material.uniforms.distortionScale.value = currentSea.distortionScale;
  water.material.uniforms.waterColor.value.copy(currentWaterColor);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = currentSea.turbidity;
  skyUniforms.rayleigh.value = currentSea.rayleigh;
  skyUniforms.mieCoefficient.value = currentSea.mieCoefficient;
  skyUniforms.mieDirectionalG.value = currentSea.mieDirectionalG;

  cloudMaterial.color.copy(currentCloudColor);
  cloudMaterial.opacity = currentSea.cloudOpacity;
  sunGlow.material.opacity = 0.9 * (1 - currentSea.rain * 0.92);
  hemisphereLight.intensity = 1.15 - currentSea.rain * 0.42;
  sunLight.intensity = 4.1 - currentSea.rain * 2.7;

  if (currentSea.rain > 0.72 && gameTime >= nextLightningAt) {
    lightningFlash = 1;
    nextLightningAt = gameTime + 4.2 + Math.random() * 7.5;
  }
  lightningFlash = Math.max(0, lightningFlash - delta * 3.8);
  if (lightningFlash > 0) {
    sunLight.intensity += lightningFlash * 8;
  }
}

function updateUnderwaterWorld(delta: number) {
  if (causticMaterial) {
    causticMaterial.uniforms.uTime.value = gameTime;
    causticMaterial.uniforms.uOpacity.value = THREE.MathUtils.damp(
      causticMaterial.uniforms.uOpacity.value,
      cameraUnderwater ? 0.12 : 0,
      4,
      delta,
    );
  }

  if (fishSchool) {
    fishAgents.forEach((agent, index) => {
      const angle = gameTime * agent.speed + agent.phase;
      const x = Math.sin(angle) * agent.radius;
      const z = 20 + Math.cos(angle) * agent.radius;
      const y = agent.height + Math.sin(gameTime * 0.8 + index) * 0.42;
      tmpMatrix.compose(
        tmpVector.set(x, y, z),
        tmpQuaternion.setFromAxisAngle(tmpVectorB.set(0, 1, 0), -angle),
        tmpVectorC.set(0.78 + (index % 4) * 0.08, 0.72, 0.72),
      );
      fishSchool?.setMatrixAt(index, tmpMatrix);
    });
    fishSchool.instanceMatrix.needsUpdate = true;
  }

  if (!bubblePoints) return;
  bubblePoints.visible = playerMode === 'swim';
  if (!bubblePoints.visible) return;
  underwaterLight.position.copy(swimmer.position).add(tmpVector.set(0, 2.5, 0));
  for (let index = 0; index < bubblePositions.length; index += 3) {
    const surface = sampleOceanHeight(bubblePositions[index], bubblePositions[index + 2], gameTime);
    const needsReset = bubblePositions[index + 1] < -900 || bubblePositions[index + 1] > surface + 0.2;
    if (needsReset) {
      const seed = index / 3;
      bubblePositions[index] = swimmer.position.x + (Math.random() - 0.5) * 0.8;
      bubblePositions[index + 1] = swimmer.position.y + (seed % 9) * 0.08 - 0.2;
      bubblePositions[index + 2] = swimmer.position.z + (Math.random() - 0.5) * 0.8;
    } else {
      bubblePositions[index] += windDirection.x * delta * 0.08;
      bubblePositions[index + 1] += delta * (0.48 + (index % 7) * 0.08);
      bubblePositions[index + 2] += windDirection.z * delta * 0.08;
    }
  }
  (bubblePoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

function updateRain(delta: number) {
  if (!rainLines) return;
  const intensity = currentSea.rain;
  rainLines.visible = intensity > 0.03 && !cameraUnderwater;
  rainLines.material.opacity = intensity * 0.42;
  if (!rainLines.visible) return;

  const count = rainPositions.length / 6;
  const fallSpeed = 48 + intensity * 30;
  for (let index = 0; index < count; index += 1) {
    const offset = index * 6;
    rainPositions[offset] += windDirection.x * delta * 12;
    rainPositions[offset + 1] -= fallSpeed * delta;
    rainPositions[offset + 2] += windDirection.z * delta * 12;
    rainPositions[offset + 3] = rainPositions[offset] - windDirection.x * 1.6;
    rainPositions[offset + 4] = rainPositions[offset + 1] - 2.8;
    rainPositions[offset + 5] = rainPositions[offset + 2] - windDirection.z * 1.6;
    const tooFar =
      Math.abs(rainPositions[offset] - camera.position.x) > 66 ||
      Math.abs(rainPositions[offset + 2] - camera.position.z) > 66;
    if (rainPositions[offset + 1] < camera.position.y - 32 || tooFar) {
      resetRainDrop(index, false);
    }
  }
  (rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

function resetRainDrop(index: number, initial: boolean) {
  const offset = index * 6;
  const x = camera.position.x + (Math.random() - 0.5) * 126;
  const y = camera.position.y + (initial ? (Math.random() - 0.35) * 90 : 48 + Math.random() * 34);
  const z = camera.position.z + (Math.random() - 0.5) * 126;
  rainPositions[offset] = x;
  rainPositions[offset + 1] = y;
  rainPositions[offset + 2] = z;
  rainPositions[offset + 3] = x - windDirection.x * 1.6;
  rainPositions[offset + 4] = y - 2.8;
  rainPositions[offset + 5] = z - windDirection.z * 1.6;
}

function updateEnvironment() {
  const surfaceAtCamera = sampleOceanHeight(camera.position.x, camera.position.z, gameTime);
  const nextUnderwater = camera.position.y < surfaceAtCamera - 0.08;
  if (nextUnderwater !== cameraUnderwater) {
    cameraUnderwater = nextUnderwater;
    gameRoot.classList.toggle('is-underwater', cameraUnderwater);
    water.visible = !cameraUnderwater;
    underwaterSurface.visible = cameraUnderwater;
    if (causticsMesh) causticsMesh.visible = cameraUnderwater;
    sky.visible = !cameraUnderwater;
    sunGlow.visible = !cameraUnderwater;
    scene.background = cameraUnderwater ? underwaterBackground : null;
    surfaceOnlyObjects.forEach((object) => {
      object.visible = !cameraUnderwater;
    });
  }

  const fog = scene.fog as THREE.FogExp2;
  if (cameraUnderwater) {
    fog.color.set(0x073746);
    fog.density = 0.022;
    underwaterLight.intensity = 2.1;
    renderer.toneMappingExposure = 0.5;
  } else {
    fog.color.copy(currentFogColor);
    fog.density = currentSea.fogDensity;
    underwaterLight.intensity = 0;
    renderer.toneMappingExposure = currentSea.exposure + lightningFlash * 0.34;
  }
  music?.setEnvironment(cameraUnderwater, currentSea.rain);
}

function selectWeather(key: WeatherKey, announce = true) {
  weatherKey = key;
  targetSea = cloneSeaState(WEATHER_PRESETS[key]);
  gameRoot.dataset.weatherMode = key;
  weatherButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.weather === key));
  });
  setSun(targetSea.sunElevation, targetSea.sunAzimuth);
  if (announce) {
    setNotice(`${WEATHER_PRESETS[key].label} sea selected. Wind ${targetSea.windKnots} knots.`);
  }
}

function updateWind(delta: number) {
  const boatPos = playerMode === 'helm' ? yacht.position : swimmer.position;
  const windStrength = THREE.MathUtils.clamp(currentSea.windKnots / 18, 0.2, 2.4);
  windStreaks.forEach((streak) => {
    streak.offset.addScaledVector(windDirection, streak.speed * delta * windStrength);
    if (streak.offset.lengthSq() > 240 * 240) {
      streak.offset.set((Math.random() - 0.5) * 210, 10 + Math.random() * 30, (Math.random() - 0.5) * 210);
    }
    streak.line.position.copy(boatPos).add(streak.offset);
    streak.line.position.y = Math.max(streak.line.position.y, cameraUnderwater ? -2 : 8);
    streak.line.rotation.y = Math.atan2(windDirection.x, windDirection.z) + Math.PI / 2;
    streak.line.material.opacity = cameraUnderwater
      ? 0
      : (0.05 + 0.14 * Math.sin(gameTime * 0.8 + streak.speed)) * windStrength;
  });

  if (notice && hiddenNoticeAt && gameTime > hiddenNoticeAt) {
    notice.classList.add('is-muted');
  }
}

function updateCamera(delta: number) {
  if (playerMode === 'swim') {
    tmpQuaternion.setFromEuler(yawEuler.set(0, swimYaw, 0, 'YXZ'));
    tmpVectorC.set(0, 1.05, 6.8).applyQuaternion(tmpQuaternion);
    tmpVectorD.copy(swimmer.position).add(tmpVectorC);
    tmpVectorE.set(Math.sin(swimYaw), 0, -Math.cos(swimYaw));
    cameraTarget.copy(swimmer.position).addScaledVector(tmpVectorE, 3.2);
    cameraTarget.y += 0.18;
    camera.position.lerp(tmpVectorD, 1 - Math.pow(0.002, delta));
    camera.lookAt(cameraTarget);
    return;
  }

  tmpVectorC.copy(cameraOffsets[cameraMode % cameraOffsets.length]).applyQuaternion(yacht.quaternion);
  tmpVectorD.copy(yacht.position).add(tmpVectorC);
  cameraTarget.copy(yacht.position);
  cameraTarget.y += 3.5;
  camera.position.lerp(tmpVectorD, 1 - Math.pow(0.001, delta));
  camera.lookAt(cameraTarget);
}

function updateHud() {
  const activeHeading = playerMode === 'helm' ? heading : swimYaw;
  const activeSpeed = playerMode === 'helm' ? displaySpeed : Math.abs(swimSpeed);
  const surface = swimmer ? sampleOceanHeight(swimmer.position.x, swimmer.position.z, gameTime) : 0;
  const depth = swimmer ? Math.max(0, surface - swimmer.position.y) : 0;
  if (speedText) speedText.textContent = Math.round(activeSpeed * 1.94).toString();
  if (headingText) headingText.textContent = formatHeading(activeHeading);
  if (windText) windText.textContent = Math.round(currentSea.windKnots).toString();
  if (fpsText) fpsText.textContent = measuredFps.toString();
  if (progressText) progressText.textContent = `${Math.min(missionIndex, missionSignals.length)}`;
  if (creditsText) creditsText.textContent = progress.credits.toString();
  if (modeText) modeText.textContent = playerMode === 'helm' ? 'Helm' : 'Dive';
  if (depthText) depthText.textContent = depth.toFixed(1);
  if (airText) airText.textContent = Math.ceil(oxygen).toString();
  airStatus?.classList.toggle('is-low', oxygen < 25);
  if (modeToggle) modeToggle.textContent = playerMode === 'helm' ? 'Dive' : 'Board';

  if (playerMode === 'swim') {
    if (objectiveText) objectiveText.textContent = awaitingDiveRecovery ? 'Recover the sunken research beacon' : depth < 0.5 ? 'Surface survey' : 'Explore the Aurora reef';
    if (npcText) {
      if (oxygen < 25) {
        npcText.textContent = 'Mara: Air is low. Move toward the surface.';
      } else if (awaitingDiveRecovery) {
        const distance = swimmer.position.distanceTo(recoveryBeacon.position);
        npcText.textContent = `Mara: Beacon signal is ${Math.round(distance)} meters away.`;
      } else {
        npcText.textContent = 'Mara: Telemetry is clear. The reef is alive below you.';
      }
    }
  } else {
    if (objectiveText) objectiveText.textContent = awaitingDiveRecovery ? 'Dive to recover the research beacon' : awaitingHarbor ? 'Return to Aurora Marina' : missionCopy[Math.min(missionIndex, missionCopy.length - 1)];
    if (npcText) npcText.textContent = awaitingDiveRecovery ? 'Mara: Hold position and enter the water. The beacon is below us.' : awaitingHarbor ? 'Mara: Bring us between the piers and reduce speed.' : missionIndex === 0 ? `Mara: ${expeditionContracts[activeContractIndex].briefing}` : npcCopy[Math.min(missionIndex, npcCopy.length - 1)];
  }
}

function updateGamepad() {
  const pad = navigator.getGamepads?.()[0];
  if (!pad) {
    gamepadThrottle = 0;
    gamepadSteer = 0;
    gamepadBoost = false;
    gamepadVertical = 0;
    previousGamepadButtons = [];
    return;
  }
  if (!gamepadConnected) {
    gamepadConnected = true;
    setNotice('Controller connected. Stick steers; triggers throttle; bumpers control depth.');
  }
  const deadzone = (value: number) => Math.abs(value) < 0.12 ? 0 : value;
  gamepadSteer = -deadzone(pad.axes[0] ?? 0);
  const forward = pad.buttons[7]?.value ?? Math.max(0, -(pad.axes[1] ?? 0));
  const reverse = pad.buttons[6]?.value ?? Math.max(0, pad.axes[1] ?? 0);
  gamepadThrottle = forward - reverse * 0.72;
  gamepadVertical = (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
  gamepadBoost = Boolean(pad.buttons[10]?.pressed);
  const currentButtons = pad.buttons.map((button) => button.pressed);
  if (currentButtons[0] && !previousGamepadButtons[0]) togglePlayerMode();
  if (currentButtons[2] && !previousGamepadButtons[2]) {
    cameraMode = (cameraMode + 1) % 3;
    setNotice('Camera changed.');
  }
  previousGamepadButtons = currentButtons;
}

function updateAdaptiveQuality() {
  if (manualQuality) return;
  if (gameTime < qualityCheckAt) return;
  qualityCheckAt = gameTime + 4;
  const lowTarget = matchMedia('(max-width: 760px)').matches ? 32 : 48;
  const nextScale = measuredFps < lowTarget ? Math.max(0.52, renderScale - 0.06) : measuredFps > 57 ? Math.min(maxRenderPixelRatio, renderScale + 0.03) : renderScale;
  if (Math.abs(nextScale - renderScale) < 0.001) return;
  renderScale = nextScale;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderScale));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  rainLines.visible = renderScale > 0.58;
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
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'KeyM' && !event.repeat) {
      void toggleMusic();
    }
    if (event.code === 'Escape' && !event.repeat) togglePause();
    if (event.code === 'KeyC' && !event.repeat) {
      cameraMode = (cameraMode + 1) % 3;
      setNotice('Camera changed.');
    }
    if (event.code === 'KeyE' && !event.repeat) {
      togglePlayerMode();
    }
    if (event.code === 'Digit1' && !event.repeat) selectWeather('calm');
    if (event.code === 'Digit2' && !event.repeat) selectWeather('bluewater');
    if (event.code === 'Digit3' && !event.repeat) selectWeather('storm');
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

  modeToggle?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    void ensureMusic();
    togglePlayerMode();
  });

  weatherButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.weather as WeatherKey | undefined;
      if (!key || !WEATHER_PRESETS[key]) return;
      void ensureMusic();
      selectWeather(key);
    });
  });

  nextExpeditionButton?.addEventListener('click', launchNextExpedition);
  pauseToggle?.addEventListener('click', () => togglePause(true));
  resumeButton?.addEventListener('click', () => togglePause(false));
  qualityButtons.forEach((button) => {
    button.addEventListener('click', () => setQuality(button.dataset.quality ?? 'balanced'));
  });
  renderHarbor();

  window.addEventListener('resize', resize);
  setTimeout(() => {
    notice?.classList.add('is-muted');
  }, 8500);
}

function togglePause(force?: boolean) {
  if (harbor?.classList.contains('is-open')) return;
  isPaused = force ?? !isPaused;
  Object.keys(keys).forEach((key) => { keys[key] = false; });
  pauseMenu?.classList.toggle('is-open', isPaused);
  pauseMenu?.setAttribute('aria-hidden', String(!isPaused));
  pauseToggle?.setAttribute('aria-label', isPaused ? 'Resume' : 'Pause');
}

function setQuality(quality: string) {
  manualQuality = quality !== 'balanced';
  renderScale = quality === 'performance' ? 0.55 : quality === 'quality' ? Math.min(1, window.devicePixelRatio) : maxRenderPixelRatio;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderScale));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  rainLines.visible = quality !== 'performance';
  if (fishSchool) fishSchool.visible = quality !== 'performance' || playerMode === 'swim';
  qualityButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.quality === quality)));
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

function togglePlayerMode() {
  if (playerMode === 'helm') {
    enterSwimMode();
  } else {
    returnToHelm('Diver aboard. Helm control restored.');
  }
}

function enterSwimMode() {
  speed = 0;
  throttleValue = 0;
  steerValue = 0;
  swimSpeed = 0;
  swimYaw = heading;
  oxygen = 100;
  const launchPoint = tmpVector.set(5.4, 0, 21.5).applyQuaternion(yacht.quaternion).add(yacht.position);
  const surface = sampleOceanHeight(launchPoint.x, launchPoint.z, gameTime);
  swimmer.position.set(launchPoint.x, surface - 2.2, launchPoint.z);
  swimmer.rotation.set(0, swimYaw, 0, 'YXZ');
  swimmer.visible = true;
  bubblePoints.visible = true;
  swimmerBody.setTranslation({ x: swimmer.position.x, y: swimmer.position.y, z: swimmer.position.z }, true);
  playerMode = 'swim';
  gameRoot.dataset.playerMode = 'swim';
  setNotice('Dive telemetry active. Aurora is holding position.');
  updateHud();
}

function returnToHelm(message: string) {
  playerMode = 'helm';
  gameRoot.dataset.playerMode = 'helm';
  swimmer.visible = false;
  bubblePoints.visible = false;
  swimmerBody.setTranslation({ x: 0, y: -1000, z: 0 }, true);
  swimSpeed = 0;
  oxygen = 100;
  setNotice(message);
  updateHud();
}

function resetBoat() {
  if (playerMode === 'swim') {
    returnToHelm('Diver aboard. Aurora reset to open water.');
  }
  speed = 0;
  throttleValue = 0;
  steerValue = 0;
  displaySpeed = 0;
  heading = 0;
  boatBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  boatBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  boatBody.setTranslation({ x: 0, y: 0.2, z: 20 }, true);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderScale));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function sampleOceanHeight(x: number, z: number, time: number) {
  const primary =
    Math.sin(
      x * currentSea.primaryFrequencyX +
        z * currentSea.primaryFrequencyZ +
        time * currentSea.primarySpeed,
    ) * currentSea.primaryAmplitude;
  const cross =
    Math.sin(
      x * currentSea.crossFrequencyX + z * currentSea.crossFrequencyZ + time * currentSea.crossSpeed,
    ) * currentSea.crossAmplitude;
  const chop =
    Math.sin(
      x * currentSea.chopFrequencyX + z * currentSea.chopFrequencyZ + time * currentSea.chopSpeed,
    ) * currentSea.chopAmplitude;
  return primary + cross + chop;
}

function seabedHeight(x: number, z: number) {
  return -18 + Math.sin(x * 0.034) * 1.15 + Math.cos(z * 0.027) * 0.9 + Math.sin((x + z) * 0.071) * 0.42;
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
