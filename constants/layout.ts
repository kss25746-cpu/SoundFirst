import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** 세로 전용 앱 기준, 600px 이상을 태블릿으로 구분 */
const isTablet = SCREEN_WIDTH >= 600;

/**
 * Learn 탭 난이도 버튼(연습·도전) 치수.
 *
 * 140/160 **고정**이던 값이다. 버튼 두 개가 쓸 수 있는 폭은
 * 「화면폭 − 섹션 좌우 마진 − gameSection 좌우 패딩 − 버튼 사이 gap」인데,
 * 360dp 기기에서 이 값이 255라 「140×2 + 15」가 40px 넘쳐 안쪽 여백을 잠식했다.
 * 그래서 **폭에서 역산한 상한**을 함께 건다.
 *
 * 폰 상한은 140 그대로다 — 390dp 이상에서는 지금 화면이 바뀌지 않는다.
 * 좁은 기기에서만 줄고, 태블릿에서만 커진다.
 */
const LEARN_SECTION_MARGIN_H = 20;
const LEARN_GAME_SECTION_PADDING = isTablet ? 30 : 25;
const LEARN_DIFFICULTY_BUTTONS_GAP = 15;
const LEARN_DIFFICULTY_ROW_WIDTH =
  SCREEN_WIDTH - LEARN_SECTION_MARGIN_H * 2 - LEARN_GAME_SECTION_PADDING * 2 - LEARN_DIFFICULTY_BUTTONS_GAP;
const LEARN_DIFFICULTY_BUTTON_SIZE = Math.max(
  96,
  Math.min(isTablet ? 180 : 140, Math.floor(LEARN_DIFFICULTY_ROW_WIDTH / 2))
);

/**
 * 버튼 **안**의 치수는 버튼 크기를 따라간다 — 버튼만 줄면 별·이름이 넘친다.
 * 인자는 버튼이 140(기존 폰 값)일 때의 치수이고, 지금 버튼 크기로 환산해 돌려준다.
 */
const LEARN_BUTTON_REFERENCE_SIZE = 140;
const scaleFromPhoneButton = (valueAt140: number) =>
  Math.round(LEARN_DIFFICULTY_BUTTON_SIZE * (valueAt140 / LEARN_BUTTON_REFERENCE_SIZE));

/**
 * learn **액션줄**(왼쪽 토글 · 오른쪽 「그만하기」) 안쪽 치수.
 *
 * 인자는 (하한, **지금 쓰던 값 = 상한**, 화면폭 비율)이다. 상한을 쓰던 값에 맞췄으므로
 * 확인 기기(411dp)에서는 전부 종전 그대로이고 **좁은 기기에서만 줄어든다**
 * (세션 34~35의 「폰 값은 그대로」 원칙 · 규칙 3).
 *
 * 한 줄에 알약 둘이 들어가므로 폭이 좁아지면 안쪽 여백·글자도 함께 줄어야
 * 줄이 두 줄로 접히지 않는다 — 그래서 높이가 아니라 **폭**에서 역산한다.
 */
const scaleActionByWidth = (min: number, max: number, widthRatio: number) =>
  Math.round(Math.max(min, Math.min(max, SCREEN_WIDTH * widthRatio)));

const REFRI_TRAY_PADDING_BOTTOM = 88;
const REFRI_FLOATING_REPLAY_SIZE = isTablet ? 64 : 52;

/**
 * 학습 카드(flashcards) 세로 배치.
 *
 * 카드 높이는 `cardStackHeight`(= min(400, 화면높이 × 0.4))로 반응형인데,
 * 카드를 **밀어내는** 값만 `cardStackMarginTop: 150` + `topCard.marginTop: 70` = **220 고정**이었다.
 * 640dp 높이 폰에서 화면의 34%를 무조건 먹어 카드 하단이 하단 네비 밑으로 들어갔다.
 * (868dp 기기에서는 여유가 있어 드러나지 않는다 — learn 난이도 버튼과 같은 구조의 문제다)
 *
 * 높이 비례로 두되 **상한을 지금 값(220)에 맞춘다** — 868dp에서는 150/70 그대로다.
 * 둘의 비(150 : 70)도 유지한다. 역할이 다르기 때문이다:
 * `cardStackMarginTop`은 흐름 안에서 자리를 차지하고(스크롤 길이에 반영),
 * `topCardMarginTop`은 절대배치된 카드만 그만큼 더 내린다(자리를 차지하지 않는다).
 */
const FLASHCARD_CARD_TOP_TOTAL = Math.round(
  Math.max(120, Math.min(220, SCREEN_HEIGHT * 0.2535))
);
const FLASHCARD_CARD_STACK_MARGIN_TOP = Math.round(FLASHCARD_CARD_TOP_TOTAL * (150 / 220));
const FLASHCARD_TOP_CARD_MARGIN_TOP = FLASHCARD_CARD_TOP_TOTAL - FLASHCARD_CARD_STACK_MARGIN_TOP;

