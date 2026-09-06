import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants/colors';
import { LAYOUT } from '../constants/layout';

/**
 * 게임 넷(`app/(tabs)/new/(games)`)에서 **목록으로 나가기.**
 * `(games)/_layout.tsx`에 **한 번만** 올린다 — 네 화면에 각각 넣으면
 * 스타일·인셋·zIndex가 갈라진다.
 *
 * `LandscapeBackButton`을 그대로 쓰지 않는 이유가 둘이다.
 * 1. 그쪽 fallback은 `/(tabs)/drum`이다. 게임에서 히스토리가 없으면 목록이 아니라
 *    **드럼으로 떨어진다.**
 * 2. 그쪽은 탭바가 숨겨진 **가로** 화면용이라 반투명 흰 판 + 흰 아이콘이다.
 *    게임 넷은 밝은 배경(사진 · 연노랑 · 연회색) 위라 그 배색이 묻힌다.
 *
 * 결과창의 **「홈으로」와는 다른 버튼이다.** 「홈으로」는 그 게임의 HOME 상태로
 * 되돌리는 **라운드 종료**이고, 이것은 **화면을 나가는 것**이다.
 * 글자를 함께 단 것도 둘을 눈으로 갈라 놓기 위해서다 — 「뒤로」는 쓰지 않는다.
 *
 * 재생 중(`LISTENING`)에도 그대로 둔다. 소리는 여기서 끊지 않는다 —
 * 넷 다 `useStopAudioOnBlur`가 화면을 뜰 때 끊는다.
 */
export function GameExitButton() {
  const router = useRouter();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // 정상 경로는 `new/index`의 `router.push`라 위에서 끝난다.
    // 히스토리가 없는 진입(딥링크 등)에서만 목록을 직접 연다.
    router.replace('/(tabs)/new');
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="게임 나가기"
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Ionicons
        name="arrow-back"
        size={LAYOUT.gameExitButtonIconSize}
        color={COLORS.textPrimary}
      />
      <Text style={styles.label} numberOfLines={1}>나가기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * 오른쪽 **아래.** 우상단은 미션아이콘(`top: 50, right: 20`)이 쓴다.
   * 이 레이아웃의 바닥은 이미 탭바 위라 **`insets.bottom`을 더하지 않는다.**
   */
  button: {
    position: 'absolute',
    right: LAYOUT.gameExitButtonRight,
    bottom: LAYOUT.gameExitButtonBottom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LAYOUT.gameExitButtonGap,
    minHeight: LAYOUT.gameExitButtonMinHeight,
    paddingHorizontal: LAYOUT.gameExitButtonPaddingH,
    borderRadius: LAYOUT.gameExitButtonMinHeight / 2,
    // 밝은 배경·사진 위에 얹히므로 **불투명**하게 깐다. 그림자는 `elevation`만 (규칙 4)
    backgroundColor: COLORS.background,
    borderWidth: 1,
    // `borderGray`(#BDBDBD)는 흰 판·`#f5f5f5` 양쪽에서 1.88:1이라 테두리가 안 보인다.
    // 판이 흰색이면 **경계가 유일한 구분**이라 3:1을 넘겨야 한다 — `textSecondary`는 5.2~5.7:1
    borderColor: COLORS.textSecondary,
    elevation: 6,
    zIndex: 10,
  },
  buttonPressed: {
    backgroundColor: COLORS.backgroundLight,
  },
  label: {
    fontSize: LAYOUT.gameExitButtonFontSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
