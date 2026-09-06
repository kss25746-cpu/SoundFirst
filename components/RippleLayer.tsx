import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface RippleLayerProps {
  touchX: SharedValue<number>;
  touchY: SharedValue<number>;
  rippleProgress: SharedValue<number>;
}

export const RippleLayer: React.FC<RippleLayerProps> = ({ touchX, touchY, rippleProgress }) => {
  // 단순한 믹스(보간) 함수 (UI 스레드에서 안전하게 실행되도록 작성)
  const r = useDerivedValue(() => {
    return rippleProgress.value * 100;
  });

  const opacity = useDerivedValue(() => {
    return 0.8 - (rippleProgress.value * 0.8); // 0.8 -> 0
  });

  // vec() 대신 x, y를 개별 속성으로 사용하거나, 단순 객체 {x, y} 반환 후 Skia에서 직접 받기
  const cx = useDerivedValue(() => touchX.value);
  const cy = useDerivedValue(() => touchY.value);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={r} color="rgba(0, 255, 170, 0.8)" opacity={opacity} />
    </Canvas>
  );
};
