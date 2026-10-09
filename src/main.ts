import './styles.css';

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WEATHER_PRESETS, cloneSeaState, dampSeaState, type WeatherKey } from './sea-config';
import {newVoyageWeather,advanceWeather,activeWeather,holdWeather,restWeather,voyageLight,weatherForecast} from './voyage-weather';
import {MASTERY_DWELL,masteryPlan,masteryStation,masteryReady,beginMastery,recordMastery,claimMastery,abandonMastery,type MasteryId} from './mastery-voyage';
import { ACHIEVEMENT_CATALOG, BOAT_CATALOG, UPGRADE_CATALOG, acquireProgressWriter, defaultProgress, loadProgress, saveProgress, setProgressStorage, upgradeCost, researchDiscount, importProgress, progressLoadStatus, ProgressLoadError, readProgressImport, type AchievementKey, type BoatKey, type UpgradeKey } from './progression';
import { platform } from './platform';
import { Inventory } from './inventory';
import { researchGrantAmount, claimResearchGrant } from './research-grant';
import { photographCrop } from './photo-framing';
import { capturePhotograph } from './photo-capture';
import { createIcons, Package, Ellipsis, Pause, Camera, Save, Map as MapIcon, Compass, Power, Radar, Radio, CloudSun, X } from 'lucide';
import { SCOOTER, newFieldEquipment, fabricateScooter, scooterStep, SONAR_COOLDOWN, SONAR_DURATION } from './field-equipment';
import { identifyScan, scannerReady, type ScanIdentification } from './scan-identification';
import { ScannerPanel } from './scanner-panel';
import { DiveSonar } from './dive-sonar';
import { ScooterGrip } from './scooter-grip';
import { StoryDialog } from './story-dialog';
import { completeStory } from './story-state';
import { ResearchPartners } from './research-partners';
import { ArrayService } from './array-service';
import { commissionArray } from './array-repair';
import { WreckwardWorld } from './wreckward-world';
import { PelagicWorld } from './pelagic-world';
import {SalvageWorld} from './salvage-world';
import {newSalvage,FIELD_POSTS,SALVAGE_CACHES,MATERIALS,RECIPES,cacheAvailable,salvageReady,recoverSalvage,fabricateMaterials,podAnchorage,deployPod,packPod,podServiceReady,podApproach,servicePod,type MaterialRecipe} from './salvage';
import { PELAGIC_SITE, PELAGIC_PORTS, pelagicTarget, pelagicApproach, pelagicReady, recordPelagicPort } from './pelagic';
import {RovWorld} from './rov-world';
import {RESEARCH_ROV,newRovEquipment,fabricateRov,rovBatteryStep,constrainRovTether,rovDepthBounds} from './research-rov';
import { REACH_SITE, FREIGHTER_STEPS, freighterObjective, freighterApproach, freighterExit, freighterStepReady, recordFreighterStep } from './wreckward';
import { VoyageAtlas } from './voyage-atlas';
import { contractById, contractAvailable, nextStoryContract } from './voyage-catalog';
import { discoverNearby, recordContractCompletion, waypointLocation } from './voyage-state';
import { ExpeditionWorld, expeditionFloor } from './expedition-world';
import { createPlayerCharacter, preloadPlayerCharacter, CharacterLoadError, type PlayerCharacter } from './player-character';
import { ISLAND_LANDMARKS, type IslandDestination } from './island-walk';
import { smoothWalkVelocity, walkFacing } from './walk-motion';
import { SPECIES, SAMPLE_SITES, expeditionPlan, surveyPhotoCount, recoveryComplete, nearestTransect, passageApproach, passageExit, stableTransectReading, nearestSample, newExpedition, newContractExpedition, objectiveCount, reefComplete, expeditionReward, completedObjectives, type DiveTool, type SpeciesKey } from './expedition-state';

type KeyMap = Record<string, boolean>;
type PlayerMode = 'helm' | 'swim' | 'walk' | 'rov';

type MissionSignal = {
  name: string;
  position: THREE.Vector3;
  group: THREE.Group;
  collected: boolean;
  sensor?: RAPIER.Collider;
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
const targetRangeText = document.querySelector<HTMLElement>('[data-target-range]');
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
const forecastDialog=document.querySelector<HTMLDialogElement>('[data-forecast]')!;
const forecastClock=document.querySelector<HTMLElement>('[data-voyage-clock]')!;
let forecastSignature='';
let daylight=1;
const creditsText = document.querySelector<HTMLElement>('[data-credits]');
const harbor = document.querySelector<HTMLElement>('[data-harbor]');
const harborCredits = document.querySelector<HTMLElement>('[data-harbor-credits]');
const rewardText = document.querySelector<HTMLElement>('[data-reward]');
const expeditionsText = document.querySelector<HTMLElement>('[data-expeditions]');
const upgradeList = document.querySelector<HTMLElement>('[data-upgrade-list]');
const fleetList = document.querySelector<HTMLElement>('[data-fleet-list]');
const achievementList = document.querySelector<HTMLElement>('[data-achievement-list]');
const achievementCount = document.querySelector<HTMLElement>('[data-achievement-count]');
const nextExpeditionButton = document.querySelector<HTMLButtonElement>('[data-next-expedition]');
const contractTitle = document.querySelector<HTMLElement>('[data-contract-title]');
const pauseToggle = document.querySelector<HTMLButtonElement>('[data-pause-toggle]');
const pauseMenu = document.querySelector<HTMLElement>('[data-pause-menu]');
const resumeButton = document.querySelector<HTMLButtonElement>('[data-resume]');
const qualityButtons = document.querySelectorAll<HTMLButtonElement>('[data-quality]');
const rewardAdButton = document.querySelector<HTMLButtonElement>('[data-reward-ad]');
const toolButtons = document.querySelectorAll<HTMLButtonElement>('[data-tool]');
const interactButton = document.querySelector<HTMLButtonElement>('[data-interact]');
const toolPrompt = document.querySelector<HTMLElement>('[data-tool-prompt]');
const journalPanel = document.querySelector<HTMLElement>('[data-journal]');
const journalContent = document.querySelector<HTMLElement>('[data-journal-content]');
const standButton = document.querySelector<HTMLButtonElement>('[data-stand]');
const cashInButton = document.querySelector<HTMLButtonElement>('[data-cash-in]');
const ledger = document.querySelector<HTMLElement>('[data-ledger]');
const cruiseButton = document.querySelector<HTMLButtonElement>('[data-cruise]');
const walkButton = document.querySelector<HTMLButtonElement>('[data-walk]');
const landDestination = document.querySelector<HTMLSelectElement>('[data-land-destination]');
const landInteract = document.querySelector<HTMLButtonElement>('[data-land-interact]');

if (!gameRoot || !host) {
  throw new Error('Ocean Adventure canvas host is missing.');
}

const hudElement=document.querySelector<HTMLElement>('.hud');
if(hudElement){
  const root=gameRoot;
  const hudObserver=new ResizeObserver(()=>root.style.setProperty('--hud-bottom',`${Math.ceil(hudElement.getBoundingClientRect().bottom)}px`));
  hudObserver.observe(hudElement);
}
const actionDock=document.querySelector<HTMLElement>('.action-dock');
if(actionDock){
  const measureActions=()=>gameRoot.style.setProperty('--action-clearance',`${Math.ceil(innerHeight-actionDock.getBoundingClientRect().top+12)}px`);
  new ResizeObserver(measureActions).observe(actionDock);window.addEventListener('resize',measureActions);measureActions();
}

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
const profiling = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('profile');
if (profiling) renderer.info.autoReset = false;
let profileFrame = 0;
const maxRenderPixelRatio = matchMedia('(max-width: 760px)').matches ? 0.8 : 1;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRenderPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Three.js uses this value for materials inheriting scene.environment.
scene.environmentIntensity = 0.18;
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
  new THREE.Vector3(0, 13, 38),
  new THREE.Vector3(0, 21, 49),
  new THREE.Vector3(33, 14, 33),
  new THREE.Vector3(31, 12, -42),
  new THREE.Vector3(43, 10, 0),
  new THREE.Vector3(17, 9, 26),
  new THREE.Vector3(-18, 6.5, 19),
  new THREE.Vector3(23, 14, -28),
  new THREE.Vector3(-95, 9, 1),
  new THREE.Vector3(-30, 3.35, 30),
];
const marinaPosition = new THREE.Vector3(0, 0, 28);
const obstacleZones = [{ x: -53, z: 43, radius: 31 }];
let expeditionWorld: ExpeditionWorld;
let selectedTool: DiveTool = 'camera';
let cruiseActive = false;
let assistBlockedSeconds = 0;
let mooringPhase: 'approach' | 'align' | 'reverse' = 'approach';
let swimReturnToBoat = false;
let transectReading: { index:number; seconds:number; run:number } | undefined;
let assistAnimal: {key:SpeciesKey;root:THREE.Group}|undefined;
let assistReached = false;
let nextShadowAt = 0;
let graphicsPreparing = false;
let swimPitch = 0;
let firstPersonDive = true;
let diveInspectionView=false;
let diveOrbitYaw=0,diveOrbitPitch=0;
let interactionReady = false;
let focusedSpecies: SpeciesKey | undefined;
let photoTargetEvaluations=0;
let nextSaveAt = 20;
let lastToolUse = -10;
let pointerLook: { x: number; y: number; id: number } | undefined;
const previousSwimPosition = new THREE.Vector3();

let water: InstanceType<typeof Water>;
let underwaterSurface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
let sky: InstanceType<typeof Sky>;
let sun = new THREE.Vector3();
let pmremTarget: THREE.WebGLRenderTarget | undefined;
let vesselReflection: THREE.WebGLCubeRenderTarget | undefined;
let vesselReflectionCamera: THREE.CubeCamera | undefined;
let vesselReflectionPmrem: THREE.WebGLRenderTarget | undefined;
let reflectionUpdateAt = 0;
let boatSwitching = false;
let hemisphereLight: THREE.HemisphereLight;
let sunLight: THREE.DirectionalLight;
let underwaterLight: THREE.PointLight;
let sunGlow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
let physicsWorld: RAPIER.World;
let boatBody: RAPIER.RigidBody;
let boatHullCollider: RAPIER.Collider | undefined;
let swimmerBody: RAPIER.RigidBody;
let yacht: THREE.Group;
let yachtVisual: THREE.Object3D | undefined;
let swimmer: THREE.Group;
let swimmerVisual: THREE.Object3D | undefined;
let swimmerCharacter: PlayerCharacter;
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
let cameraMode = 2;
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
let researchRov:RovWorld,rovBuilding=false,rovLaunching=false,rovYaw=0,rovPitch=0,rovChase=true,rovLights=true,rovSpeed=0;
let rovLastScan=-Infinity,rovLastManual=-Infinity,rovContacts:ScanIdentification[]=[],rovFeedback='';
let rovRenderedContacts:ScanIdentification[]|undefined;
const rovPrevious=new THREE.Vector3(),rovAnchor=new THREE.Vector3();
let walker: PlayerCharacter;
let walkYaw = 0, walkPitch = 0, walkSpeed = 0;
let firstPersonWalk = false;
let walkDestination: IslandDestination = 'research';
let walkRouting=false;
let walkRouteRequest=0;
let walkRoute: THREE.Vector3[] = [];
let walkRouteIndex = 0;
let walkBlockedTime = 0;
let walkBoardRequested = false;
const WALK_PACE = 1.4, RUN_PACE = 2.2;
const previousWalkPosition = new THREE.Vector3();
const walkVelocity = new THREE.Vector3();
let swimYaw = 0;
let swimSpeed = 0;
let actualSwimSpeed = 0;
let oxygen = 100;
let scooterEnabled=false,scooterPowered=false,scooterLoading=false,scooterBuilding=false;
let scooterVisual:THREE.Group|undefined,scooterLoad:Promise<void>|undefined;
let scooterGrip:ScooterGrip|undefined;
let diveSonar:DiveSonar;
let sonarStarted=-Infinity;
let sonarManualStarted=-Infinity;
let sonarResults:ScanIdentification[]=[];
let sonarSweeps=0;
let scannerAutomatic=true;
let sonarContext='';
const scannerPanel=new ScannerPanel(document.querySelector<HTMLElement>('[data-sonar-contacts]')!);
let cameraUnderwater = false;
let lightningFlash = 0;
let nextLightningAt = 7;
let weatherKey: WeatherKey = 'bluewater';
let currentSea = cloneSeaState(WEATHER_PRESETS.bluewater);
let targetSea = cloneSeaState(WEATHER_PRESETS.bluewater);
const progress = defaultProgress();
let inventory: Inventory;
let voyageAtlas: VoyageAtlas;
let storyDialog:StoryDialog;
let researchPartners:ResearchPartners;
let arrayService:ArrayService;
let wreckward:WreckwardWorld;
let observatory:PelagicWorld;
let salvageWorld:SalvageWorld,fieldTargetId='',fieldSelectedId='',fieldSignature='',fieldFeedback='',fieldCrafting=false;
let fieldReading:{id:string;seconds:number}|undefined;
let masteryReading:{id:string;index:number;seconds:number}|undefined;
let masteryFeedback='';
let fieldPlacementChecks:{id:string;clear:boolean}[]=[];
let observatoryReading:{run:number;index:number;seconds:number}|undefined;
let freighterFeedback='';
let automaticStory=false;
let replacingVoyage=false;
let adBusy = false;
let lastMenuRender = 0;
let expeditionComplete = false;
let rewardGranted = false;
let rewardDoubled = false;
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
let lastImpactAt = -10;
let cameraImpulse = 0;
const expeditionContracts: Array<{ name: string; reward: number; weather: WeatherKey; briefing: string }> = [
  { name: 'Bluewater Survey', reward: 850, weather: 'bluewater', briefing: 'Chart the outer markers and recover the lost research beacon.' },
  { name: 'Storm Relay', reward: 1150, weather: 'storm', briefing: 'Restore the navigation relay before the storm closes the channel.' },
  { name: 'Golden Reef Research', reward: 1000, weather: 'calm', briefing: 'Document the reef route and retrieve its deep-water sensor.' },
];
const contractRoutes = [
  [[0, -70], [70, -120], [135, 26], [26, 162], [-96, 132]],
  [[-42, -54], [-116, -16], [-148, 92], [-38, 166], [86, 128]],
  [[52, -58], [122, -82], [158, 34], [92, 128], [-16, 148]],
] as const;
let activeContractIndex = progress.expeditions % expeditionContracts.length;

const windDirection = new THREE.Vector3(0.58, 0, -0.82).normalize();
const currentWaterColor = new THREE.Color(WEATHER_PRESETS.bluewater.waterColor);
const currentFogColor = new THREE.Color(WEATHER_PRESETS.bluewater.fogColor);
const currentCloudColor = new THREE.Color(WEATHER_PRESETS.bluewater.cloudColor);
const underwaterBackground = new THREE.Color(0x167b92);
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

  setMuted(muted: boolean) {
    this.muted = muted;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.72, this.context.currentTime, 0.08);
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

  playCue(type: 'signal' | 'recovery' | 'purchase' | 'impact' | 'achievement') {
    const now = this.context.currentTime;
    if (type === 'impact') {
      this.playNote(92, now, 0.28, 0.12, 'sawtooth');
      this.playNote(58, now + 0.05, 0.42, 0.09, 'triangle');
      return;
    }
    const notes = type === 'signal' ? [440, 659] : type === 'recovery' ? [330, 494, 740] : type === 'purchase' ? [392, 523] : [523, 659, 784];
    notes.forEach((frequency, index) => this.playNote(frequency, now + index * 0.08, 0.32, 0.075, 'sine'));
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
  const startupStarted=performance.now();
  const startupStages:{stage:string;ms:number}[]=[];let previousStage=startupStarted;
  const stage=(name:string)=>{const now=performance.now();startupStages.push({stage:name,ms:Math.round(now-previousStage)});previousStage=now;};
  const qaMode = ['localhost', '127.0.0.1'].includes(location.hostname) ? new URLSearchParams(location.search).get('qa') : null;
  automaticStory=!qaMode;
  await platform.initialize();
  stage('platform');
  if (!qaMode && platform.storage === localStorage && !await acquireProgressWriter()) {
    if (loading) {
      loading.innerHTML = '<strong>Ocean Adventure is open in another tab</strong><p>Close the other game tab, then reload here. Your saved voyage is protected.</p><button type="button" data-retry-session>Reload game</button>';
      loading.querySelector('button')!.onclick = () => location.reload();
    }
    return;
  }
  const previewKey=`ocean-adventure-preview-${qaMode}-`;
  const previewHadSave=qaMode ? !!sessionStorage.getItem(previewKey+'ocean-adventure-progress-v1') : false;
  setProgressStorage(qaMode ? {
    getItem: key => sessionStorage.getItem(previewKey+key) ?? platform.storage.getItem(key),
    setItem: (key, value) => { sessionStorage.setItem(previewKey+key,value); },
  } : platform.storage);
  Object.assign(progress, loadProgress());
  if(!qaMode&&progress.expedition.stage==='briefing'&&!progress.expedition.contractId&&progress.expeditions===0)progress.expedition=newContractExpedition('bay-signal',progress.expedition.run);
  if (qaMode === 'reset') Object.assign(progress, defaultProgress());
  if (qaMode === 'lagoon' && !previewHadSave) { progress.expedition=newExpedition(2);progress.expedition.stage='reef'; }
  if (qaMode === 'passage' && !previewHadSave) { progress.expedition=newExpedition(3);progress.expedition.stage='reef'; }
  activeContractIndex = progress.expeditions % expeditionContracts.length;
  expeditionComplete = progress.expedition.sold;
  void preloadPlayerCharacter().catch(()=>{});
  await RAPIER.init();
  stage('physicsRuntime');
  physicsWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
  physicsWorld.timestep = 1 / 60;
  createLighting(); await createOceanAndSky();stage('oceanAndSky');createWorld();stage('world');
  await Promise.all([createYacht(),createSwimmer(),createPlayerCharacter('walk').then(character=>{walker=character;walker.root.visible=false;scene.add(walker.root);})]);createPhysics();
  stage('modelsAndColliders');
  inventory = new Inventory(() => progress, () => canVisitStand() && !boatSwitching && !adBusy,
    (kind, key) => { if (kind === 'boat') void purchaseOrEquipBoat(key as BoatKey); else purchaseUpgrade(key as UpgradeKey); },
    (open) => { clearPlayerInput(); resetFrameClock(); if (open) platform.gameplayStop(); else resumePlatformIfPlaying(); },()=>{void buildDiveDrive();},()=>{void buildResearchRov();},recipe=>{void buildMaterialRecipe(recipe);});
  voyageAtlas = new VoyageAtlas(()=>progress,()=>{const p=activePlayerPosition();return{x:p.x,z:p.z,yaw:playerMode==='helm'?heading:playerMode==='walk'?-walker.root.rotation.y:swimYaw};},()=>canVisitStand()&&!boatSwitching&&!adBusy,
    acceptVoyageContract,next=>{try{saveProgress(next);Object.assign(progress,next);cancelSwimAssist();updateHud();return true;}catch{return false;}},
    next=>{try{importProgress(next);replacingVoyage=true;location.reload();return true;}catch{return false;}},
    open=>{clearPlayerInput();resetFrameClock();if(open)platform.gameplayStop();else resumePlatformIfPlaying();},masteryAction);
  createIcons({ icons: { Package, Ellipsis, Pause, Camera, Save, Map:MapIcon, Compass, Power, Radar, Radio, CloudSun, X } }); createInput();
  researchPartners=new ResearchPartners(scene,expeditionWorld.walking.height.bind(expeditionWorld.walking));
  storyDialog=new StoryDialog(()=>progress,finishConversation,open=>{clearPlayerInput();resetFrameClock();if(open)platform.gameplayStop();else resumePlatformIfPlaying();});
  arrayService=new ArrayService(scene,expeditionFloor(190,-156),finishArrayRepair,open=>{clearPlayerInput();resetFrameClock();if(open)platform.gameplayStop();else resumePlatformIfPlaying();});
  wreckward=new WreckwardWorld(scene,expeditionFloor(REACH_SITE.x,REACH_SITE.z));
  observatory=new PelagicWorld(scene,expeditionFloor(PELAGIC_SITE.x,PELAGIC_SITE.z),expeditionWorld.marineMetalTexture);
  salvageWorld=new SalvageWorld(scene,expeditionFloor,expeditionWorld.marineMetalTexture);
  fieldPlacementChecks=[...FIELD_POSTS.map(s=>({id:s.id,clear:expeditionWorld.fieldLocationClear(s.x,s.z)})),...SALVAGE_CACHES.map(c=>({id:c.id,clear:expeditionWorld.fieldLocationClear(c.x,c.z,2.5)}))];
  researchRov=new RovWorld(scene,physicsWorld);
  diveSonar=new DiveSonar(scene);
  if(progress.fieldEquipment?.scooter)void ensureDiveDrive().catch(()=>setNotice('Dive drive model unavailable. Your equipment is saved; toggle the drive to retry.'));
  progress.weather??=newVoyageWeather();progress.rov??=newRovEquipment();progress.salvage??=newSalvage();progress.saveVersion=progress.saveVersion===6?6:5;
  selectWeather(activeWeather(progress.weather), false);
  restoreExpeditionCheckpoint();
  if (qaMode === 'reef' || qaMode === 'dive' || qaMode === 'wreck' || qaMode === 'return') {
    if(!previewHadSave){
    progress.shorePosition=undefined;
    progress.expedition = newExpedition(); progress.expedition.stage = 'reef';
    if (qaMode === 'wreck' || qaMode === 'return') {
      Object.assign(progress.expedition, { photos: ['turtle', 'tang', 'butterflyfish'], waterSample: true, sedimentSample: true, stage: 'wreck', checkpoint: 'wreck' });
    } else progress.expedition.checkpoint = 'reef';
    if (qaMode === 'return') Object.assign(progress.expedition, { cableFreed: true, sensorRecovered: true, stage: 'return', checkpoint: 'harbor' });
    }
    restoreExpeditionCheckpoint();
    if (qaMode !== 'return') {
      enterSwimMode();
      const start = qaMode === 'wreck' ? new THREE.Vector3(81, -23.8, -156) : new THREE.Vector3(0, -8.8, -85);
      swimmer.position.copy(start); swimYaw = qaMode === 'wreck' ? .3 : 0;
      camera.position.copy(start).add(new THREE.Vector3(0, .65, 6.8));
      swimmerBody.setTranslation(start, true);
    }
  } else if (qaMode === 'fleet' || qaMode === 'harbor' || qaMode === 'achievements') {
    if(!previewHadSave)progress.credits = Math.max(progress.credits, qaMode === 'fleet' ? 2500 : 1600);
    if (qaMode === 'achievements') progress.achievements = Object.keys(ACHIEVEMENT_CATALOG) as AchievementKey[];
    openResearchStand();
  }
  if(qaMode==='walk'&&!progress.shorePosition){progress.expedition.checkpoint='harbor';restoreExpeditionCheckpoint();enterWalkMode();}
  else if((!qaMode||qaMode==='walk'||qaMode==='return')&&progress.shorePosition){
    const saved=progress.shorePosition;
    enterWalkMode(false);
    const h=expeditionWorld.walking.height(saved.x,saved.z);
    if(Number.isFinite(h)&&!expeditionWorld.walking.blocked(saved.x,saved.z)){walker.root.position.set(saved.x,h,saved.z);walkYaw=saved.yaw;walker.root.rotation.y=-walkYaw;}
  }
  applyGraphicsMode(readGraphicsMode());resize();updateCamera(1);updateEnvironment();
  stage('controlsAndSettings');
  await renderer.compileAsync(scene,camera);
  stage('shaders');
  resetFrameClock();
  loading?.classList.add('is-hidden');gameRoot.classList.add('is-ready'); platform.loadingFinished(); platform.gameplayStart();
  if(profiling)gameRoot.dataset.startupProfile=JSON.stringify({readyMs:performance.now()-startupStarted,stages:startupStages,walkCharacter:walker.source,swimCharacter:swimmerCharacter.source,asset:'/models/ocean-player-character.glb'});
  renderResearchGrant();
  if(progressLoadStatus==='recovered')setNotice('Your voyage was recovered from the latest verified checkpoint. Export a backup from Atlas / Saves.');
  updateHud(); renderer.setAnimationLoop(tick);
  if(automaticStory)storyDialog.poll();
}

