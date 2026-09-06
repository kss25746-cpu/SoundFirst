import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { InstrumentButton } from './InstrumentButton';

export type DifficultyLevel<T extends string = string> = {
  name: T;
  label: string;
};

type DifficultyRowProps<T extends string> = {
  levels: readonly DifficultyLevel<T>[];
  selected: T;
  onSelect: (name: T) => void;
  /** 훈련 중에는 난이도를 못 바꾼다 */
  disabled?: boolean;
  color?: string;
  activeColor?: string;
  fontSize?: number;
  paddingVertical?: number;
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
};

/** 난이도 단계를 가로 한 줄로. 피아노 `difficultyContainer`가 원본이다 */
export function DifficultyRow<T extends string>({
  levels,
  selected,
  onSelect,
  disabled = false,
  color,
  activeColor,
  fontSize,
  paddingVertical,
  paddingHorizontal,
  style,
}: DifficultyRowProps<T>) {
  return (
    <View style={[styles.row, style]}>
      {levels.map(({ name, label }) => (
        <InstrumentButton
          key={name}
          variant="difficulty"
          label={label}
          active={selected === name}
          disabled={disabled}
          color={color}
          activeColor={activeColor}
          fontSize={fontSize}
          paddingVertical={paddingVertical}
          paddingHorizontal={paddingHorizontal}
          onPress={() => onSelect(name)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
