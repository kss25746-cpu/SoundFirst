/**
 * 앱 공통 색상 상수
 * LAYOUT_APPLY_REPORT 권장사항 반영
 */
export const COLORS = {
  /** 기본 텍스트 */
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#555',
  textLight: '#999',
  textSlate: '#4b5563',
  textPlaceholder: '#aaa',
  textLoading: '#64748b',

  /** 배경 */
  background: '#ffffff',
  backgroundGray: '#f5f5f5',
  backgroundLight: '#f0f0f0',
  backgroundWarm: '#fffbeb',
  backgroundSuccess: '#ecfdf5',
  backgroundError: '#fef2f2',
  backgroundWarning: '#fef3c7',
  backgroundStar: '#FFF9E6',
  /** learn 탭 바탕 (배경 이미지 뒤에 깔리는 색) */
  backgroundSoft: '#F0F2F5',
  /**
   * 배경 **이미지 위**에 글자를 받치는 반투명 흰 판.
   * 사진 위에 글자가 맨몸으로 얹히면 이미지에 따라 대비가 흔들린다.
   * learn 제목 pill · flashcards 제목/진행도 pill이 함께 쓴다.
   */
  surfaceOnImage: 'rgba(255, 255, 255, 0.88)',
  /** 아주 옅은 회색 판 (모달 닫기 버튼 바탕) */
  backgroundSubtle: 'rgba(0, 0, 0, 0.06)',

  /** 액센트 / 버튼 */
  primary: '#f59e0b',
  primaryDark: '#d97706',
  blue: '#4A90E2',
  green: '#10b981',
  greenBright: '#50C878',
  success: '#7cbd7e',
  /**
   * 흰 배경 위 초록 **글자**용. 브랜드 초록(`success`)은 흰 배경에서 2.2:1이라
   * 큰 글씨 기준(3:1)에 못 미친다. 배경·테두리에는 `success`를 그대로 쓰고,
   * 글자로 쓸 때만 이 값을 쓴다 (세션 34).
   */
  successOnWhite: '#4E9A51',
  /**
   * 소리가 **나는 중**임을 알리는 파랑. learn 액션줄의 「재생 중...」이 쓴다.
   * `WordGame` 바닥 버튼에 리터럴로 있던 값 그대로다 — 색을 새로 고르지 않았다.
   */
  playingBlue: '#4da8de',
  purple: '#9C27B0',

  /** 상태 */
  successLight: '#C8E6C9',
  successText: '#065f46',
  error: '#F44336',
  errorLight: '#FFCDD2',
  errorBorder: '#fca5a5',

  /** 테두리 */
  border: '#e2e8f0',
  borderGray: '#BDBDBD',

  /** 강조 */
  gold: '#FFD700',
  white: '#ffffff',

  /** 오버레이 */
  overlay: 'rgba(0, 0, 0, 0.4)',
  /** 모달 뒤 스크림 */
  overlayModal: 'rgba(0, 0, 0, 0.5)',
  /** 학습 카드 위에 덮는 따뜻한 반투명 판 (사진이 비쳐 글자가 읽히도록) */
  cardWarmOverlay: 'rgba(255, 250, 240, 0.55)',

  /** 기타 */
  activityIndicator: '#007bff',
  orange: '#FF8c42',
  successGreen: '#28A745',
  shadow: '#000',
  grayLight: '#E0E0E0',
  blueLight: '#E3F2FD',

  /** 등급 (matchGameAI, matchGamePG) */
  gradeUntried: '#999',
  gradePerfect: '#FF6B6B',
  gradeExcellent: '#4ECDC4',
  gradeNormal: '#95E1D3',
  gradePractice: '#FFE66D',
} as const;

/** 파형 Skia LinearGradient — 좌→우: 주황 → 연한 주황 → 초록 */
export const WAVEFORM_GRADIENT = {
  start: '#FF9800',
  middle: '#FFB74D',
  end: '#81C784',
  positions: [0, 0.5, 1] ,
} as const;