function restoreExpeditionCheckpoint() {
  const checkpoint = progress.expedition.checkpoint;
  const plan=expeditionPlan(progress.expedition);
  const p = progress.mastery?.active?.anchor??(checkpoint === 'reef' ? { x:plan.site.x,z:plan.site.z+28 } : checkpoint === 'transect' ? { x:plan.secondSite.x,z:plan.secondSite.z+28 } : checkpoint === 'wreck' ? { x: 74, z: -141 } : { x: 0, z: 20 });
  heading = progress.mastery?.active?.anchor.yaw??(checkpoint === 'wreck' ? .4 : 0); speed = 0; throttleValue = 0;
  yacht.position.set(p.x, sampleOceanHeight(p.x, p.z, gameTime) + .18, p.z);
  boatBody.setTranslation(yacht.position, true); boatBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
}

function createLighting() {
  hemisphereLight = new THREE.HemisphereLight(0xb7e8ff, 0x0a283b, 1.2);
  scene.add(hemisphereLight);

  sunLight = new THREE.DirectionalLight(0xfff2ce, 4.2);
  sunLight.position.set(-70, 130, -80);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -34;
  sunLight.shadow.camera.right = 34;
  sunLight.shadow.camera.top = 34;
  sunLight.shadow.camera.bottom = -34;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 250;
  sunLight.shadow.bias = -0.0002;
  sunLight.shadow.normalBias = 0.06;
  scene.add(sunLight);
  scene.add(sunLight.target);

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
    // Water's custom shader does not have Three's begin_vertex chunk.
    shader.vertexShader = `uniform float uWaveTime; uniform vec4 uPrimaryWave;
      uniform vec4 uCrossWave; uniform vec4 uChopWave;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
        'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
        `vec3 transformed = vec3(position);
        float worldZ = -position.y;
        transformed.z += sin(position.x * uPrimaryWave.x + worldZ * uPrimaryWave.y + uWaveTime * uPrimaryWave.w) * uPrimaryWave.z;
        transformed.z += sin(position.x * uCrossWave.x + worldZ * uCrossWave.y + uWaveTime * uCrossWave.w) * uCrossWave.z;
        transformed.z += sin(position.x * uChopWave.x + worldZ * uChopWave.y + uWaveTime * uChopWave.w) * uChopWave.z;
        mirrorCoord = modelMatrix * vec4( transformed, 1.0 );`,
      ).replace('modelViewMatrix * vec4( position, 1.0 )','modelViewMatrix * vec4( transformed, 1.0 )');
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;',
      `float shoreRange = length((worldPosition.xz - vec2(-53.0,43.0)) / vec2(40.0,44.0));
       float shallows = 1.0 - smoothstep(0.85,1.75,shoreRange);
       vec3 bayColor = mix(waterColor, vec3(0.035,0.34,0.32), shallows * 0.72);
       vec3 scatter = max(0.0,dot(surfaceNormal,eyeDirection)) * bayColor;`
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
  sky.material.uniforms.uNightAmbient={value:0};
  sky.material.fragmentShader=`uniform float uNightAmbient;\n${sky.material.fragmentShader}`.replace('gl_FragColor = vec4( texColor, 1.0 );','gl_FragColor = vec4( texColor + vec3(0.006, 0.012, 0.026) * uNightAmbient, 1.0 );');
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

let skyEnvironmentKey='';
function setSun(elevation: number, azimuth: number, refreshEnvironment=true) {
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms.sunPosition.value.copy(sun);
  water.material.uniforms.sunDirection.value.copy(sun).normalize();
  sunGlow.position.copy(sun).multiplyScalar(620);
  sunLight.position.copy(sun).multiplyScalar(500);
  if(!refreshEnvironment)return;

  const uniforms=sky.material.uniforms;
  const environmentKey=JSON.stringify([elevation,azimuth,uniforms.turbidity.value,uniforms.rayleigh.value,uniforms.mieCoefficient.value,uniforms.mieDirectionalG.value]);
  if(pmremTarget&&environmentKey===skyEnvironmentKey)return;

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
  skyEnvironmentKey=environmentKey;
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

async function loadActiveYacht(key: BoatKey = progress.activeBoat) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(BOAT_CATALOG[key].model);
  const nextVisual = gltf.scene;
  nextVisual.name = `blender_${key}_yacht`;
  const previousVisual = yachtVisual;
  if (previousVisual) yacht.remove(previousVisual);
  yachtVisual = nextVisual;
  yachtVisual.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material instanceof THREE.MeshStandardMaterial) {
        node.material.envMapIntensity = node.material.metalness > 0.5 ? 0.55 : 0.18;
        if (node.material.name === 'Pearl marine gelcoat') {
          node.material.color.set(0xced8da);
          node.material.roughness = 0.30;
          node.material.envMapIntensity = 0.10;
        }
        if (node.material instanceof THREE.MeshPhysicalMaterial) {
          // Quality mode adds interior depth; lighter modes retain reflective glazing.
          if (node.material.name === 'Smoked reflective glazing') {
            node.material.color.set(0x496b72);
            node.material.transmission = renderer.shadowMap.enabled ? 0.38 : 0;
            node.material.thickness = 0.035;
            node.material.ior = 1.45;
            node.material.attenuationColor.set(0x6f9298);
            node.material.attenuationDistance = 8;
            node.material.metalness = 0.12;
            node.material.roughness = 0.095;
            node.material.clearcoat = 0.8;
            node.material.envMapIntensity = 1.1;
          }
        }
        if (/continuous.?curved.?hull/i.test(node.name)) {
          const positions = node.geometry.getAttribute('position');
          const colors = new Float32Array(positions.count * 3);
          for (let index = 0; index < positions.count; index += 1) {
            const height = positions.getY(index);
            const along = positions.getZ(index);
            const grain = Math.sin(along * 4.7 + positions.getX(index) * 2.3) * 0.008;
            const wetBand = Math.exp(-Math.pow((height - 0.38) / 0.48, 2));
            const streak = (Math.sin(along * 3.1) * 0.5 + 0.5) * 0.04;
            const patina = wetBand * (0.09 + streak);
            colors[index * 3] = 1 - patina + grain;
            colors[index * 3 + 1] = 1 - patina * 0.72 + grain;
            colors[index * 3 + 2] = 1 - patina * 0.46 + grain;
          }
          node.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          node.material = node.material.clone();
          node.material.vertexColors = true;
          node.geometry.userData.hasWaterlinePatina = true;
        }
      }
    }
  });
  addVesselFinishDetails(yachtVisual, key);
  yachtVisual.rotation.y = Math.PI;
  const salonLight = new THREE.PointLight(0xe7d1ab, 12, 7, 2);
  salonLight.position.set(0, 3.8, BOAT_CATALOG[key].length * 0.075);
  yachtVisual.add(salonLight);
  if (key === 'aurora') {
    const bridgeLight = new THREE.PointLight(0xe7d1ab, 8, 6, 2);
    bridgeLight.position.set(0, 7, BOAT_CATALOG[key].length * 0.12);
    yachtVisual.add(bridgeLight);
  }
  yacht.add(yachtVisual);
  const vesselName = BOAT_CATALOG[key].name;
  const vesselTitle = document.querySelector('[data-vessel-title]');
  const vesselSystems = document.querySelector('[data-vessel-systems]');
  if (vesselTitle) vesselTitle.textContent = `${vesselName} expedition`;
  if (vesselSystems) vesselSystems.textContent = `${vesselName} systems`;
  reflectionUpdateAt = 0;
  const boat = BOAT_CATALOG[key];
  if (boatHullCollider) {
    boatHullCollider.setHalfExtents({ x: boat.beam * 0.43, y: 1.7, z: boat.length * 0.46 });
    boatHullCollider.setTranslationWrtParent({ x: 0, y: 0, z: -boat.length * 0.04 });
  }
  if (previousVisual) disposeBoatVisual(previousVisual);
}

function addVesselFinishDetails(visual: THREE.Object3D, boat: BoatKey) {
  if (boat !== 'aurora') return;
  const details = new THREE.Group();
  details.name = 'Aurora browser finish details';
  const gelcoat = new THREE.MeshPhysicalMaterial({
    name: 'Marine finish gelcoat', color: 0xced8da, roughness: 0.30,
    metalness: 0.02, clearcoat: 0.65, clearcoatRoughness: 0.24,
  });
  // The exported Blender coordinates are (x, height, -longitudinal).
  // Two molded stringers carry every companionway tread into the upper deck.
  const stairX = -BOAT_CATALOG.aurora.beam * 0.39;
  for (const side of [-1, 1]) {
    const bottom = new THREE.Vector3(stairX + side * 0.30, 2.23, -8.48);
    const top = new THREE.Vector3(stairX + side * 0.30, 5.49, -10.87);
    const direction = top.clone().sub(bottom);
    const stringer = new THREE.Mesh(new RoundedBoxGeometry(0.10, direction.length(), 0.18, 3, 0.025), gelcoat);
    stringer.name = side < 0 ? 'Outer companionway stringer' : 'Inner companionway stringer';
    stringer.position.copy(bottom).add(top).multiplyScalar(0.5);
    stringer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    details.add(stringer);
  }
  // Fill the original curved table rim with a solid surface and underside.
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.645, 0.645, 0.068, 64), gelcoat);
  table.name = 'Solid observation tabletop';
  table.position.set(0, 5.59 + 0.985, -6);
  details.add(table);
  details.traverse((node) => {
    if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  visual.add(details);
}

function disposeBoatVisual(visual: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  visual.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && value !== scene.environment && value !== vesselReflectionPmrem?.texture) textures.add(value);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

async function createSwimmer() {
  swimmer = new THREE.Group();
  swimmer.name = 'player_diver';
  swimmer.visible = false;
  scene.add(swimmer);

  swimmerCharacter = await createPlayerCharacter('swim');
  swimmerVisual = swimmerCharacter.root;
  swimmerVisual.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
      node.material.envMapIntensity = 0.72;
    }
  });
  swimmer.add(swimmerVisual);
  createBubbleField();
}

function createPhysics() {
  boatBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .2, 20).setLinearDamping(.9).setAngularDamping(4.5).setCcdEnabled(true).setCanSleep(false).enabledRotations(false, true, false));
  const boat = BOAT_CATALOG[progress.activeBoat];
  const shape = RAPIER.ColliderDesc.cuboid(boat.beam * .43, 1.7, boat.length * .46).setFriction(.22).setRestitution(.02).setDensity(1.15);
  shape.setTranslation(0, 0, -boat.length * .04); boatHullCollider = physicsWorld.createCollider(shape, boatBody);
  swimmerBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0));
  physicsWorld.createCollider(RAPIER.ColliderDesc.capsule(.62, .32).setSensor(true), swimmerBody);
  obstacleZones.forEach(zone => createObstacleCollider(zone.x, zone.z, zone.radius));
  for (const x of [-8.5, 8.5]) physicsWorld.createCollider(RAPIER.ColliderDesc.cuboid(1.55, .8, 31).setTranslation(x, .3, 27).setFriction(.35));
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
  expeditionWorld = new ExpeditionWorld(scene);
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

function configureContractRoute() {
  const route = contractRoutes[activeContractIndex % contractRoutes.length];
  missionSignals.forEach((signal, index) => {
    const [x, z] = route[index];
    signal.position.set(x, 0, z);
    signal.group.position.x = x;
    signal.group.position.z = z;
    signal.sensor?.setTranslation({ x, y: 1.2, z });
  });
  if (recoveryBeacon) {
    const final = missionSignals[missionSignals.length - 1].position;
    recoveryBeacon.position.set(final.x + 7, seabedHeight(final.x + 7, final.z - 4) + 1.2, final.z - 4);
  }
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
    scene.add(cloud);surfaceOnlyObjects.push(cloud);
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
  fpsAccumulator += rawDelta;
  fpsFrames += 1;

  if (fpsAccumulator >= 0.5) {
    measuredFps = Math.round(fpsFrames / fpsAccumulator);
    fpsAccumulator = 0;
    fpsFrames = 0;
  }

  if (menusOpen()) {
    if (now - lastMenuRender < 1) return;
    lastMenuRender = now;
    renderResearchGrant();
    renderer.render(scene, camera);
    return;
  }

  gameTime += delta;
  const updateStarted = profiling ? performance.now() : 0;
  if (profiling) renderer.info.reset();
  updateGamepad(delta);
  updateAdaptiveQuality();
  updateWeather(delta);
  water.material.uniforms.time.value += delta * currentSea.waterSpeed;

  updateBoat(delta);
  updateSwimmer(delta);
  updateResearchRov(delta);
  if(playerMode!=='swim'){
    const equipment=progress.fieldEquipment??=newFieldEquipment();
    equipment.charge=scooterStep(equipment,delta,{aboard:playerMode==='helm',enabled:false,forward:0,boost:false,depth:0,assisting:false,retrofit:progress.salvage?.capacitor}).charge;
    scooterPowered=false;
  }
  if(scooterVisual)scooterVisual.visible=playerMode==='swim'&&scooterEnabled&&!firstPersonDive&&!!progress.fieldEquipment?.scooter;
  const rotor=scooterVisual?.getObjectByName('Manta_rotor');if(rotor)rotor.rotation.z+=delta*(scooterPowered?30:0);
  diveSonar.update(gameTime,playerMode==='rov'||playerMode==='swim'&&selectedTool==='scanner');
  updateWalker(delta);
  updateUnderwaterWorld(delta);
  updateMissions(delta);
  salvageWorld.update(progress,activePlayerPosition(),gameTime,sampleOceanHeight);updateFieldWork(delta);
  updateWake(delta);
  updateWind(delta);
  updateCamera(delta);
  updateRain(delta);
  updateEnvironment();
  expeditionWorld.update(gameTime, activePlayerPosition(), cameraUnderwater, progress.upgrades.light);
  const scanRecord=progress.expedition;
  const scanContext=[scanRecord.run,scanRecord.contractId,scanRecord.route,scanRecord.stage,scanRecord.waterSample,scanRecord.sedimentSample,scanRecord.cableFreed,scanRecord.sensorRecovered,scanRecord.arrayRestored,...scanRecord.transectReadings,...(scanRecord.interiorSteps??[]),progress.mastery?.active?.id,progress.mastery?.active?.run,progress.mastery?.active?.readings.length].join('|');
  if(scanContext!==sonarContext){sonarContext=scanContext;sonarStarted=-Infinity;sonarResults=[];diveSonar.clear();}
  if(scannerReady({swimming:playerMode==='swim',selected:selectedTool==='scanner'&&scannerAutomatic,depth:sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-swimmer.position.y,paused:menusOpen(),acquiring:!!transectReading||!!masteryReading,time:gameTime,lastSweep:sonarStarted}))emitDiveSonar(false);
  if(playerMode!=='rov'&&(playerMode!=='swim'||selectedTool!=='scanner'||sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-swimmer.position.y<=.6)){sonarStarted=-Infinity;sonarResults=[];diveSonar.clear();}
  expeditionWorld.pointLight(camera);
  researchPartners.update(gameTime,activePlayerPosition(),cameraUnderwater);
  hudAccumulator += delta;
  if (hudAccumulator >= 0.1) {
    updateHud();
    if(automaticStory&&!menusOpen()&&!transectReading)storyDialog.poll();
    hudAccumulator = 0;
  }

  const renderStarted = profiling ? performance.now() : 0;
  renderer.render(scene, camera);
  if (profiling) gameRoot.dataset.renderProfile = JSON.stringify({
    frame: ++profileFrame, frameMs: rawDelta * 1000,
    updateMs: renderStarted - updateStarted, renderMs: performance.now() - renderStarted,
    calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    mode: playerMode, scale: renderScale, position: activePlayerPosition().toArray(), vesselPosition: yacht.position.toArray(), lookYaw: playerMode==='rov'?rovYaw:playerMode==='walk'?walkYaw:swimYaw, lookPitch: playerMode==='rov'?rovPitch:playerMode==='walk'?walkPitch:swimPitch,
    rovBattery:progress.rov?.battery,rovLoaded:researchRov.loaded,rovChase,rovLights,rovVisible:researchRov.root.visible,rovCableVisible:researchRov.tether.visible,rovLightIntensity:researchRov.lamp.intensity,rovTether:playerMode==='rov'?researchRov.root.position.distanceTo(rovAnchor):undefined,
    observatoryLoaded:observatory.loaded,observatoryFloor:observatory.floor,observatoryRecords:progress.expedition.observatoryRecords,observatoryReading:observatoryReading?.seconds,
    fieldLoaded:salvageWorld.loaded,fieldTarget:fieldTargetId,fieldReading:fieldReading?.seconds,salvage:progress.salvage,
    fieldPlacementChecks,weather:progress.weather,daylight,weatherKey,mastery:progress.mastery,masteryReading:masteryReading?.seconds,masteryStation:masteryStation(progress.mastery,expeditionFloor),
    walkFacing: playerMode==='walk'?-walker.root.rotation.y:undefined, walkSpeed: playerMode==='walk'?walkSpeed:undefined,
    characterSource: playerMode==='walk'?walker.source:swimmerCharacter.source, diveInspectionView, diveOrbitYaw,
    diverNdc:playerMode==='swim'&&!firstPersonDive?swimmer.position.clone().project(camera).toArray():undefined,
    cameraPosition:camera.position.toArray(),
    swimSpeed:actualSwimSpeed,scooterPowered,scooterLoaded:!!scooterVisual,scooterVisible:!!scooterVisual?.visible,scooterCharge:progress.fieldEquipment?.charge,
    scooterGripError:scooterGrip?.maxError,
    swimBodyPitch:swimmer.rotation.x,
    photoTargetEvaluations,
    sonarSweeps,
    sonarContacts:gameTime-sonarStarted<SONAR_DURATION?sonarResults.map(contact=>contact.id):[],
  });
}

function updateBoat(delta: number) {
  const helmActive = playerMode === 'helm';
  const chartCourse=waypointLocation(progress.voyage);
  const returning = helmActive && cruiseActive && ((progress.expedition.stage === 'return'||masteryReturning())&&!chartCourse||chartCourse?.id==='harbor');
  const navigationTarget = returning ? new THREE.Vector3(0,0,mooringPhase==='reverse'?24:-55) : objectiveLocation();
  const keyboardThrottle = helmActive
    ? (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? 0.72 : 0)
    : 0;
  const keyboardSteer = helmActive
    ? (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0)
    : 0;
  let rawThrottle = helmActive ? (Math.abs(keyboardThrottle) > 0.01 ? keyboardThrottle : gamepadThrottle) : 0;
  let rawSteer = helmActive ? (Math.abs(keyboardSteer) > 0.01 ? keyboardSteer : gamepadSteer) : 0;

  if (helmActive && cruiseActive) {
    if (Math.abs(keyboardThrottle) > .01 || Math.abs(keyboardSteer) > .01 || Math.abs(gamepadThrottle) > .1 || Math.abs(gamepadSteer) > .1) cruiseActive = false;
    else {
      const distance = Math.hypot(navigationTarget.x-yacht.position.x,navigationTarget.z-yacht.position.z);
      const reversing = returning && mooringPhase === 'reverse';
      const desired = returning && mooringPhase === 'align' ? 0 : reversing
        ? Math.atan2(yacht.position.x-navigationTarget.x,navigationTarget.z-yacht.position.z)
        : Math.atan2(navigationTarget.x-yacht.position.x,-(navigationTarget.z-yacht.position.z));
      const error = THREE.MathUtils.euclideanModulo(desired-heading+Math.PI,Math.PI*2)-Math.PI;
      const stop = reversing ? .2 : returning ? 4 : chartCourse?10:27;
      if (returning && mooringPhase === 'align') {
        rawThrottle = Math.abs(speed) > .1 ? -Math.sign(speed) * .5 : 0; rawSteer = 0;
        if (Math.abs(speed)<.35) {
          // Opposed propellers align the vessel in open water before backing
          // into the narrow piers; no turning maneuver occurs at the gangway.
          heading += THREE.MathUtils.clamp(error,-.38*delta,.38*delta);
          if (Math.abs(error)<.06) { mooringPhase='reverse'; setNotice('Mara: Backing into the berth. Keep the channel clear.'); }
        }
      } else if (distance <= stop + 1.5 && Math.abs(speed)<.4) {
        rawThrottle=0;rawSteer=0;
        if (returning && mooringPhase==='approach') { mooringPhase='align'; setNotice('Mara: Aligning in open water before mooring.'); }
        else {
          cruiseActive=false;
          setNotice(returning ? boatAtLanding() ? 'Moored at the gangway. Walk ashore or open Harbor to sell your cargo.' : 'Berth reached. Align north within the channel to reach the gangway.' : 'Research site reached. Dive when ready.');
        }
      } else if (reversing) {
        rawSteer=THREE.MathUtils.clamp(-error*3,-1,1);
        const desiredSpeed=-Math.min(2.2,Math.max(0,distance-stop)*.3);
        rawThrottle=speed<desiredSpeed-.15?.5:speed>desiredSpeed+.15?-.65:0;
      }
      else { rawSteer=THREE.MathUtils.clamp(error*2,-1,1);const desiredSpeed=distance<stop+14?Math.max(0,(distance-stop)*.32):Math.abs(error)>1.0?3.0:7.0;rawThrottle=speed>desiredSpeed+.5?-.7:speed<desiredSpeed? .75:0; }
    }
  }
  const boosting = helmActive && (isDown('ShiftLeft') || isDown('ShiftRight') || gamepadBoost);

  throttleValue = THREE.MathUtils.damp(throttleValue, rawThrottle, 6.5, delta);
  steerValue = THREE.MathUtils.damp(steerValue, rawSteer, 8.5, delta);

  const engineMultiplier = 1 + progress.upgrades.engine * 0.08;
  const boatStats = BOAT_CATALOG[progress.activeBoat];
  const targetAcceleration = (boosting ? 4.6 : 3.4) * engineMultiplier * boatStats.speed;
  speed += throttleValue * targetAcceleration * delta;
  if (rawThrottle < 0 && speed > 0) {
    speed -= (3.5 + speed * 0.14) * delta;
  }
  const weatherDrag = 1 + currentSea.rain * 0.24;
  const drag = (rawThrottle === 0 ? 0.65 : 0.18) * weatherDrag;
  speed -= Math.sign(speed) * Math.min(Math.abs(speed), (drag + speed * speed * 0.008) * delta);
  const stormPenalty = currentSea.rain * Math.max(0.03, 0.14 - progress.upgrades.hull * 0.035);
  const forwardLimit = (boosting ? 15.5 : 11.5) * engineMultiplier * boatStats.speed * (1 - stormPenalty);
  speed = THREE.MathUtils.clamp(speed, -3.6, forwardLimit);

  const turnPower = THREE.MathUtils.clamp(speed / 9, -0.45, 1);
  heading += steerValue * turnPower * delta * 0.55 * boatStats.handling;
  displaySpeed = THREE.MathUtils.damp(displaySpeed, Math.abs(speed), 7.5, delta);

  const forward = tmpVector.set(Math.sin(heading), 0, -Math.cos(heading)).normalize();
  const sideDrift = tmpVectorB
    .copy(windDirection)
    .multiplyScalar((0.08 + currentSea.windKnots * 0.01) * (1 + Math.abs(speed) * 0.012) * THREE.MathUtils.smoothstep(Math.abs(speed), 0.4, 3));
  const velocity = forward.multiplyScalar(speed).add(sideDrift);
  const requestedVelocity = velocity.length();
  boatBody.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
  physicsWorld.timestep = delta;
  physicsWorld.step();

  const resolvedVelocity = boatBody.linvel();
  const impactLoss = requestedVelocity - Math.hypot(resolvedVelocity.x, resolvedVelocity.z);
  if (impactLoss > 3.2 && Math.abs(speed) > 5 && gameTime - lastImpactAt > 0.8) {
    triggerHullImpact(impactLoss);
  }

  if (impactLoss > 1.0) speed = Math.sign(speed) * Math.min(Math.abs(speed), Math.hypot(resolvedVelocity.x, resolvedVelocity.z));
  const bodyPosition = boatBody.translation();
  resolveIslandCollision(bodyPosition);
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
  // Compass headings increase clockwise; Three.js yaw increases counterclockwise.
  yawEuler.set(pitch, -heading, roll, 'YXZ');
  tmpQuaternion.setFromEuler(yawEuler);
  boatBody.setRotation(tmpQuaternion, true);

  yacht.position.set(bodyPosition.x, y, bodyPosition.z);
  yacht.quaternion.copy(tmpQuaternion);
  if(renderer.shadowMap.enabled && gameTime>=nextShadowAt){renderer.shadowMap.needsUpdate=true;nextShadowAt=gameTime+.15;}
  const atHarbor=yacht.position.distanceTo(marinaPosition)<85;
  sunLight.target.position.copy(atHarbor ? tmpVectorD.set(-25,0,36) : yacht.position);
  const shadowRange=atHarbor?65:34;
  sunLight.shadow.camera.left=-shadowRange;sunLight.shadow.camera.right=shadowRange;sunLight.shadow.camera.top=shadowRange;sunLight.shadow.camera.bottom=-shadowRange;sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.position.copy(sunLight.target.position).addScaledVector(sun, 120);
  if (renderer.shadowMap.enabled && playerMode === 'helm' && gameTime >= reflectionUpdateAt) {
    updateVesselReflection();
    reflectionUpdateAt = gameTime + 12;
  }

  if (yachtVisual) {
    const bob = Math.sin(gameTime * 2.8) * 0.025 + Math.sin(gameTime * 4.1 + 1.7) * 0.015;
    yachtVisual.position.y = bob;
  }

  if (Math.abs(speed) > 3 && gameTime - lastWakeSpawn > 0.09) {
    const wakeStern = boatStats.length * 0.46 + 0.4;
    const wakeBeam = boatStats.beam * 0.28;
    sternBase.set(0, 0, wakeStern).applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(sternBase, Math.abs(speed) * 0.08);
    const side = wakeSideToggle ? sternLeft.set(-wakeBeam, 0, wakeStern + 0.4) : sternRight.set(wakeBeam, 0, wakeStern + 0.4);
    side.applyQuaternion(yacht.quaternion).add(yacht.position);
    createWakeParticle(side, Math.abs(speed) * 0.045);
    wakeSideToggle = !wakeSideToggle;
    lastWakeSpawn = gameTime;
  }
}

function resolveIslandCollision(bodyPosition: { x: number; y: number; z: number }) {
  obstacleZones.forEach((zone) => {
    const dx = bodyPosition.x - zone.x;
    const dz = bodyPosition.z - zone.z;
    const distance = Math.hypot(dx, dz);
    const limit = zone.radius * 0.74 + 4.2;
    if (distance >= limit) return;
    const nx = distance > 0.001 ? dx / distance : 1;
    const nz = distance > 0.001 ? dz / distance : 0;
    bodyPosition.x = zone.x + nx * limit;
    bodyPosition.z = zone.z + nz * limit;
    boatBody.setTranslation(bodyPosition, true);
    if (Math.abs(speed) > 4) triggerHullImpact(Math.abs(speed) * 0.7);
  });
}

function triggerHullImpact(strength: number) {
  if (gameTime - lastImpactAt <= 0.8) return;
  lastImpactAt = gameTime;
  cameraImpulse = Math.min(1, strength / 12);
  speed *= 0.32;
  music?.playCue('impact');
  setNotice('Hull impact. Reduce speed near reefs.');
}

function activePlayerPosition(){return playerMode==='rov'?researchRov.root.position:playerMode==='walk'?walker.root.position:playerMode==='helm'?yacht.position:swimmer.position;}
function boatAtLanding(){return yacht&&Math.abs(yacht.position.x)<3&&yacht.position.z>15&&yacht.position.z<34&&Math.cos(heading)>.975&&Math.abs(speed)<.7;}
function atLandmark(key:IslandDestination,range:number){const target=ISLAND_LANDMARKS[key];return playerMode==='walk'&&Math.hypot(walker.root.position.x-target.x,walker.root.position.z-target.z)<range;}
function canBoardFromIsland(){return atLandmark('boat',3.2);}
function canVisitStand(){return playerMode==='walk'?(atLandmark('research',2.8)||atLandmark('outfitter',2.8)):playerMode==='helm'&&yacht.position.distanceTo(marinaPosition)<=31&&Math.abs(speed)<=2;}
function canSellCargo(){return playerMode==='walk'?atLandmark('research',2.8):playerMode==='helm'&&yacht.position.distanceTo(marinaPosition)<=31&&Math.abs(speed)<=2;}

function enterWalkMode(save=true){
  if(playerMode!=='helm'||!boatAtLanding()||menusOpen()){setNotice('Moor between the piers, heading north, below 1.4 knots to walk ashore.');return;}
  walkRouteRequest++;cruiseActive=false;speed=0;throttleValue=0;steerValue=0;
  boatBody.setLinvel({x:0,y:0,z:0},true);boatBody.setAngvel({x:0,y:0,z:0},true);
  Object.keys(keys).forEach(key=>{keys[key]=false;});
  const gate=ISLAND_LANDMARKS.boat;walker.root.position.set(gate.x,expeditionWorld.walking.height(gate.x,gate.z),gate.z);
  walkYaw=Math.PI;walkPitch=0;walkSpeed=0;walkVelocity.set(0,0,0);walkDestination='research';walkRoute=[];walkBoardRequested=false;
  if(landDestination)landDestination.value=walkDestination;
  walker.root.visible=!firstPersonWalk;walker.root.rotation.y=-walkYaw;
  swimmer.visible=false;bubblePoints.visible=false;playerMode='walk';gameRoot.dataset.playerMode='walk';
  progress.expedition.checkpoint='harbor';
  camera.position.copy(walker.root.position).add(new THREE.Vector3(0,1.65,0));
  if(save)persistExpedition();
  setNotice('Welcome ashore. WASD walks, drag to look, hold Shift for a light jog. Choose a destination for optional Walk assist.');updateHud();
}
function useLandInteraction(){
  if(menusOpen())return;
  if(walkBoardRequested){togglePlayerMode();return;}
  if(canVisitStand())openResearchStand();else togglePlayerMode();
}
async function startWalkAssist(boardOnArrival=false){
  if(cruiseActive&&!boardOnArrival){cruiseActive=false;walkRoute=[];walkBoardRequested=false;updateHud();return;}
  if(walkRouting)return;
  walkBoardRequested=boardOnArrival;
  const request=++walkRouteRequest,start=walker.root.position.clone(),destination=walkDestination;
  walkRouting=true;setNotice('Finding a safe island route…');updateHud();
  const route=await expeditionWorld.walking.route(start,objectiveLocation());
  walkRouting=false;
  if(request!==walkRouteRequest||playerMode!=='walk'||walkDestination!==destination||walker.root.position.distanceTo(start)>.15||menusOpen()){updateHud();return;}
  walkRoute=route;walkRouteIndex=0;walkBlockedTime=0;
  if(new URLSearchParams(location.search).has('qa'))console.debug('Island route',destination,'from',start.toArray(),'to',route.at(-1)?.toArray(),'waypoints',route.length);
  cruiseActive=walkRoute.length>0;
  if(!cruiseActive)walkBoardRequested=false;
  setNotice(cruiseActive?boardOnArrival?'Returning to the boat. You will board when you reach the pier. Move or drag to cancel.':`Walking to ${ISLAND_LANDMARKS[walkDestination].name}. Manual movement or drag look cancels assist.`:'No safe route found. Walk around the obstruction and try again.');updateHud();
}
function updateWalker(delta:number){
  if(playerMode!=='walk')return;
  previousWalkPosition.copy(walker.root.position);
  let forward=(isDown('KeyW')||isDown('ArrowUp')?1:0)-(isDown('KeyS')||isDown('ArrowDown')?1:0);
  let strafe=(isDown('KeyD')?1:0)-(isDown('KeyA')?1:0);
  const turn=(isDown('ArrowRight')?1:0)-(isDown('ArrowLeft')?1:0);
  if(Math.abs(forward)+Math.abs(strafe)+Math.abs(turn)+Math.abs(gamepadThrottle)+Math.abs(gamepadSteer)>.05){cruiseActive=false;walkBoardRequested=false;if(walkRouting)walkRouteRequest++;}
  if(!forward)forward=gamepadThrottle;if(!strafe)strafe=gamepadSteer;
  walkYaw+=turn*delta*1.7;
  const move=new THREE.Vector3();
  const jogIntent=isDown('ShiftLeft')||isDown('ShiftRight')||gamepadBoost;
  if(cruiseActive){
    walkVelocity.set(0,0,0);
    let target=walkRoute[walkRouteIndex];
    if(target&&Math.hypot(target.x-walker.root.position.x,target.z-walker.root.position.z)<.035)target=walkRoute[++walkRouteIndex];
    if(!target){
      cruiseActive=false;
      if(new URLSearchParams(location.search).has('qa'))console.debug('Island route ended',walkDestination,'at',walker.root.position.toArray(),'index',walkRouteIndex);
      if(walkBoardRequested&&canBoardFromIsland()){returnToHelm('Researcher aboard. Choose Dive to enter the water.');persistExpedition();return;}
      walkBoardRequested=false;
      if(atLandmark(walkDestination,.6)){walkYaw=ISLAND_LANDMARKS[walkDestination].facing;walkPitch=0;persistExpedition();setNotice(`${ISLAND_LANDMARKS[walkDestination].name} reached. Explore or interact.`);}
      else setNotice('The route ended before the destination. Choose Walk assist to find a fresh route.');
    }
    else{move.copy(target).sub(walker.root.position);move.y=0;const distance=move.length();move.normalize().multiplyScalar(Math.min((jogIntent?RUN_PACE:WALK_PACE)*delta,distance));
      const desired=Math.atan2(move.x,-move.z),error=THREE.MathUtils.euclideanModulo(desired-walkYaw+Math.PI,Math.PI*2)-Math.PI;walkYaw+=THREE.MathUtils.clamp(error,-4*delta,4*delta);}
  }else{
    move.set(Math.sin(walkYaw)*forward+Math.cos(walkYaw)*strafe,0,-Math.cos(walkYaw)*forward+Math.sin(walkYaw)*strafe);
    if(move.lengthSq()>1)move.normalize();move.multiplyScalar(jogIntent?RUN_PACE:WALK_PACE);
    smoothWalkVelocity(walkVelocity,move,delta);move.copy(walkVelocity).multiplyScalar(delta);
  }
  expeditionWorld.walking.move(walker.root.position,move.x,move.z);
  const actual=walker.root.position.distanceTo(previousWalkPosition);walkSpeed=actual/delta;
  if(cruiseActive&&move.length()>.01&&actual<delta*.2){walkBlockedTime+=delta;if(walkBlockedTime>1.5){cruiseActive=false;walkBoardRequested=false;setNotice('The route is blocked. Walk around the obstacle and resume assist.');}}else walkBlockedTime=0;
  // Body facing follows resolved travel, not the camera, including reverse and strafe.
  walker.root.rotation.y=firstPersonWalk?-walkYaw:walkFacing(walker.root.rotation.y,walker.root.position.x-previousWalkPosition.x,walker.root.position.z-previousWalkPosition.z,delta);
  walker.animate(delta,walkSpeed,jogIntent);
}

function updateSwimmer(delta: number) {
  if (playerMode !== 'swim') return;
  previousSwimPosition.copy(swimmer.position);
  const move = (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0) - (isDown('KeyS') || isDown('ArrowDown') ? .65 : 0);
  const turn = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
  const strafe = (isDown('KeyZ') ? 1 : 0) - (isDown('KeyQ') ? 1 : 0);
  const vertical = (isDown('Space') ? 1 : 0) - (isDown('ControlLeft') || isDown('ControlRight') ? 1 : 0);
  if(Math.abs(move)+Math.abs(turn)+Math.abs(strafe)+Math.abs(vertical)+Math.abs(gamepadThrottle)+Math.abs(gamepadSteer)+Math.abs(gamepadVertical)>.1)fieldTargetId='';
  let forwardInput = Math.abs(move) > .01 ? move : gamepadThrottle;
  let verticalInput = Math.abs(vertical) > .01 ? vertical : gamepadVertical;
  const boost = isDown('ShiftLeft') || isDown('ShiftRight') || gamepadBoost;
  swimYaw += (Math.abs(turn) > .01 ? turn : gamepadSteer) * delta * 1.35;
  if(cruiseActive){
    if(Math.abs(move)+Math.abs(turn)+Math.abs(strafe)+Math.abs(vertical)+Math.abs(gamepadThrottle)+Math.abs(gamepadSteer)+Math.abs(gamepadVertical)>.1)cancelSwimAssist();
    else{
      const target=objectiveLocation();const d=target.clone().sub(swimmer.position);const range=d.length();
      const fieldGoal=fieldTargetPoint();
      const remoteApproach=progress.expedition.stage==='remote'&&!swimReturnToBoat&&!fieldTargetPoint()?pelagicApproach(progress.expedition,observatory.floor,swimmer.position):undefined;
      const approach=freighterApproach(progress.expedition,swimmer.position,wreckward.floor)||(selectedTool==='scanner'&&passageApproach(progress.expedition,swimmer.position))||(remoteApproach&&!('index' in remoteApproach)?remoteApproach:undefined)||(fieldGoal&&'via' in fieldGoal?fieldGoal:undefined);
      const exiting=(swimReturnToBoat||progress.expedition.stage==='return'||habitatBoatReturn())&&diveExitRoute();
      const stop=exiting?1:swimReturnToBoat?1.4:fieldGoal?('via' in fieldGoal?.15:.8):progress.mastery?.active?1:progress.expedition.stage==='interior'||progress.expedition.stage==='remote'?.6:selectedTool==='camera'?6:approach?1:progress.expedition.route==='passage'&&progress.expedition.stage==='transect'?3.15:2.3;
      if(exiting&&('ascent' in exiting?exiting.ascent:exiting.y>expeditionWorld.passageClearance)) {
        // Clearance ascent must not steer residual forward motion back into the vault.
        swimSpeed=0;forwardInput=0;verticalInput=.85;swimPitch=THREE.MathUtils.damp(swimPitch,0,4,delta);
      } else {
      const desired=Math.atan2(d.x,-d.z);const error=THREE.MathUtils.euclideanModulo(desired-swimYaw+Math.PI,Math.PI*2)-Math.PI;
      swimYaw+=THREE.MathUtils.clamp(error,-1.6*delta,1.6*delta);swimPitch=THREE.MathUtils.damp(swimPitch,Math.atan2(d.y,Math.hypot(d.x,d.z)),4,delta);
      forwardInput=range>stop?(Math.abs(error)>1?.35:.85):0;verticalInput=0;
      const pitchError=Math.abs(swimPitch-Math.atan2(d.y,Math.hypot(d.x,d.z)));
      if(range<=stop&&Math.abs(error)<.10&&pitchError<.10){
        if(swimReturnToBoat&&!exiting){returnToHelm('Researcher aboard. Cargo secured for the next sailing leg.');persistExpedition();return;}
        else if(selectedTool==='camera'){
          if(!assistReached)setNotice('Tracking the wildlife subject. Press Photograph when the frame is ready.');
          assistReached=true;
        }else if(!approach&&!exiting){cruiseActive=false;setNotice(progress.expedition.stage==='remote'?'The observatory terminal requires Sentry optical acquisition.':'Research target reached. Use your selected tool.');}
      }
      }
    }
  }
  const finBonus = 1 + progress.upgrades.fins * .12;
  swimmer.rotation.set(swimPitch + verticalInput * .15, -swimYaw, -turn * .08, 'YXZ');
  const equipment=progress.fieldEquipment??=newFieldEquipment();
  const drive=scooterStep(equipment,delta,{aboard:false,enabled:scooterEnabled&&!!scooterVisual,forward:forwardInput,boost,depth:Math.max(0,sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-swimmer.position.y),assisting:cruiseActive,retrofit:progress.salvage?.capacitor});
  equipment.charge=drive.charge;scooterPowered=drive.powered;
  if(equipment.charge<=0&&scooterEnabled){scooterEnabled=false;setNotice('Dive drive battery empty. Swim normally and recharge aboard your vessel.');}
  swimSpeed = THREE.MathUtils.damp(swimSpeed, forwardInput * (boost ? 4.5 : 3.1) * finBonus * drive.multiplier, 5, delta);
  tmpVectorF.set(Math.sin(swimYaw) * Math.cos(swimPitch), Math.sin(swimPitch), -Math.cos(swimYaw) * Math.cos(swimPitch));
  swimmer.position.addScaledVector(tmpVectorF, swimSpeed * delta);
  swimmer.position.addScaledVector(tmpVectorB.set(Math.cos(swimYaw), 0, Math.sin(swimYaw)), strafe * 2.2 * finBonus * delta);
  swimmer.position.y += verticalInput * 2.6 * delta;
  if(scooterEnabled&&scooterVisual){
    // Resolve the carried drive's leading end as well as the researcher's body.
    tmpVectorD.set(0,-.28,-1.05).applyQuaternion(swimmer.quaternion);
    tmpVectorC.copy(swimmer.position).add(tmpVectorD);tmpVectorE.copy(previousSwimPosition).add(tmpVectorD);
    expeditionWorld.resolveDiver(tmpVectorC,tmpVectorE);
    wreckward?.resolveDiver(tmpVectorC,tmpVectorE,swimmer.quaternion);
    observatory?.resolve(tmpVectorC,tmpVectorE,swimmer.quaternion);
    salvageWorld?.resolve(tmpVectorC,tmpVectorE,swimmer.quaternion);
    tmpVectorC.sub(swimmer.position).sub(tmpVectorD);swimmer.position.add(tmpVectorC);
  }
  expeditionWorld.resolveDiver(swimmer.position, previousSwimPosition);
  arrayService?.resolveDiver(swimmer.position,previousSwimPosition);
  wreckward?.resolveDiver(swimmer.position,previousSwimPosition,swimmer.quaternion);
  observatory?.resolve(swimmer.position,previousSwimPosition,swimmer.quaternion);
  salvageWorld?.resolve(swimmer.position,previousSwimPosition,swimmer.quaternion);
  if(cruiseActive && Math.abs(swimSpeed)>1 && swimmer.position.distanceToSquared(previousSwimPosition)<delta*delta*.10){
    assistBlockedSeconds+=delta;
    if(assistBlockedSeconds>3){cruiseActive=false;swimReturnToBoat=false;assistBlockedSeconds=0;setNotice('A rock blocks this route. Swim around it, then resume assist.');}
  }else assistBlockedSeconds=0;
  const surface = sampleOceanHeight(swimmer.position.x, swimmer.position.z, gameTime);
  swimmer.position.y = THREE.MathUtils.clamp(swimmer.position.y, expeditionFloor(swimmer.position.x, swimmer.position.z) + .8, surface + .1);
  actualSwimSpeed = swimmer.position.distanceTo(previousSwimPosition) / Math.max(delta, .001);
  const depth = Math.max(0, surface - swimmer.position.y);
  if (depth > 10) unlockAchievement('deep_diver');
  const drain = (.33 + (boost ? .10 : 0)) / (1 + progress.upgrades.tank * .25);
  oxygen = THREE.MathUtils.clamp(oxygen + (depth < .35 ? 12 : -drain) * delta, 0, 100);
  swimmerCharacter.animate(delta,Math.hypot(swimSpeed,strafe*2.2,verticalInput*2.6));
  scooterGrip?.update(scooterEnabled&&!!progress.fieldEquipment?.scooter,delta);
  swimmerBody.setTranslation(swimmer.position, true);
  if (oxygen <= .01) rescueDiver();
}

function updateMissions(delta: number) {
  updateMasteryReading(delta);
  const record = progress.expedition;
  const plan = expeditionPlan(record);
  const active = activePlayerPosition();
  observatory?.update(active,progress.voyage.completed.includes('pelagic-record')?3:record.observatoryRecords?.length??0);
  const discoveries=discoverNearby(progress.voyage,active);
  if(discoveries.length){persistExpedition();setNotice(`Chart updated: ${discoveries.map(place=>place.name).join(', ')}.`);}
  if(playerMode==='rov'){
    arrayService?.update(active,progress.voyage.completed.includes('array-repair'));wreckward?.update(active,record.route==='reach'&&(record.interiorSteps?.length??0)>=3);
    if(gameTime>nextSaveAt){persistExpedition();nextSaveAt=gameTime+20;}return;
  }
  const chartTarget=waypointLocation(progress.voyage);
  if(playerMode==='helm'&&chartTarget&&(chartTarget.id==='harbor'?boatAtLanding():Math.hypot(active.x-chartTarget.x,active.z-chartTarget.z)<12)){progress.voyage.activeWaypoint=undefined;cruiseActive=false;persistExpedition();setNotice(`Waypoint reached: ${chartTarget.name}.`);}
  if (record.stage === 'reef' && Math.hypot(active.x - plan.site.x, active.z - plan.site.z) < 40 && record.checkpoint !== 'reef') {
    record.checkpoint = 'reef'; persistExpedition();
  }
  if (record.stage === 'reef' && reefComplete(record)) {
    record.stage = plan.remoteRequired?'remote':plan.interiorRequired?'interior':plan.repairRequired?'repair':plan.stations.length?'transect':'wreck'; cruiseActive = false; persistExpedition(); setNotice(plan.remoteRequired?'Selene: Deploy Sentry beside the observatory. The three archive terminals need an optical reading.':plan.interiorRequired?'Mara: Record the starboard breach before recovering the freighter archive.':plan.repairRequired?'Ivo: The cabinet east of the vault needs commissioning. Follow its bearing.':`${plan.habitat} survey complete. Board the vessel and sail to ${plan.recoveryTitle.toLowerCase()}.`);
  }
  if ((record.stage === 'wreck'||record.stage==='transect'||record.stage==='repair'||record.stage==='interior'||record.stage==='remote') && Math.hypot(yacht.position.x - plan.secondSite.x, yacht.position.z - plan.secondSite.z) < 45 && record.checkpoint !== (record.stage==='repair'||record.stage==='interior'||record.stage==='remote'?'transect':record.stage)) {
    record.checkpoint = record.stage==='repair'||record.stage==='interior'||record.stage==='remote'?'transect':record.stage; persistExpedition();
  }
  if(transectReading) {
    const station=plan.stations[transectReading.index];
    if(!station||playerMode!=='swim'||record.stage!=='transect'||record.run!==transectReading.run||selectedTool!=='scanner'||!transectReady(swimmer.position.distanceTo(new THREE.Vector3(station.x,station.y,station.z)))) {
      transectReading=undefined;setNotice('Reading interrupted. Hold position beside the station, then retry.');
    }else if(delta>0) {
      transectReading.seconds+=delta;
      if(transectReading.seconds>=2.5) {
        if(!record.transectReadings.includes(transectReading.index))record.transectReadings.push(transectReading.index);
        transectReading=undefined;persistExpedition();setNotice(`Reading saved: ${station.reading}.`);music?.playCue('signal');
      }
    }
  }
  if ((record.stage === 'wreck'||record.stage==='transect') && recoveryComplete(record)) {
    record.stage = 'return'; cruiseActive = false; persistExpedition(); setNotice(plan.stations.length?`${plan.recoveryTitle} logged. Board your vessel and return to the research exchange.`:'Sensor secured. Surface, board your vessel and return to the research stand.');
  }
  if (record.stage === 'return' && yacht.position.distanceTo(marinaPosition) < 30 && Math.abs(speed) < 2) {
    if (record.checkpoint !== 'harbor') { record.checkpoint = 'harbor'; persistExpedition(); }
  }
  expeditionWorld.updateSites(record, selectedTool);
  arrayService?.update(active,record.contractId==='array-repair'&&!record.sold?record.arrayRestored===true:progress.voyage.completed.includes('array-repair'));
  wreckward?.update(active,record.route==='reach'&&(record.interiorSteps?.length??0)>=3);
  if (gameTime > nextSaveAt) { persistExpedition(); nextSaveAt = gameTime + 20; }
}

function persistExpedition(announce = false) {
  if(progress.mastery?.active)progress.mastery.active.anchor=masteryAnchor();
  progress.shorePosition=playerMode==='walk'?{x:walker.root.position.x,z:walker.root.position.z,yaw:walkYaw}:undefined;
  try { saveProgress(progress); if (announce) setNotice(`Saved on this device. Resume checkpoint: ${playerMode==='walk'?'island':progress.expedition.checkpoint}.`); return true; }
  catch { setNotice('This browser could not save. Keep this tab open and allow local storage.'); return false; }
}

function transectReady(distance:number) {
  const movement=['KeyW','KeyS','KeyQ','KeyZ','ArrowUp','ArrowDown','Space','ControlLeft','ControlRight'].some(key=>isDown(key))||Math.abs(gamepadThrottle)+Math.abs(gamepadVertical)>.1;
  return !movement&&stableTransectReading(distance,Math.max(Math.abs(swimSpeed),actualSwimSpeed));
}
function habitatBoatReturn() { const r=progress.expedition;return (r.stage==='wreck'||r.stage==='transect')&&r.checkpoint==='reef'; }
function photoCandidates() {
  const r=progress.expedition,plan=expeditionPlan(r);
  return expeditionWorld.animals.filter(a=>!r.photos.includes(a.key)&&(!plan.requiredSpecies.length||plan.requiredSpecies.includes(a.key)&&Math.hypot(a.home.x-plan.site.x,a.home.z-plan.site.z)<45)).sort((a,b)=>a.root.position.distanceToSquared(swimmer.position)-b.root.position.distanceToSquared(swimmer.position));
}
function objectiveLocation() {
  if(playerMode==='helm'){const target=waypointLocation(progress.voyage);if(target)return new THREE.Vector3(target.x,0,target.z);}
  if(playerMode==='walk'){const target=ISLAND_LANDMARKS[walkDestination];return new THREE.Vector3(target.x,expeditionWorld.walking.height(target.x,target.z),target.z);}
  const record = progress.expedition;
  if(playerMode==='swim'&&(swimReturnToBoat || !fieldTargetPoint()&&(record.stage==='return'||habitatBoatReturn()))){
    const exit=diveExitRoute();
    if(exit)return new THREE.Vector3(exit.x,exit.y,exit.z);
    const point=new THREE.Vector3(BOAT_CATALOG[progress.activeBoat].beam*.58+1.2,0,0).applyQuaternion(yacht.quaternion).add(yacht.position);
    point.y=sampleOceanHeight(point.x,point.z,gameTime)-.2;return point;
  }
  if(playerMode==='swim'){const target=fieldTargetPoint();if(target)return new THREE.Vector3(target.x,target.y,target.z);}
  if(progress.mastery?.active){const s=masteryStation(progress.mastery,expeditionFloor);return s?new THREE.Vector3(s.x,playerMode==='helm'?0:s.y,s.z):marinaPosition.clone();}
  if(record.stage==='remote'){if(playerMode==='helm')return new THREE.Vector3(PELAGIC_SITE.x,0,PELAGIC_SITE.z);const point=pelagicApproach(record,observatory.floor,activePlayerPosition());if(point)return new THREE.Vector3(point.x,point.y,point.z);}
  if(record.stage==='repair')return playerMode==='helm'?new THREE.Vector3(planRepairSite().x,0,planRepairSite().z):arrayService.position.clone();
  if(record.stage==='interior'){if(playerMode==='helm')return new THREE.Vector3(REACH_SITE.x,0,REACH_SITE.z);const point=freighterApproach(record,swimmer.position,wreckward.floor)??freighterObjective(record,wreckward.floor);return point?new THREE.Vector3(point.x,point.y,point.z):marinaPosition.clone();}
  if (record.stage === 'briefing' || record.stage === 'return' || record.stage === 'complete') return marinaPosition.clone();
  if (playerMode === 'helm') { const plan=expeditionPlan(record),site = record.stage === 'reef' ? plan.site : plan.secondSite; return new THREE.Vector3(site.x, 0, site.z); }
  if (record.stage === 'reef') {
    if(selectedTool==='camera'&&record.photos.length<7){
      if(cruiseActive&&assistAnimal&&!record.photos.includes(assistAnimal.key))return assistAnimal.root.position.clone();
      const candidates=photoCandidates();
      if(candidates[0])return candidates[0].root.position.clone();
    }
    const sample=nearestSample(record,swimmer.position);
    if(sample)return new THREE.Vector3(sample.site.x,sample.site.y,sample.site.z);
    const animal = expeditionWorld.animals.find(a => !record.photos.includes(a.key));
    return animal?.root.position.clone() ?? new THREE.Vector3(0, -9, -86);
  }
  if(record.stage==='transect'){
    const station=selectedTool==='scanner'?passageApproach(record,swimmer.position)??nearestTransect(record,swimmer.position)?.site:nearestTransect(record,swimmer.position)?.site;
    return station?new THREE.Vector3(station.x,station.y,station.z):marinaPosition.clone();
  }
  const p = record.cableFreed ? SAMPLE_SITES.sensor : SAMPLE_SITES.cable; return new THREE.Vector3(p.x, p.y, p.z);
}

function useDiveTool() {
  if(playerMode==='rov'){if(progress.expedition.stage==='remote')beginObservatoryReading();else pulseResearchRov();return;}
  if(playerMode==='walk'){useLandInteraction();return;}
  if (playerMode !== 'swim' || menusOpen() || gameTime - lastToolUse < .65) return;
  if(progress.mastery?.active&&selectedTool==='scanner'){
    if(masteryReading)return;
    if(masteryReadingReady()){cancelSwimAssist();masteryReading={id:progress.mastery.active.id,index:progress.mastery.active.readings.length,seconds:0};masteryFeedback='';updateHud();}
    else{emitDiveSonar();setNotice('Approach the current mastery water column and hold position with Scanner.');}return;
  }
  if(selectedTool==='cutter'&&fieldRecoveryReady()){beginFieldRecovery();return;}
  const record = progress.expedition;
  if(record.stage==='interior'){
    if(!wreckward.loaded){setNotice('The freighter is still preparing. No archive progress has been recorded.');return;}
    try{const next=structuredClone(progress);next.expedition=recordFreighterStep(record,selectedTool,swimmer.position,wreckward.floor);try{saveProgress(next);}catch{freighterFeedback='Field record could not be saved. Your archive is unchanged. Allow storage and retry.';setNotice(freighterFeedback);updateHud();return;}Object.assign(progress,next);freighterFeedback='';lastToolUse=gameTime;cancelSwimAssist();updateHud();music?.playCue('signal');setNotice(next.expedition.stage==='return'?'Archive secured and exit recorded. Board the yacht and bring the cassette home.':FREIGHTER_STEPS[next.expedition.interiorSteps.length].action);}
    catch(error){setNotice((error as Error).message);}return;
  }
  if(record.stage==='repair'&&selectedTool==='scanner'&&arrayRepairReady()){cancelSwimAssist();arrayService.show();return;}
  if (record.stage !== 'reef' && record.stage !== 'wreck' && record.stage!=='transect') { if(selectedTool==='scanner'){emitDiveSonar();return;}setNotice('Begin a research expedition at the harbor first.'); return; }
  lastToolUse = gameTime;
  if (selectedTool === 'camera') {
    const plan=expeditionPlan(record);
    if(record.route!=='reef'&&(record.stage!=='reef'||Math.hypot(swimmer.position.x-plan.site.x,swimmer.position.z-plan.site.z)>48)){setNotice('Photograph wildlife at your active habitat survey site.');return;}
    const subject = expeditionWorld.photographicSubject(camera, swimmer.position,progress.expedition.photos,plan.requiredSpecies);
    const species = subject?.key;
    if (!species) { setNotice('Bring a visible animal into the central frame, within 25 meters.'); return; }
    if (record.photos.includes(species)) { setNotice(`${SPECIES[species].name} is already in this survey.`); return; }
    cruiseActive=false;assistAnimal=undefined;assistReached=false;
    try{
      const canvas = renderer.domElement;
      const crop=photographCrop(subject.root,camera,canvas.width,canvas.height);
      record.photoImages[species]=capturePhotograph(renderer,scene,camera,crop);
      progress.collectionPhotos[species] = record.photoImages[species];
    }catch{setNotice('Camera capture unavailable. Try again; no observation was recorded.');updateHud();return;}
    record.photos.push(species); if (!progress.discoveredSpecies.includes(species)) progress.discoveredSpecies.push(species);
    gameRoot.classList.remove('photo-flash'); void gameRoot.offsetWidth; gameRoot.classList.add('photo-flash');
    setNotice(`${SPECIES[species].name} photographed. Field journal updated.`); music?.playCue('signal');
  } else if (selectedTool === 'sampler') {
    const sample=nearestSample(record,swimmer.position);
    if (sample?.inRange) { record[sample.key==='water'?'waterSample':'sedimentSample']=true; setNotice(sample.key==='water'?'Water sample sealed and labeled for the research exchange.':'Sediment sample collected. Reef habitat left undisturbed.'); }
    else { setNotice('Swim closer to an uncollected sample site. Use Scanner for its bearing.'); return; }
  } else if (selectedTool === 'cutter') {
    const p = SAMPLE_SITES.cable;
    if (record.stage !== 'wreck' || record.cableFreed || swimmer.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)) > 3.5) { setNotice('Locate the snagged sensor cable beside the wreck.'); return; }
    record.cableFreed = true; setNotice('Cable released. Select Scanner and retrieve the sensor.');
  } else {
    const p = SAMPLE_SITES.sensor;
    if(record.stage==='transect') {
      if(transectReading)return;
      const station=nearestTransect(record,swimmer.position);
      if(station&&transectReady(station.distance)) {cruiseActive=false;transectReading={index:station.index,seconds:0,run:record.run};setNotice(`Acquiring ${station.site.name}. Hold position.`);updateHud();}
      else setNotice(record.route==='passage'?'Follow the passage stations from south entrance to north exit. Hold position for each reading.':'Approach an unrecorded acoustic station and hold position.');
      return;
    }
    if (record.stage === 'wreck' && record.cableFreed && !record.sensorRecovered && swimmer.position.distanceTo(new THREE.Vector3(p.x,p.y,p.z)) < 3.6) { record.sensorRecovered = true; setNotice('Research sensor recovered. Your cargo is ready for the harbor.'); }
    else {emitDiveSonar();return;}
  }
  persistExpedition(); updateMissions(0); updateHud(); renderJournal();
}

function openResearchStand() {
  if (!canVisitStand()) { setNotice(playerMode==='walk'?'Walk up to the research exchange or dive outfitter to visit.':'Return between the harbor piers and slow below 4 knots to visit the stand.'); return; }
  cruiseActive = false; speed = 0; throttleValue = 0; steerValue = 0;
  Object.keys(keys).forEach(key => { keys[key] = false; });
  persistExpedition();
  renderHarbor(); harbor?.classList.add('is-open'); harbor?.setAttribute('aria-hidden','false'); platform.gameplayStop();
  nextExpeditionButton?.focus();
}

function closeResearchStand() {
  if (adBusy) return;
  harbor?.classList.remove('is-open'); harbor?.setAttribute('aria-hidden','true'); platform.gameplayStart();
}

function sellResearchCargo() {
  const record = progress.expedition;
  if (record.sold || record.stage !== 'return' || !reefComplete(record) || !recoveryComplete(record) || !canSellCargo()) return;
  const next = structuredClone(progress); const reward = expeditionReward(record);
  next.credits += reward; next.expeditions += 1; next.expedition.sold = true; next.expedition.stage = 'complete'; next.expedition.checkpoint = 'harbor'; next.expedition.saleCredits = reward;
  const contract=contractById(record.contractId);
  if(contract){try{next.voyage=recordContractCompletion(next.voyage,contract);}catch{setNotice('The contract record is inconsistent. Cargo remains aboard.');return;}}
  if (!next.achievements.includes('expedition_complete')) next.achievements.push('expedition_complete');
  // Persist the receipt and credit balance together before changing the live state.
  try { saveProgress(next); } catch { setNotice('Cargo kept safely aboard. Browser storage is unavailable; allow it before selling.'); return; }
  Object.assign(progress,next); expeditionComplete = true; rewardGranted = true; renderHarbor(); updateHud();
  setNotice(contract?`${reward} credits paid. ${contract.debrief}`:`Research cargo sold for ${reward} credits. New boats and gear are available.`); music?.playCue('purchase');
}

function renderResearchLedger() {
  const r=progress.expedition,plan=expeditionPlan(r);
  if(ledger) ledger.innerHTML = `${plan.photoGoal?`<div><span>Wildlife survey · ${surveyPhotoCount(r)} species</span><b>${surveyPhotoCount(r)*120} cr</b></div>`:''}${plan.samplesRequired?`<div><span>Water sample</span><b>${r.waterSample?'150 cr':'Not collected'}</b></div><div><span>Sediment sample</span><b>${r.sedimentSample?'200 cr':'Not collected'}</b></div>`:''}${plan.recoveryRequired?plan.stations.length?`<div><span>${plan.recoveryTitle} · ${r.transectReadings.length}/${plan.stations.length} stations</span><b>${r.transectReadings.length*plan.readingCredits} cr</b></div>`:`<div><span>Recovered research sensor</span><b>${r.sensorRecovered?'550 cr':'Not recovered'}</b></div>`:''}<div><span>Complete expedition bonus</span><b>${reefComplete(r)&&recoveryComplete(r)?`${plan.completionBonus} cr`:'Finish the survey'}</b></div>`;
  if(cashInButton){cashInButton.disabled = boatSwitching || r.sold || r.stage !== 'return' || !canSellCargo(); cashInButton.textContent = r.sold ? 'Cargo sold · receipt saved' : r.stage === 'return' ? playerMode==='walk'&&!canSellCargo()?'Visit the research counter to sell':`Sell expedition cargo · ${expeditionReward(r)} credits` : 'Complete expedition to sell cargo';}
  const copy=harbor?.querySelector('.harbor__reward p'); if(copy) copy.textContent=r.sold?'Your research payment is saved. Choose new equipment or begin another survey.':'Earn credits for photographs, permitted samples and recovered equipment. Boats and gear use in-game credits.';
  const nextStory=r.contractId?nextStoryContract(progress.voyage.completed):undefined;
  if(nextExpeditionButton)nextExpeditionButton.textContent=r.stage==='briefing'?'Begin research expedition':r.sold?nextStory?`Begin ${nextStory.title}`:r.contractId?'Choose next contract':`Begin ${expeditionPlan(newExpedition(r.run+1)).title}`:'Return to expedition';
  if(nextExpeditionButton&&progress.mastery?.active)nextExpeditionButton.textContent='Review mastery voyage';
}

function renderJournal() {
  if(!journalContent)return;const r=progress.expedition;
  const plan=expeditionPlan(r);
  const goals:Array<[string,boolean]>=[];
  if(plan.photoGoal){if(plan.requiredSpecies.length)for(const key of plan.requiredSpecies)goals.push([`Photograph ${SPECIES[key].name}`,r.photos.includes(key)]);else goals.push([`Photograph ${plan.photoGoal} different species`,surveyPhotoCount(r)>=plan.photoGoal]);}
  if(plan.samplesRequired)goals.push(['Collect a water sample',r.waterSample],['Collect a sediment sample',r.sedimentSample]);
  if(plan.recoveryRequired)goals.push(...(plan.stations.length?plan.stations.map((station,index)=>[`Record ${station.name}`,r.transectReadings.includes(index)]as[string,boolean]):[['Free the wreck sensor cable',r.cableFreed],['Recover the research sensor',r.sensorRecovered]]as[string,boolean][]));
  if(plan.repairRequired)goals.push(['Commission the three isolated array circuits',r.arrayRestored===true]);
  if(plan.interiorRequired)for(const [index,step]of FREIGHTER_STEPS.entries())goals.push([step.action,(r.interiorSteps??[]).includes(index)]);
  if(plan.remoteRequired)for(const [index,port]of PELAGIC_PORTS.entries())goals.push([`Read ${port.name}`,(r.observatoryRecords??[]).includes(index)]);
  goals.push(['Sell the cargo at the harbor',r.sold]);
  journalContent.innerHTML=`<p class="journal__intro">${plan.title} · Survey ${r.run} · ${completedObjectives(r)}/${objectiveCount(r)} objectives · ${expeditionReward(r)} credits in cargo</p><div class="journal__goals">${goals.map(([name,done])=>`<div class="${done?'is-done':''}"><span>${done?'✓':'○'}</span>${name}</div>`).join('')}</div><h3>Wildlife observations</h3><div class="journal__species">${(Object.entries(SPECIES)as[SpeciesKey,typeof SPECIES[SpeciesKey]][]).map(([key,s])=>`<article class="${r.photos.includes(key)?'is-done':''}">${r.photoImages[key]?`<img src="${r.photoImages[key]}" alt="${s.name} photographed during this survey" loading="lazy">`:""}<small>${r.photos.includes(key)?'Photographed this survey':progress.discoveredSpecies.includes(key)?'Previously discovered':'Not yet photographed'}</small><strong>${s.name}</strong><p>${s.note}</p></article>`).join('')}</div><p class="journal__intro">Autosaved every 20 seconds and after discoveries. Atlas contains campaign records and recovery checkpoints.</p>`;
}

function toggleJournal(force?:boolean) {
  const open=force??!journalPanel?.classList.contains('is-open');renderJournal();
  journalPanel?.classList.toggle('is-open',open);journalPanel?.setAttribute('aria-hidden',String(!open));
  if(open){Object.keys(keys).forEach(k=>{keys[k]=false;});platform.gameplayStop();journalPanel?.querySelector<HTMLButtonElement>('[data-journal-close]')?.focus();}else platform.gameplayStart();
}

function cancelSwimAssist(){masteryReading=undefined;cruiseActive=false;fieldTargetId='';swimReturnToBoat=false;assistAnimal=undefined;assistReached=false;assistBlockedSeconds=0;}
function canBoardSwimmer(){return swimmer.position.y>=sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-1.5&&swimmer.position.distanceTo(yacht.position)<=BOAT_CATALOG[progress.activeBoat].length*.6+8;}
function selectDiveTool(tool:DiveTool){cancelSwimAssist();transectReading=undefined;selectedTool=tool;toolButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tool===tool)));updateHud();}
function rescueDiver(){if(playerMode==='rov')recallResearchRov('Free ROV recovery complete.');else if(playerMode!=='helm'){returnToHelm('Free recovery complete. Your research cargo is safe and air is restored.');persistExpedition();}togglePause(false);}

function completeExpedition() { openResearchStand(); }

function renderHarbor() {
  if (nextExpeditionButton) nextExpeditionButton.disabled = boatSwitching;
  const contract = expeditionContracts[activeContractIndex];
  renderResearchLedger();
  if (creditsText) creditsText.textContent = progress.credits.toString();
  if (harborCredits) harborCredits.textContent = progress.credits.toString();
  if (rewardText) rewardText.textContent = expeditionReward(progress.expedition).toString();
  const visitingOutfitter=playerMode==='walk'&&atLandmark('outfitter',2.8);
  if (contractTitle) contractTitle.textContent = visitingOutfitter?'Dive Outfitter':progress.expedition.sold ? 'Survey Complete' : expeditionPlan(progress.expedition).title;
  const shopEyebrow=harbor?.querySelector('.harbor__header .hud__eyebrow');if(shopEyebrow)shopEyebrow.textContent=visitingOutfitter?'Island equipment & fleet':'Dockside research exchange';
  if (expeditionsText) expeditionsText.textContent = `${progress.expeditions} expedition${progress.expeditions === 1 ? '' : 's'} completed`;
  renderFleet();
  renderAchievements();
  inventory?.render(); renderResearchGrant();
  if (!upgradeList) return;
  upgradeList.replaceChildren();
  (Object.keys(UPGRADE_CATALOG) as UpgradeKey[]).forEach((key) => {
    const item = UPGRADE_CATALOG[key];
    const level = progress.upgrades[key];
    const cost = upgradeCost(key, level,researchDiscount(progress));
    const maxed = level >= item.maxLevel;
    const article = document.createElement('article');
    article.className = 'upgrade';
    article.innerHTML = `<div><span>${item.name}</span><strong>${item.description}</strong></div><div class="upgrade__level" aria-label="Level ${level} of ${item.maxLevel}">${Array.from({ length: item.maxLevel }, (_, index) => `<i class="${index < level ? 'is-filled' : ''}"></i>`).join('')}</div>`;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.upgrade = key;
    button.disabled = boatSwitching || maxed || progress.credits < cost;
    button.textContent = maxed ? 'Max level' : `${cost} credits`;
    button.addEventListener('click', () => purchaseUpgrade(key));
    article.append(button);
    upgradeList.append(article);
  });
}

function renderAchievements() {
  if (achievementCount) achievementCount.textContent = progress.achievements.length.toString();
  if (!achievementList) return;
  achievementList.replaceChildren();
  (Object.keys(ACHIEVEMENT_CATALOG) as AchievementKey[]).forEach((key) => {
    const item = ACHIEVEMENT_CATALOG[key];
    const unlocked = progress.achievements.includes(key);
    const badge = document.createElement('div');
    badge.className = `achievement${unlocked ? ' is-unlocked' : ''}`;
    badge.innerHTML = `<span>${unlocked ? 'Logged' : 'Unknown'}</span><strong>${unlocked ? item.name : 'Undiscovered'}</strong><small>${unlocked ? item.description : 'Continue exploring to reveal this entry.'}</small>`;
    achievementList.append(badge);
  });
}

function unlockAchievement(key: AchievementKey) {
  if (progress.achievements.includes(key)) return;
  progress.achievements.push(key);
  persistExpedition();
  music?.playCue('achievement');
  setNotice(`Captain's log updated: ${ACHIEVEMENT_CATALOG[key].name}.`);
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
    button.disabled = boatSwitching || active || (!owned && progress.credits < boat.price);
    button.textContent = active ? 'Equipped' : owned ? 'Equip' : `${boat.price} credits`;
    button.addEventListener('click', () => { void purchaseOrEquipBoat(key); });
    article.append(button);
    fleetList.append(article);
  });
}

