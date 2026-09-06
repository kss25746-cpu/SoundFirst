import { useState, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSharedValue } from 'react-native-reanimated';

/**
 * 단어 듣기 훈련용 오디오 재생 훅.
 * 🎧 learn 탭(`WordGame`)과 📖 flashcards 탭(`WordFlashcard`)이 함께 씁니다.
 *
 * 훈련 특성상 **버튼을 누른 뒤 소리가 나기까지의 지연이 짧을수록 좋습니다.**
 * 그래서 재생마다 플레이어를 새로 만들지 않고 모듈 단위 LRU 캐시에 상주시킵니다.
 * (피아노 `MusicTrainingScreen` · 기타 `guitar/_layout`과 같은 방식)
 *
 * 오디오 세션은 **여기서 건드리지 않습니다.** `AudioManagerProvider`가 앱 시작 시 1회 설정합니다.
 * 재생할 때마다 `setAudioModeAsync`를 부르면 네이티브 세션 재구성 지연이 첫 소리 앞에 그대로 붙습니다.
 */

/** 상주시킬 단어 플레이어 수. 단어 파일은 36개 / 2.7MB이므로 8개면 최근 문항을 대부분 덮습니다 */
const CACHE_LIMIT = 8;
/** 진행도(progress) 갱신 간격 (ms). 파형 애니메이션이 끊겨 보이지 않을 정도 */
const UPDATE_INTERVAL_MS = 100;
/** 재생 완료 신호가 오지 않을 때를 대비한 백업 타이머의 여유 (ms) */
const BACKUP_GRACE_MS = 500;
/** 아직 소리 길이를 모를 때 쓰는 백업 타이머 기본값 (ms) */
const BACKUP_FALLBACK_MS = 3000;

/**
 * 사운드 소스 → 상주 플레이어.
 * 훅 바깥(모듈 단위)에 두어 화면을 나갔다 들어와도, 두 탭을 오가도 캐시가 유지됩니다.
 * Map은 삽입 순서를 지키므로 "가장 오래 안 쓴 것 = 맨 앞"으로 LRU가 됩니다.
 */
const playerCache = new Map<any, AudioPlayer>();

/** 캐시가 꽉 찼을 때 가장 오래 안 쓴 플레이어부터 버린다. 재생 중인 것은 건너뛴다 */
function evictLeastRecentlyUsed() {
  for (const [key, player] of playerCache) {
    if (player.playing) continue;
    playerCache.delete(key);
    try {
      player.remove();
    } catch (error) {
      console.warn('단어 플레이어 해제 실패:', error);
    }
    return;
  }
}

function getPlayer(source: any): AudioPlayer {
  const cached = playerCache.get(source);
  if (cached) {
    // 최근 사용으로 표시 (맨 뒤로 이동)
    playerCache.delete(source);
    playerCache.set(source, cached);
    return cached;
  }

  if (playerCache.size >= CACHE_LIMIT) evictLeastRecentlyUsed();

  const player = createAudioPlayer(source, { updateInterval: UPDATE_INTERVAL_MS });
  playerCache.set(source, player);
  return player;
}