/**
 * 학습 카드 **안**(WordFlashcard)의 치수.
 *
 * 카드 자체는 반응형인데(`cardStackHeight` · 폭 80%) **안쪽 치수는 전부 고정**이었다.
 * 그래서 세로로 312px, 가로로 290px이 늘 필요했고 —
 * - 320×640 폰: 카드가 256×256이라 **세로 56px · 가로 70px 넘쳐** 「전체 듣기」가 잘렸다
 * - 태블릿(800×1280): 카드가 640×512로 커져도 내용은 그대로라 **남는 200px이 전부
 *   버튼 위에 쌓였다** — 단어 카드는 위에, 버튼은 바닥에 떨어져 균형이 깨진다
 *
 * 그래서 **화면이 아니라 카드에서** 역산한다. 기준은 지금 확인된 실기기(411×868)의
 * 카드 크기 `329×347`이고, 그 크기에서는 **모든 값이 종전과 같다.**
 * 작은 폰에서만 줄고 태블릿에서만 커진다 (세션 34~35의 「폰 값은 그대로」 원칙).
 */
const FLASHCARD_CARD_WIDTH = SCREEN_WIDTH * 0.8; // topCard가 left/right 10%
const FLASHCARD_CARD_HEIGHT = Math.min(isTablet ? 560 : 400, SCREEN_HEIGHT * 0.4);
const FLASHCARD_REF_CARD_WIDTH = 329;
const FLASHCARD_REF_CARD_HEIGHT = 347;

const scaleInCardH = (valueAtRef: number, min: number, max: number) =>
  Math.round(
    Math.max(min, Math.min(max, FLASHCARD_CARD_HEIGHT * (valueAtRef / FLASHCARD_REF_CARD_HEIGHT)))
  );
const scaleInCardW = (valueAtRef: number, min: number, max: number) =>
  Math.round(
    Math.max(min, Math.min(max, FLASHCARD_CARD_WIDTH * (valueAtRef / FLASHCARD_REF_CARD_WIDTH)))
  );

/**
 * 가로는 **두 단어 카드가 VS를 사이에 두고 한 줄에 들어가야** 한다.
 * 카드 폭에서 테두리(2×2)와 좌우 패딩, VS 칸을 뺀 나머지를 반으로 나눈 값이
 * 단어 카드 하나의 폭이다. 폰 상한 120은 **기존 값**이라 411dp에서는 그대로다.
 */
const FLASHCARD_CONTAINER_PADDING_H = scaleInCardW(16, 10, 20);
const FLASHCARD_VS_PADDING_H = scaleInCardW(15, 8, 18);
const FLASHCARD_VS_WIDTH = FLASHCARD_VS_PADDING_H * 2 + 20; // 'VS' 글자폭(16px 2자) 어림
const FLASHCARD_CARD_INNER_WIDTH =
  FLASHCARD_CARD_WIDTH - 4 - FLASHCARD_CONTAINER_PADDING_H * 2;
const FLASHCARD_WORD_CARD_WIDTH = Math.max(
  84,
  Math.min(isTablet ? 180 : 120, Math.floor((FLASHCARD_CARD_INNER_WIDTH - FLASHCARD_VS_WIDTH) / 2))
);
/** 단어 카드 안쪽 패딩도 카드 폭을 따라간다 — 카드만 줄면 글자가 넘친다 */
const FLASHCARD_WORD_CARD_PADDING = Math.max(
  10,
  Math.min(isTablet ? 26 : 20, Math.round(FLASHCARD_WORD_CARD_WIDTH * (20 / 120)))
);

/**
 * 진행바 레일의 기하.
 *
 * 레일(`progressLine`)은 래퍼 폭의 90%가 **가운데 정렬**이라 래퍼 기준 5%에서 시작해
 * 95%에서 끝난다. 마커·눈금·채움이 **한 식**(`시작 + 비율 × 폭`)을 쓰게 여기서 숫자로 둔다.
 * 전에는 마커만 `left: 비율 × 90%` + `marginLeft: -1`이라 레일보다 4px 왼쪽에 놓였고,
 * 눈금은 `space-between`이라 또 다른 기준이었다 — 셋이 서로 어긋나 있었다.
 */
const SECTION_MARGIN_H = 15;
const PROGRESS_RAIL_RATIO = 0.9;
const PROGRESS_RAIL_SPAN_PERCENT = PROGRESS_RAIL_RATIO * 100;
const PROGRESS_RAIL_START_PERCENT = (100 - PROGRESS_RAIL_SPAN_PERCENT) / 2;
/** 레일 실제 폭(px). 눈금을 카드 수에 맞춰 줄일 때 쓴다 */
const PROGRESS_RAIL_WIDTH = (SCREEN_WIDTH - SECTION_MARGIN_H * 2) * PROGRESS_RAIL_RATIO;
const PROGRESS_MARKER_SIZE = isTablet ? 44 : 32;
const PROGRESS_TICK_BASE_SIZE = isTablet ? 12 : 10;