async function purchaseOrEquipBoat(key: BoatKey) {
  if (boatSwitching || adBusy || !canVisitStand() || progress.activeBoat === key) return;
  const boat = BOAT_CATALOG[key];
  const alreadyOwned = progress.ownedBoats.includes(key);
  if (!alreadyOwned && progress.credits < boat.price) return;
  const previousProgress = structuredClone(progress);
  boatSwitching = true;
  clearPlayerInput(); platform.gameplayStop();
  renderHarbor();
  try {
    await loadActiveYacht(key);
    const next=structuredClone(previousProgress);next.activeBoat=key;
    if (!alreadyOwned) {
      next.credits -= boat.price;
      next.ownedBoats.push(key);
      if(!next.achievements.includes('fleet_owner'))next.achievements.push('fleet_owner');
    }
    saveProgress(next);
    Object.assign(progress,next);
    music?.playCue('purchase');
    setNotice(`${boat.name} equipped for the next expedition.`);
  } catch {
    Object.assign(progress,previousProgress);
    try{await loadActiveYacht();}catch{/* Keep the previous saved vessel selected if asset loading is unavailable. */}
    setNotice('The vessel could not load. Your previous boat and credits are safe.');
  } finally {
    boatSwitching = false;
    clearPlayerInput(); resetFrameClock(); renderHarbor(); resumePlatformIfPlaying();
  }
}

