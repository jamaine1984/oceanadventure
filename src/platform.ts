import { GoogleH5Ads } from './google-h5';
type AdCallbacks = { adStarted: () => void; adFinished: () => void; adError: () => void };

type CrazySdk = {
  init(): Promise<void>;
  environment?: string;
  game: { loadingStart(): void; loadingStop(): void; gameplayStart(): void; gameplayStop(): void };
  data: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>;
  ad: { requestAd(type: 'rewarded' | 'midgame', callbacks: AdCallbacks): void };
};

type PokiSdk = {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  rewardedBreak(options?: { size?: 'small' | 'medium' | 'large'; onStart?: () => void }): Promise<boolean>;
  commercialBreak(onStart?: () => void): Promise<void>;
};

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazySdk };
    PokiSDK?: PokiSdk;
  }
}

export type PortalName = 'standalone' | 'crazygames' | 'poki' | 'google';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Unable to load ${src}`)), { once: true });
    document.head.append(script);
  });
}

class PlatformBridge {
  name: PortalName = 'standalone';
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = localStorage;
  private playing = false;
  private google = new GoogleH5Ads();

  async initialize() {
    const requested = new URLSearchParams(location.search).get('portal');
    const host = location.hostname;
    if (requested === 'google' || host === 'crateshipgames.com' || host.endsWith('.crateshipgames.com')) {
      this.name = 'google';
      await this.google.initialize();
    } else if (requested === 'crazygames' || host.includes('crazygames.')) {
      try {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
        await window.CrazyGames?.SDK.init();
        const sdk = window.CrazyGames?.SDK;
        if (sdk && sdk.environment !== 'disabled') {
          this.name = 'crazygames';
          this.storage = sdk.data;
          sdk.game.loadingStart();
        }
      } catch (error) {
        console.warn('CrazyGames SDK unavailable; continuing standalone.', error);
      }
    } else if (requested === 'poki' || host.includes('poki.')) {
      try {
        await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        await window.PokiSDK?.init();
        if (window.PokiSDK) this.name = 'poki';
      } catch (error) {
        console.warn('Poki SDK unavailable; continuing standalone.', error);
      }
    }
  }

  loadingFinished() {
    if (this.name === 'crazygames') window.CrazyGames?.SDK.game.loadingStop();
    if (this.name === 'poki') window.PokiSDK?.gameLoadingFinished();
  }

  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    if (this.name === 'crazygames') window.CrazyGames?.SDK.game.gameplayStart();
    if (this.name === 'poki') window.PokiSDK?.gameplayStart();
  }

  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.name === 'crazygames') window.CrazyGames?.SDK.game.gameplayStop();
    if (this.name === 'poki') window.PokiSDK?.gameplayStop();
  }

  supportsRewardedAds() {
    return this.name === 'google' ? this.google.ready : this.name !== 'standalone';
  }

  setSound(on: boolean) { if (this.name === 'google') this.google.setSound(on); }

  async interstitialBreak(onStart: () => void, onFinish: () => void) {
    if (this.name === 'google') await this.google.request('next', onStart, onFinish);
  }

  async rewardedBreak(onStart: () => void, onFinish: () => void, offer?: (show: () => void, decline: () => void) => void) {
    if (this.name === 'google') return this.google.request('reward', onStart, onFinish, offer);
    if (this.name === 'poki' && window.PokiSDK) {
      const rewarded = await window.PokiSDK.rewardedBreak({ size: 'medium', onStart });
      onFinish();
      return rewarded;
    }
    if (this.name === 'crazygames' && window.CrazyGames) {
      return new Promise<boolean>((resolve) => {
        window.CrazyGames?.SDK.ad.requestAd('rewarded', {
          adStarted: onStart,
          adFinished: () => { onFinish(); resolve(true); },
          adError: () => { onFinish(); resolve(false); },
        });
      });
    }
    return false;
  }
}

export const platform = new PlatformBridge();
