import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withDelay,
  withTiming,
  Easing,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';

/**
 * WaveRipple
 * wave.json(Lottie) 대체용 pulse/ripple 컴포넌트.
 *
 * 원본 값 매핑:
 * - 원 개수      : 8   (count)
 * - 색상         : rgb(121,161,255) = #79A1FF
 * - scale        : 1% → 100%
 * - opacity      : 100% → 0%
 * - 1 cycle      : 90프레임 @30fps = 3000ms  (duration)
 * - 시차(stagger): delay = duration / count → 3000/8 = 375ms
 *                  (1000ms로 벌리면 8개가 3주기로 겹쳐 원이 3개로 보인다)
 */

type WaveRippleProps = {
  size?: number;        // 최대 원 지름(px). 
  color?: string;
  count?: number;       // 동시에 퍼지는 원 개수. 원본은 8
  duration?: number;    // 한 원이 퍼졌다 사라지는 시간(ms). 원본은 3000
  style?: StyleProp<ViewStyle>;
};

const Ripple = ({
  size,
  color,
  delay,
  duration,
}: {
  size: number;
  color: string;
  delay: number;
  duration: number;
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration,
          // Lottie 원본 bezier(0.833/0.167) ≈ ease-in-out
          easing: Easing.inOut(Easing.ease),
        }),
        -1,   // 무한 반복
        false // 역방향 없음
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.01, 1]) }],
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export default function WaveRipple({
  size = 3000,
  color = '#79A1FF',
  count = 8,
  duration = 3000,
  style,
}: WaveRippleProps) {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        style,
      ]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Ripple
          key={i}
          size={size}
          color={color}
          duration={duration}
          delay={(duration / count) * i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
