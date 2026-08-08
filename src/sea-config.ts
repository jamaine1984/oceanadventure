export type WeatherKey = 'calm' | 'bluewater' | 'storm';

export type SeaState = {
  windKnots: number;
  windX: number;
  windZ: number;
  primaryAmplitude: number;
  primaryFrequencyX: number;
  primaryFrequencyZ: number;
  primarySpeed: number;
  crossAmplitude: number;
  crossFrequencyX: number;
  crossFrequencyZ: number;
  crossSpeed: number;
  chopAmplitude: number;
  chopFrequencyX: number;
  chopFrequencyZ: number;
  chopSpeed: number;
  waterSpeed: number;
  distortionScale: number;
  waterColor: number;
  fogColor: number;
  fogDensity: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudOpacity: number;
  cloudColor: number;
  rain: number;
  exposure: number;
  sunElevation: number;
  sunAzimuth: number;
};

export type WeatherPreset = SeaState & {
  key: WeatherKey;
  label: string;
};

export const WEATHER_PRESETS: Record<WeatherKey, WeatherPreset> = {
  calm: {
    key: 'calm',
    label: 'Calm',
    windKnots: 5,
    windX: 0.35,
    windZ: -0.94,
    primaryAmplitude: 0.34,
    primaryFrequencyX: 0.035,
    primaryFrequencyZ: 0.022,
    primarySpeed: 0.52,
    crossAmplitude: 0.18,
    crossFrequencyX: -0.018,
    crossFrequencyZ: 0.043,
    crossSpeed: 0.34,
    chopAmplitude: 0.035,
    chopFrequencyX: 0.13,
    chopFrequencyZ: -0.09,
    chopSpeed: 0.82,
    waterSpeed: 0.34,
    distortionScale: 2.35,
    waterColor: 0x08748b,
    fogColor: 0xa4ddec,
    fogDensity: 0.00048,
    turbidity: 5.2,
    rayleigh: 2.9,
    mieCoefficient: 0.0035,
    mieDirectionalG: 0.77,
    cloudOpacity: 0.28,
    cloudColor: 0xffffff,
    rain: 0,
    exposure: 0.52,
    sunElevation: 13,
    sunAzimuth: 208,
  },
  bluewater: {
    key: 'bluewater',
    label: 'Bluewater',
    windKnots: 15,
    windX: 0.58,
    windZ: -0.82,
    primaryAmplitude: 0.72,
    primaryFrequencyX: 0.052,
    primaryFrequencyZ: 0.036,
    primarySpeed: 0.92,
    crossAmplitude: 0.46,
    crossFrequencyX: -0.028,
    crossFrequencyZ: 0.064,
    crossSpeed: 0.62,
    chopAmplitude: 0.13,
    chopFrequencyX: 0.19,
    chopFrequencyZ: -0.14,
    chopSpeed: 1.7,
    waterSpeed: 0.62,
    distortionScale: 4.2,
    waterColor: 0x075b74,
    fogColor: 0x87cfe9,
    fogDensity: 0.00072,
    turbidity: 8.4,
    rayleigh: 2.4,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.82,
    cloudOpacity: 0.4,
    cloudColor: 0xffffff,
    rain: 0,
    exposure: 0.58,
    sunElevation: 8,
    sunAzimuth: 194,
  },
  storm: {
    key: 'storm',
    label: 'Storm',
    windKnots: 38,
    windX: 0.82,
    windZ: -0.57,
    primaryAmplitude: 1.82,
    primaryFrequencyX: 0.038,
    primaryFrequencyZ: 0.061,
    primarySpeed: 1.28,
    crossAmplitude: 1.08,
    crossFrequencyX: -0.057,
    crossFrequencyZ: 0.028,
    crossSpeed: 1.05,
    chopAmplitude: 0.42,
    chopFrequencyX: 0.22,
    chopFrequencyZ: -0.19,
    chopSpeed: 2.35,
    waterSpeed: 1.18,
    distortionScale: 7.6,
    waterColor: 0x052f42,
    fogColor: 0x526e78,
    fogDensity: 0.00145,
    turbidity: 15.5,
    rayleigh: 0.72,
    mieCoefficient: 0.022,
    mieDirectionalG: 0.91,
    cloudOpacity: 0.76,
    cloudColor: 0x697985,
    rain: 1,
    exposure: 0.36,
    sunElevation: 0.8,
    sunAzimuth: 172,
  },
};

export function cloneSeaState(preset: WeatherPreset): SeaState {
  const { key: _key, label: _label, ...state } = preset;
  return { ...state };
}

export function dampSeaState(current: SeaState, target: SeaState, delta: number, lambda = 1.8) {
  const blend = 1 - Math.exp(-lambda * delta);
  (Object.keys(current) as Array<keyof SeaState>).forEach((key) => {
    if (key.endsWith('Color')) return;
    current[key] += (target[key] - current[key]) * blend;
  });
}
