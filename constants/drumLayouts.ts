import { InstrumentType } from './drumSounds';

interface InstrumentDetail {
  x: number;
  y: number;
}

/** 악기별 중립 위치 오프셋 (악기 위치에서 상대적으로 떨어진 거리) */
interface NeutralOffset {
  dx: number;
  dy: number;
}

export interface DrumLayout {
  image: any;
  colorImage: any;
  order: InstrumentType[];
  details: Partial<Record<InstrumentType, InstrumentDetail>>;
  /** 악기별 중립 위치 오프셋 (다음 문제 전 캐릭터를 약간 떨어진 위치로 이동) */
  neutralOffsets: Partial<Record<InstrumentType, NeutralOffset>>;
  /**
   * 3악기 세트의 바닥선에 맞추려고 세트 전체를 아래로 내리는 양. `drumSetSize`에 곱해 쓴다.
   *
   * 네 PNG 모두 540×540 정사각형이라 `resizeMode="contain"`이 잘라내거나 레터박스를 만들
   * 자리가 없다. 즉 화면에서 **박스 위치·크기는 네 페이지가 모두 같고**, 다른 것은
   * 그 캔버스 안에서 그림이 실제로 차지하는 영역이다. 알파 채널 실측으로 그림 아래
   * 남는 투명 띠는 (540px 기준) last_33 0 · last_55 31 · last_44 35 · last_22 80 이다.
   *
   * 드럼은 바닥에 놓인 물체로 읽히므로 눈이 맞추는 기준은 그림의 중심이 아니라 아래 끝선이다.
   * 그래서 바닥까지 꽉 찬 3악기만 제자리로 보이고 나머지는 그 띠만큼 떠 보인다.
   * 띠 비율만큼 도로 내려서 네 페이지의 바닥선을 맞춘다.
   *
   * 이미지를 다시 내보내 여백을 맞추는 길도 있었지만 택하지 않았다. 여백을 바꾸면
   * 위 `details`·`neutralOffsets`의 캔버스 기준 비율이 전부 무효가 되고,
   * 베이스와 픽셀 단위로 겹쳐 그리는 하이라이트 14장까지 같은 기준으로 다시 뽑아야 한다.
   */
  bottomAlignOffset: number;
}

// 5-instrument layout
export const LAYOUT_5_DRUMS: DrumLayout = {
  image: require('../assets/images/last_55.png'),
  colorImage: require('../assets/images/last_55.png'), 
  order: ['snare', 'hihat', 'tom', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.15, y: 0.2 },
    snare:  { x: 0.27, y: 0.35 },
    kick:   { x: 0.46, y: 0.44 },
    cymbal: { x: 0.85, y: 0.2 },
    tom:    { x: 0.55, y: 0.15 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.08, dy: -0.06 },
    snare:  { dx: -0.08, dy: 0.06 },
    kick:   { dx: 0, dy: 0.08 },
    cymbal: { dx: 0.06, dy: -0.06 },
    tom:    { dx: 0.06, dy: -0.08 },
  },
  bottomAlignOffset: 31 / 540, // ≈ 0.057
};

// 4-instrument layout
export const LAYOUT_4_DRUMS: DrumLayout = {
  image: require('../assets/images/last_44.png'),
  colorImage: require('../assets/images/last_44.png'),
  order: ['snare', 'hihat', 'cymbal', 'kick'],
  details: {
    hihat:  { x: 0.15, y: 0.2 },
    snare:  { x: 0.27, y: 0.35 },
    kick:   { x: 0.46, y: 0.44 },
    cymbal: { x: 0.85, y: 0.2 },
  },
  neutralOffsets: {
    hihat:  { dx: -0.08, dy: -0.06 },
    snare:  { dx: -0.08, dy: 0.06 },
    kick:   { dx: 0, dy: 0.08 },
    cymbal: { dx: 0.06, dy: -0.06 },
  },
  bottomAlignOffset: 35 / 540, // ≈ 0.065
};

// 3-instrument layout
export const LAYOUT_3_DRUMS: DrumLayout = {
  image: require('../assets/images/last_33.png'),
  colorImage: require('../assets/images/last_33.png'),
  order: ['snare', 'hihat', 'kick'],
  details: {
    hihat: { x: 0.19, y: 0.15 },
    snare: { x: 0.33, y: 0.35},
    kick:  { x: 0.55, y: 0.45 },
  },
  neutralOffsets: {
    hihat: { dx: -0.08, dy: -0.06 },
    snare: { dx: -0.08, dy: 0.06 },
    kick:  { dx: 0.06, dy: 0.08 },
  },
  bottomAlignOffset: 0, // 기준. 그림이 캔버스 바닥까지 꽉 차 있다
};

// 2-instrument layout
export const LAYOUT_2_DRUMS: DrumLayout = {
  image: require('../assets/images/last_22.png'),
  colorImage: require('../assets/images/last_22.png'),
  order: ['snare', 'kick'],
  details: {
    snare: { x: 0.37, y: 0.25 },
    kick:  { x: 0.57, y: 0.35 },
  },
  neutralOffsets: {
    snare: { dx: -0.1, dy: -0.08 },
    kick:  { dx: 0.1, dy: 0.08 },
  },
  bottomAlignOffset: 80 / 540, // ≈ 0.148 — 네 장 중 아래 여백이 가장 크다
};

export const drumLayouts = {
  '5': LAYOUT_5_DRUMS,
  '4': LAYOUT_4_DRUMS,
  '3': LAYOUT_3_DRUMS,
  '2': LAYOUT_2_DRUMS,
};