/** UI 레이아웃 상수 (반응형·동적 상수) */
export const LAYOUT = {
  /** 화면 크기 */
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,

  /** 태블릿 여부 (세로 기준 600px 이상) */
  isTablet,

  /** 카드 스택 */
  cardStackHeight: Math.min(isTablet ? 560 : 400, SCREEN_HEIGHT * 0.4),
  cardStackMinHeight: Math.min(isTablet ? 560 : 400, SCREEN_HEIGHT * 0.4),

  /** 카드 양쪽 여백. left/right 각 10% → 카드 폭은 화면의 80%다 */
  cardWidthInsetPercent: '10%' as const,

  /** 진행도 바 — 기하의 근거는 위 `PROGRESS_RAIL_*` 주석 참고 */
  progressLineWidthPercent: `${PROGRESS_RAIL_SPAN_PERCENT}%` as `${number}%`,
  /** 마커·눈금·채움이 함께 쓰는 한 식: `시작 + 비율 × 폭` (래퍼 기준 %) */
  progressRailStartPercent: PROGRESS_RAIL_START_PERCENT,
  progressRailSpanPercent: PROGRESS_RAIL_SPAN_PERCENT,
  progressMarkerSize: PROGRESS_MARKER_SIZE,
  progressMarkerIconSize: isTablet ? 48 : 36,
  /** 마커는 **가운데**가 레일 위 지점을 가리켜야 한다. 전에는 -1이라 4px 왼쪽이었다 */
  progressMarkerMarginLeft: -PROGRESS_MARKER_SIZE / 2,
  progressMarkerMarginTop: isTablet ? -36 : -30,
  progressTickSize: PROGRESS_TICK_BASE_SIZE,
  progressLineWrapperHeight: isTablet ? 24 : 20,
  progressLineHeight: isTablet ? 4 : 3,
  progressLineBorderRadius: 2,

  /** 간격 (Spacing) */
  spacingXS: isTablet ? 6 : 4,
  spacingSM: isTablet ? 10 : 8,
  spacingMD: isTablet ? 20 : 16,
  spacingLG: isTablet ? 30 : 24,


  /** 섹션·컨테이너 */
  sectionMarginH: SECTION_MARGIN_H,
  sectionMarginV: 10,
  cardStackMarginTop: FLASHCARD_CARD_STACK_MARGIN_TOP,
  /** 카드(절대배치)를 스택 안에서 더 내리는 양. 위 상수 주석 참고 */
  flashcardsTopCardMarginTop: FLASHCARD_TOP_CARD_MARGIN_TOP,
  /**
   * 진행도 바의 세로 위치(섹션 기준). 화면 높이 비례이던 값에 **상한만** 걸었다 —
   * 태블릿(1280dp)에서 256까지 내려가 카드와 붙었다. 868dp 폰에서는 174로 종전과 같다.
   */
  flashcardsProgressTop: Math.round(Math.min(isTablet ? 190 : 176, SCREEN_HEIGHT * 0.2)),
  scrollPaddingBottom: 30,

  /** WordFlashcard — 값의 근거는 위 `FLASHCARD_CARD_*` 주석 참고. 411×868에서는 전부 종전값이다 */
  /** 파형 폭은 화면이 아니라 **카드 안쪽 폭**을 넘지 않아야 한다 (320dp에서 12px 삐져나왔다) */
  waveformWidth: Math.min(isTablet ? 400 : 280, Math.floor(FLASHCARD_CARD_INNER_WIDTH)),
  /**
   * 파형의 세로. **담는 상자(`waveformContainer`)의 높이이자 Canvas의 높이**다 — 하나로 둔다.
   * 전에는 상자가 `scaleInCardH(39…)`, Canvas가 `scaleInCardH(60…)`이라 기준이 갈려
   * Canvas가 담는 상자보다 21px 커졌고 `paddingVertical`은 뜻을 잃었다.
   * 값은 **자리를 차지하던 쪽(39)**을 남겨 레이아웃이 종전 그대로다.
   */
  waveformHeight: scaleInCardH(39, 26, 52),
  wordCardMinWidth: FLASHCARD_WORD_CARD_WIDTH,
  containerPaddingV: scaleInCardH(20, 10, 24),
  containerPaddingH: FLASHCARD_CONTAINER_PADDING_H,
  wordCardPadding: FLASHCARD_WORD_CARD_PADDING,
  wordTextFontSize: scaleInCardH(32, 22, isTablet ? 40 : 32),
  wordTextMarginBottom: scaleInCardH(15, 8, 18),
  wordCardBorderRadius: 15,
  wordCardElevation: 2,
  /** 단어 카드 안 스피커 아이콘. 글자와 같이 줄어야 카드가 넘치지 않는다 */
  wordPlayIconSize: scaleInCardH(40, 28, isTablet ? 48 : 40),
  playAllButtonPaddingH: scaleInCardH(24, 16, 28),
  playAllButtonPaddingV: scaleInCardH(14, 10, 16),
  /**
   * 「전체 듣기」와 파형 사이의 **최소** 간격.
   * 남는 공간은 단어 카드 쪽과 나눠 갖되(`wordsBlock`이 가운데 정렬),
   * 공간이 빠듯한 기기에서도 버튼이 파형에 붙지 않게 이만큼은 늘 띄운다.
   */
  playAllButtonMarginTop: scaleInCardH(12, 8, 20),
  playAllButtonMarginBottom: scaleInCardH(16, 6, 20),
  playAllButtonFontSize: scaleInCardH(16, 13, 18),
  playAllButtonBorderRadius: 28,
  playAllButtonElevation: 4,
  /** 「전체 듣기」 앞 스피커 아이콘. 글자(`playAllButtonFontSize`)보다 한 단계 크다 */
  playAllButtonIconSize: scaleInCardH(20, 16, 22),
  wordsRowMarginBottom: scaleInCardH(10, 6, 14),
  wordColumnContainerGap: scaleInCardH(10, 6, 12),
  playButtonPadding: scaleInCardH(10, 4, 12),
  vsPaddingH: FLASHCARD_VS_PADDING_H,
  vsPaddingV: scaleInCardH(8, 5, 10),
  vsFontSize: 16,
  vsBorderRadius: 20,
  waveformContainerElevation: 2,

  /** 진행도 텍스트 */
  progressTextFontSize: isTablet ? 22 : 18,
  progressTextMarginTop: isTablet ? 8 : 6,

  /** 공통 텍스트 (index 등) */
  sectionTitleFontSize: isTablet ? 30 : 24,
  sectionSubtitleFontSize: isTablet ? 20 : 16,
  completedBadgeTextFontSize: isTablet ? 22 : 16,
  /**
   * 제목·배지·완료화면의 아이콘 치수. 이모지를 벡터 아이콘으로 바꾸며 생겼다.
   * 옆 글자 크기의 0.85~0.9로 둔다 — 같은 px면 획이 굵어 글자보다 커 보인다.
   */
  headerTitleIconSize: isTablet ? 26 : 21,
  completedBadgeIconSize: isTablet ? 20 : 15,
  totalCountFontSize: isTablet ? 17 : 14,
  hintTextFontSize: isTablet ? 17 : 14,
  completedTitleFontSize: isTablet ? 22 : 18,
  completionTextFontSize: isTablet ? 30 : 24,
  /** 완료화면 제목과 그 아래 설명 사이 */
  completionTextMarginBottom: 10,
  /** 완료화면 맨 위 트로피. 글자 위에 따로 서므로 제목보다 크다 */
  completionIconSize: isTablet ? 56 : 44,
  /**
   * 완료화면 안쪽 여백. 완료화면은 화면이 아니라 **카드박스 안**에 들어가므로
   * 카드 폭을 따라간다 — `40` 고정이면 320dp에서 안쪽 폭 256 중 **80을 먹는다.**
   * 411dp(실기기)에서는 계산값이 그대로 40이라 종전과 같다.
   */
  completionContainerPadding: scaleInCardW(40, 20, 48),
  completionSubTextFontSize: isTablet ? 20 : 16,
  buttonTextFontSize: isTablet ? 18 : 16,
  smallButtonTextFontSize: isTablet ? 15 : 12,


  /** 모달 닫기, 헤더 작은 아이콘(snow/arrow-undo), 네비 화살표 */
  modalCloseIconSize: isTablet ? 24 : 22,
  headerSmallIconSize: isTablet ? 20 : 18,
  navArrowIconSize: isTablet ? 32 : 28,
  /** refri-test 아이콘 */
  refriReplayIconSize: isTablet ? 24 : 20,
  refriVolumeIconSize: isTablet ? 30 : 26,

  /** 카드·버튼 공통 (index 등) */
  cardBorderRadius: Math.min(isTablet ? 32 : 24, Math.round(SCREEN_WIDTH * 0.04)),
  topCardBackgroundBorderRadius: 25,
  /** 헤더 좌/우 버튼 대칭 (냉장고, 완료 배지) */
  headerSideButtonMinWidth: Math.min(isTablet ? 120 : 88, Math.round(SCREEN_WIDTH * 0.22)),
  headerSideButtonPaddingH: 12,
  headerSideButtonPaddingV: 8,
  headerSideButtonBorderRadius: 8,
  navArrowButtonSize: isTablet ? 60 : 48,
  navArrowButtonBorderRadius: isTablet ? 30 : 24,
  navArrowButtonElevation: 3,
  completeButtonBorderRadius: 28,
  /** 버튼이 `flex: 1`이라 폭은 남는 자리가 정한다. 이 값은 **글자가 붙지 않을 최소 안쪽 여백**이다 */
  completeButtonPaddingH: 20,
  completeButtonPaddingV: 14,
  completeButtonElevation: 4,

  /** Drum 탭 — 고정 헤더 텍스트 */
  drumHeaderTextFontSize: isTablet ? 18 : 16,

  /** Drum 탭 — 문제 수 세그먼티드 컨트롤 (비율 90%, 폰 최대 420 / 태블릿 최대 520) */
  questionSelectorWidth: Math.min(Math.round(SCREEN_WIDTH * 0.9), isTablet ? 520 : 420),
  /** 세그먼트 한 칸 높이. 트랙 높이는 여기에 상하 패딩이 더해진 값 */
  questionSelectorItemHeight: isTablet ? 44 : 36,
  questionSelectorFontSize: isTablet ? 16 : 14,

  /** 모달 */
  modalHeaderPaddingV: 16,
  modalHeaderPaddingH: isTablet ? 24 : 20,
  modalContentBorderRadius: 24,
  modalTitleFontSize: isTablet ? 22 : 18,
  modalCloseBtnSize: isTablet ? 40 : 36,
  modalBodyPaddingH: isTablet ? 20 : 16,
  modalBodyPaddingV: 16,
  modalBodyPaddingBottom: 24,
  /** 익힘모달 시트 손잡이 — 아래서 올라오는 판이라는 표시 */
  modalHandleWidth: isTablet ? 56 : 44,
  modalHandleHeight: 5,
  completedCardItemPadding: 14,
  completedCardItemBorderRadius: 16,
  completedCardItemElevation: 2,
  /**
   * 완료 항목의 폭. 전에는 minWidth: '45%'라 단어 길이에 따라 항목이 늘어나
   * **줄마다 폭이 달랐다.** 폭을 고정하고 컨테이너의 space-between이 사이를 벌린다.
   * 48×2 = 96%라 남는 4%가 두 열 사이 간격이 된다 (411dp에서 15px).
   */
  completedCardItemWidthPercent: '48%' as const,
  completedCardTextFontSize: isTablet ? 22 : 18,
  /** 완료 항목의 「되돌리기」 표시 */
  completedCardChipIconSize: isTablet ? 16 : 14,
  completedCardChipFontSize: isTablet ? 13 : 11,
  /** 「전체 다시 하기」(익힘모달)와 「처음부터」(완료화면)가 함께 쓴다 */
  restartButtonIconSize: isTablet ? 20 : 18,
  modalResetButtonBorderWidth: 1.5,
  completionRestartButtonBorderRadius: 25,
  completionRestartButtonMarginTop: 24,
  completionRestartButtonMarginBottom: 36,
  completionRestartButtonPaddingH: isTablet ? 32 : 28,
  completedSectionPadding: isTablet ? 24 : 20,
  completedSectionBorderRadius: isTablet ? 18 : 15,
  completedSectionMarginTop: isTablet ? 24 : 20,
  headerTopRowMarginBottom: isTablet ? 20 : 15,
  bottomNavPaddingV: isTablet ? 24 : 20,
  bottomNavPaddingH: isTablet ? 24 : 20,
  bottomNavGap: isTablet ? 48 : 40,

  /** Refri (refri-test) — 냉장고 퀴즈 */
  refriRiveWidth: isTablet ? 800 : 600,
  refriRiveHeight: isTablet ? 667 : 500,
  /**
   * 냉장고 칸의 **상한** (화면 높이의 40%).
   * 짧은 폰은 게이지·선반을 뺀 남은 칸이 이보다 작으면 그만큼만 쓴다.
   * 확인 기기(411×868)·태블릿은 남은 칸이 더 커서 이 값이 그대로 높이가 된다.
   */
  refriSceneHeightRatio: 0.4,
  refriCratesBottomRatio: 0.15,
  refriCratesPaddingLeftRatio: 0.075,
  refriCratesPaddingBottomRatio: 0.012,
  refriCrateWrapperMarginBottomRatio: -0.053,
  refriCrateWrapperTopRatio: -0.077,
  refriCrateBoxSizeRatio: 0.2,
  refriTrayMinHeightRatio: 0.24,
  refriTrayPaddingTop: 20,
  refriTrayPaddingBottom: REFRI_TRAY_PADDING_BOTTOM,
  refriTrayPaddingH: 16,
  refriTrayGap: 12,
  refriTrayBorderRadius: 30,
  refriFloatingReplaySize: REFRI_FLOATING_REPLAY_SIZE,
  /**
   * 다시 듣기의 세로 자리. **선반(`answersContainer`) 기준**이고, 선반이 아래로 비운
   * 칸(`refriTrayPaddingBottom`) 안의 가운데다 — 그 칸은 이 버튼을 두려고 비운 자리다.
   *
   * `insets.bottom`을 더하지 않는다. 탭바가 이미 `64 + insets.bottom`을 먹고
   * 절대배치가 아니라 화면 영역이 그 위에서 끝난다 (`BottomTabBar.js:248` · 세션 47·53).
   *
   * **화면 바닥이 아니라 선반을 기준으로 삼는 이유**: 냉장고는 `flex: 1`이어도
   * `maxHeight`가 화면 40%라, 그보다 큰 여유는 선반 **아래**에 남는다. 화면 기준이면
   * 그만큼 칸을 벗어난다 — 411×868은 +7~31이라 티가 덜 나지만 태블릿은 계산상 +212다.
   */
  refriFloatingReplayBottom: Math.round(
    (REFRI_TRAY_PADDING_BOTTOM - REFRI_FLOATING_REPLAY_SIZE) / 2,
  ),
  refriFloatingReplayElevation: 4,
  refriControlSectionPaddingH: 24,
  refriControlBtnMinWidth: 160,
  refriStartBtnWidth: isTablet ? 240 : 200,
  refriStartBtnHeight: isTablet ? 72 : 60,
  refriControlRowGap: 10,
  refriControlRowMaxWidth: Math.min(isTablet ? 480 : 320, SCREEN_WIDTH - 32),
  refriControlBtnPaddingV: 14,
  refriControlBtnBorderRadius: 28,
  refriControlBtnGap: 6,
  refriGaugeSectionPaddingV: 8,
  refriGaugeSectionPaddingH: 16,
  /** 게이지 하단 ~ 냉장고 영역 상단 사이 거리 (수치 조정은 여기서) */
  refriGaugeToFridgeGap: 20,

  refriStatusBadgeBorderRadius: 20,
  refriStatusBadgeTop: isTablet ? 60 : 53,
  refriContainerMarginTop: isTablet ? -24 : -20,
  refriGaugeTrackHeight: 14,
  refriGaugeTrackBorderRadius: 12,
  refriGaugeContainerWidthPercent: '90%' as const,
  /** 게이지 섹션 고정 높이 — 게이지만 단독 이동, Rive 위치 유지 */
  refriGaugeSectionHeight: isTablet ? 80 : 60,
  refriGaugeMilestoneSize: isTablet ? 3 : 2,
  refriAnswerCardBorderRadius: Math.min(isTablet ? 14 : 10, Math.round(SCREEN_WIDTH * 0.025)),
  refriAnswerCardPadding: 6,
  refriAnswerCardElevation: 3,
  refriAnswerInnerMinHeight: Math.min(isTablet ? 120 : 90, SCREEN_HEIGHT * 0.12),
  refriAnswerImageSize: Math.min(isTablet ? 64 : 48, Math.round(SCREEN_WIDTH * 0.12)),
  refriAnswerLabelMarginTop: 6,
  refriAnswerLabelFontSize: Math.min(isTablet ? 18 : 15, Math.round(SCREEN_WIDTH * 0.038)),
  refriAnswerCardWidth: Math.floor(SCREEN_WIDTH / 3) - 24,
  refriCompleteBoxBorderRadius: 24,
  refriCompleteBoxPadding: 32,
  refriCompleteBoxMinWidth: Math.min(isTablet ? 400 : 280, SCREEN_WIDTH - 40),
  refriCompleteBoxElevation: 10,
  refriCompleteEmojiFontSize: Math.min(isTablet ? 120 : 64, Math.round(SCREEN_WIDTH * 0.2)),
  refriCompleteTitleFontSize: Math.min(isTablet ? 36 : 28, Math.round(SCREEN_WIDTH * 0.07)),
  refriCompleteSubtitleFontSize: 16,
  refriCompleteStatsFontSize: 18,
  refriCompleteButtonPaddingH: 24,
  refriCompleteButtonGap: 8,
  refriBottomInsetOffset: 20,
  refriZIndexAnswers: 150,
  refriZIndexFloatingReplay: 160,
  refriZIndexControlSection: 200,
  refriZIndexCompleteOverlay: 1000,

  /** Learn 탭 — 소리 구별 퀴즈 */
  tabBarHeight: 64,
  /** Flashcards 하단 네비 미세 위치 보정값 (안드로이드 기준) */
  flashcardsBottomOffset: isTablet ? 26 : 40,
  learnSectionMarginH: LEARN_SECTION_MARGIN_H,
  learnSectionMarginTop: 10,
  learnSectionTitleFontSize: isTablet ? 28 : 24,
  /**
   * 진행 게이지. 트랙은 냉장고와 같은 두께다.
   * **섹션 고정 높이(냉장고 60/80)는 쓰지 않는다** — 320×569 여유가 ≈2px뿐이라
   * (0-2절 세션 61) 그 높이를 더하면 선택지가 잘린다. 자리는 제목 아래 마진과
   * `learnDifficultyContainerMarginBottom`에서 가져온다.
   */
  learnGaugeTrackHeight: 14,
  learnGaugeTrackBorderRadius: 12,
  learnGaugeContainerWidthPercent: '90%' as const,
  learnGaugeMilestoneSize: isTablet ? 3 : 2,
  learnDifficultyButtonSize: LEARN_DIFFICULTY_BUTTON_SIZE,
  learnDifficultyButtonBorderRadius: 20,
  learnDifficultyButtonPadding: scaleFromPhoneButton(20),
  learnDifficultyButtonsGap: LEARN_DIFFICULTY_BUTTONS_GAP,
  /** 30이던 값. 제목 아래 게이지(~26)가 그 자리 일부를 먹으므로 16으로 줄였다 */
  learnDifficultyContainerMarginBottom: 16,
  learnGameSectionPadding: LEARN_GAME_SECTION_PADDING,
  /** 게임 영역을 아래로 미는 값. 세로가 짧은 기기에서 선택지·다시 듣기가 밀려나지 않게
   *  높이 비례로 둔다. 상한 50은 기존 고정값이라 보통 폰에서는 그대로다 */
  learnGameContentMarginTop: Math.round(Math.max(24, Math.min(50, SCREEN_HEIGHT * 0.06))),
  learnStarIconSize: scaleFromPhoneButton(60),
  learnMultiStarIconWidth: scaleFromPhoneButton(32),
  learnMultiStarIconHeight: scaleFromPhoneButton(44),
  learnStarsRowContainerHeight: scaleFromPhoneButton(55),
  learnDifficultyNameFontSize: scaleFromPhoneButton(18),
  /** 「그만하기」 — 손가락이 닿는 최소 높이. 줄 높이도 같은 값이라
   *  버튼이 나타났다 사라져도 아래 게임이 밀리지 않는다 */
  learnQuitButtonMinHeight: isTablet ? 52 : 44,
  /** 액션줄 두 알약 사이의 최소 숨 (`space-between`이라 보통은 더 벌어진다) */
  learnActionRowGap: isTablet ? 16 : 12,
  /** 왼쪽 토글(시작·계속·다시 듣기) — 값은 `WordGame` 바닥에 있던 `startButton` 그대로가 상한이다 */
  learnActionButtonPaddingH: scaleActionByWidth(18, 30, 0.075),
  learnActionButtonGap: scaleActionByWidth(6, 10, 0.025),
  learnActionButtonIconSize: scaleActionByWidth(18, 24, 0.06),
  learnActionButtonFontSize: scaleActionByWidth(14, 18, 0.045),
  /** 오른쪽 「그만하기」 — 상한은 쓰던 `spacingMD`·`buttonTextFontSize`와 같은 값이다 */
  learnQuitButtonPaddingH: scaleActionByWidth(12, isTablet ? 20 : 16, 0.04),
  learnQuitButtonFontSize: scaleActionByWidth(14, isTablet ? 18 : 16, 0.042),


  /** 게임 넷 공용 「나가기」 — `(games)/_layout.tsx`에 하나만 얹는다.
   *  높이는 손가락이 닿는 최소치, 여백은 코너에서 띄우는 값이다 (규칙 3) */
  gameExitButtonMinHeight: isTablet ? 52 : 44,
  gameExitButtonRight: isTablet ? 24 : 16,
  gameExitButtonBottom: isTablet ? 24 : 16,
  gameExitButtonPaddingH: isTablet ? 18 : 14,
  gameExitButtonGap: isTablet ? 8 : 6,
  gameExitButtonIconSize: isTablet ? 22 : 18,
  gameExitButtonFontSize: isTablet ? 16 : 14,

  /** OrderGame — 소리 순서 맞추기 */
  orderGameCardSize: Math.min(isTablet ? 120 : 100, Math.round(SCREEN_WIDTH * 0.22)),
  orderGameImageSize: Math.round(Math.min(isTablet ? 120 : 100, Math.round(SCREEN_WIDTH * 0.22)) * 0.8),
  orderGameDropZoneMargin: isTablet ? 12 : 10,
  orderGameDropZoneHeight: 120,
  orderGameImagesContainerPadding: 10,
  orderGameImagesContainerMarginBottom: 20,
  orderGameStartButtonMinWidth: 200,
  orderGameStartButtonBorderRadius: 15,
  orderGameSubmitButtonMarginTop: 20,

  /** MatchGame(소리 맞추기) — 카드 게임 */
  matchGameStartButtonPaddingV: 18,
  matchGameStartButtonPaddingH: 48,
  matchGameStartButtonMinWidth: 220,
  matchGameStartButtonBorderRadius: 16,
  matchGameGameButtonBorderRadius: 16,
  matchGameModalContentPadding: 24,
  matchGameModalContentBorderRadius: 20,
  matchGameModalTitleMarginBottom: 10,
  matchGameModalTextMarginBottom: 20,
  matchGameModalButtonPaddingV: 12,
  matchGameModalButtonPaddingH: 24,
  matchGameModalButtonBorderRadius: 12,

  /** New 탭 — 게임 선택 화면 */
  newTabSectionHeaderPadding: isTablet ? 24 : 20,
  newTabSectionHeaderBorderRadius: 15,
  newTabSectionHeaderMarginBottom: 15,
  newTabSectionTitleMarginBottom: 8,
  newTabGameGridPadding: 15,
  newTabGameGridGap: 12,
  newTabGameCardBorderRadius: 15,
  newTabGameCardPadding: 15,
  newTabIconSize: isTablet ? 80 : 70,
  newTabIconBorderRadius: 35,
  newTabGameEmojiFontSize: isTablet ? 40 : 36,
  newTabScrollPaddingBottom: 30,
  newTabStarBadgeSize: 16,
  newTabStarBadgeTop: 8,
  newTabStarBadgeRight: 8,
  newTabClearedBadgeBottom: 8,
  newTabClearedBadgePaddingH: 10,
  newTabClearedBadgePaddingV: 4,
  newTabClearedBadgeBorderRadius: 10,

  /** MatchGameAI / MatchGamePG — 청능 훈련 (Q-Learning, Policy Gradient) */
  auditoryWaveAnimationSize: isTablet ? 240 : 200,
  auditoryLoadingTextMarginTop: 20,
  auditoryGameButtonMinWidth: isTablet ? 120 : 100,
  auditoryGameButtonMargin: 6,
  auditoryStatsCardBorderRadius: 12,
  auditoryStatsCardPadding: 16,
  auditoryStatsCardMarginBottom: 12,
  auditoryOverallStatsValueFontSize: isTablet ? 52 : 48,
  auditoryProgressBarHeight: 8,
  auditoryProgressBarBorderRadius: 4,
  auditoryPrimaryButtonWidthPercent: '80%' as const,
  auditoryStatsBackButtonWidthPercent: '40%' as const,
} as const;