function purchaseUpgrade(key: UpgradeKey) {
  if (boatSwitching || adBusy || !canVisitStand()) return;
  const item = UPGRADE_CATALOG[key];
  const level = progress.upgrades[key];
  const cost = upgradeCost(key, level,researchDiscount(progress));
  if (level >= item.maxLevel || progress.credits < cost) return;
  const next=structuredClone(progress);next.credits-=cost;next.upgrades[key]+=1;
  try{saveProgress(next);}catch{setNotice('Upgrade could not be saved. Your credits are unchanged.');return;}
  Object.assign(progress,next);
  music?.playCue('purchase');
  renderHarbor();
  setNotice(`${item.name} upgraded to level ${progress.upgrades[key]}.`);
}

async function launchNextExpedition() {
  if (boatSwitching || adBusy) return;
  if(progress.mastery?.active){closeResearchStand();voyageAtlas.show('voyages');return;}
  if (progress.expedition.grantState === 'earned' && !saveEarnedGrant()) return;
  const completedSurvey = progress.expedition.sold;
  const next = structuredClone(progress);
  if(completedSurvey&&next.expedition.contractId){const story=nextStoryContract(next.voyage.completed);if(!story){closeResearchStand();voyageAtlas.show('contracts');return;}if(story.remote&&!progress.rov?.owned){closeResearchStand();inventory.show();setNotice('Fabricate Sentry ROV before departing for the observatory. Other contracts remain available.');return;}next.expedition=newContractExpedition(story.id,progress.expedition.run+1);}
  else if (completedSurvey) next.expedition = newExpedition(progress.expedition.run + 1);
  if(completedSurvey||next.expedition.stage==='briefing')next.voyage.activeWaypoint=undefined;
  if (next.expedition.stage === 'briefing') { next.expedition.stage = 'reef'; next.expedition.checkpoint = 'harbor'; }
  next.shorePosition = playerMode === 'walk' ? { x: walker.root.position.x, z: walker.root.position.z, yaw: walkYaw } : undefined;
  try { saveProgress(next); }
  catch { setNotice('Departure could not be saved. Your cargo receipt and credits are unchanged.'); return; }
  Object.assign(progress, next);
  transectReading=undefined;
  if (completedSurvey) {
    adBusy = true; clearPlayerInput();
    const restoreMusic = music?.isOn() ?? false;
    try { await platform.interstitialBreak(() => { adBusy = true; platform.gameplayStop(); music?.setMuted(true); }, () => { adBusy = false; if (restoreMusic) music?.setMuted(false); resetFrameClock(); resumePlatformIfPlaying(); }); }
    finally { adBusy = false; }
  }
  expeditionComplete = false; rewardGranted = false; rewardDoubled = false;
  closeResearchStand();
  const plan=expeditionPlan(progress.expedition);
  setNotice(progress.expedition.stage==='reef'?`${plan.title}: sail to ${plan.habitat.toLowerCase()}. Photograph ${plan.photoGoal} species and collect both samples.`:progress.expedition.stage==='transect'?`Sail to ${plan.recoveryTitle.toLowerCase()}. Record the three stations with Scanner.`:progress.expedition.stage==='wreck'?'Sail to the wreck buoy. Release the cable and recover the research sensor.':'Return to the research harbor to sell your cargo.');
  updateHud();
}

