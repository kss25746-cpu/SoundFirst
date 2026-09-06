/**
 * matchGameAI, matchGamePG 공통 오디오 매니저
 * 동물 소리 사전 로드 후 이름으로 재생
 *
 * **싱글턴이지만 앱 수명 동안 상주하지는 않는다.**
 * `createAudioPlayer`는 재생 여부와 무관하게 만드는 즉시 AudioTrack 하나를 잡고,
 * 안드로이드는 앱(UID)당 동시 AudioTrack을 약 40개로 제한한다. 동물 12개를 앱 종료까지
 * 붙잡고 있으면 아무 소리도 내지 않으면서 피아노·기타 예산을 12칸 깎는다.
 * 그래서 화면을 떠날 때 `unloadAll()`로 반납한다(`useStopAudioOnBlur`).
 *
 * 근거: `doc/audio-무음-원인과-방향.md`
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { SOUNDS_CONFIG } from '../constants/animalSounds';

export class GameAudioManager {
  private static instance: GameAudioManager;
  private sounds = new Map<string, AudioPlayer>();

  /** 진행 중인 로드. 두 화면이 거의 동시에 들어와도 12개를 두 번 만들지 않게 한다 */
  private loading: Promise<void> | null = null;

  /**
   * `unloadAll()`이 불릴 때마다 오른다. 로드가 끝났을 때 값이 달라져 있으면
   * **로드 중에 화면이 떠난 것**이므로, 만든 플레이어를 캐시에 넣지 않고 그 자리에서 버린다.
   */
  private generation = 0;

  private constructor() {}

  public static getInstance(): GameAudioManager {
    if (!GameAudioManager.instance) {
      GameAudioManager.instance = new GameAudioManager();
    }
    return GameAudioManager.instance; 
  }

  /**
   * 동물 소리를 만든다. 이미 있으면 아무것도 하지 않고, **로드 중이면 그 로드를 기다린다.**
   * `unloadAll()` 뒤에 다시 부르면 새로 만든다 — 화면 재진입 경로가 여기에 기댄다.
   */
  async loadSoundsAsync(): Promise<void> {
    if (this.sounds.size > 0) return;
    // 예전에는 위 검사가 `await`보다 앞에만 있어서, 두 화면이 거의 동시에 들어오면
    // 둘 다 통과해 12개를 두 번 만들 수 있었다. 진행 중인 Promise를 돌려줘 막는다
    if (this.loading) return this.loading;

    const gen = this.generation;
    const load = (async () => {
      const created = await Promise.all(
        SOUNDS_CONFIG.map(async ({ name, file }) => {
          try {
            return [name, createAudioPlayer(file, { updateInterval: 500 })] as const;
          } catch (error) {
            console.error(`'${name}' 사운드 로딩 실패:`, error);
            return null;
          }
        })
      );

      if (gen !== this.generation) {
        // 만드는 사이에 화면이 떠났다. 캐시에 넣으면 주인 없는 트랙이 남는다
        for (const entry of created) {
          if (!entry) continue;
          try { entry[1].remove(); } catch (e) { }
        }
        return;
      }

      for (const entry of created) {
        if (entry) this.sounds.set(entry[0], entry[1]);
      }
    })();

    this.loading = load;
    try {
      await load;
    } finally {
      if (this.loading === load) this.loading = null;
    }
  }

  /**
   * 만들어 둔 플레이어를 전부 **해제한다.** 화면을 떠날 때 부른다.
   *
   * **`pause()`가 아니라 `remove()`다.** `pause()`는 소리만 멈추고 AudioTrack은 계속
   * 붙잡는다. 자리를 돌려주려면 해제해야 한다. 대가는 재진입 시 첫 소리 지연이다.
   */
  unloadAll(): void {
    // 진행 중인 로드가 끝나고 나서 캐시를 채우는 것도 막는다
    this.generation += 1;

    for (const player of this.sounds.values()) {
      try {
        // 재생 중인 플레이어를 지울 수 있다
        player.remove();
      } catch (e) { }
    }
    this.sounds.clear();
  }

  async playSound(name: string): Promise<void> {
    try {
      const player = this.sounds.get(name);
      if (player) {
        // 이전 `playFromPositionAsync(0)`과 같다 — 처음으로 되감고 재생한다
        await player.seekTo(0);
        player.play();
      }
    } catch (e) {
      console.error(`'${name}' 사운드 재생 중 오류:`, e);
    }
  }
}

export const gameAudioManager = GameAudioManager.getInstance();