export type WordGameMetrics = {
  contentTopPadding: number;
  contentBottomPadding: number;
  choiceVerticalPadding: number;
  choiceTextSize: number;
};

/**
 * WordGame(소리 구별 퀴즈) 반응형 메트릭.
 * width/height를 직접 받아 기기별 차이를 반영합니다.
 */
export function getWordGameMetrics(width: number, height: number): WordGameMetrics {
  const isTabletWidth = width >= 600;

  const contentTopPadding = Math.round(
    Math.max(isTabletWidth ? 52 : 44, Math.min(isTabletWidth ? 84 : 72, height * 0.09))
  );
  // 게임 내용과 화면 끝 사이의 최소 숨.
  // 바닥 버튼(시작·다시 듣기)이 **액션줄로 올라가** 여기 남는 것은 선택지·안내문뿐이다
  const contentBottomPadding = Math.round(
    Math.max(0, Math.min(isTabletWidth ? 10 : 8, height * 0.008))
  );
  const choiceVerticalPadding = Math.round(
    Math.max(isTabletWidth ? 22 : 20, Math.min(isTabletWidth ? 34 : 30, height * 0.035))
  );
  const choiceTextSize = Math.round(
    Math.max(isTabletWidth ? 26 : 24, Math.min(isTabletWidth ? 34 : 30, width * 0.075))
  );
  /**
   * `replayOffsetY`·`startOffsetY`는 **없앴다.** 바닥에 붙던 「시작하기」·「다시 듣기」를
   * 난이도 아래 **액션줄**로 올렸으므로(`doc/learn-액션줄.md`) 바닥에서 띄울 것이 없다.
   * 두 값은 탭바를 피하려고 바닥을 조정하던 값이었고, 이제 버튼이 탭바 근처에 없다.
   */
  return {
    contentTopPadding,
    contentBottomPadding,
    choiceVerticalPadding,
    choiceTextSize,
  };
}