async function buildResearchRov(){
  if(rovBuilding||boatSwitching||adBusy||!canVisitStand())return;
  const report=(message:string)=>{inventory.report(message);setNotice(message);};
  try{fabricateRov(progress);}catch(error){report((error as Error).message);return;}
  rovBuilding=true;const button=inventory.dialog.querySelector<HTMLButtonElement>('[data-fabricate-rov]');if(button){button.disabled=true;button.textContent='Preparing ROV…';}
  try{
    await researchRov.load();if(!canVisitStand()||boatSwitching||adBusy)return;
    const next=fabricateRov(progress);try{saveProgress(next);}catch{report('ROV fabrication could not be saved. Your credits are unchanged. Allow storage and retry.');return;}
    Object.assign(progress,next);report('Sentry Research ROV fabricated.');music?.playCue('purchase');renderHarbor();
  }catch{report('ROV model could not load. No credits were spent. Retry at the outfitter.');}
  finally{rovBuilding=false;inventory.render();updateHud();}
}
function fieldPoint(id:string){
  if(id==='calypso-service'){const s=FIELD_POSTS.find(s=>s.id===progress.salvage?.pod.site);if(s)return podApproach(progress,activePlayerPosition(),expeditionFloor(s.x,s.z));return;}
  const c=SALVAGE_CACHES.find(c=>c.id===id);if(c&&cacheAvailable(progress,id))return{x:c.x,y:expeditionFloor(c.x,c.z)+2,z:c.z};
}
function fieldTargetPoint(){return fieldPoint(fieldTargetId);}
function fieldInput(){return ['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyZ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].some(isDown)||Math.abs(gamepadThrottle)+Math.abs(gamepadSteer)+Math.abs(gamepadVertical)>.05;}
function fieldRecoveryReady(id=fieldSelectedId){const c=SALVAGE_CACHES.find(c=>c.id===id);return playerMode==='swim'&&selectedTool==='cutter'&&!menusOpen()&&!fieldInput()&&salvageWorld.loaded&&!!c&&salvageReady(progress,id,swimmer.position,expeditionFloor(c.x,c.z),actualSwimSpeed);}
function beginFieldRecovery(){if(fieldReading||!fieldRecoveryReady())return;cruiseActive=false;fieldTargetId='';fieldReading={id:fieldSelectedId,seconds:0};fieldFeedback='Releasing the supply case';updateHud();}
function updateFieldWork(delta:number){
  if(!fieldReading)return;
  if(fieldReading.id!==fieldSelectedId||!fieldRecoveryReady(fieldReading.id)){fieldReading=undefined;fieldFeedback='Recovery interrupted. Hold position beside the case and retry.';updateHud();return;}
  if((fieldReading.seconds+=delta)<2)return;const id=fieldReading.id,c=SALVAGE_CACHES.find(c=>c.id===id)!;fieldReading=undefined;
  const next=recoverSalvage(progress,id,swimmer.position,expeditionFloor(c.x,c.z),actualSwimSpeed);
  try{saveProgress(next);Object.assign(progress,next);fieldTargetId='';fieldFeedback=`Recovered ${c.amount} ${MATERIALS[c.material].toLowerCase()}. Material receipt saved.`;music?.playCue('signal');}
  catch{fieldFeedback='Supply recovery could not be saved. Materials and case are unchanged. Allow storage and retry.';}updateHud();
}
async function buildMaterialRecipe(recipe:MaterialRecipe){
  if(fieldCrafting||boatSwitching||adBusy||!canVisitStand())return;
  try{fabricateMaterials(progress,recipe);}catch(e){inventory.report((e as Error).message);return;}
  fieldCrafting=true;
  const craftButton=inventory.dialog.querySelector<HTMLButtonElement>(`[data-craft-material="${recipe}"]`);if(craftButton){craftButton.disabled=true;craftButton.textContent='Preparing';}
  try{
    if(recipe==='pod')await salvageWorld.load();if(!canVisitStand()||boatSwitching||adBusy)return;
    const next=fabricateMaterials(progress,recipe);try{saveProgress(next);}catch{inventory.report('Fabrication could not be saved. Credits and materials are unchanged. Allow storage and retry.');return;}
    Object.assign(progress,next);inventory.report(`${RECIPES[recipe].name} ${recipe==='refill'?'resupplied':'fabricated'}.`);music?.playCue('purchase');updateHud();
  }catch{inventory.report('Field model unavailable. Credits and materials are unchanged. Retry fabrication.');}
  finally{fieldCrafting=false;if(inventory.open)inventory.render();}
}
async function togglePodDeployment(){
  if(fieldCrafting||playerMode!=='helm'||menusOpen()||!podAnchorage(progress,yacht.position,speed))return;
  fieldCrafting=true;try{
    await salvageWorld.load();if(playerMode!=='helm'||menusOpen())return;
    const anchor=podAnchorage(progress,yacht.position,speed);if(!anchor)return;
    const packing=!!progress.salvage?.pod.site,next=packing?packPod(progress,yacht.position,speed):deployPod(progress,anchor.id,yacht.position,speed);
    try{saveProgress(next);}catch{reportRov('Pod operation could not be saved. Location and reservoirs are unchanged.');return;}
    Object.assign(progress,next);fieldTargetId='';fieldFeedback='';reportRov(packing?'Survey anchor packed. Remaining reservoirs retained.':'Survey anchor deployed. Service connectors are below its marker buoy.');
  }catch(e){reportRov((e as Error).message);}finally{fieldCrafting=false;updateHud();}
}
function usePodService(){
  if(menusOpen()||fieldInput()||!salvageWorld.loaded||playerMode!=='swim'&&playerMode!=='rov')return;
  const site=FIELD_POSTS.find(s=>s.id===progress.salvage?.pod.site);if(!site)return;
  try{
    const serviced=servicePod(progress,activePlayerPosition(),expeditionFloor(site.x,site.z),playerMode==='swim'?actualSwimSpeed:rovSpeed,playerMode,oxygen);
    try{saveProgress(serviced.progress);}catch{fieldFeedback='Field service could not be saved. Reservoirs and equipment are unchanged. Allow storage and retry.';updateHud();return;}
    Object.assign(progress,serviced.progress);if(playerMode==='swim')oxygen=serviced.oxygen;cruiseActive=false;fieldTargetId='';fieldFeedback='Service receipt saved.';music?.playCue('signal');
  }catch(e){fieldFeedback=(e as Error).message;}updateHud();
}
function renderFieldHud(){
  gameRoot.classList.remove('is-field-focused');
  const deploy=document.querySelector<HTMLButtonElement>('[data-pod-deploy]')!;deploy.hidden=playerMode!=='helm'||!progress.salvage?.pod.built;const anchor=podAnchorage(progress,yacht.position,speed);deploy.disabled=fieldCrafting||!anchor||!!progress.salvage?.pod.site&&anchor.id!==progress.salvage.pod.site;deploy.querySelector('span')!.textContent=progress.salvage?.pod.site?'Pack pod':'Deploy pod';
  const panel=document.querySelector<HTMLElement>('[data-field-work]')!,parent=playerMode==='rov'?document.querySelector('.rov-tools'):document.querySelector('.dive-tools');if(parent&&panel.parentElement!==parent)parent.append(panel);
  const active=playerMode==='swim'||playerMode==='rov',contacts=active?salvageWorld.contacts(progress,activePlayerPosition()).filter(c=>playerMode==='swim'||c.id==='calypso-service'):[];
  panel.hidden=!active||!contacts.length&&!fieldFeedback;if(panel.hidden)return;
  const select=panel.querySelector<HTMLSelectElement>('[data-field-target]')!,signature=contacts.map(c=>c.id).join('|');
  if(signature!==fieldSignature||!select.options.length){fieldSignature=signature;select.replaceChildren(...contacts.map(c=>new Option(c.name,c.id)));if(!contacts.some(c=>c.id===fieldSelectedId))fieldSelectedId=contacts[0]?.id??'';select.value=fieldSelectedId;}
  const service=fieldSelectedId==='calypso-service',recover=panel.querySelector<HTMLButtonElement>('[data-field-recover]')!,approach=panel.querySelector<HTMLButtonElement>('[data-field-approach]')!,use=panel.querySelector<HTMLButtonElement>('[data-pod-service]')!;
  const focus=contacts.find(c=>c.id===fieldSelectedId);if(focus&&(focus.distance<10||cruiseActive&&fieldTargetId===focus.id)){
    gameRoot.classList.add('is-field-focused');if(objectiveText)objectiveText.textContent=focus.name;if(npcText&&playerMode==='swim'&&oxygen>=25)npcText.textContent=service?'Field service / finite air and power reservoirs':'Reclaimed equipment / material recovery';const guide=document.querySelector('[data-nav-bearing]');if(guide)guide.textContent=`${focus.name} / ${Math.round(focus.distance)} m`;
  }
  select.hidden=!contacts.length;approach.disabled=!salvageWorld.loaded||!fieldPoint(fieldSelectedId);recover.hidden=service||playerMode==='rov'||!contacts.length;recover.disabled=!!fieldReading||!fieldRecoveryReady();recover.textContent=fieldReading?'Releasing case':selectedTool==='cutter'?'Recover supplies':'Cutter required';
  use.hidden=!service;const site=FIELD_POSTS.find(s=>s.id===progress.salvage?.pod.site),state=progress.salvage?.pod;
  const needed=playerMode==='swim'?!!state&&(state.air>0&&oxygen<99.5||state.energy>0&&!!progress.fieldEquipment?.scooter&&progress.fieldEquipment.charge<99.5):!!state&&state.energy>0&&(progress.rov?.battery??100)<99.5;
  use.disabled=!site||!salvageWorld.loaded||fieldInput()||!needed||!podServiceReady(progress,activePlayerPosition(),expeditionFloor(site.x,site.z),playerMode==='swim'?actualSwimSpeed:rovSpeed);
  panel.querySelector('[data-field-stores]')!.textContent=service?`Air ${state?.air??0}/400 / Power ${state?.energy??0}/300`:`Alloy ${progress.salvage?.stock.alloy??0} / Copper ${progress.salvage?.stock.copper??0} / Cartridges ${progress.salvage?.stock.cell??0}`;
  const meter=panel.querySelector<HTMLProgressElement>('[data-field-reading]')!;meter.hidden=!fieldReading;meter.value=fieldReading?.seconds??0;const status=panel.querySelector<HTMLElement>('[data-field-feedback]')!;status.hidden=!fieldFeedback;status.textContent=fieldFeedback;
  if(fieldTargetId&&cruiseActive){const target=fieldTargetPoint();if(target){if(objectiveText)objectiveText.textContent=contacts.find(c=>c.id===fieldTargetId)?.name??'Field equipment';const guide=document.querySelector('[data-nav-bearing]');if(guide)guide.textContent=`Field equipment / ${Math.round(Math.hypot(target.x-activePlayerPosition().x,target.y-activePlayerPosition().y,target.z-activePlayerPosition().z))} m`;}}
}
function reportRov(message:string){rovFeedback=message;setNotice(message);updateHud();}
function observatoryReadingReady(){
  tmpVectorC.set(0,0,-1).applyQuaternion(researchRov.root.quaternion);
  return playerMode==='rov'&&!!progress.rov?.owned&&observatory.loaded&&!rovChase&&!menusOpen()&&pelagicReady(progress.expedition,observatory.floor,researchRov.root.position,tmpVectorC,rovSpeed);
}
function beginObservatoryReading(){
  if(observatoryReading||!observatoryReadingReady())return;
  const target=pelagicTarget(progress.expedition,observatory.floor)!;
  observatoryReading={run:progress.expedition.run,index:target.index,seconds:0};rovFeedback=`Acquiring ${target.name}`;updateHud();
}
function canLaunchRov(){return playerMode==='helm'&&!!progress.rov?.owned&&(progress.rov.battery??0)>2&&Math.abs(speed)<.7&&yacht.position.distanceTo(marinaPosition)>45&&!menusOpen();}
async function launchResearchRov(){
  if(rovLaunching||!canLaunchRov())return;rovLaunching=true;rovFeedback='Preparing research ROV';updateHud();
  try{
    await researchRov.load();if(!canLaunchRov())return;
    clearPlayerInput();cruiseActive=false;speed=0;throttleValue=0;steerValue=0;displaySpeed=0;
    const vessel=BOAT_CATALOG[progress.activeBoat];
    researchRov.root.position.set(vessel.beam*.65,0,vessel.length*.47+2).applyQuaternion(yacht.quaternion).add(yacht.position);
    const surface=sampleOceanHeight(researchRov.root.position.x,researchRov.root.position.z,gameTime),bounds=rovDepthBounds(expeditionFloor(researchRov.root.position.x,researchRov.root.position.z),surface);
    if(!bounds){reportRov('Move the vessel to deeper water before deploying the ROV.');return;}
    researchRov.root.position.y=THREE.MathUtils.clamp(surface-2.2,bounds.min,bounds.max);
    rovYaw=heading;rovPitch=0;rovChase=true;rovLights=true;rovSpeed=0;rovLastScan=-Infinity;rovLastManual=-Infinity;rovContacts=[];rovFeedback='';
    researchRov.root.rotation.set(0,-rovYaw,0,'YXZ');researchRov.root.visible=true;playerMode='rov';gameRoot.dataset.playerMode='rov';
    pulseResearchRov(false);updateHud();
  }catch{reportRov('ROV model unavailable. Your equipment and credits are unchanged. Retry launch.');}
  finally{rovLaunching=false;updateHud();}
}
function recallResearchRov(message='ROV recovered. Helm control restored.'){
  if(playerMode!=='rov')return;clearPlayerInput();cruiseActive=false;fieldTargetId='';fieldReading=undefined;observatoryReading=undefined;researchRov.recover();rovContacts=[];diveSonar.clear();
  playerMode='helm';gameRoot.dataset.playerMode='helm';camera.position.copy(cameraOffsets[2]).applyQuaternion(yacht.quaternion).add(yacht.position);cameraMode=2;
  persistExpedition();reportRov(message);
}
function updateResearchRov(delta:number){
  const equipment=progress.rov??=newRovEquipment(),active=playerMode==='rov';
  if(!active){equipment.battery=rovBatteryStep(equipment.battery,delta,{owned:equipment.owned,active:false,aboard:playerMode==='helm',moving:false,lights:false});return;}
  rovPrevious.copy(researchRov.root.position);rovAnchor.copy(yacht.position);rovAnchor.y+=.5;
  const move=(isDown('KeyW')||isDown('ArrowUp')?1:0)-(isDown('KeyS')||isDown('ArrowDown')?1:0);
  const turn=(isDown('KeyD')||isDown('ArrowRight')?1:0)-(isDown('KeyA')||isDown('ArrowLeft')?1:0);
  const vertical=(isDown('Space')?1:0)-(isDown('ControlLeft')||isDown('ControlRight')?1:0);
  let forward=Math.abs(move)>.01?move:gamepadThrottle,rise=Math.abs(vertical)>.01?vertical:gamepadVertical;
  const manual=Math.abs(forward)+Math.abs(rise)+Math.abs(turn)+Math.abs(gamepadSteer)>.05;
  if(manual){cruiseActive=false;fieldTargetId='';if(observatoryReading){observatoryReading=undefined;rovFeedback='Reading interrupted. Hold position and retry.';}}
  if(cruiseActive&&(progress.expedition.stage==='remote'||fieldTargetId==='calypso-service')){
    const servicing=fieldTargetId==='calypso-service',goal=servicing?fieldTargetPoint():pelagicApproach(progress.expedition,observatory.floor,researchRov.root.position),terminal=pelagicTarget(progress.expedition,observatory.floor);
    if(goal&&(servicing?salvageWorld.loaded:!!terminal&&observatory.loaded)){
      tmpVectorD.set(goal.x,goal.y,goal.z).sub(researchRov.root.position);const range=tmpVectorD.length();
      if(range<.45){if(servicing)tmpVectorD.set(goal.x,goal.y-1,goal.z-3).sub(researchRov.root.position);else tmpVectorD.set(terminal!.deviceX,terminal!.deviceY,terminal!.deviceZ).sub(researchRov.root.position);}
      const desiredYaw=Math.atan2(tmpVectorD.x,-tmpVectorD.z),desiredPitch=Math.atan2(tmpVectorD.y,Math.hypot(tmpVectorD.x,tmpVectorD.z));
      rovYaw+=Math.atan2(Math.sin(desiredYaw-rovYaw),Math.cos(desiredYaw-rovYaw))*Math.min(1,delta*5);rovPitch=THREE.MathUtils.damp(rovPitch,desiredPitch,5,delta);
      forward=range<.45?0:Math.min(1,range/2)*Math.max(0,Math.cos(desiredYaw-rovYaw));rise=0;
    }else forward=rise=0;
  }
  rovYaw+=(Math.abs(turn)>.01?turn:gamepadSteer)*delta*1.4;
  researchRov.root.rotation.set(rovPitch,-rovYaw,0,'YXZ');
  tmpVectorC.set(0,0,-1).applyQuaternion(researchRov.root.quaternion);researchRov.root.position.addScaledVector(tmpVectorC,forward*RESEARCH_ROV.speed*delta);researchRov.root.position.y+=rise*2.2*delta;
  const tetherLimit=RESEARCH_ROV.range-RESEARCH_ROV.radius;
  const limited=constrainRovTether(researchRov.root.position,rovAnchor,tetherLimit);researchRov.root.position.set(limited.x,limited.y,limited.z);
  researchRov.resolve(researchRov.root.position,rovPrevious);expeditionWorld.resolveDiver(researchRov.root.position,rovPrevious,RESEARCH_ROV.radius);wreckward.resolveRov(researchRov.root.position,rovPrevious);
  arrayService.resolveDiver(researchRov.root.position,rovPrevious,RESEARCH_ROV.radius);
  observatory.resolve(researchRov.root.position,rovPrevious);
  salvageWorld.resolve(researchRov.root.position,rovPrevious);
  const bounds=rovDepthBounds(expeditionFloor(researchRov.root.position.x,researchRov.root.position.z),sampleOceanHeight(researchRov.root.position.x,researchRov.root.position.z,gameTime));
  if(bounds)researchRov.root.position.y=THREE.MathUtils.clamp(researchRov.root.position.y,bounds.min,bounds.max);else researchRov.root.position.copy(rovPrevious);
  if(researchRov.root.position.distanceTo(rovAnchor)>tetherLimit+.01)researchRov.root.position.copy(rovPrevious);
  rovSpeed=researchRov.root.position.distanceTo(rovPrevious)/Math.max(.001,delta);
  if(observatoryReading){
    const target=pelagicTarget(progress.expedition,observatory.floor);
    if(!target||target.index!==observatoryReading.index||progress.expedition.run!==observatoryReading.run||!observatoryReadingReady()){observatoryReading=undefined;rovFeedback='Reading interrupted. Hold the terminal in optical view and retry.';}
    else if((observatoryReading.seconds+=delta)>=2){
      observatoryReading=undefined;const next=structuredClone(progress);
      next.expedition=recordPelagicPort(next.expedition,observatory.floor,researchRov.root.position,tmpVectorC,rovSpeed);
      try{saveProgress(next);Object.assign(progress,next);cruiseActive=false;rovFeedback=next.expedition.stage==='return'?'Three archives secured. Recall Sentry and bring the report to harbor.':`${target.name} saved. Continue to the next terminal.`;music?.playCue('signal');}
      catch{rovFeedback='Archive could not be saved. Records and credits are unchanged. Allow storage and retry.';}updateHud();
    }
  }
  equipment.battery=rovBatteryStep(equipment.battery,delta,{owned:true,active:true,aboard:false,moving:Math.abs(forward)+Math.abs(rise)>.01,lights:rovLights});
  researchRov.update(delta,rovAnchor,rovSpeed>.02,rovLights);
  if(equipment.battery<=2){recallResearchRov('ROV reserve reached. Recovery complete; recharge aboard.');return;}
  if(gameTime-rovLastScan>=SONAR_COOLDOWN)pulseResearchRov(false);
}
function pulseResearchRov(manual=true){
  if(playerMode!=='rov'||menusOpen()||manual&&gameTime-rovLastManual<SONAR_COOLDOWN)return;
  if(manual)rovLastManual=gameTime;
  const p=researchRov.root.position,objective=freighterObjective(progress.expedition,wreckward.floor);
  const extra:ScanIdentification[]=objective?[{id:`freighter-${objective.id}`,name:objective.name,kind:'Research instrument',note:'Pelagic 05 field objective',action:'Diver recovery',x:objective.x,y:objective.y,z:objective.z,distance:Math.hypot(objective.x-p.x,objective.y-p.y,objective.z-p.z),bearing:Math.atan2(objective.x-p.x,-(objective.z-p.z)),vertical:objective.y-p.y}]:[];
  const terminal=pelagicTarget(progress.expedition,observatory.floor);if(terminal)extra.push({id:`observatory-${terminal.id}`,name:terminal.name,kind:'Research instrument',note:'Pelagic Observatory archive terminal',action:'Optical ROV reading',x:terminal.x,y:terminal.y,z:terminal.z,distance:Math.hypot(terminal.x-p.x,terminal.y-p.y,terminal.z-p.z),bearing:Math.atan2(terminal.x-p.x,-(terminal.z-p.z)),vertical:terminal.y-p.y});
  extra.push(...salvageWorld.contacts(progress,p));
  rovContacts=identifyScan(progress.expedition,p,expeditionWorld.animals,extra);rovLastScan=gameTime;diveSonar.emit(p,rovContacts,gameTime);updateHud();
}
function renderRovHud(){
  const active=playerMode==='rov',equipment=progress.rov;
  const boost=document.querySelector<HTMLButtonElement>('.touch-controls [data-hold="ShiftLeft"]');if(boost){boost.disabled=active;boost.title=active?'ROV has fixed-speed thrust':'Boost';}
  const launch=document.querySelector<HTMLButtonElement>('[data-rov-launch]');if(launch){launch.hidden=!equipment?.owned||playerMode!=='helm';launch.disabled=rovLaunching||!canLaunchRov();launch.querySelector('span')!.textContent=rovLaunching?'Preparing ROV':(equipment?.battery??0)<=2?'ROV / recharging':'Launch ROV';}
  const feedback=document.querySelector<HTMLElement>('[data-rov-feedback]');if(feedback){const parent=active?document.querySelector('.rov-tools'):playerMode==='swim'?document.querySelector('.dive-tools'):actionDock;if(parent&&feedback.parentElement!==parent)parent.append(feedback);feedback.hidden=!rovFeedback;feedback.textContent=rovFeedback;}
  if(!active)return;
  const terminal=pelagicTarget(progress.expedition,observatory.floor),acquire=document.querySelector<HTMLButtonElement>('[data-rov-acquire]'),reading=document.querySelector<HTMLProgressElement>('[data-rov-reading]');
  if(acquire){acquire.hidden=!terminal;acquire.disabled=!!observatoryReading||!observatoryReadingReady();acquire.textContent=observatoryReading?'Acquiring archive':!observatory.loaded?'Preparing observatory':rovChase?'Optical view required':`Read ${terminal?.name??'terminal'}`;}
  if(reading){reading.hidden=!terminal;reading.value=observatoryReading?.seconds??0;}
  if(modeText)modeText.textContent='ROV';if(speedText)speedText.textContent=rovSpeed.toFixed(1);const unit=document.querySelector('[data-speed-unit]');if(unit)unit.textContent='m/s';if(headingText)headingText.textContent=formatHeading(rovYaw);
  if(modeToggle)modeToggle.textContent='Recall ROV';if(objectiveText)objectiveText.textContent=terminal?`${terminal.name} / ${progress.expedition.observatoryRecords?.length??0}/3`:progress.expedition.route==='pelagic'&&progress.expedition.stage==='return'?'Archives secured / return to harbor':'Sentry / scouting';if(npcText)npcText.textContent=`Tether ${Math.round(researchRov.root.position.distanceTo(rovAnchor))} / ${RESEARCH_ROV.range} m`;
  const help=document.querySelector('[data-nav-help]');if(help)help.textContent=rovChase?'Sentry / external camera':'Sentry / optical camera';
  const bearing=document.querySelector('[data-nav-bearing]');if(bearing&&terminal)bearing.textContent=`${terminal.name} / ${Math.round(researchRov.root.position.distanceTo(new THREE.Vector3(terminal.x,terminal.y,terminal.z)))} m / Pelagic Observatory`;
  document.querySelector('[data-rov-battery]')!.textContent=`${Math.ceil(equipment?.battery??0)}%`;
  const meter=document.querySelector<HTMLMeterElement>('[data-rov-meter]');if(meter)meter.value=equipment?.battery??0;
  document.querySelector('[data-rov-range]')!.textContent=`${Math.round(researchRov.root.position.distanceTo(rovAnchor))} / ${RESEARCH_ROV.range} m`;
  document.querySelector('[data-rov-sweep]')!.textContent=`Last sweep ${Math.floor(gameTime-rovLastScan)} s / ${rovContacts.length} contacts`;
  const light=document.querySelector('[data-rov-light]');light?.setAttribute('aria-pressed',String(rovLights));
  const pulse=document.querySelector<HTMLButtonElement>('[data-rov-pulse]');if(pulse)pulse.disabled=gameTime-rovLastManual<SONAR_COOLDOWN;
  if(rovRenderedContacts!==rovContacts){
    rovRenderedContacts=rovContacts;const list=document.querySelector('[data-rov-contacts]')!;list.replaceChildren();
    for(const contact of rovContacts){const row=document.createElement('li');const name=document.createElement('strong');name.textContent=contact.name;const detail=document.createElement('span');detail.textContent=`${contact.kind} / ${Math.round(contact.distance)} m / depth ${Math.max(0,-contact.y).toFixed(1)} m`;row.append(name,detail);list.append(row);}
  }
}

function ensureDiveDrive():Promise<void> {
  if(scooterVisual)return Promise.resolve();
  if(scooterLoad)return scooterLoad;
  scooterLoading=true;
  scooterLoad=new GLTFLoader().loadAsync(SCOOTER.model).then(asset=>{
    const root=asset.scene;root.name=SCOOTER.name;
    root.position.set(0,-.28,-.85);root.scale.setScalar(.82);root.visible=false;
    root.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=node.receiveShadow=true;if(node.material instanceof THREE.MeshStandardMaterial)node.material.envMapIntensity=.55;}});
    swimmer.add(root);
    try{scooterGrip=new ScooterGrip(swimmerCharacter.root,root);}catch(error){swimmer.remove(root);throw error;}
    scooterVisual=root;
  }).finally(()=>{scooterLoading=false;scooterLoad=undefined;updateHud();});
  return scooterLoad;
}
async function buildDiveDrive(){
  if(scooterBuilding||boatSwitching||adBusy||!canVisitStand())return;
  const report=(message:string)=>{inventory.report(message);setNotice(message);};
  try{fabricateScooter(progress);}catch(error){report((error as Error).message);return;}
  scooterBuilding=true;
  const button=inventory.dialog.querySelector<HTMLButtonElement>('[data-fabricate-scooter]');if(button){button.disabled=true;button.textContent='Preparing drive…';}
  try{
    await ensureDiveDrive();
    if(!canVisitStand()||adBusy||boatSwitching)return;
    const next=fabricateScooter(progress);
    try{saveProgress(next);}catch{report('Dive drive could not be saved. Your credits and blueprint are unchanged. Allow browser storage and retry.');return;}
    Object.assign(progress,next);music?.playCue('purchase');report('Manta Dive Drive fabricated. Its battery recharges aboard your vessel.');renderHarbor();
  }catch{report('Dive drive model could not load. No credits were spent. Retry at the outfitter.');}
  finally{scooterBuilding=false;inventory.render();updateHud();}
}
async function toggleDiveDrive(){
  if(playerMode!=='swim'||menusOpen()||!progress.fieldEquipment?.scooter||scooterLoading)return;
  if(scooterEnabled){scooterEnabled=false;updateHud();return;}
  if(progress.fieldEquipment.charge<=0){setNotice('Recharge the dive drive aboard your vessel.');return;}
  try{await ensureDiveDrive();if(playerMode==='swim'&&!menusOpen()){scooterEnabled=true;setNotice('Dive drive enabled. Forward propulsion below the surface; normal swimming remains available.');updateHud();}}
  catch{setNotice('Dive drive model could not load. Toggle again to retry.');}
}
function emitDiveSonar(manual=true){
  const remaining=manual?SONAR_COOLDOWN-(gameTime-sonarManualStarted):0;
  if(remaining>0){setNotice(`Sonar recharging · ${Math.ceil(remaining)} s.`);return;}
  if(manual)sonarManualStarted=gameTime;
  const point=arrayService.position,extra:ScanIdentification[]=progress.expedition.stage==='repair'?[{id:'array-service',name:'Array service station',kind:'Research instrument',note:'Isolated reference channels. West 46 Hz reversed / Center 18 Hz normal / North 32 Hz reversed.',action:'Scanner / commission at the cabinet',x:point.x,y:point.y,z:point.z,distance:swimmer.position.distanceTo(point),bearing:Math.atan2(point.x-swimmer.position.x,-(point.z-swimmer.position.z)),vertical:point.y-swimmer.position.y}]:[];
  const freighter=freighterObjective(progress.expedition,wreckward.floor);if(freighter)extra.push({id:`freighter-${freighter.id}`,name:freighter.name,kind:'Research instrument',note:freighter.index===0?'A wide starboard breach into the flooded cargo corridor.':freighter.index<3?'The sealed deployment archive inside Pelagic 05.':'A separate port breach leading into open water.',action:`${freighter.tool==='cutter'?'Cutter':'Scanner'} / ${freighter.action.toLowerCase()}`,x:freighter.x,y:freighter.y,z:freighter.z,distance:swimmer.position.distanceTo(new THREE.Vector3(freighter.x,freighter.y,freighter.z)),bearing:Math.atan2(freighter.x-swimmer.position.x,-(freighter.z-swimmer.position.z)),vertical:freighter.y-swimmer.position.y});
  extra.push(...salvageWorld.contacts(progress,swimmer.position));
  const station=masteryStation(progress.mastery,expeditionFloor);
  if(station)extra.unshift({id:`mastery-${station.id}`,name:station.name,kind:'Research instrument',note:'Habitat water-column survey. Remain inside the column for four seconds; time, wind and sea state are attached to the record.',action:'Scanner / acquire mastery reading',x:station.x,y:station.y,z:station.z,distance:swimmer.position.distanceTo(new THREE.Vector3(station.x,station.y,station.z)),bearing:Math.atan2(station.x-swimmer.position.x,-(station.z-swimmer.position.z)),vertical:station.y-swimmer.position.y});
  sonarResults=identifyScan(progress.expedition,swimmer.position,expeditionWorld.animals,extra);sonarStarted=gameTime;sonarSweeps++;
  diveSonar.emit(swimmer.position,sonarResults,gameTime);
  if(manual){setNotice(sonarResults.length?`Sonar identified ${sonarResults[0].name} / ${sonarResults.length} contact${sonarResults.length===1?'':'s'}.`:'Sonar: no contacts in range.');music?.playCue('signal');}updateHud();
}

