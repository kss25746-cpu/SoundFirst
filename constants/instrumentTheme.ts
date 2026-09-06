/**
 * 악기 화면(피아노 · 기타)이 공유하는 디자인 토큰.
 *
 * 통일감은 **색이 아니라 구조·간격·타이포**에서 나온다. 그래서 여기 모으는 건
 * 두 화면이 실제로 같아야 하는 값들(제어반 치수, 라운드, 의미색)이고,
 * 악기색은 `INSTRUMENT_ACCENT`로 갈라둔다 — 두 악기가 구분은 돼야 하기 때문이다.
 *
 * 쓰는 곳: `components/instrument/*`, `screens/MusicTrainingScreen.tsx`,
 * `app/(tabs)/guitar/_layout.tsx`
 */

/** 하단 제어반. 값은 피아노 `trainingContainer`가 원본이다 */
export const CONTROL_BAR = {
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderTopWidth: 2,
  borderTopColor: 'rgba(255, 255, 255, 0.1)',
  /** 기본 높이 */
  standardHeight: 110,
  /** 폴링노트처럼 위쪽 공간이 급할 때. 기타는 가로모드라 이쪽을 기준으로 쓴다 */
  compactHeight: 76,
} as const;

export const RADII = {
  action: 8,
  difficulty: 14,
  toggle: 6,
} as const;

/**
 * 의미색 — **악기가 달라도 뜻이 같으면 같은 색이다.**
 * 이걸 악기별로 갈라두면 "빨강 = 중지"라는 학습이 화면마다 깨진다.
 */
export const SEMANTIC = {
  /** 중지 · 훈련 종료 */
  stop: '#FF3B30',
  /** 다시 듣기 */
  repeat: '#34C759',
  /** 피드백 문구 */
  feedback: '#4CAF50',
  /** 정답 힌트(디버그) */
  hint: '#FF453A',
  /** 점수 */
  score: '#ffffff',
} as const;

/** 악기별 액센트 — 구조는 같고 **이것만** 다르다 */
export const INSTRUMENT_ACCENT = {
  piano: {
    screen: '#000000',
    bar: 'rgba(34, 34, 34, 0.85)',
    accent: '#007BFF',
    idle: '#555555',
    /**
     * 미션 오버레이 · 미리듣기 카운트 · 옥타브 이동 강조.
     *
     * **피아노에만 있다.** 기타에는 대응하는 오버레이가 없어서 `SEMANTIC`으로
     * 올리지 않았다 — 한 화면에만 있는 색을 공통으로 올리면 뜻이 없는 토큰이 된다.
     */
    highlight: '#00e5ff',
    /** 건반. 기타 `fretboard`와 **합치지 말 것** — 악기가 구분돼야 한다 */
    keys: {
      white: 'white',
      whiteBorder: '#ccc',
      black: 'black',
      /** 흰건반 음이름 */
      label: '#555',
      /** 검은건반 음이름 — 어두운 바탕이라 밝게 */
      labelOnBlack: '#bbb',
      /** 키보드 매핑 보조 라벨. 흑·백 공통 */
      labelSub: '#888',
      whiteDisabled: '#666',
      whiteBorderDisabled: '#444',
      labelDisabled: '#555',
    },
  },
  guitar: {
    screen: '#1a120b',
    bar: 'rgba(60, 42, 33, 0.85)',
    accent: '#d4a373',
    idle: '#4f3422',
    /** 프렛보드. 피아노 `keys`와 **합치지 말 것** */
    fretboard: {
      face: '#2d2016',
      border: '#5f4339',
      faceDisabled: '#221a14',
      borderDisabled: '#332211',
      /** 6줄 현 */
      string: '#c5c5c5',
      label: '#fff',
      labelDisabled: '#444',
    },
  },
} as const;

export type InstrumentId = keyof typeof INSTRUMENT_ACCENT;
