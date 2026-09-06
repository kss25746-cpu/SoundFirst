import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * 탭에서 포커스를 잃을 때 그 화면의 소리를 멈춘다.
 *
 * 탭은 한 번 방문하면 계속 마운트 상태로 남는다(`app/(tabs)/_layout.tsx`의 `Tabs`에
 * `unmountOnBlur`를 쓰지 않음). 그래서 **언마운트 클린업은 탭을 바꿔도 실행되지 않고**,
 * 정리는 포커스 기준으로 걸어야 한다.
 *
 * 재생 주체가 화면마다 다르므로(드럼 `AudioManager` 풀 / 단어 훅 / 피아노·기타 자체 캐시 /
 * 동물게임·냉장고는 화면이 직접 들고 있는 플레이어) 공통 정지 함수는 없다.
 * 각 화면이 자기 소리를 멈추는 함수를 넘긴다.
 *
 * **무엇을 하는지는 화면이 정한다 — 정지만이 아니다.**
 * 피아노·기타는 여기서 플레이어를 `remove()`까지 한다. `pause()`는 소리만 멈추고
 * **AudioTrack은 계속 붙잡기 때문이다.** 안드로이드는 앱당 약 40개로 제한하므로,
 * 붙잡은 채로 두면 다음 탭이 트랙을 못 받아 무음이 된다.
 * (예전에는 재진입 첫 음 지연을 피하려고 정지만 했다. 그게 앱 전체 무음의 원인이었다.
 *  경위: `doc/audio-무음-원인과-방향.md`)
 *
 * @param stopAudio 포커스를 잃는 순간 호출된다. 매 렌더의 최신 함수가 쓰이므로
 *                  `useCallback`으로 감쌀 필요가 없다.
 * @returns 포커스 여부를 담은 ref. 답을 맞힌 뒤 타이머로 다음 문제음을 내보내는 화면(기타)처럼
 *          **떠난 뒤에 시작될 재생을 막아야 할 때** 재생 직전에 확인한다.
 */
export function useStopAudioOnBlur(stopAudio: () => void) {
  const stopRef = useRef(stopAudio);
  stopRef.current = stopAudio;

  const isFocusedRef = useRef(true);

  useFocusEffect(
    // 의존성을 비워 두어 클린업이 포커스를 잃을 때만 1회 실행되게 한다
    useCallback(() => {
      isFocusedRef.current = true;

      return () => {
        isFocusedRef.current = false;
        stopRef.current();
      };
    }, [])
  );

  return isFocusedRef;
}