async function acceptVoyageContract(id:string):Promise<boolean> {
  if(progress.mastery?.active)return false;
  const contract=contractById(id),record=progress.expedition;
  if(contract?.remote&&!progress.rov?.owned)return false;
  if(!contract||!contractAvailable(contract,progress.voyage.completed)||!canVisitStand()||boatSwitching||adBusy||!record.sold&&record.stage!=='briefing')return false;
  if(record.grantState==='earned'&&!saveEarnedGrant())return false;
  const next=structuredClone(progress);next.expedition=newContractExpedition(id,record.run+(record.sold?1:0));next.expedition.stage='reef';next.voyage.activeWaypoint=undefined;
  try{saveProgress(next);}catch{return false;}
  Object.assign(progress,next);fieldTargetId='';fieldReading=undefined;transectReading=undefined;cancelSwimAssist();expeditionComplete=false;rewardGranted=false;rewardDoubled=false;
  closeResearchStand();updateMissions(0);updateHud();setNotice(contract.briefing);return true;
}

function masteryAnchor(){return{x:yacht.position.x,z:yacht.position.z,yaw:heading};}
function masteryReturning(){const r=progress.mastery?.active;return !!r&&r.readings.length===masteryPlan(r.id)!.stops.length;}
function masteryAction(action:'start'|'claim'|'abandon',id?:string):boolean{
  if(boatSwitching||adBusy)return false;
  try{
    const next=action==='start'?beginMastery(progress,id as MasteryId,canVisitStand(),masteryAnchor()):action==='claim'?claimMastery(progress,canVisitStand()):abandonMastery(progress,canVisitStand());
    saveProgress(next);Object.assign(progress,next);cancelSwimAssist();masteryFeedback='';if(action==='claim')music?.playCue('purchase');updateHud();return true;
  }catch{return false;}
}
function masteryReadingReady(){
  const moving=['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyZ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight'].some(isDown)||Math.abs(gamepadThrottle)+Math.abs(gamepadSteer)+Math.abs(gamepadVertical)>.05;
  return playerMode==='swim'&&selectedTool==='scanner'&&swimmerCharacter.source==='supplied'&&!moving&&masteryReady(progress.mastery,swimmer.position,expeditionFloor,Math.max(Math.abs(swimSpeed),actualSwimSpeed),sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-swimmer.position.y);
}
function updateMasteryReading(delta:number){
  const reading=masteryReading;if(!reading)return;
  const active=progress.mastery?.active;
  if(!active||active.id!==reading.id||active.readings.length!==reading.index||!masteryReadingReady()){masteryReading=undefined;masteryFeedback='Reading interrupted. Hold position inside the water column and retry.';return;}
  reading.seconds+=delta;if(reading.seconds<MASTERY_DWELL)return;
  masteryReading=undefined;
  try{
    const next=recordMastery(progress,swimmer.position,expeditionFloor,actualSwimSpeed,sampleOceanHeight(swimmer.position.x,swimmer.position.z,gameTime)-swimmer.position.y,weatherKey,currentSea.windKnots,masteryAnchor());
    saveProgress(next);Object.assign(progress,next);cancelSwimAssist();masteryFeedback=masteryReturning()?'All station records secured. Board your yacht and return to harbor.':'Station record saved. Board your yacht for the next region.';music?.playCue('signal');
  }catch{masteryFeedback='Reading could not be saved. Your report is unchanged; allow storage and retry.';}
  setNotice(masteryFeedback);updateHud();
}
function renderMasteryHud(){
  const active=progress.mastery?.active,status=document.querySelector<HTMLElement>('[data-mastery-status]')!;
  status.hidden=!active||playerMode!=='swim';if(!active)return;
  const plan=masteryPlan(active.id)!,station=masteryStation(progress.mastery,expeditionFloor),returning=!station;
  if(progressText)progressText.textContent=String(active.readings.length);document.querySelector('[data-objective-total]')!.textContent=String(plan.stops.length);
  const returningToBoat=playerMode==='swim'&&swimReturnToBoat;
  if(objectiveText&&playerMode!=='walk')objectiveText.textContent=returningToBoat?'Return to your vessel':returning?'Return the mastery report to harbor':`${plan.title} / ${active.readings.length+1}/${plan.stops.length}`;
  if(npcText&&!(playerMode==='swim'&&oxygen<25))npcText.textContent=masteryFeedback||(station?`Selene: ${station.name}. Acquire a stable Scanner reading before continuing.`:'Selene: All water columns recorded. The complete report is ready to archive at harbor.');
  if(playerMode==='swim'){
    status.textContent=masteryFeedback||`${active.readings.length}/${plan.stops.length} station records / ${station?.name??'Report complete'}`;
    if(selectedTool==='scanner'){
      interactionReady=!!station&&!masteryReading&&masteryReadingReady();if(interactButton){interactButton.disabled=!interactionReady;interactButton.textContent=masteryReading?'Acquiring reading':returning?'Report complete':'Acquire reading / F';}
      if(toolPrompt)toolPrompt.textContent=masteryReading?`Acquiring / ${Math.round(masteryReading.seconds/MASTERY_DWELL*100)}%`:station?`${station.name} / ${Math.round(swimmer.position.distanceTo(new THREE.Vector3(station.x,station.y,station.z)))} m / hold position`:'Board and return to harbor';
      gameRoot.classList.toggle('target-ready',interactionReady);
    }else{if(toolPrompt)toolPrompt.textContent='Mastery survey / Scanner required';if(interactButton)interactButton.disabled=true;}
    const meter=document.querySelector<HTMLProgressElement>('[data-reading-progress]')!;meter.hidden=!masteryReading;meter.max=MASTERY_DWELL;meter.value=masteryReading?.seconds??0;
    const pulse=document.querySelector<HTMLButtonElement>('[data-sonar-pulse]')!;pulse.hidden=selectedTool!=='scanner';pulse.disabled=!!masteryReading||gameTime-sonarManualStarted<SONAR_COOLDOWN;
  }
  if(playerMode!=='walk'&&!fieldTargetId){const target=objectiveLocation(),p=activePlayerPosition(),bearing=Math.atan2(target.x-p.x,-(target.z-p.z)),waypoint=playerMode==='helm'?waypointLocation(progress.voyage):undefined;document.querySelector('[data-nav-bearing]')!.textContent=`${formatHeading(bearing)} / ${Math.round(p.distanceTo(target))} m / ${waypoint?.name??(returningToBoat?'Return to vessel':station?.name??'Research harbor')}`;}
}

async function finishConversation(id:string,choice:string):Promise<boolean>{
  const next=completeStory(progress,id,choice);
  if(id==='welcome'&&choice==='depart'){
    if(!canVisitStand()||progress.expedition.stage!=='briefing')return false;
    next.expedition.stage='reef';next.expedition.checkpoint='harbor';next.voyage.activeWaypoint=undefined;
  }
  try{saveProgress(next);}catch{return false;}
  Object.assign(progress,next);updateHud();return true;
}

function planRepairSite(){return expeditionPlan(progress.expedition).secondSite;}
function diveExitRoute(){
  if(Math.hypot(swimmer.position.x-PELAGIC_SITE.x,swimmer.position.z-PELAGIC_SITE.z)<7&&swimmer.position.y<observatory.floor+4.7&&swimmer.position.z<PELAGIC_SITE.z+8.3)return{x:PELAGIC_SITE.x,y:observatory.floor+3,z:PELAGIC_SITE.z+9};
  return freighterExit(swimmer.position,wreckward.floor)??passageExit(progress.expedition,swimmer.position,yacht.position,expeditionWorld.passageClearance);
}
function arrayRepairReady(){return playerMode==='swim'&&progress.expedition.stage==='repair'&&arrayService?.loaded&&swimmer.position.distanceTo(arrayService.position)<3.5;}
function finishArrayRepair(circuits:Parameters<typeof commissionArray>[1]){
  if(!arrayRepairReady())return false;
  const next=structuredClone(progress);next.expedition=commissionArray(next.expedition,circuits);
  try{saveProgress(next);}catch{return false;}
  Object.assign(progress,next);cruiseActive=false;updateHud();music?.playCue('recovery');setNotice('Array feed restored. Return the commissioning record to the research harbor.');return true;
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
  const clock=progress.weather!;
  advanceWeather(clock,delta);
  const scheduled=activeWeather(clock);
  if(scheduled!==weatherKey){selectWeather(scheduled,false);setNotice(`${WEATHER_PRESETS[scheduled].label} front arriving. ${scheduled==='storm'?'Rough seas: reduce throttle or shelter at harbor.':'Marine forecast updated.'}`);}
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
  const light=voyageLight(clock.elapsed);daylight=light.daylight;
  setSun(light.elevation,light.azimuth,false);
  // The night key light follows the moon; sky and surface sunlight remain astronomical.
  if(daylight<.1){sun.multiplyScalar(-1);sunGlow.position.copy(sun).multiplyScalar(620);water.material.uniforms.sunDirection.value.copy(sun);}
  sunGlow.material.color.set(daylight<.1?0xcddfff:0xffefd0);
  skyUniforms.uNightAmbient.value=1-daylight;
  sunGlow.material.opacity = (daylight<.1?.65*(1-daylight/.1):.9*daylight) * (1 - currentSea.rain * 0.92);
  water.material.uniforms.sunColor.value.set(daylight<.1?0x283b50:0xffffff);
  hemisphereLight.intensity = (0.30+daylight*.20) * (1-currentSea.rain*.24);
  sunLight.intensity = (daylight<.1?.42:3*daylight) * (1-currentSea.rain*.62);
  sunLight.color.set(daylight<.1?0xabcaff:light.elevation<14?0xffc487:0xfff2ce);
  scene.environmentIntensity=.06+daylight*.12;
  renderForecast();

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
      cameraUnderwater ? 0.12*daylight : 0,
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
    const depth = Math.max(0, surfaceAtCamera - camera.position.y);
    underwaterBackground.set(0x167b92).lerp(tmpColor.set(0x0a283b),1-daylight);
    fog.color.copy(underwaterBackground);
    fog.density = THREE.MathUtils.lerp(0.008, 0.013, Math.min(depth / 70, 1));
    underwaterLight.intensity = 5+daylight*4;
    renderer.toneMappingExposure = 0.95;
  } else {
    fog.color.copy(currentFogColor).lerp(tmpColor.set(0x101e2c),1-daylight);
    fog.density = currentSea.fogDensity;
    underwaterLight.intensity = 0;
    renderer.toneMappingExposure = currentSea.exposure + (1-daylight)*.22 + lightningFlash * 0.34;
  }
  music?.setEnvironment(cameraUnderwater, currentSea.rain);
}

function selectWeather(key: WeatherKey, announce = true) {
  if(announce){
    const next=structuredClone(progress);next.weather=holdWeather(progress.weather!,key);
    try{saveProgress(next);}catch{document.querySelector<HTMLElement>('[data-forecast-feedback]')!.textContent='Weather setting could not be saved. Your forecast is unchanged.';setNotice('Weather setting could not be saved. Your forecast is unchanged.');return;}
    Object.assign(progress,next);
  }
  weatherKey = key;
  targetSea = cloneSeaState(WEATHER_PRESETS[key]);
  gameRoot.dataset.weatherMode = key;
  weatherButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.weather === key));
  });
  if (announce) {
    setNotice(`${WEATHER_PRESETS[key].label} sea selected for three sailing minutes. Wind ${targetSea.windKnots} knots.`);
  }
  renderForecast();
  document.querySelector<HTMLElement>('[data-forecast-feedback]')!.textContent='';
}

function renderForecast() {
  if(!progress.weather)return;
  const light=voyageLight(progress.weather.elapsed),forecast=weatherForecast(progress.weather);
  const canRest=(playerMode==='helm'?boatAtLanding():playerMode==='walk'&&canVisitStand())&&(light.hour<7||light.hour>=17);
  const restButton=document.querySelector<HTMLButtonElement>('[data-weather-rest]')!;restButton.disabled=!canRest;restButton.title=canRest?'Rest until 07:00; equipment and cargo remain unchanged':'Moor at harbor at dusk or night to rest';
  const signature=JSON.stringify([light.clock,light.period,forecast.key,forecast.manual,Math.ceil(forecast.remaining/60)]);
  if(signature===forecastSignature)return;forecastSignature=signature;
  forecastClock.textContent=`${light.clock} ${light.period}`;
  forecastClock.title=`${WEATHER_PRESETS[forecast.key].label}; next change in ${Math.ceil(forecast.remaining/60)} sailing min`;
  document.querySelector<HTMLElement>('[data-forecast-now]')!.textContent=`${light.clock} ${light.period} / ${WEATHER_PRESETS[forecast.key].label} / ${WEATHER_PRESETS[forecast.key].windKnots} kt wind`;
  document.querySelector<HTMLElement>('[data-forecast-advice]')!.textContent=forecast.key==='storm'?'Rough seas. Reduce throttle; hull upgrades reduce speed loss. Harbor remains available.':light.period==='Night'?'Night passage. Follow chart waypoints and keep your dive light equipped.':'Open-water conditions. Check the next front before a long dive.';
  const list=document.querySelector<HTMLOListElement>('[data-forecast-fronts]')!;list.replaceChildren();
  for(const front of forecast.entries){const li=document.createElement('li');li.textContent=`${WEATHER_PRESETS[front.key].label} in ${Math.ceil(front.inSeconds/60)} sailing min / ${WEATHER_PRESETS[front.key].windKnots} kt`;list.append(li);}
  document.querySelector('[data-weather-auto]')!.setAttribute('aria-pressed',String(!forecast.manual));
  weatherButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.weather===forecast.key)));
}