type MatchGameGridMetrics = {
  columns: number;
  gap: number;
  cardSize: number;
  mediaSize: number;
  contentHeight: number;
};
/**
 * MatchGame(소리 맞추기) 카드 그리드 메트릭.
 * 세로 뷰 전용(orientation 고정) 기준으로 screenWidth/isTablet만 사용합니다.
 */
export function getMatchGameGridMetrics(): MatchGameGridMetrics {
  const columns = 3;
  const gap = LAYOUT.isTablet ? 10 : 4;

  // matchGame.tsx container 스타일과 맞춤 (width: '96%', maxWidth: 460, paddingHorizontal: 10)
  const containerWidth = Math.min(Math.round(LAYOUT.screenWidth * 0.96), 460);
  const containerHPadding = 10;

  const usableWidth = containerWidth - containerHPadding * 2;
  // 작은 폰에서도 3열이 유지되도록 최소 크기를 낮춤
  const cardSize = Math.max(72, Math.floor((usableWidth - gap * (columns - 1)) / columns));

  // 카드 내부(이미지/Rive)는 카드 크기에 비례하도록 고정
  const mediaSize = Math.round(cardSize * (LAYOUT.isTablet ? 0.62 : 0.58));
  // 텍스트 영역을 제외한 컨텐츠 높이(카드 흔들림 방지용 고정)
  const contentHeight = Math.round(cardSize * 0.82);

  return { columns, gap, cardSize, mediaSize, contentHeight };
}



/**
 * 진행바 눈금 하나의 크기.
 *
 * 눈금은 **카드 한 장**을 뜻하므로 개수가 카드 수를 따라간다. 그래서 카드가 많으면
 * 기본 크기(폰 10 · 태블릿 12)로는 서로 붙는다. 레일을 카드 수로 나눈 한 칸의 **절반**을
 * 넘지 않게 줄이되, 눈금이 보이지 않을 만큼 작아지지는 않게 하한을 둔다.
 *
 * 레일이 넓으면 줄일 일이 없다 — 실기기(411dp, 레일 343)에서는 카드 20장이어도 10 그대로고,
 * 320dp(레일 261)에서 15장을 넘길 때부터 줄어든다.
 */
export function getProgressTickSize(cardCount: number): number {
  if (cardCount <= 1) return PROGRESS_TICK_BASE_SIZE;
  const slot = PROGRESS_RAIL_WIDTH / (cardCount - 1);
  return Math.round(Math.max(4, Math.min(PROGRESS_TICK_BASE_SIZE, slot * 0.55)));
}
