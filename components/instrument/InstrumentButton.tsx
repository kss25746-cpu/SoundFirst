import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { RADII } from '../../constants/instrumentTheme';

/**
 * - `action` — 훈련 시작/종료, 다시 듣기, 연주 시작. 알약형 큰 버튼
 * - `difficulty` — 난이도 단계. 더 둥글고 작다
 * - `toggle` — 콘솔 안의 2지선다(스케일·템포). 테두리가 있고 꺼진 상태는 글자가 흐리다
 */
export type InstrumentButtonVariant = 'action' | 'difficulty' | 'toggle';

type InstrumentButtonProps = {
  label: string;
  onPress: () => void;
  variant?: InstrumentButtonVariant;
  /** 켜진 상태 — 선택된 난이도 · 선택된 토글 · 훈련 중인 종료 버튼 */
  active?: boolean;
  disabled?: boolean;
  /** 꺼진 상태 배경 */
  color?: string;
  /** 켜진 상태 배경. 없으면 `color`를 그대로 쓴다 */
  activeColor?: string;
  fontSize?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * 악기 화면의 버튼. 피아노 `trainingButton` / `difficultyButton` / `scaleToggleButton`을
 * variant 셋으로 합친 것이고, 기타도 같은 것을 쓴다.
 *
 * **색은 넘겨받는다.** 모양·간격·글자 굵기는 두 악기가 같아야 하지만
 * 액센트는 악기마다 달라야 하기 때문이다(피아노 파랑 / 기타 우드).
 * 의미색(중지 빨강·다시듣기 초록)은 `SEMANTIC`에서 꺼내 넘긴다.
 */
export function InstrumentButton({
  label,
  onPress,
  variant = 'action',
  active = false,
  disabled = false,
  color,
  activeColor,
  fontSize,
  paddingVertical,
  paddingHorizontal,
  style,
  textStyle,
}: InstrumentButtonProps) {
  const base = color ?? variantDefaults[variant].color;
  const background = active ? activeColor ?? base : base;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        variantStyles[variant],
        { backgroundColor: background },
        variant === 'toggle' && active && styles.toggleActive,
        paddingVertical != null && { paddingVertical },
        paddingHorizontal != null && { paddingHorizontal },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.baseText,
          variantTextStyles[variant],
          variant === 'toggle' && active && styles.toggleTextActive,
          fontSize != null && { fontSize },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const variantDefaults: Record<InstrumentButtonVariant, { color: string }> = {
  action: { color: '#007BFF' },
  difficulty: { color: '#555555' },
  toggle: { color: '#3a3a3a' },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.45,
  },
  toggleActive: {
    borderColor: '#007BFF',
  },
  toggleTextActive: {
    color: '#fff',
  },
});

const variantStyles = StyleSheet.create({
  action: {
    borderRadius: RADII.action,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  difficulty: {
    borderRadius: RADII.difficulty,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginHorizontal: 3,
  },
  toggle: {
    borderRadius: RADII.toggle,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 56,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
});

const variantTextStyles = StyleSheet.create({
  action: {
    fontSize: 14,
  },
  difficulty: {
    fontSize: 16,
    fontWeight: '800',
  },
  toggle: {
    // 꺼진 토글은 배경이 아니라 **글자**를 흐리게 해서 구분한다.
    // 배경을 흐리게 하면 콘솔 SVG 프레임 무늬가 비쳐 지저분해진다.
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 15,
    fontWeight: '800',
  },
});