function updateWind(delta: number) {
  const boatPos = activePlayerPosition();
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
  if(playerMode==='rov'){
    tmpQuaternion.copy(researchRov.root.quaternion);
    tmpVectorD.set(0,rovChase?.8:.04,rovChase?3.1:-.84).applyQuaternion(tmpQuaternion).add(researchRov.root.position);
    if(rovChase){expeditionWorld.resolveDiver(tmpVectorD,researchRov.root.position,RESEARCH_ROV.radius);wreckward.resolveRov(tmpVectorD,researchRov.root.position);observatory.resolve(tmpVectorD,researchRov.root.position);salvageWorld.resolve(tmpVectorD,researchRov.root.position);}
    tmpVectorD.y=Math.min(tmpVectorD.y,sampleOceanHeight(tmpVectorD.x,tmpVectorD.z,gameTime)-.35);
    camera.position.copy(tmpVectorD);cameraTarget.set(0,0,-8).applyQuaternion(tmpQuaternion).add(researchRov.root.position);camera.lookAt(cameraTarget);return;
  }
  if(playerMode==='walk'){
    const p=walker.root.position;
    cameraTarget.set(p.x+Math.sin(walkYaw)*Math.cos(walkPitch)*8,p.y+1.65+Math.sin(walkPitch)*8,p.z-Math.cos(walkYaw)*Math.cos(walkPitch)*8);
    tmpVectorD.set(p.x,p.y+1.65,p.z);
    if(!firstPersonWalk){
      const back=new THREE.Vector3(-Math.sin(walkYaw)*3.5,.75,Math.cos(walkYaw)*3.5);
      let scale=1;
      for(let i=1;i<=20;i++){const f=i/20;if(expeditionWorld.walking.blocked(p.x+back.x*f,p.z+back.z*f)){scale=Math.max(.10,f-.10);break;}}
      tmpVectorD.addScaledVector(back,scale);tmpVectorD.y=Math.max(tmpVectorD.y,expeditionWorld.walking.height(tmpVectorD.x,tmpVectorD.z)+.35);
      cameraTarget.set(p.x,p.y+1.45,p.z).addScaledVector(new THREE.Vector3(Math.sin(walkYaw),0,-Math.cos(walkYaw)),3);
    }
    camera.position.lerp(tmpVectorD,1-Math.pow(.0001,delta));camera.lookAt(cameraTarget);return;
  }
  if (playerMode === 'swim') {
    tmpQuaternion.setFromEuler(yawEuler.set(swimPitch * .6, -swimYaw, 0, 'YXZ'));
    if(diveInspectionView)tmpVectorC.set(Math.sin(diveOrbitYaw)*2.6,.15+Math.sin(diveOrbitPitch)*2,-Math.cos(diveOrbitYaw)*2.6).applyQuaternion(tmpQuaternion);
    else tmpVectorC.set(0,firstPersonDive?.28:.8,firstPersonDive?-.15:5.2).applyQuaternion(tmpQuaternion);
    tmpVectorD.copy(swimmer.position).add(tmpVectorC);
    const swimmerSurface = sampleOceanHeight(swimmer.position.x, swimmer.position.z, gameTime);
    if (swimmerSurface - swimmer.position.y > 1.2) {
      const cameraSurface = sampleOceanHeight(tmpVectorD.x, tmpVectorD.z, gameTime);
      tmpVectorD.y = Math.min(tmpVectorD.y, cameraSurface - 0.65);
    }
    if(!firstPersonDive)tmpVectorD.y=Math.max(tmpVectorD.y,expeditionFloor(tmpVectorD.x,tmpVectorD.z)+.45);
    tmpVectorE.set(Math.sin(swimYaw) * Math.cos(swimPitch), Math.sin(swimPitch), -Math.cos(swimYaw) * Math.cos(swimPitch));
    cameraTarget.copy(swimmer.position).addScaledVector(tmpVectorE, diveInspectionView?.55:firstPersonDive?8:1.6);
    cameraTarget.y += 0.18;
    if(!firstPersonDive){observatory.resolve(tmpVectorD,swimmer.position);salvageWorld.resolve(tmpVectorD,swimmer.position);}
    camera.position.lerp(tmpVectorD, 1 - Math.pow(0.002, delta));
    applyCameraImpulse(delta);
    if(!firstPersonDive){observatory.resolve(camera.position,swimmer.position);salvageWorld.resolve(camera.position,swimmer.position);}
    camera.lookAt(cameraTarget);
    return;
  }

  if(cameraMode>=6&&yacht.position.distanceTo(marinaPosition)<85){
    tmpVectorD.copy(cameraOffsets[cameraMode]);
    cameraTarget.set(cameraMode===8?-57:cameraMode===9?-34:-33,cameraMode===8?1.8:cameraMode===9?2.85:3.5,cameraMode===8?30:cameraMode===9?34.7:cameraMode===6?36:42);
    camera.position.lerp(tmpVectorD,1-Math.pow(.001,delta));camera.lookAt(cameraTarget);return;
  }

  const vesselCameraScale = BOAT_CATALOG[progress.activeBoat].length / 42;
  tmpVectorC.copy(cameraOffsets[cameraMode>=6?2:cameraMode]).multiplyScalar(vesselCameraScale).applyQuaternion(yacht.quaternion);
  tmpVectorD.copy(yacht.position).add(tmpVectorC);
  cameraTarget.copy(yacht.position);
  cameraTarget.y += 3.5;
  if (cameraMode === 5) {
    cameraTarget.add(tmpVectorE.set(0, 0, 10 * vesselCameraScale).applyQuaternion(yacht.quaternion));
  }
  camera.position.lerp(tmpVectorD, 1 - Math.pow(0.001, delta));
  applyCameraImpulse(delta);
  camera.lookAt(cameraTarget);
}

function applyCameraImpulse(delta: number) {
  if (cameraImpulse < 0.001) return;
  camera.position.x += Math.sin(gameTime * 88) * cameraImpulse * 0.35;
  camera.position.y += Math.sin(gameTime * 113) * cameraImpulse * 0.22;
  cameraImpulse = THREE.MathUtils.damp(cameraImpulse, 0, 7, delta);
}

function updateHud() {
  const r=progress.expedition;const p=activePlayerPosition();if(!p)return;
  const plan=expeditionPlan(r);
  const partner=playerMode==='walk'?researchPartners?.nearest(p):undefined;
  const partnerButton=document.querySelector<HTMLButtonElement>('[data-partner-talk]');if(partnerButton){partnerButton.hidden=!partner;partnerButton.dataset.partner=partner??'';partnerButton.textContent=partner?`Talk to ${partner==='mara'?'Mara':partner==='ivo'?'Ivo':'Selene'}`:'Talk';}
  const target=objectiveLocation();const dx=target.x-p.x,dz=target.z-p.z;const bearing=Math.atan2(dx,-dz);
  if(speedText)speedText.textContent=playerMode==='walk'?walkSpeed.toFixed(1):Math.round((playerMode==='helm'?displaySpeed:Math.abs(swimSpeed))*1.94).toString();
  const unit=document.querySelector('[data-speed-unit]');if(unit)unit.textContent=playerMode==='walk'?'m/s':'kt';
  if(headingText)headingText.textContent=formatHeading(playerMode==='helm'?heading:playerMode==='walk'?walkYaw:swimYaw);
  if(targetRangeText)targetRangeText.textContent=Math.round(p.distanceTo(target)).toString();
  if(windText)windText.textContent=Math.round(currentSea.windKnots).toString();if(fpsText)fpsText.textContent=measuredFps.toString();
  if(progressText)progressText.textContent=completedObjectives(r).toString();if(creditsText)creditsText.textContent=progress.credits.toString();
  const total=document.querySelector('[data-objective-total]');if(total)total.textContent=objectiveCount(r).toString();
  if(modeText)modeText.textContent=playerMode==='helm'?'Helm':playerMode==='walk'?walkSpeed>.08?(isDown('ShiftLeft')||isDown('ShiftRight')||gamepadBoost?'On foot · Jogging':'On foot · Walking'):'On foot':'Dive';
  if(depthText)depthText.textContent=Math.max(0,sampleOceanHeight(p.x,p.z,gameTime)-p.y).toFixed(1);if(airText)airText.textContent=Math.ceil(oxygen).toString();
  airStatus?.classList.toggle('is-low',oxygen<25);if(modeToggle){modeToggle.textContent=playerMode==='helm'?'Dive':playerMode==='walk'?walkBoardRequested?'Cancel boat return':canBoardFromIsland()?'Board boat':'Return to boat':swimReturnToBoat?'Cancel boat return':canBoardSwimmer()?'Board boat':'Return to boat';modeToggle.disabled=playerMode==='walk'&&walkRouting;}
  if(walkButton){walkButton.hidden=playerMode!=='helm';walkButton.disabled=!boatAtLanding();}
  const objectives={briefing:'Begin your research expedition',interior:playerMode==='helm'?'Sail to Wreckward Reach':`Pelagic 05 / ${r.interiorSteps?.length??0}/4 field records`,repair:playerMode==='helm'?'Sail to the array service station':'Commission the array circuits',reef:playerMode==='helm'?r.route==='passage'?'Sail to the coral garden':r.route==='lagoon'?'Sail to the turtle lagoon':'Sail to the reef survey site':`${plan.habitat} · ${surveyPhotoCount(r)}/${plan.photoGoal} species · ${Number(r.waterSample)+Number(r.sedimentSample)}/2 samples`,wreck:playerMode==='helm'?'Sail to the wreck recovery site':r.cableFreed?'Retrieve the research sensor':'Free the snagged sensor cable',transect:playerMode==='helm'?`Sail to the ${plan.recoveryTitle.toLowerCase()}`:`${plan.recoveryTitle} · ${r.transectReadings.length}/3 readings`,return:'Return to the research harbor',complete:'Expedition complete · new gear awaits'};
  if(objectiveText)objectiveText.textContent=r.stage==='remote'?`Pelagic Observatory / ${r.observatoryRecords?.length??0}/3 archives`:objectives[r.stage];
  if(r.contractId&&r.stage==='reef'&&objectiveText)objectiveText.textContent=playerMode==='helm'?`Sail to ${plan.habitat.toLowerCase()}`:[plan.photoGoal?`${surveyPhotoCount(r)}/${plan.photoGoal} photographs`:null,plan.samplesRequired?`${Number(r.waterSample)+Number(r.sedimentSample)}/2 samples`:null].filter(Boolean).join(' / ');
  if(objectiveText&&playerMode==='swim'&&(swimReturnToBoat||r.stage==='return'||habitatBoatReturn()))objectiveText.textContent='Return to your vessel · surface and board';
  if(npcText)npcText.textContent=oxygen<25&&playerMode==='swim'?'Mara: Air is low. Surface or use free rescue.':r.stage==='briefing'?'Mara: Visit the harbor stand for your brief.':r.stage==='reef'?r.route==='passage'?'Mara: Turtle and blue tang photos, then the garden samples.':r.route==='lagoon'?'Mara: Turtle and ray photographs, then the two lagoon samples.':'Mara: Camera for wildlife; Sampler for marked research sites.':r.stage==='transect'?r.route==='passage'?'Mara: Survey south entrance, arch interior, then north exit.':'Mara: Scanner for three stations. Hold position for a clean reading.':r.stage==='wreck'?'Mara: The amber lamp marks the sensor beside the wreck.':r.stage==='return'?'Mara: Dock slowly, then open Harbor to sell your cargo.':'Mara: Your research payment is safely recorded.';
  if(r.contractId&&r.stage==='reef'&&npcText&&!(oxygen<25&&playerMode==='swim'))npcText.textContent=contractById(r.contractId)?.briefing??npcText.textContent;
  const guide=document.querySelector<HTMLElement>('[data-nav-bearing]');if(guide)guide.textContent=`${formatHeading(bearing)} · ${Math.round(p.distanceTo(target))} m · ${r.stage==='reef'?plan.habitat:r.stage==='transect'?plan.recoveryTitle:r.stage==='wreck'?'Wreck recovery':'Research harbor'}`;
  const waypoint=playerMode==='helm'?waypointLocation(progress.voyage):undefined;if(waypoint&&guide)guide.textContent=`${formatHeading(bearing)} / ${Math.round(p.distanceTo(target))} m / ${waypoint.name}`;
  const help=document.querySelector<HTMLElement>('[data-nav-help]');if(help)help.textContent=playerMode==='helm'?'W/S throttle · A/D steer · Cruise assist sails toward the site':'W/S swim · Drag to look · Space/Ctrl depth · F use tool · C view';
  if(standButton)standButton.disabled=!canVisitStand();
  if(cruiseButton){cruiseButton.disabled=playerMode==='rov'&&r.stage!=='remote'&&fieldTargetId!=='calypso-service'||walkRouting||(playerMode!=='walk'&&!progress.mastery?.active&&!waypoint&&!fieldTargetPoint()&&(r.stage==='briefing'||r.stage==='complete'));cruiseButton.setAttribute('aria-pressed',String(cruiseActive));cruiseButton.textContent=walkRouting?'Planning route…':cruiseActive?'Cancel assist':playerMode==='rov'?'Survey assist':playerMode==='walk'?'Walk assist':playerMode==='swim'?'Swim assist':'Cruise assist';}
  const photoAllowed=r.route==='reef'||r.stage==='reef'&&Math.hypot(swimmer.position.x-plan.site.x,swimmer.position.z-plan.site.z)<48;
  focusedSpecies=undefined;
  if(playerMode==='swim'&&selectedTool==='camera'&&photoAllowed){
    focusedSpecies=expeditionWorld.photographicTarget(camera,swimmer.position,r.photos,plan.requiredSpecies);
    if(profiling)photoTargetEvaluations++;
  }
  interactionReady=false;let prompt='Choose a tool';
  if(selectedTool==='camera'){interactionReady=!!focusedSpecies&&!r.photos.includes(focusedSpecies);prompt=focusedSpecies?`${SPECIES[focusedSpecies].name}${r.photos.includes(focusedSpecies)?' · already photographed':' · ready to photograph'}`:'Frame a visible species within 25 m';}
  else if(selectedTool==='sampler'){const sample=nearestSample(r,p);interactionReady=!!sample?.inRange;prompt=sample?`${sample.key==='water'?'Water':'Sediment'} sample · ${Math.round(sample.distance)} m`:'Both samples sealed';}
  else if(selectedTool==='cutter'){const s=SAMPLE_SITES.cable;const distance=p.distanceTo(new THREE.Vector3(s.x,s.y,s.z));interactionReady=r.stage==='wreck'&&!r.cableFreed&&distance<3.5;prompt=r.cableFreed?'Cable released':`Snagged cable · ${Math.round(distance)} m`;}
  else if(r.stage==='transect') {
    const station=nearestTransect(r,p);interactionReady=!transectReading&&!!station&&transectReady(station.distance);
    prompt=transectReading?`${plan.stations[transectReading.index].name} · acquiring ${Math.round(transectReading.seconds/2.5*100)}%`:station?`${station.site.name} · ${Math.round(station.distance)} m${!transectReady(0)?' · hold position':''}`:'All stations recorded';
  } else{interactionReady=true;prompt=r.stage==='wreck'&&r.cableFreed?'Scan or retrieve the sensor':'Scan for a research target';}
  if(r.stage!=='reef'&&r.stage!=='wreck'&&r.stage!=='transect'){
    interactionReady=false;
    prompt=r.stage==='return'?'Cargo secured. Return to the research harbor.':r.stage==='complete'?'Survey complete. Begin another expedition at the harbor.':'Visit the harbor stand to begin research.';
  }
  if(selectedTool==='scanner'&&r.stage!=='transect')interactionReady=gameTime-sonarManualStarted>=SONAR_COOLDOWN||(r.stage==='wreck'&&r.cableFreed&&swimmer.position.distanceTo(new THREE.Vector3(SAMPLE_SITES.sensor.x,SAMPLE_SITES.sensor.y,SAMPLE_SITES.sensor.z))<3.6);
  if(r.stage==='repair'&&selectedTool==='scanner'){interactionReady=arrayRepairReady()||gameTime-sonarManualStarted>=SONAR_COOLDOWN;prompt=`Array service station / ${Math.round(p.distanceTo(arrayService.position))} m${arrayRepairReady()?' / ready to commission':!arrayService.loaded?' / preparing station':''}`;}
  if(r.stage==='interior'){const step=freighterObjective(r,wreckward.floor);interactionReady=wreckward.loaded&&freighterStepReady(r,selectedTool,p,wreckward.floor);if(step)prompt=`${step.name} / ${Math.round(Math.hypot(p.x-step.x,p.y-step.y,p.z-step.z))} m / ${step.tool==='cutter'?'Cutter':'Scanner'}`;if(!wreckward.loaded)prompt='Preparing freighter interior';}
  const sonarButton=document.querySelector<HTMLButtonElement>('[data-sonar-pulse]');if(sonarButton){sonarButton.hidden=selectedTool!=='scanner'||r.stage!=='transect'&&r.stage!=='interior';sonarButton.disabled=playerMode!=='swim'||!!transectReading||gameTime-sonarManualStarted<SONAR_COOLDOWN;}
  interactionReady=interactionReady&&gameTime-lastToolUse>=.65;
  if(toolPrompt)toolPrompt.textContent=prompt;if(interactButton){interactButton.disabled=playerMode!=='swim'||!interactionReady;interactButton.textContent=selectedTool==='camera'?'Photograph · F':selectedTool==='sampler'?'Collect sample · F':selectedTool==='cutter'?'Release cable · F':r.stage==='transect'?transectReading?'Acquiring…':'Acquire reading · F':'Scan / recover · F';}
  if(interactButton&&r.stage==='repair'&&selectedTool==='scanner'&&arrayRepairReady())interactButton.textContent='Commission array / F';
  if(r.stage==='interior'){const step=freighterObjective(r,wreckward.floor);if(interactButton)interactButton.textContent=`${step?.action??'Use tool'} / F`;if(npcText&&oxygen>=25)npcText.textContent='Mara: Starboard entry, archive cassette, port escape. The overhead deck is solid; leave the breach before surfacing.';if(guide)guide.textContent=`${formatHeading(bearing)} / ${Math.round(p.distanceTo(target))} m / Pelagic 05`;}
  const freighterStatus=document.querySelector<HTMLElement>('[data-freighter-status]');if(freighterStatus){freighterStatus.hidden=r.stage!=='interior'||!freighterFeedback;freighterStatus.textContent=freighterFeedback;}
  if(r.stage==='repair'&&npcText&&oxygen>=25)npcText.textContent='Ivo: Match frequencies and polarity to the receiver plates. Test before restoring the feed.';
  if(r.stage==='repair'&&guide)guide.textContent=`${formatHeading(bearing)} / ${Math.round(p.distanceTo(target))} m / Array service station`;
  if(r.stage==='remote'){
    if(npcText&&oxygen>=25)npcText.textContent='Selene: The archives require Sentry optical readings. The service opening is on the south side.';
    if(guide)guide.textContent=`${formatHeading(bearing)} / ${Math.round(p.distanceTo(target))} m / ${swimReturnToBoat?'Return to vessel':'Pelagic Observatory'}`;
    if(playerMode==='swim'){interactionReady=false;if(interactButton)interactButton.disabled=true;if(toolPrompt)toolPrompt.textContent='Remote archive / Sentry ROV required';}
  }
  const readingProgress=document.querySelector<HTMLProgressElement>('[data-reading-progress]');if(readingProgress){readingProgress.hidden=!transectReading;readingProgress.max=2.5;readingProgress.value=transectReading?.seconds??0;}
  const equipmentRow=document.querySelector<HTMLElement>('[data-dive-equipment]');if(equipmentRow)equipmentRow.hidden=!progress.fieldEquipment?.scooter;
  const driveButton=document.querySelector<HTMLButtonElement>('[data-scooter-toggle]');if(driveButton){driveButton.disabled=scooterLoading;driveButton.setAttribute('aria-pressed',String(scooterEnabled));driveButton.querySelector('span')!.textContent=scooterLoading?'Loading drive…':scooterEnabled?'Drive on':'Dive drive';}
  const chargeMeter=document.querySelector<HTMLMeterElement>('[data-scooter-charge]');if(chargeMeter)chargeMeter.value=progress.fieldEquipment?.charge??100;
  const driveStatus=document.querySelector<HTMLElement>('[data-scooter-status]');if(driveStatus)driveStatus.textContent=`${Math.ceil(progress.fieldEquipment?.charge??100)}%${scooterPowered?' · thrust':''}`;
  scannerPanel.update(sonarResults,p,gameTime-sonarStarted,playerMode==='swim'&&selectedTool==='scanner'&&Number.isFinite(sonarStarted),scannerAutomatic);
  gameRoot.classList.toggle('target-ready',interactionReady);
  renderRovHud();
  renderFieldHud();
  renderMasteryHud();
  if(playerMode==='walk'){
    if(objectiveText)objectiveText.textContent=`Explore the island · ${ISLAND_LANDMARKS[walkDestination].name}`;
    if(npcText)npcText.textContent='Walk the harbor, visit the counters, or follow the island trail.';
    if(guide)guide.textContent=`${formatHeading(bearing)} · ${Math.round(p.distanceTo(target))} m · ${ISLAND_LANDMARKS[walkDestination].name}`;
    if(help)help.textContent='WASD walk · Arrows turn / move · Drag to look · Hold Shift to jog · F interact · C view';
    const nearShop=canVisitStand(),nearBoat=canBoardFromIsland(),gate=ISLAND_LANDMARKS.boat;
    const prompt=document.querySelector('[data-land-prompt]');if(prompt)prompt.textContent=walkBoardRequested?'Following the pier route · boards on arrival':nearShop?'Counter in reach · F to visit':nearBoat?'Boat in reach · E to board':`Boat · ${Math.round(Math.hypot(p.x-gate.x,p.z-gate.z))} m · Return to boat guides you there`;
    if(landInteract){landInteract.disabled=walkRouting;landInteract.textContent=walkBoardRequested?'Cancel boat return':nearShop?'Visit counter · F':nearBoat?'Board boat · E':'Return to boat · E';}
  }
}

