import { SoundManager, type SoundPlayer } from "./sound-manager";

const makeManager = () => {
  const play = vi.fn();
  const factory = vi.fn(async (): Promise<SoundPlayer> => ({ play }));
  return { m: new SoundManager(factory), play, factory };
};

describe("SoundManager", () => {
  it("never plays before a user gesture, and doesn't even load audio", () => {
    const { m, factory } = makeManager();
    expect(m.play("tap")).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
  it("plays after unlock and respects one-tap mute", async () => {
    const { m, play } = makeManager();
    m.unlock();
    expect(m.play("pop")).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(play).toHaveBeenCalledWith("pop");
    m.setMuted(true);
    expect(m.play("pop")).toBe(false);
  });
});
