/**
 * Sound manager (web PRD section 6): short sounds, one-tap mute, and never a
 * sound before the first user gesture (browsers block it anyway, and children
 * shouldn't be startled). Howler is loaded lazily so it stays out of the first
 * page load; the player is injectable for tests.
 */
export type SoundName = "tap" | "pop";

export const SOUND_FILES: Record<SoundName, string> = {
  tap: "/sounds/tap.wav",
  pop: "/sounds/pop.wav",
};

export interface SoundPlayer {
  play(name: SoundName): void;
}

export type PlayerFactory = () => Promise<SoundPlayer>;

export const howlerPlayer: PlayerFactory = async () => {
  const { Howl } = await import("howler");
  const howls = Object.fromEntries(
    Object.entries(SOUND_FILES).map(([k, src]) => [k, new Howl({ src: [src], volume: 0.6, preload: true })]),
  ) as Record<SoundName, InstanceType<typeof Howl>>;
  return { play: (n) => void howls[n].play() };
};

export class SoundManager {
  private unlocked = false;
  private muted = false;
  private player: Promise<SoundPlayer> | null = null;

  constructor(private readonly factory: PlayerFactory = howlerPlayer) {}

  /** Call from a user-gesture handler (pointerdown/keydown). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.player = this.factory();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  /** Plays only after a gesture and when not muted; otherwise a silent no-op. */
  play(name: SoundName): boolean {
    if (!this.unlocked || this.muted || !this.player) return false;
    void this.player.then((p) => p.play(name)).catch(() => {});
    return true;
  }
}

export const sounds = new SoundManager();