function updateGamepad(delta:number) {
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
  gamepadSteer = deadzone(pad.axes[0] ?? 0);
  const forward = pad.buttons[7]?.value ?? Math.max(0, -(pad.axes[1] ?? 0));
  const reverse = pad.buttons[6]?.value ?? Math.max(0, pad.axes[1] ?? 0);
  gamepadThrottle = playerMode==='walk'?-deadzone(pad.axes[1]??0):forward - reverse * 0.72;
  gamepadVertical = (pad.buttons[5]?.pressed ? 1 : 0) - (pad.buttons[4]?.pressed ? 1 : 0);
  gamepadBoost = Boolean(pad.buttons[10]?.pressed);
  const currentButtons = pad.buttons.map((button) => button.pressed);
  if (currentButtons[0] && !previousGamepadButtons[0]) togglePlayerMode();
  if (currentButtons[2] && !previousGamepadButtons[2]) {
    cycleCamera();
  }
  if (currentButtons[3] && !previousGamepadButtons[3]) useDiveTool();
  const lookX=deadzone(pad.axes[2]??0),lookY=deadzone(pad.axes[3]??0);
  if((lookX||lookY)&&playerMode!=='helm'&&!(playerMode==='swim'&&diveInspectionView)){cancelSwimAssist();if(playerMode==='walk'){walkRouteRequest++;walkBoardRequested=false;}}
  if (playerMode === 'swim') {
    if(diveInspectionView){diveOrbitYaw+=lookX*delta*1.7;diveOrbitPitch=THREE.MathUtils.clamp(diveOrbitPitch-lookY*delta*1.4,-.7,.7);}
    else{swimYaw+=lookX*delta*1.7;swimPitch=THREE.MathUtils.clamp(swimPitch-lookY*delta*1.4,-1,1);}
  }
  if(playerMode==='rov'){if(Math.abs(lookX)+Math.abs(lookY)>.05){cruiseActive=false;fieldTargetId='';observatoryReading=undefined;}rovYaw+=lookX*delta*1.7;rovPitch=THREE.MathUtils.clamp(rovPitch-lookY*delta*1.4,-.9,.9);}
  if(playerMode==='walk'){walkYaw+=lookX*delta*1.7;walkPitch=THREE.MathUtils.clamp(walkPitch-lookY*delta*1.4,-.85,.85);}
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
  document.querySelector('[data-forecast-toggle]')!.addEventListener('click',()=>{if(menusOpen())return;renderForecast();clearPlayerInput();forecastDialog.showModal();resetFrameClock();platform.gameplayStop();});
  document.querySelector('[data-forecast-close]')!.addEventListener('click',()=>forecastDialog.close());
  forecastDialog.addEventListener('close',()=>{clearPlayerInput();resetFrameClock();resumePlatformIfPlaying();const more=document.querySelector<HTMLButtonElement>('[data-action-menu-toggle]')!;const trigger=document.querySelector<HTMLButtonElement>('[data-forecast-toggle]')!;(more.getClientRects().length?more:trigger).focus();});
  document.querySelector('[data-weather-auto]')!.addEventListener('click',()=>{const next=structuredClone(progress);next.weather=holdWeather(progress.weather!,null);try{saveProgress(next);}catch{document.querySelector<HTMLElement>('[data-forecast-feedback]')!.textContent='Weather setting could not be saved. Your forecast is unchanged.';setNotice('Weather setting could not be saved. Your forecast is unchanged.');return;}Object.assign(progress,next);selectWeather(activeWeather(progress.weather!),false);});
  document.querySelector('[data-weather-rest]')!.addEventListener('click',()=>{
    const next=structuredClone(progress),feedback=document.querySelector<HTMLElement>('[data-forecast-feedback]')!;
    try{next.weather=restWeather(progress.weather!,playerMode==='helm'?boatAtLanding():playerMode==='walk'&&canVisitStand());saveProgress(next);}catch{feedback.textContent='Rest could not be saved. Moor at harbor and allow storage before retrying.';return;}
    Object.assign(progress,next);selectWeather(activeWeather(progress.weather!),false);updateWeather(0);updateEnvironment();renderer.render(scene,camera);feedback.textContent='07:00. Cargo and equipment remain unchanged.';
  });
  const actionMenu=document.querySelector<HTMLElement>('[data-action-menu]')!;
  const actionToggle=document.querySelector<HTMLButtonElement>('[data-action-menu-toggle]')!;
  const compactActions=matchMedia('(max-width:760px) and (min-height:521px), (max-width:1024px) and (max-height:520px)');
  const setActionMenu=(open:boolean)=>{
    const restoreFocus=!open&&compactActions.matches&&actionMenu.classList.contains('is-open')&&actionMenu.contains(document.activeElement);
    actionMenu.classList.toggle('is-open',open);actionToggle.setAttribute('aria-expanded',String(open));
    gameRoot.classList.toggle('actions-open',open);if(open)clearPlayerInput();
    if(restoreFocus)actionToggle.focus();
  };
  compactActions.addEventListener('change',()=>setActionMenu(false));
  actionToggle.addEventListener('click',()=>setActionMenu(!actionMenu.classList.contains('is-open')));
  actionMenu.addEventListener('click',event=>{if((event.target as Element).closest('button'))setActionMenu(false);});
  document.addEventListener('pointerdown',event=>{if(!(event.target as Element).closest('.action-dock'))setActionMenu(false);});
  window.addEventListener('keydown', (event) => {
    if(forecastDialog.open){if(event.code==='Escape'){event.preventDefault();forecastDialog.close();}return;}
    if(arrayService?.open){if(event.code==='Escape'){event.preventDefault();arrayService.close();}return;}
    if(storyDialog?.open){if(event.code==='Escape'){event.preventDefault();storyDialog.close();}return;}
    if (adBusy || inventory?.open || voyageAtlas?.open) return;
    if(event.code==='Escape'&&actionMenu.classList.contains('is-open')){setActionMenu(false);event.preventDefault();return;}
    const menuOpen=menusOpen();
    if(!menuOpen) keys[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'KeyM' && !event.repeat) {
      void toggleMusic();
    }
    if (event.code === 'Escape' && !event.repeat) { if(journalPanel?.classList.contains('is-open'))toggleJournal(false);else if(harbor?.classList.contains('is-open'))closeResearchStand();else togglePause(); }
    if(menuOpen && event.code !== 'Escape' && event.code !== 'KeyJ') return;
    if (event.code === 'KeyC' && !event.repeat) {
      cycleCamera();
    }
    if (event.code === 'KeyE' && !event.repeat) {
      togglePlayerMode();
    }
    if(event.code==='KeyF'&&!event.repeat&&!menuOpen)useDiveTool();
    if(event.code==='KeyJ'&&!event.repeat)toggleJournal();
    if(event.code==='KeyH'&&!event.repeat&&!menuOpen)openResearchStand();
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
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((code) => { keys[code] = false; });
    document.querySelectorAll('[data-hold].is-active').forEach((button) => button.classList.remove('is-active'));
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
      button.setPointerCapture(event.pointerId);
      hold(true);
    });
    button.addEventListener('pointerup', () => hold(false));
    button.addEventListener('pointercancel', () => hold(false));
    button.addEventListener('lostpointercapture', () => hold(false));
  });

  musicToggle?.addEventListener('click', () => {
    void toggleMusic();
  });
  document.querySelector('[data-camera-toggle]')?.addEventListener('click', cycleCamera);

  modeToggle?.addEventListener('click', () => {
    togglePlayerMode();
  });

  weatherButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.weather as WeatherKey | undefined;
      if (!key || !WEATHER_PRESETS[key]) return;
      selectWeather(key);
    });
  });

  nextExpeditionButton?.addEventListener('click', () => { void launchNextExpedition(); });
  rewardAdButton?.addEventListener('click', () => { void requestResearchGrant(); });
  document.querySelectorAll<HTMLButtonElement>('[data-inventory-toggle]').forEach(button => button.addEventListener('click', () => { if (!adBusy) inventory.show(); }));
  pauseToggle?.addEventListener('click', () => togglePause(true));
  resumeButton?.addEventListener('click', () => togglePause(false));
  qualityButtons.forEach((button) => {
    button.addEventListener('click', () => setQuality(button.dataset.quality ?? 'balanced'));
  });

  toolButtons.forEach(button=>button.addEventListener('click',()=>selectDiveTool(button.dataset.tool as DiveTool)));
  interactButton?.addEventListener('click',useDiveTool);
  document.querySelector('[data-scooter-toggle]')?.addEventListener('click',()=>{void toggleDiveDrive();});
  document.querySelector('[data-rov-launch]')?.addEventListener('click',()=>{void launchResearchRov();});
  document.querySelector('[data-rov-pulse]')?.addEventListener('click',()=>pulseResearchRov());
  document.querySelector('[data-rov-acquire]')?.addEventListener('click',beginObservatoryReading);
  document.querySelector('[data-field-recover]')?.addEventListener('click',beginFieldRecovery);
  document.querySelector('[data-pod-service]')?.addEventListener('click',usePodService);
  document.querySelector('[data-pod-deploy]')?.addEventListener('click',()=>{void togglePodDeployment();});
  document.querySelector<HTMLSelectElement>('[data-field-target]')?.addEventListener('change',event=>{fieldSelectedId=(event.target as HTMLSelectElement).value;fieldTargetId='';fieldReading=undefined;cancelSwimAssist();updateHud();});
  document.querySelector('[data-field-approach]')?.addEventListener('click',()=>{if(!menusOpen()&&(playerMode==='swim'||playerMode==='rov')&&fieldPoint(fieldSelectedId)){fieldTargetId=fieldSelectedId;fieldReading=undefined;observatoryReading=undefined;swimReturnToBoat=false;cruiseActive=true;assistBlockedSeconds=0;updateHud();}});
  document.querySelector('[data-rov-light]')?.addEventListener('click',()=>{if(playerMode==='rov'&&!menusOpen()){rovLights=!rovLights;updateHud();}});
  document.querySelector('[data-sonar-pulse]')?.addEventListener('click',()=>{if(playerMode==='swim'&&!menusOpen()&&!transectReading)emitDiveSonar();});
  document.querySelector('[data-scan-auto]')?.addEventListener('click',()=>{if(playerMode==='swim'&&!menusOpen()){scannerAutomatic=!scannerAutomatic;updateHud();}});
  standButton?.addEventListener('click',openResearchStand);
  cashInButton?.addEventListener('click',sellResearchCargo);
  document.querySelector('[data-journal-toggle]')?.addEventListener('click',()=>toggleJournal());
  document.querySelector('[data-journal-close]')?.addEventListener('click',()=>toggleJournal(false));
  document.querySelectorAll('[data-atlas-toggle]').forEach(button=>button.addEventListener('click',()=>openVoyageAtlas('chart')));
  document.querySelector('[data-contracts-toggle]')?.addEventListener('click',()=>openVoyageAtlas('contracts'));
  document.querySelector('[data-save]')?.addEventListener('click',()=>persistExpedition(true));
  document.querySelector('[data-story-toggle]')?.addEventListener('click',()=>{if(!menusOpen())storyDialog.show();});
  document.querySelector('[data-partner-talk]')?.addEventListener('click',()=>{if(!menusOpen()){const partner=researchPartners.nearest(activePlayerPosition());if(partner)storyDialog.show(partner);}});
  document.querySelector('[data-rescue]')?.addEventListener('click',rescueDiver);
  walkButton?.addEventListener('click',()=>enterWalkMode());
  landInteract?.addEventListener('click',useLandInteraction);
  landDestination?.addEventListener('change',()=>{walkRouteRequest++;walkBoardRequested=false;walkDestination=landDestination.value as IslandDestination;cruiseActive=false;walkRoute=[];updateHud();});
  cruiseButton?.addEventListener('click',()=>{if(playerMode==='walk'){startWalkAssist();return;}if(progress.mastery?.active||waypointLocation(progress.voyage)||progress.expedition.stage!=='briefing'&&progress.expedition.stage!=='complete'){
    masteryReading=undefined;
    observatoryReading=undefined;
    transectReading=undefined;
    cruiseActive=!cruiseActive;assistBlockedSeconds=0;assistReached=false;
    swimReturnToBoat=cruiseActive&&playerMode==='swim'&&(progress.expedition.stage==='return'||masteryReturning()||habitatBoatReturn());
    assistAnimal=cruiseActive&&playerMode==='swim'&&selectedTool==='camera'&&!swimReturnToBoat&&!progress.mastery?.active?photoCandidates()[0]:undefined;
    if(cruiseActive&&playerMode==='helm'&&(progress.expedition.stage==='return'||masteryReturning()||waypointLocation(progress.voyage)?.id==='harbor'))mooringPhase=boatAtLanding()?'reverse':Math.hypot(yacht.position.x,yacht.position.z+55)<7?'align':'approach';
  }updateHud();});
  renderer.domElement.addEventListener('pointerdown',event=>{if(playerMode!=='helm'&&!isPaused){pointerLook={x:event.clientX,y:event.clientY,id:event.pointerId};renderer.domElement.setPointerCapture(event.pointerId);}});
  renderer.domElement.addEventListener('pointermove',event=>{
    if(!pointerLook||pointerLook.id!==event.pointerId)return;
    const dx=(event.clientX-pointerLook.x)*.005,dy=(event.clientY-pointerLook.y)*.004;
    if(playerMode==='rov'){cruiseActive=false;fieldTargetId='';fieldReading=undefined;observatoryReading=undefined;rovYaw+=dx;rovPitch=THREE.MathUtils.clamp(rovPitch-dy,-.9,.9);}
    else if(playerMode==='walk'){walkRouteRequest++;walkBoardRequested=false;walkYaw+=dx;walkPitch=THREE.MathUtils.clamp(walkPitch-dy,-.85,.85);cruiseActive=false;}
    else if(diveInspectionView){diveOrbitYaw+=dx;diveOrbitPitch=THREE.MathUtils.clamp(diveOrbitPitch-dy,-.7,.7);}
    else{fieldReading=undefined;cancelSwimAssist();swimYaw+=dx;swimPitch=THREE.MathUtils.clamp(swimPitch-dy,-1,1);}
    pointerLook.x=event.clientX;pointerLook.y=event.clientY;
  });
  const stopLook=()=>{pointerLook=undefined;};renderer.domElement.addEventListener('pointerup',stopLook);renderer.domElement.addEventListener('pointercancel',stopLook);renderer.domElement.addEventListener('lostpointercapture',stopLook);
  window.addEventListener('pagehide',()=>{if(!replacingVoyage)persistExpedition();});
  document.addEventListener('visibilitychange',()=>{resetFrameClock();for(const key of Object.keys(keys))keys[key]=false;pointerLook=undefined;});
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
  if (isPaused) platform.gameplayStop();
  else platform.gameplayStart();
}

function clearPlayerInput() {
  Object.keys(keys).forEach(key => { keys[key] = false; });
  pointerLook = undefined; gamepadThrottle = 0; gamepadSteer = 0; gamepadBoost = false;
}

function menusOpen() { return forecastDialog.open || adBusy || boatSwitching || inventory?.open || voyageAtlas?.open || storyDialog?.open || arrayService?.open || isPaused || harbor?.classList.contains('is-open') || journalPanel?.classList.contains('is-open'); }
function openVoyageAtlas(view:'chart'|'contracts') {if(adBusy||boatSwitching||inventory?.open)return;closeResearchStand();toggleJournal(false);togglePause(false);voyageAtlas.show(view);}
function resumePlatformIfPlaying() { if (!menusOpen()) platform.gameplayStart(); }

function renderResearchGrant() {
  const r = progress.expedition, amount = researchGrantAmount(progress);
  const status = document.querySelector<HTMLElement>('[data-grant-status]');
  if (status) status.textContent = !r.sold ? 'Sell cargo to unlock a grant.' : r.grantState === 'claimed' ? `${r.grantCredits} bonus credits received. Receipt saved.` : r.grantState === 'earned' ? 'Grant confirmed. Save it to receive your credits.' : `Optional +${amount} credits for your next voyage.${platform.supportsRewardedAds() ? '' : ' Video currently unavailable.'}`;
  if (rewardAdButton) {
    rewardAdButton.hidden = !r.sold || r.grantState === 'claimed' || (!platform.supportsRewardedAds() && r.grantState !== 'earned');
    rewardAdButton.disabled = adBusy || boatSwitching;
    rewardAdButton.textContent = r.grantState === 'earned' ? 'Save research grant' : adBusy ? 'Checking availability...' : 'Check grant availability';
  }
  if (nextExpeditionButton) nextExpeditionButton.disabled = boatSwitching || adBusy;
}

function saveEarnedGrant() {
  const next = claimResearchGrant(progress);
  if (!next) return true;
  try { saveProgress(next); }
  catch { setNotice('Grant confirmed. Storage is unavailable; retry saving before departing.'); renderResearchGrant(); return false; }
  Object.assign(progress, next); renderHarbor(); updateHud();
  setNotice(`${next.expedition.grantCredits} research grant credits added. Receipt saved.`);
  return true;
}

async function requestResearchGrant() {
  if (adBusy || boatSwitching || !harbor?.classList.contains('is-open') || !progress.expedition.sold || progress.expedition.grantState === 'claimed') return;
  if (progress.expedition.grantState === 'earned') { saveEarnedGrant(); return; }
  adBusy = true; clearPlayerInput(); renderResearchGrant();
  const run = progress.expedition.run, restoreMusic = music?.isOn() ?? false;
  const dialog = document.querySelector<HTMLDialogElement>('[data-grant-offer]')!;
  const watch = dialog.querySelector<HTMLButtonElement>('[data-grant-watch]')!;
  const decline = dialog.querySelector<HTMLButtonElement>('[data-grant-decline]')!;
  let cancelOffer: (() => void) | undefined;
  try {
    const rewarded = await platform.rewardedBreak(
      () => { adBusy = true; clearPlayerInput(); platform.gameplayStop(); music?.setMuted(true); },
      () => { adBusy = false; if (restoreMusic) music?.setMuted(false); resetFrameClock(); resumePlatformIfPlaying(); },
      (show, cancel) => {
        dialog.querySelector<HTMLElement>('[data-grant-offer-amount]')!.textContent = `+${researchGrantAmount(progress)} credits`;
        cancelOffer = () => { dialog.close(); cancel(); };
        decline.onclick = cancelOffer;
        dialog.oncancel = (event) => { event.preventDefault(); cancelOffer?.(); };
        watch.onclick = () => { dialog.close(); show(); };
        dialog.showModal();
      },
    );
    if (rewarded && run === progress.expedition.run && progress.expedition.grantState === 'unclaimed') {
      progress.expedition.grantState = 'earned'; progress.expedition.grantCredits = researchGrantAmount(progress);
      // Keep the earned receipt before attempting the atomic balance/claim transaction.
      try { saveProgress(progress); } catch { /* A later save can retry the earned receipt. */ }
      saveEarnedGrant();
    } else setNotice('No grant claimed. Your research payment is safe.');
  } catch { setNotice('Video unavailable. Your research payment is safe.'); }
  finally {
    dialog.close(); watch.onclick = null; decline.onclick = null; dialog.oncancel = null;
    adBusy = false; if (restoreMusic) music?.setMuted(false); clearPlayerInput(); resetFrameClock();
    renderResearchGrant(); inventory.render(); resumePlatformIfPlaying(); rewardAdButton?.focus();
  }
}

type GraphicsMode='performance'|'balanced'|'quality';
function graphicsStorage(){return ['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa')?sessionStorage:localStorage;}
function readGraphicsMode():GraphicsMode{
  try{const mode=graphicsStorage().getItem('ocean-adventure-graphics');if(mode==='performance'||mode==='quality')return mode;}catch{}
  return 'balanced';
}
function resetFrameClock(){lastFrameTime=performance.now()*.001;fpsAccumulator=0;fpsFrames=0;}
function applyGraphicsMode(quality:GraphicsMode){
  manualQuality = quality !== 'balanced';
  renderScale = quality === 'performance' ? 0.65 : quality === 'quality' ? Math.min(1.0, window.devicePixelRatio) : maxRenderPixelRatio;
  resize();
  rainLines.visible = quality !== 'performance';
  renderer.shadowMap.enabled = quality === 'quality';
  renderer.shadowMap.needsUpdate = quality === 'quality';
  if (quality === 'quality') reflectionUpdateAt = 0;
  yachtVisual?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshPhysicalMaterial && node.material.name === 'Smoked reflective glazing') {
      node.material.transmission = quality === 'quality' ? 0.38 : 0;
      node.material.needsUpdate = true;
    }
  });
  if (fishSchool) fishSchool.visible = quality !== 'performance' || playerMode === 'swim';
  qualityButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.quality === quality)));
}
async function setQuality(quality: string) {
  if(graphicsPreparing||(quality!=='performance'&&quality!=='balanced'&&quality!=='quality'))return;
  graphicsPreparing=true;renderer.setAnimationLoop(null);
  const loadingTitle=loading?.querySelector('strong');if(loadingTitle)loadingTitle.textContent='Preparing graphics';
  loading?.classList.remove('is-hidden');
  applyGraphicsMode(quality);
  try{graphicsStorage().setItem('ocean-adventure-graphics',quality);}catch{}
  try{await renderer.compileAsync(scene,camera);}finally{
    graphicsPreparing=false;resetFrameClock();
    loading?.classList.add('is-hidden');renderer.setAnimationLoop(tick);
  }
}

function updateVesselReflection() {
  if (!yachtVisual || cameraUnderwater) return;
  if (!vesselReflection) {
    vesselReflection = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    vesselReflectionCamera = new THREE.CubeCamera(0.5, 800, vesselReflection);
  }
  if (!vesselReflectionCamera) return;
  vesselReflectionCamera.position.copy(yacht.position);
  vesselReflectionCamera.position.y += 4.5;
  const wasVisible = yacht.visible;
  yacht.visible = false;
  try {
    // Capture the actual ocean and shore, so cabin windows reflect their surroundings.
    vesselReflectionCamera.update(renderer, scene);
  } finally {
    yacht.visible = wasVisible;
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const previous = vesselReflectionPmrem;
  vesselReflectionPmrem = generator.fromCubemap(vesselReflection.texture);
  generator.dispose();
  yachtVisual.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshPhysicalMaterial && node.material.name === 'Smoked reflective glazing') {
      node.material.envMap = vesselReflectionPmrem!.texture;
      node.material.needsUpdate = true;
    }
  });
  previous?.dispose();
}

function cycleCamera() {
  if(playerMode==='rov'){observatoryReading=undefined;rovChase=!rovChase;updateHud();return;}
  if(playerMode==='walk'){firstPersonWalk=!firstPersonWalk;walker.root.visible=!firstPersonWalk;setNotice(firstPersonWalk?'First person island view. Drag to look.':'Third person island view.');return;}
  if(playerMode==='swim'){
    if(firstPersonDive){firstPersonDive=false;diveInspectionView=false;}
    else if(!diveInspectionView){diveInspectionView=true;diveOrbitYaw=0;diveOrbitPitch=0;}
    else{firstPersonDive=true;diveInspectionView=false;}
    swimmer.visible=!firstPersonDive;setNotice(firstPersonDive?'First person dive view. Drag to look.':diveInspectionView?'Diver portrait view. Press C again for first person.':'Third person dive view.');return;
  }
  cameraMode=(cameraMode+1)%cameraOffsets.length;setNotice(`${['Chase','Overhead','Rear quarter','Bow quarter','Side','Aft deck','Research stand','Harbor approach','Island shore','Research counter'][cameraMode]} view.`);
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
  if (adBusy) return;
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
  platform.setSound(isOn);
  musicToggle.textContent = isOn ? 'Music on' : 'Music off';
  musicToggle.classList.toggle('is-on', isOn);
}

function isDown(code: string) {
  return keys[code] === true;
}

function togglePlayerMode() {
  transectReading=undefined;
  if(menusOpen())return;
  if(playerMode==='rov'){recallResearchRov();return;}
  if(playerMode==='walk'){
    if(walkRouting)return;
    if(canBoardFromIsland()){returnToHelm('Researcher aboard. Choose Dive to enter the water.');persistExpedition();return;}
    if(walkBoardRequested){walkRouteRequest++;walkBoardRequested=false;cruiseActive=false;walkRoute=[];setNotice('Return to boat cancelled.');updateHud();return;}
    walkDestination='boat';if(landDestination)landDestination.value='boat';cruiseActive=false;void startWalkAssist(true);return;
  }
  if (playerMode === 'helm') {
    enterSwimMode();
  } else {
    if(swimReturnToBoat){cancelSwimAssist();setNotice('Return to vessel cancelled.');updateHud();return;}
    if(!canBoardSwimmer()){swimReturnToBoat=true;cruiseActive=true;assistAnimal=undefined;assistBlockedSeconds=0;assistReached=false;setNotice('Returning to the vessel. Surface approach is guided; movement cancels assist.');updateHud();return;}
    returnToHelm('Diver aboard. Helm control restored.');
  }
}

function enterSwimMode() {
  swimReturnToBoat=false;
  speed = 0;
  throttleValue = 0;
  steerValue = 0;
  swimSpeed = 0; actualSwimSpeed = 0;
  swimYaw = heading;
  swimPitch = 0; cruiseActive = false;
  oxygen = 100;
  const vessel = BOAT_CATALOG[progress.activeBoat];
  const launchPoint = tmpVector.set(vessel.beam * 0.58, 0, vessel.length * 0.46 + 1.0).applyQuaternion(yacht.quaternion).add(yacht.position);
  const surface = sampleOceanHeight(launchPoint.x, launchPoint.z, gameTime);
  swimmer.position.set(launchPoint.x, surface - 2.2, launchPoint.z);
  swimmer.rotation.set(0, -swimYaw, 0, 'YXZ');
  swimmer.visible = !firstPersonDive;
  bubblePoints.visible = true;
  swimmerBody.setTranslation({ x: swimmer.position.x, y: swimmer.position.y, z: swimmer.position.z }, true);
  playerMode = 'swim';
  gameRoot.dataset.playerMode = 'swim';
  // Start below the surface immediately instead of easing down from the helm camera.
  tmpQuaternion.setFromEuler(yawEuler.set(0, -swimYaw, 0, 'YXZ'));
  camera.position.copy(swimmer.position).add(tmpVectorC.set(0, 0.65, 6.8).applyQuaternion(tmpQuaternion));
  setNotice(`Dive telemetry active. ${BOAT_CATALOG[progress.activeBoat].name} is holding position.`);
  updateHud();
}

function returnToHelm(message: string) {
  masteryReading=undefined;masteryFeedback='';
  fieldTargetId='';fieldReading=undefined;
  transectReading=undefined;
  swimReturnToBoat=false;
  walkRouteRequest++;walkBoardRequested=false;walker.root.visible=false;walkSpeed=0;walkVelocity.set(0,0,0);cruiseActive=false;walkRoute=[];progress.shorePosition=undefined;
  playerMode = 'helm';
  gameRoot.dataset.playerMode = 'helm';
  swimmer.visible = false;
  bubblePoints.visible = false;
  swimmerBody.setTranslation({ x: 0, y: -1000, z: 0 }, true);
  swimSpeed = 0; actualSwimSpeed = 0;
  oxygen = 100;
  setNotice(message);
  updateHud();
}

function resetBoat() {
  if(playerMode==='rov')recallResearchRov();
  if (playerMode !== 'helm') {
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
  renderer.setSize(window.innerWidth, window.innerHeight, false);
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

function seabedHeight(x:number,z:number){return expeditionFloor(x,z);}

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
    loading.innerHTML = error instanceof CharacterLoadError?'<strong>Your character could not load</strong><p>Your saved voyage is unchanged. Retry to load the GLB character.</p><button type="button" data-retry-session>Retry</button>':'<strong>Ocean failed to initialize</strong><button type="button" data-retry-session>Retry</button>';
    loading.querySelector('button')!.onclick=()=>location.reload();
    if(error instanceof ProgressLoadError){
      loading.querySelector('strong')!.textContent='Your saved voyage is protected';
      const message=document.createElement('p');message.textContent=error.message;loading.prepend(message);
      const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Import voyage backup');
      input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('This save file is too large.');const next=readProgressImport(await file.text());if(!confirm(`Restore ${next.expeditions} expeditions and ${next.credits} credits from this backup?`))return;importProgress(next);location.reload();}catch(error){message.textContent=error instanceof Error?error.message:'The backup could not be read.';}};loading.append(input);
    }
  }
});
