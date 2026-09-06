import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * 드럼처럼 지연이 치명적인 짧은 샘플용 오디오 매니저.
 *
 * - 사운드 키마다 플레이어를 하나씩 만들어 재사용한다 (타격마다 생성/파괴하지 않음).
 * - 재생 요청을 큐에 쌓지 않는다. 터치 → 소리가 곧바로 이어진다.
 * - 같은 키를 다시 재생하면 겹치지 않고 처음부터 다시 재생한다.
 *   드럼 UI에서 같은 악기를 연속 재생하는 경로는 퀴즈의 ↻(다시 듣기)뿐이고,
 *   거기서는 겹쳐 울리면 "두 번 친 것"처럼 들려 문제를 오히려 방해한다.
 *   서로 다른 악기는 각자 플레이어를 가지므로 자연히 겹쳐 난다.
 *
 * 피아노(MusicTrainingScreen) · 기타(guitar/_layout)와 같은 상주 플레이어 방식이며,
 * 드럼은 샘플이 5개(≈540KB)뿐이라 LRU 없이 전부 상주시킨다.
 */

type SoundEntry = { readonly key: string; readonly source: any };

interface AudioManagerContextType {
  /** 탭 진입 시 미리 플레이어를 만들어 첫 터치 지연을 없앤다 */
  preloadSounds: (entries: readonly SoundEntry[]) => void;
  playSound: (soundKey: string, source: any) => void;
  stopAllSounds: () => void;
  getCurrentTab: () => string;
  setCurrentTab: (tab: string) => void;
  isPlaying: (soundKey: string) => boolean;
}

const AudioManagerContext = createContext<AudioManagerContextType | null>(null);

function releasePlayer(player: AudioPlayer) {
  try {
    player.remove();
  } catch (error) {
    console.warn('AudioManager: 플레이어 해제 실패', error);
  }
}

export function AudioManagerProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  /** 사운드 키 → 상주 플레이어 */
  const poolRef = useRef<Map<string, AudioPlayer>>(new Map());
  const currentTabRef = useRef<string>('');

  // 오디오 세션은 앱 시작 시 여기서 한 번만 설정한다. **앱 전체에서 유일한 설정 지점이다.**
  // 재생할 때마다 설정하면 네이티브 세션 재구성 지연이 첫 소리 앞에 그대로 붙는다.
  //
  // `doNotMix` = 훈련 중에는 바깥 앱(유튜브·음악 등) 소리를 끊는다.
  // 청각 훈련 중 바깥 소리가 섞이면 훈련이 오염되고 측정값도 신뢰할 수 없다는 판단이다.
  // 앱 **안**의 소리끼리는 이 설정과 무관하게 항상 같이 난다
  // (동물게임에서 소리 3개가 겹쳐 들리는 훈련 설계도 그대로 유지된다).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    }).catch((error) => console.warn('AudioManager: 오디오 모드 설정 실패', error));
  }, []);

  const getPlayer = useCallback((soundKey: string, source: any): AudioPlayer => {
    const pooled = poolRef.current.get(soundKey);
    if (pooled) return pooled;

    const player = createAudioPlayer(source);
    poolRef.current.set(soundKey, player);
    return player;
  }, []);

  const preloadSounds = useCallback((entries: readonly SoundEntry[]) => {
    for (const { key, source } of entries) {
      try {
        getPlayer(key, source);
      } catch (error) {
        console.warn(`AudioManager: ${key} 프리로드 실패`, error);
      }
    }
  }, [getPlayer]);

  const playSound = useCallback((soundKey: string, source: any) => {
    try {
      const player = getPlayer(soundKey, source);
      // 재생 중이어도 겹치지 않고 처음부터 다시 (↻ 다시 듣기가 이 경로를 탄다)
      player.seekTo(0).catch(() => { });
      player.play();
    } catch (error) {
      console.warn(`AudioManager: ${soundKey} 재생 실패`, error);
    }
  }, [getPlayer]);

  /** 재생만 멈춘다. 상주 플레이어는 유지해 탭 재진입 시 즉시 반응하도록 한다. */
  const stopAllSounds = useCallback(() => {
    for (const player of poolRef.current.values()) {
      try {
        player.pause();
        player.seekTo(0).catch(() => { });
      } catch (error) {
        console.warn('AudioManager: 재생 중지 실패', error);
      }
    }
  }, []);

  const setCurrentTab = useCallback((newTab: string) => {
    if (currentTabRef.current === newTab) return;
    stopAllSounds();
    currentTabRef.current = newTab;
  }, [stopAllSounds]);

  const isPlaying = useCallback(
    (soundKey: string): boolean => poolRef.current.get(soundKey)?.playing ?? false,
    []
  );

  // 앱 종료 시 전체 해제
  useEffect(() => {
    const pool = poolRef.current;

    return () => {
      for (const player of pool.values()) releasePlayer(player);
      pool.clear();
    };
  }, []);

  const value = useMemo(() => ({
    preloadSounds,
    playSound,
    stopAllSounds,
    getCurrentTab: () => currentTabRef.current,
    setCurrentTab,
    isPlaying,
  }), [preloadSounds, playSound, stopAllSounds, setCurrentTab, isPlaying]);

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
    </AudioManagerContext.Provider>
  );
}

export function useAudioManager() {
  const context = useContext(AudioManagerContext);
  if (!context) {
    throw new Error('useAudioManager must be used within AudioManagerProvider');
  }
  return context;
}
