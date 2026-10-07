export type H5Placement = {
  type: 'reward' | 'next'; name: string;
  beforeAd(): void; afterAd(): void;
  beforeReward?: (showAd: () => void) => void;
  adViewed?: () => void; adDismissed?: () => void;
  adBreakDone: () => void;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (placement: H5Placement) => void;
    adConfig?: (config: { preloadAdBreaks?: 'on'; sound?: 'on' | 'off'; onReady?: () => void }) => void;
  }
}

export class GoogleH5Ads {
  ready = false;
  busy = false;
  private lastBreak = 0;

  constructor() {
    try { this.lastBreak = Number(sessionStorage.getItem('ocean-ad-last-break')) || 0; } catch { /* Ads still work without optional frequency storage. */ }
  }

  async initialize() {
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    // Tests inject the documented callback contract only on localhost.
    if (local && window.adBreak && window.adConfig) { this.ready = true; return; }
    const client = import.meta.env.VITE_GOOGLE_AD_CLIENT;
    if (!/^ca-pub-\d{16}$/.test(client ?? '')) return;
    window.adsbygoogle ??= [];
    window.adBreak = (placement) => { window.adsbygoogle!.push(placement); };
    window.adConfig = (config) => { window.adsbygoogle!.push(config); };
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.adClient = client;
    script.dataset.adFrequencyHint = '300s';
    if (local || import.meta.env.VITE_GOOGLE_ADS_TEST !== 'off') script.dataset.adbreakTest = 'on';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
    script.onerror = () => { this.ready = false; };
    document.head.append(script);
    window.adConfig({ preloadAdBreaks: 'on', onReady: () => { this.ready = true; } });
  }

  setSound(on: boolean) { if (this.ready) window.adConfig?.({ sound: on ? 'on' : 'off' }); }

  async request(kind: 'reward' | 'next', onStart: () => void, onFinish: () => void,
    offer?: (show: () => void, decline: () => void) => void): Promise<boolean> {
    if (!this.ready || this.busy || !window.adBreak) return false;
    if (kind === 'next' && this.lastBreak && Date.now() - this.lastBreak < 300_000) return false;
    this.busy = true;
    return new Promise<boolean>((resolve) => {
      let settled = false, started = false, ended = false, viewed = false;
      let timeout: ReturnType<typeof setTimeout>;
      const finish = () => {
        if (started && !ended) { ended = true; this.busy = false; onFinish(); }
        if (settled) return;
        settled = true; clearTimeout(timeout); this.busy = false;
        resolve(viewed);
      };
      // Only time out before an ad starts. Never resume underneath a playing video.
      timeout = setTimeout(finish, 15_000);
      try {
        window.adBreak!({
          type: kind, name: kind === 'reward' ? 'ocean_research_grant' : 'ocean_next_expedition',
          beforeAd: () => {
            // A request watchdog cannot cancel Google's placement. Late video
            // startup still owns the pause/audio lifecycle, but earns no grant.
            if (started || ended) return;
            started = true; this.busy = true; clearTimeout(timeout); this.lastBreak = Date.now();
            try { sessionStorage.setItem('ocean-ad-last-break', String(this.lastBreak)); } catch { /* Keep the in-memory frequency guard. */ }
            onStart();
          },
          afterAd: finish,
          beforeReward: kind === 'reward' ? (show) => {
            if (settled) return;
            clearTimeout(timeout);
            if (!offer) { finish(); return; }
            offer(() => { if (!settled) { timeout = setTimeout(finish, 15_000); try { show(); } catch { finish(); } } }, finish);
          } : undefined,
          adViewed: () => { if (!settled) viewed = true; },
          adDismissed: () => { viewed = false; },
          adBreakDone: finish,
        });
      } catch { finish(); }
    });
  }
}
