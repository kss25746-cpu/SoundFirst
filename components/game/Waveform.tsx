import React from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import { WAVEFORM_GRADIENT } from '../../constants/colors';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * 진폭 1.0이 상자 높이를 꽉 채우게 하는 계수. 아래에서 `barHeight * 2`로 가운데선 위아래에 나눠 그린다.
 * 전에는 0.35라 상자의 70%까지만 칠했는데, 그때는 Canvas가 담는 상자보다 커서 그게 맞아 보였다.
 */
const AMPLITUDE_RATIO = 0.5;
/** 한 칸에서 막대가 차지하는 폭 */
const BAR_WIDTH_RATIO = 0.66;

interface WaveformProps {
  /**
   * 각 막대의 상대 높이(0~1). 배열 길이가 곧 막대 개수다.
   * **렌더마다 새로 만들지 말 것** — 아래 `useDerivedValue`의 의존성이라 mapper가 매번 재시작한다.
   */
  readonly data: readonly number[];
  readonly color: string;
  readonly height: number;
  readonly width: number;
  /**
   * 오디오 진행도(0~1). `SharedValue`라 값이 바뀌어도 리렌더 없이 파형만 다시 그려진다.
   * 진행도에 따라 왼쪽부터 몇 개까지 그릴지가 정해진다.
   */
  readonly progress: SharedValue<number>;
}

export function Waveform({ data, color, height, width, progress }: WaveformProps) {
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const centerY = height / 2;
    const barWidth = width / Math.max(data.length, 1);
    const maxAmplitude = height * AMPLITUDE_RATIO;

    // 진행도 0이면 하나도 그리지 않는다. `<=`였을 때는 0에서도 첫 막대가 이미 서 있었다
    const visibleBars = Math.floor(data.length * progress.value);

    data.forEach((amplitude, index) => {
      if (index < visibleBars) {
        const x = index * barWidth + barWidth / 2;
        const barHeight = amplitude * maxAmplitude;
        p.addRect(
          Skia.XYWHRect(
            x - barWidth / 3,
            centerY - barHeight,
            barWidth * BAR_WIDTH_RATIO,
            barHeight * 2
          )
        );
      }
    });

    return p;
  }, [data, height, width]);

  // 훅을 다 부른 뒤에 막는다 — 렌더마다 훅 호출 순서가 같아야 한다
  if (!data || data.length === 0) return null;
  // 0 이하 크기로 그리면 Skia에서 NaN이 난다
  if (height <= 0 || width <= 0) return null;

  return (
    // Canvas만으로도 되지만, 가운데 정렬 등 레이아웃용으로 View로 감쌈
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      <Canvas style={{ width, height }}>
        {/* WAVEFORM_GRADIENT.positions는 as const 튜플 — Skia는 number[] 기대라 [...] 전개 */}
        <Path path={path} style="fill">
          <LinearGradient
            start={vec(0, height / 2)}
            end={vec(width, height / 2)}
            colors={[color, WAVEFORM_GRADIENT.middle, WAVEFORM_GRADIENT.end]}
            positions={[...WAVEFORM_GRADIENT.positions]}
          />
        </Path>
      </Canvas>
    </View>
  );
}