export function useWordAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const progress = useSharedValue(0);

  const currentPlayerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const playbackIdRef = useRef(0);
  /** 백업 타이머를 재생 진행에 맞춰 다시 잡기 위한 마지막 재생 위치(초) */
  const lastTimeRef = useRef(-1);

  const clearBackupTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /**
   * 현재 재생만 멈춘다. **플레이어는 캐시에 그대로 둔다** — 다음 재생이 즉시 시작되도록.
   * (이전 구현은 매번 `unloadAsync()` 후 50ms를 기다렸고, 그만큼이 다음 소리 앞에 붙었다)
   */
  const stopCurrentPlayback = () => {
    clearBackupTimer();

    subscriptionRef.current?.remove();
    subscriptionRef.current = null;

    const player = currentPlayerRef.current;
    currentPlayerRef.current = null;
    if (!player) return;

    try {
      player.pause();
    } catch (error) {
      console.warn('단어 사운드 중지 실패:', error);
    }
  };

  useEffect(() => {
    // 오디오 세션은 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
    // 동물게임의 `duckOthers`를 되돌리려고 여기 두었던 `setAudioModeAsync` 호출은 그때 제거했다.
    return () => {
      // 언마운트 시 재생만 멈춘다. 캐시는 다음 진입을 위해 유지한다.
      playbackIdRef.current++;
      stopCurrentPlayback();
    };
  }, []);

  const handlePlaybackComplete = (onComplete?: () => void, playbackId?: number) => {
    if (playbackId !== undefined && playbackId !== playbackIdRef.current) return;
    if (completedRef.current) return;

    completedRef.current = true;
    clearBackupTimer();
    setIsPlaying(false);
    progress.value = 1;

    onComplete?.();
  };

  const playWordSound = async (
    soundSource: any,
    wordText: string,
    onComplete?: () => void
  ): Promise<void> => {
    // 재생 ID 증가 → 이 시점 이후의 이전 재생 콜백은 전부 무효
    const currentPlaybackId = ++playbackIdRef.current;

    try {
      // 이전 재생이 있으면 끊는다 (ref로 판단 — state는 같은 tick 안에서 갱신 전 값을 본다)
      stopCurrentPlayback();

      setIsPlaying(true);
      completedRef.current = false;
      progress.value = 0;
      lastTimeRef.current = -1;

      console.log(`🔊 Playing word: ${wordText}`);

      const player = getPlayer(soundSource);
      currentPlayerRef.current = player;
      player.volume = 1.0;

      const armBackupTimer = (millis: number) => {
        clearBackupTimer();
        timerRef.current = setTimeout(() => {
          if (currentPlaybackId !== playbackIdRef.current) return;
          console.log('⚠️ 백업 타이머로 재생 완료 처리');
          handlePlaybackComplete(onComplete, currentPlaybackId);
        }, millis);
      };

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (status) => {
        if (currentPlaybackId !== playbackIdRef.current) return;

        /**
         * 죽은 플레이어는 예외도 로그도 없이 무음이 된다. 유일한 통보 경로가 이 이벤트다.
         *
         * 캐시에 남겨두면 다음 재생도 같은 플레이어를 재사용해 또 무음이다. 그런데 이 캐시는
         * **탭을 나가도 안 비워진다**(모듈 단위, `playerCache`). 그래서 그냥 두면 회복 조건이
         * "다른 단어 8개가 LRU로 밀어내기" 아니면 "앱 재시작"이다. 여기서 빼두면 다음 재생 때
         * `getPlayer`가 새로 만들어 **한 번 더 누르면 회복한다.**
         *
         * 완료 처리는 건드리지 않는다 — `:186`의 백업 타이머가 3초 뒤 `onComplete`를 부른다.
         */
        if (status.error) {
          console.warn(`[audio] 단어 '${wordText}' 재생 에러:`, status.error);

          // 해제 전에 구독·참조부터 끊는다. 남겨두면 나중에 해제된 플레이어를 pause하게 된다
          subscriptionRef.current?.remove();
          subscriptionRef.current = null;
          if (currentPlayerRef.current === player) currentPlayerRef.current = null;

          // 그 사이에 축출·교체됐다면 남의 플레이어다. 건드리지 않는다
          if (playerCache.get(soundSource) === player) {
            playerCache.delete(soundSource);
            try {
              player.remove();
            } catch (removeError) {
              console.warn('단어 플레이어 해제 실패:', removeError);
            }
          }
          return;
        }

        if (status.duration > 0) {
          progress.value = Math.min(status.currentTime / status.duration, 1);

          // 재생이 실제로 진행됐을 때만 백업 타이머를 남은 시간에 맞춰 다시 잡는다.
          // 위치가 멈춰 있으면 재무장하지 않으므로 마지막 타이머로 반드시 빠져나온다.
          if (status.currentTime > lastTimeRef.current) {
            lastTimeRef.current = status.currentTime;
            armBackupTimer((status.duration - status.currentTime) * 1000 + BACKUP_GRACE_MS);
          }
        }

        if (status.didJustFinish) {
          handlePlaybackComplete(onComplete, currentPlaybackId);
        }
      });

      // 처음 재생이면 이미 0이므로 seek 없이 바로 시작 (지연 최소화).
      // 다시 듣기처럼 위치가 남아 있을 때만 되감는다.
      if (player.currentTime > 0) {
        await player.seekTo(0);
        if (currentPlaybackId !== playbackIdRef.current) return;
      }

      player.play();

      // 길이를 아직 모르면 기존과 같은 3초로 잡고, 첫 상태 갱신에서 실제 길이로 교체된다
      armBackupTimer(
        player.duration > 0 ? player.duration * 1000 + BACKUP_GRACE_MS : BACKUP_FALLBACK_MS
      );
    } catch (error) {
      console.error('단어 사운드 재생 오류:', error);
      if (currentPlaybackId === playbackIdRef.current) {
        clearBackupTimer();
        setIsPlaying(false);
        completedRef.current = false;
        progress.value = 0;
        onComplete?.();
      }
    }
  };

  const stopSound = async () => {
    // 재생 ID 증가하여 현재 재생 무효화
    playbackIdRef.current++;
    stopCurrentPlayback();
    setIsPlaying(false);
    completedRef.current = true;
    progress.value = 0;
  };

  return {
    playWordSound,
    stopSound,
    isPlaying,
    progress,
  };
}
