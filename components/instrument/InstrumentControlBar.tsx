import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CONTROL_BAR } from '../../constants/instrumentTheme';

type InstrumentControlBarProps = {
  /** 제어반 높이. 화면 높이에서 계산해 넣는다 (`CONTROL_BAR.standardHeight/compactHeight` 참고) */
  height: number;
  /** 악기색. `INSTRUMENT_ACCENT[악기].bar` */
  background: string;
  /** 좁은 제어반은 세로 패딩을 줄인다 */
  paddingVertical?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * 악기 화면 **하단 미션 제어반**의 껍데기.
 *
 * 피아노 `trainingContainer`가 원본이고 기타가 같은 값을 쓴다.
 * 안에 무엇이 들어가는지는 화면마다 다르므로(피아노는 곡 슬롯·콘솔 SVG,
 * 기타는 난이도 한 줄) **자식은 받기만 하고 배치만 책임진다.**
 *
 * `zIndex/elevation: 20` — 건반·프렛의 그림자(elevation 10~15)보다 위에 있어야
 * 안드로이드에서 제어반이 악기 밑으로 깔리지 않는다.
 */
export function InstrumentControlBar({
  height,
  background,
  paddingVertical = CONTROL_BAR.paddingVertical,
  style,
  children,
}: InstrumentControlBarProps) {
  return (
    <View
      style={[
        styles.bar,
        { height, backgroundColor: background, paddingVertical },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    paddingHorizontal: CONTROL_BAR.paddingHorizontal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: CONTROL_BAR.borderTopWidth,
    borderTopColor: CONTROL_BAR.borderTopColor,
    zIndex: 20,
    elevation: 20,
  },
});
