import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * 값을 상·하한 안에 가둔다.
 *
 * 반응형 치수를 잡는 방식이다 — 비율(`usableHeight * 0.2`)로 잡되,
 * **작은 스마트폰에서 읽을 수 없게 줄어들거나 태블릿에서 우스꽝스럽게 커지지 않도록**
 * 양쪽을 막는다. 비율만 쓰면 전자가, 고정값만 쓰면 후자가 깨진다.
 */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** `clamp` 후 정수로. 폰트·패딩은 소수점이 있으면 기기마다 반올림이 갈린다 */
export const clampRound = (value: number, min: number, max: number) =>
  Math.round(clamp(value, min, max));

/**
 * 악기 화면이 공통으로 쓰는 화면 치수.
 *
 * 두 화면 모두 **가로모드 전체화면**이라 인셋을 직접 다뤄야 한다.
 * `SafeAreaView edges={[]}`로 자동 패딩을 끄고, 내용은 `safeAreaFrameStyle`을 씌운
 * 절대배치 레이어에 담는 방식 — 배경은 노치 밑까지 칠하고 내용만 안쪽으로 들인다.
 */
export function useInstrumentMetrics() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const usableWidth = Math.max(1, width - insets.left - insets.right);
  const usableHeight = Math.max(1, height - insets.top - insets.bottom);

  return {
    width,
    height,
    insets,
    usableWidth,
    usableHeight,
    /** 내용 레이어를 인셋 안쪽으로 들이는 프레임 */
    safeAreaFrameStyle: {
      top: insets.top,
      right: insets.right,
      bottom: insets.bottom,
      left: insets.left,
    },
    /** 우상단 `MissionProgressIcon` 위치. 인셋이 0이어도 최소 12는 띄운다 */
    missionIconStyle: {
      top: Math.max(12, insets.top),
      right: insets.right + 12,
    },
  };
}
