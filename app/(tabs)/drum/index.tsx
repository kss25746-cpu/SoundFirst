import { Text, View, StyleSheet, ScrollView, TouchableOpacity, FlatList, TouchableWithoutFeedback, Dimensions, Image, Modal, Animated as RNAnimated, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from 'expo-router';
import React, { useState, useRef, useCallback, useEffect } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrumGameOverScreen from '../../../screens/DrumGameOverScreen';
import InteractiveDrumSet, { type InteractiveDrumSetRef } from '../../../components/game/InteractiveDrumSet';
import { InstrumentType, DRUM_INSTRUMENTS } from '../../../constants/drumSounds';
import { LAYOUT } from '../../../constants/layout';
import { useAudioManager } from '../../../context/AudioManager';
import { useGameLogic } from '../../../hooks/useDrumLogic';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../constants/colors';
import Svg, { Circle, G, Path } from 'react-native-svg';

// 하단 고정 버튼(다시 듣기/순환) 반응형 치수 (기준 너비 390)
const REFERENCE_WIDTH = 390;
const fixedBtnScale = Dimensions.get('window').width / REFERENCE_WIDTH;
const FIXED_BUTTON_WIDTH = Math.round(88 * fixedBtnScale);
const FIXED_BUTTON_HEIGHT = Math.round(56 * fixedBtnScale);
const FIXED_BUTTON_GAP = Math.round(150 * fixedBtnScale);
const FIXED_BUTTON_RADIUS = Math.round(12 * fixedBtnScale);
const FIXED_ICON_FONT_SIZE = Math.max(22, Math.min(34, Math.round(26 * fixedBtnScale)));
const PAGE_INDICATOR_FONT_SIZE = Math.max(16, Math.min(22, Math.round(18 * fixedBtnScale)));
const FIXED_REPLAY_MARGIN_LEFT = -(FIXED_BUTTON_WIDTH + FIXED_BUTTON_GAP / 2);
const FIXED_CYCLE_MARGIN_LEFT = FIXED_BUTTON_GAP / 2;
const DRUM_BACKGROUND_IMAGE = require('../../../assets/images/drum_m.webp');
const DRUM_BACKGROUND_ASSET = Image.resolveAssetSource(DRUM_BACKGROUND_IMAGE);
const DRUM_BACKGROUND_ASPECT_RATIO = DRUM_BACKGROUND_ASSET.width / DRUM_BACKGROUND_ASSET.height;

/** 헤더 중앙 모드 배지 글자 크기. 우측 '듣기연습' 버튼은 이 값을 기준으로 0.8배 축소 */
const HEADER_BADGE_FONT_SIZE = LAYOUT.drumHeaderTextFontSize + 2;
const HEADER_ACTION_SCALE = 0.8;
const HEADER_ACTION_FONT_SIZE = Math.round(HEADER_BADGE_FONT_SIZE * HEADER_ACTION_SCALE);
/** 👆 이모지를 감싸는 흰 원형 칩 지름 */
const HEADER_ACTION_ICON_CHIP_SIZE = HEADER_ACTION_FONT_SIZE + 7;

// 설정 드롭다운: 문제 수 옵션 (세그먼티드 컨트롤의 칸 = 이 배열의 원소)
const QUESTION_COUNTS = [5, 10, 15, 20] as const;
/**
 * 악기명 레이블 칩의 최소 높이. 레이블을 제 높이만큼 아래로 내리는 데 쓰는데,
 * 실측(onLayout)이 오기 전 첫 프레임에도 자리가 맞아야 튀지 않는다.
 * 스타일의 minHeight와 같은 값을 봐야 하므로 상수 하나를 양쪽에서 쓴다.
 */
const INSTRUMENT_LABEL_MIN_HEIGHT = 50;

/** 세그먼티드 컨트롤 트랙 안쪽 여백. 인디케이터 pill이 트랙 테두리에서 이만큼 떠 있음 */
const SEGMENTED_TRACK_PADDING = 4;
const SEGMENTED_TRACK_HEIGHT = LAYOUT.questionSelectorItemHeight + SEGMENTED_TRACK_PADDING * 2;

/** 하단 왼쪽 버튼에 scale 펄스를 주기 위한 애니메이션 래핑 (절대 위치 스타일 유지) */
const AnimatedTouchable = RNAnimated.createAnimatedComponent(TouchableOpacity);

/** 설정 드롭다운 패널 높이 = 트랙 + 상하 패딩. 바깥 터치 감지용 백드롭 시작점 계산에도 사용 */
const SETTINGS_PANEL_HEIGHT = SEGMENTED_TRACK_HEIGHT + 20;

/** 드럼 스틱 아이콘 크기. 삼각형(◀▶) 글리프보다 가로로 길어 보이므로 글자 크기보다 키움 */
const DRUM_STICK_ICON_SIZE = Math.round(FIXED_ICON_FONT_SIZE * 1.5);

interface DrumStickIconProps {
  /** bead(스틱 끝 알)가 향하는 쪽 = 이동 방향 */
  readonly direction: 'left' | 'right';
  readonly color?: string;
  readonly opacity?: number;
}

/**
 * 하단 이동 버튼용 드럼 스틱 아이콘 (버트 - 몸통 - bead).
 * path는 가로로 눕힌 한 벌만 두고, 45° 기울임 + 좌우 반전을 회전각으로 처리한다.
 * (오른쪽 = 우상향 -45°, 왼쪽 = 좌상향 225° → 두 각이 세로축 기준 대칭)
 * 회전 중심(16,16)에서 가장 먼 점이 15 이내라 32 뷰박스 안에서 잘리지 않음.
 */
function DrumStickIcon({ direction, color = '#ffffff', opacity = 1 }: DrumStickIconProps) {
  return (
    <Svg width={DRUM_STICK_ICON_SIZE} height={DRUM_STICK_ICON_SIZE} viewBox="0 0 32 32">
      <G
        transform={`rotate(${direction === 'left' ? 225 : -45}, 16, 16)`}
        fill={color}
        opacity={opacity}
      >
        {/* 손에 쥐는 버트 쪽 둥근 끝 */}
        <Circle cx="3.6" cy="16" r="2.6" />
        {/* 몸통: 버트(굵음) → 넥(가늘어짐) */}
        <Path d="M3.6 13.4 L23.4 14.7 L23.4 17.3 L3.6 18.6 Z" />
        {/* 타격면 bead */}
        <Circle cx="25.8" cy="16" r="4" />
      </G>
    </Svg>
  );
}

export default function Index() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [backgroundViewport, setBackgroundViewport] = useState({ width: 0, height: 0 });

  const audioManager = useAudioManager();
  const headerFlashAnim = useRef(new RNAnimated.Value(0)).current;

  // 상태 관리
  const [questionCount, setQuestionCount] = useState<typeof QUESTION_COUNTS[number]>(5); // 문제 수 (5, 10, 15, 20)
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalMaxScore, setFinalMaxScore] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isSoundTestExpanded, setIsSoundTestExpanded] = useState(true); // 사운드 테스트 아코디언 상태 - 초기 열림
  const [isGameAudioPlaying, setIsGameAudioPlaying] = useState(false); // 게임 오디오 재생 상태
  const [isGameMode, setIsGameMode] = useState(false); // 레거시 (HorizontalDrumScroller에 isQuizActive 전달로 대체)

  const [isQuizActive, setIsQuizActive] = useState(false); // 통합 퀴즈 모드 활성화
  const [countdown, setCountdown] = useState<number | null>(null); // 퀴즈 시작 카운트다운 (3,2,1,0)
  /** 퀴즈 시작 시 고정된 페이지 인덱스. 게임 중 스크롤 시 이와 다르면 강제 종료 */
  const [quizStartScrollIndex, setQuizStartScrollIndex] = useState<number | null>(null);

  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false); // 톱니 탭 시 헤더 바로 아래 패널 열림
  /** 헤더 실측 높이(상단 인셋 포함). 설정 드롭다운을 헤더 바로 아래에 붙이는 기준 */
  const [headerHeight, setHeaderHeight] = useState(0);

  // 드럼 오버레이(캐릭터+순환 버튼)를 ScrollView 밖에서 고정 표시용
  const drumScrollXRef = useRef(new RNAnimated.Value(0));
  const [drumContainerWidth, setDrumContainerWidth] = useState(windowWidth);
  const [currentDrumScrollIndex, setCurrentDrumScrollIndex] = useState(0);
  const horizontalDrumScrollerRef = useRef<HorizontalDrumScrollerRef>(null);
  const isStartingQuizRef = useRef(false);
  /**
   * 악기명 레이블용. 페이지(2~5악기)마다 드럼 세트가 따로 있고 각자 선택 악기를 들고 있어서,
   * 하나로 합치면 페이지를 넘겨도 이전 페이지에서 고른 이름이 그대로 남는다.
   * 페이지별로 담고 현재 보이는 페이지 것만 그린다. null = 아직 아무 악기도 안 고름.
   */
  const [instrumentByPage, setInstrumentByPage] = useState<(InstrumentType | null)[]>(
    () => Array<InstrumentType | null>(ANIMATED_FLATLIST_PAGES).fill(null)
  );
  /** 현재 보이는 페이지 = 악기 수 (설정에서 제거, 화면이 곧 선택) */
  const instrumentCount = currentDrumScrollIndex + 2;
  /** 지금 보이는 페이지에서 고른 악기. 다른 페이지 선택은 이 화면에 뜨지 않는다 */
  const labelInstrument = instrumentByPage[currentDrumScrollIndex] ?? null;
  /**
   * 레이블과 헤더 사이 간격. 고정 px로 두면 작은 폰에서 답답하고 태블릿에서 붕 뜬다.
   * 화면 높이에 비례시키되 양 끝을 묶어 극단으로 가지 않게 한다.
   */
  const instrumentLabelGap = Math.min(24, Math.max(8, Math.round(windowHeight * 0.02)));
  /**
   * 레이블 칩의 실측 높이. 레이블을 제 높이만큼 더 내리라는 요구라, 내리는 양이 곧 이 값이다.
   * 고정 50으로 두지 않는 이유는 기기 글꼴 배율이 크면 칩이 minHeight보다 커지기 때문이다.
   * 초기값을 minHeight와 맞춰 두어 실측 전 첫 프레임에서도 자리가 튀지 않는다.
   */
  const [instrumentLabelHeight, setInstrumentLabelHeight] = useState(INSTRUMENT_LABEL_MIN_HEIGHT);
  const viewportAspectRatio = backgroundViewport.width > 0 && backgroundViewport.height > 0
    ? backgroundViewport.width / backgroundViewport.height
    : 0;
  const renderedBackgroundHeight = viewportAspectRatio > 0
    ? (viewportAspectRatio > DRUM_BACKGROUND_ASPECT_RATIO
      ? backgroundViewport.height
      : backgroundViewport.width / DRUM_BACKGROUND_ASPECT_RATIO)
    : 0;
  const backgroundBottomGap = Math.max(0, (backgroundViewport.height - renderedBackgroundHeight) / 2);
  const fixedButtonBottomOffset = Math.max(-70, Math.round((backgroundBottomGap - FIXED_BUTTON_HEIGHT) / 2) - 45);

  // 설정 변경 콜백 (세그먼트 터치 시 호출, Haptic 포함)
  const handleQuestionCountChange = useCallback((value: typeof QUESTION_COUNTS[number]) => {
    Haptics.selectionAsync?.();
    setQuestionCount(value);
  }, []);

  // audioManager를 ref에 넣어 useFocusEffect 의존성 제거 → 클린업은 탭 포커스 잃을 때만 1회 실행
  const audioManagerRef = useRef(audioManager);
  audioManagerRef.current = audioManager;

  useFocusEffect(
    React.useCallback(() => {
      // 탭에 들어올 때 (포커스 얻음)
      audioManagerRef.current?.setCurrentTab('drum');
      // 첫 타격 지연 제거: 드럼 샘플 5개(≈540KB)를 미리 로드해 둔다
      audioManagerRef.current?.preloadSounds(
        Object.entries(DRUM_INSTRUMENTS).map(([key, instrument]) => ({
          key,
          source: instrument.sound,
        }))
      );

      return () => {
        // 탭을 떠날 때 (포커스 잃음) - 게임 상태 정리
        // 소리를 끊는 이상 퀴즈는 이어질 수 없다. 예약된 다음 라운드·카운트다운까지 함께 끊지
        // 않으면 떠난 탭에서 라운드가 혼자 넘어가고, 돌아왔을 때 답을 못 내는 상태로 굳는다.
        exitQuizRef.current();
        setIsGameStarted(false);
        setIsGameOver(false);
        setFinalScore(0);
        setFinalMaxScore(0);
        setIsGameAudioPlaying(false);
        // 울리던 드럼 소리를 끊는다. 플레이어 5개는 그대로 남아 재진입 시 즉시 반응한다
        audioManagerRef.current?.stopAllSounds();
      };
    }, [])
  );



  const toggleSettingsPanel = () => setIsSettingsExpanded((v) => !v);
  const closeSettingsOnOutsideTouch = () => { if (isSettingsExpanded) setIsSettingsExpanded(false); };

  // 드럼 스크롤 시 인덱스 반영
  const handleDrumScrollIndexChange = useCallback((index: number) => {
    setCurrentDrumScrollIndex(index);
  }, []);

  // 각 페이지의 선택 악기를 받아 그 페이지 자리에만 담는다 (레이블 표시용)
  const handleInstrumentChange = useCallback((instrument: InstrumentType | null, pageIndex: number) => {
    setInstrumentByPage((prev) => {
      if (prev[pageIndex] === instrument) return prev; // 같은 값이면 리렌더 없이 통과
      const next = [...prev];
      next[pageIndex] = instrument;
      return next;
    });
  }, []);



  // 게임 완료
  const handleGameComplete = (score: number, maxScore: number) => {
    console.log('🏁 게임 완료 콜백 호출됨!');
    console.log('🏁 게임 완료 - 설정 적용 결과:', {
      score,
      maxScore,
      finalQuestionCount: questionCount,
      finalInstrumentCount: instrumentCount
    });
    console.log('🏁 isGameOver를 true로 설정');
    setFinalScore(score);
    setFinalMaxScore(maxScore);
    setIsGameOver(true);
    console.log('🎯 게임 완료 - isGameStarted: false');
    setIsGameStarted(false);
    // 게임 오버 오버레이가 전체 화면에 표시되므로 스크롤 불필요
  };

  // 통합 퀴즈용 게임 로직 (오버레이 UI에서 사용)
  const gameLogic = useGameLogic({
    questionCount,
    instrumentCount,
    onGameComplete: handleGameComplete,
  });
  const {
    currentInstrument,
    gameState,
    score,
    round,
    answerHistory,
    showFeedback,
    feedbackMessage,
    maxRounds,
    startNewRound,
    handleAnswer,
    resetGame,
    startPlaying,
    stopPendingRounds,
  } = gameLogic;

  // 게임 중 사용자가 다른 페이지로 스크롤 시 퀴즈 강제 종료 → 사운드 체크 모드로 복귀
  const quizScrollLockRef = useRef(false);

  /**
   * 진행 중인 카운트다운을 무효화하는 표. 시작할 때마다 하나 올리고, 기다림이 끝날 때
   * 번호가 그대로인지 본다 — 다르면 그 사이에 그만둔 것이므로 아무것도 하지 않는다.
   *
   * `await`는 취소되지 않는다. 표가 없으면 「그만하기」를 눌러도 남은 카운트다운이 끝까지 돌아
   * **접은 퀴즈가 `playing`으로 들어간다.**
   */
  const quizRunIdRef = useRef(0);
  /** 카운트다운 대기 타이머. 끊을 때 `clearTimeout`과 함께 `resolve`도 해서 대기를 깨운다 */
  const quizWaitersRef = useRef<Map<ReturnType<typeof setTimeout>, () => void>>(new Map());
  const cancelQuizWaits = useCallback(() => {
    quizWaitersRef.current.forEach((resolve, id) => {
      clearTimeout(id);
      resolve();
    });
    quizWaitersRef.current.clear();
  }, []);
  const waitInQuiz = useCallback((delayMs: number) => new Promise<void>((resolve) => {
    const id = setTimeout(() => {
      quizWaitersRef.current.delete(id);
      resolve();
    }, delayMs);
    quizWaitersRef.current.set(id, resolve);
  }), []);

  /**
   * 퀴즈를 접는 유일한 통로 — 「그만하기」·「나가기」·페이지 이탈·탭 이탈이 다 여기로 온다.
   * 한 군데라도 빼먹으면 그 길로 나갔을 때만 타이머가 살아남는다 (세션 49 피아노 재점검 참고).
   */
  const exitQuiz = useCallback(() => {
    quizRunIdRef.current += 1; // 진행 중인 카운트다운 무효화
    cancelQuizWaits();
    stopPendingRounds();
    isStartingQuizRef.current = false;
    quizScrollLockRef.current = false;
    setCountdown(null);
    setIsQuizActive(false);
    setQuizStartScrollIndex(null);
  }, [cancelQuizWaits, stopPendingRounds]);
  /** 탭 포커스 클린업은 의존성이 빈 배열이라(재구독 방지) 최신 함수를 ref로 본다 */
  const exitQuizRef = useRef(exitQuiz);
  exitQuizRef.current = exitQuiz;

  // 퀴즈 시작: 설정된 악기 수 페이지로 전환 → 카운트다운 → 첫 문제 재생
  const handleStartQuiz = useCallback(async () => {
    // 이미 퀴즈 시작 중이면 무시 (연타 방지)
    if (isStartingQuizRef.current) {
      console.log('⚠️ 퀴즈 시작 중 - 중복 호출 무시');
      return;
    }
    isStartingQuizRef.current = true;

    const runId = ++quizRunIdRef.current;
    quizScrollLockRef.current = true;
    setQuizStartScrollIndex(currentDrumScrollIndex);
    setIsQuizActive(true);
    resetGame();
    setIsGameOver(false);
    setFinalScore(0);
    setFinalMaxScore(0);

    /**
     * 캐릭터를 초기 위치로 되돌린다.
     *
     * 연주모드에서 마지막에 친 악기 위에 캐릭터가 앉은 채로 넘어오면, 첫 문제가 마침 그 악기일 때
     * 정답 자리에 이미 서 있는 셈이 된다(마커 초록도 남는다). 라운드 사이에는
     * moveToNeutralPosition이 비켜 주는데 진입 첫 문제에만 그 처리가 없었다.
     * 카운트다운 동안 돌아가므로 첫 문제가 나갈 때는 이미 제자리다.
     */
    horizontalDrumScrollerRef.current?.resetCharacterToInitial();

    // 헤더 배경 플래시 애니메이션
    RNAnimated.sequence([
      RNAnimated.timing(headerFlashAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      RNAnimated.timing(headerFlashAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();

    void waitInQuiz(800).then(() => {
      if (quizRunIdRef.current === runId) quizScrollLockRef.current = false;
    });
    for (let i = 2; i > 0; i--) {
      setCountdown(i);
      await waitInQuiz(1000);
      if (quizRunIdRef.current !== runId) return; // 그 사이에 그만뒀다
    }
    setCountdown(0);
    await waitInQuiz(500);
    if (quizRunIdRef.current !== runId) return;
    setCountdown(null);
    startPlaying();
    isStartingQuizRef.current = false;
  }, [currentDrumScrollIndex, resetGame, startPlaying, waitInQuiz]);

  useEffect(() => {
    if (!isQuizActive || quizStartScrollIndex === null) return;
    if (quizScrollLockRef.current) return; // 시작 직후 자동 스크롤은 무시
    if (currentDrumScrollIndex !== quizStartScrollIndex) {
      exitQuiz();
    }
  }, [isQuizActive, quizStartScrollIndex, currentDrumScrollIndex, exitQuiz]);

  // 문제 출제 시 소리만 재생 (힌트 없이)
  useEffect(() => {
    if (isQuizActive && gameState === 'playing' && currentInstrument) {
      audioManager.playSound(currentInstrument, DRUM_INSTRUMENTS[currentInstrument].sound);
    }
  }, [isQuizActive, gameState, currentInstrument]);

  /** 퀴즈모드 ↻(다시 듣기) 활성 조건. 라운드마다 켜졌다 꺼지므로 회색 처리만 하고 버튼은 계속 렌더 */
  const isReplayEnabled = isQuizActive && gameState === 'playing' && !showFeedback && !!currentInstrument;

  /** ↻ 눌림 피드백용 스케일 펄스. 정답 악기를 하이라이트하면 답이 노출되므로 버튼 자체만 반응 */
  const replayPulseAnim = useRef(new RNAnimated.Value(1)).current;
  const pulseReplayButton = useCallback(() => {
    replayPulseAnim.setValue(1);
    RNAnimated.sequence([
      RNAnimated.timing(replayPulseAnim, { toValue: 1.15, duration: 90, useNativeDriver: true }),
      RNAnimated.timing(replayPulseAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [replayPulseAnim]);

  // 피드백 전 마지막 선택 악기 저장용
  const lastAnsweredInstrumentRef = useRef<InstrumentType | null>(null);

  // 피드백이 끝난 후 캐릭터를 중립 위치로 이동 (다음 문제 준비)
  const prevShowFeedbackRef = useRef(showFeedback);
  useEffect(() => {
    // showFeedback이 true → false로 바뀔 때 (피드백 종료)
    if (prevShowFeedbackRef.current && !showFeedback && isQuizActive && lastAnsweredInstrumentRef.current) {
      console.log('🎯 피드백 종료 - 캐릭터 중립 위치로 이동:', lastAnsweredInstrumentRef.current);
      horizontalDrumScrollerRef.current?.moveToNeutralPosition(lastAnsweredInstrumentRef.current);
    }
    prevShowFeedbackRef.current = showFeedback;
  }, [showFeedback, isQuizActive]);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* 전체 화면 배경: contain으로 한 영역 안에 맞춤 */}
        <View
          style={[StyleSheet.absoluteFill, styles.backgroundImageWrapper]}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setBackgroundViewport({ width, height });
          }}
        >
          <Image
            source={DRUM_BACKGROUND_IMAGE}
            style={{ width: windowWidth, height: windowHeight }}
            resizeMode="contain"
          />
        </View>
        {/* 콘텐츠: 상단 인셋은 헤더가 직접 흡수(헤더 배경이 상태바 뒤까지 이어짐) + 하단 탭 공간 확보 */}
        <View
          style={[
            styles.contentWrapper,
            { paddingBottom: insets.bottom },
          ]}
        >
          {/* 고정 헤더: 설정 & 퀴즈 시작 / Round & 그만하기 */}
          <RNAnimated.View
            onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
            style={[
        styles.fixedHeader,
        {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 15,
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          // 불투명(알파 1) 유지 필수: 0.95였을 때 뒤의 배경 이미지 letterbox 경계선이 헤더에 비쳐 보였음
          backgroundColor: headerFlashAnim.interpolate({
            inputRange: [0, 1, 2],
            outputRange: ['rgb(255, 255, 255)', 'rgb(255, 153, 0)', 'rgb(153, 153, 153)']
          })
        }
      ]}>
            {!isQuizActive ? (
              <>
                <TouchableOpacity
                  onPress={toggleSettingsPanel}
                  style={styles.headerCountButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.headerCountButtonText}>⚙️ {questionCount}문제 </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartQuiz}
                  style={styles.headerActionButton}
                  activeOpacity={0.8}
                >
                  {/* 👆 = 여기를 눌러 진입하라는 신호. 코랄 배경에 노란 손 이모지가 묻혀서 흰 원형 칩 위에 올림 */}
                  <View style={styles.headerActionIconChip}>
                    <Text style={styles.headerActionButtonIcon}>👆</Text>
                  </View>
                  <Text style={styles.headerActionButtonText}>듣기연습</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.headerSide}>
                  <Text style={styles.headerText}>{round}/{questionCount} 회</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    RNAnimated.sequence([
                      RNAnimated.timing(headerFlashAnim, { toValue: 2, duration: 150, useNativeDriver: false }),
                      RNAnimated.timing(headerFlashAnim, { toValue: 0, duration: 150, useNativeDriver: false }),
                    ]).start();
                    exitQuiz();
                  }}
                  style={styles.headerSide}
                >
                  <Text style={[styles.headerText, { color: '#999' }]}>그만하기</Text>
                </TouchableOpacity>
              </>
            )}

            {/* 헤더 정중앙 타이틀: 좌우 버튼 폭에 영향받지 않도록 절대 배치, 모드에 따라 문구 전환 */}
            <View
              pointerEvents="none"
              style={[
                styles.headerCenter,
                { top: insets.top + 12, bottom: 12 },
              ]}
            >
              <View style={[styles.headerCenterBadge, isQuizActive ? styles.headerCenterBadgeQuiz : styles.headerCenterBadgeListen]}>
                <Text style={[styles.headerCenterText, isQuizActive ? styles.headerCenterTextQuiz : styles.headerCenterTextListen]}>
                  {isQuizActive ? '퀴즈모드' : '연주모드'}
                </Text>
              </View>
            </View>
          </RNAnimated.View>

          {/* 설정 패널: 톱니 탭 시 헤더 바로 아래 열림, 바깥 터치로 닫기 */}
          {!isQuizActive && isSettingsExpanded && (
            <>
              <View style={[styles.settingsDropdownPanel, { top: headerHeight }]}>
                <QuestionCountSelector value={questionCount} onChange={handleQuestionCountChange} />
              </View>
              <TouchableWithoutFeedback onPress={closeSettingsOnOutsideTouch}>
                <View style={[styles.settingsDropdownBackdrop, { top: headerHeight + SETTINGS_PANEL_HEIGHT }]} />
              </TouchableWithoutFeedback>
            </>
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {/* 드럼 세트 (연주 + 퀴즈 시 정답 제출) */}
            <View style={[styles.section, styles.sectionDrum]}>
              <View>
                <HorizontalDrumScroller
                  ref={horizontalDrumScrollerRef}
                  scrollX={drumScrollXRef}
                  onContainerLayout={setDrumContainerWidth}
                  onScrollIndexChange={handleDrumScrollIndexChange}
                  onInstrumentPlay={() => {}}
                  onInstrumentChange={handleInstrumentChange}
                  isGameAudioPlaying={isQuizActive && gameState === 'playing'}
                  isGameMode={isQuizActive}
                  isQuizWaiting={isQuizActive && gameState === 'playing'}
                  onAnswerSubmit={(instrument) => {
                    lastAnsweredInstrumentRef.current = instrument;
                    handleAnswer(instrument);
                  }}
                  scrollEnabled={!isQuizActive}
                />
              </View>
            </View>
          </ScrollView>

          {/*
            듣기연습 첫 문제 안내. 헤더 바로 아래, 1회째만.
            악기명 레이블은 퀴즈 중 숨기므로 그 자리를 쓴다. 터치는 통과.
          */}
          {isQuizActive && !isGameOver && round === 1 && (
            <View
              style={[
                styles.quizHintFixed,
                { top: headerHeight + instrumentLabelGap },
              ]}
              pointerEvents="none"
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.quizHintText}>들린 악기에 캐릭터를 가져가세요</Text>
            </View>
          )}

          {/*
            현재 악기 레이블 — ScrollView 밖에 둔다. 안에 두면 드럼 세트 위로 올릴 때
            FlatList 셀에 잘려 뒤 배경이 드러난다. 세로 기준은 헤더 실측 높이(상단 인셋 포함).
            거기에 칩 높이를 한 번 더 더해 제 높이만큼 아래로 내린다.
            퀴즈 중에는 정답을 알려주는 셈이라 숨긴다.
          */}
          {!isQuizActive && labelInstrument && (
            <View
              style={[
                styles.instrumentLabelFixed,
                { top: headerHeight + instrumentLabelGap + instrumentLabelHeight },
              ]}
              pointerEvents="none"
            >
              <View
                style={styles.currentInstrumentDisplay}
                onLayout={(event) => {
                  // 같은 값이면 setState를 부르지 않는다 — onLayout → 리렌더 → onLayout 반복을 막는다
                  const measured = Math.round(event.nativeEvent.layout.height);
                  setInstrumentLabelHeight((prev) => (prev === measured ? prev : measured));
                }}
              >
                <Text style={styles.currentInstrumentText}>
                  {DRUM_INSTRUMENTS[labelInstrument].name}
                </Text>
              </View>
            </View>
          )}

          {/* 드럼 캐릭터+순환 버튼 오버레이 (결과창 떠 있을 때는 미표시) */}
          {!(isQuizActive && isGameOver) && (
            <View style={[styles.drumOverlayFixed, { bottom: insets.bottom + fixedButtonBottomOffset }]} pointerEvents="box-none">
              <View
                style={[styles.drumOverlayClip, { width: drumContainerWidth }]}
                pointerEvents="box-none"
              >
                <RNAnimated.View
                  pointerEvents="box-none"
                  style={[
                    styles.fixedDrumOverlayInner,
                    {
                      width: drumContainerWidth * 4,
                      transform: [{
                        translateX: drumScrollXRef.current.interpolate({
                          inputRange: [0, drumContainerWidth * 3],
                          outputRange: [0, -drumContainerWidth * 3],
                        }),
                      }],
                    },
                  ]}
                >
                  {[0, 1, 2, 3].map((pageIndex) => (
                    <View key={pageIndex} style={[styles.drumOverlayPageCell, { width: drumContainerWidth }]}>
                      {/* 왼쪽 버튼: 연습모드 = ◀ 역순 이동 / 퀴즈모드 = ↻ 다시 듣기 */}
                      <AnimatedTouchable
                        style={[
                          styles.fixedReplayButton,
                          isQuizActive && !isReplayEnabled && styles.fixedReplayButtonDisabled,
                          { transform: [{ scale: replayPulseAnim }] }
                        ]}
                        onPress={() => {
                          if (!isQuizActive) {
                            horizontalDrumScrollerRef.current?.moveToPrevInstrumentForCurrentPage();
                          } else if (isReplayEnabled && currentInstrument) {
                            pulseReplayButton();
                            audioManager.playSound(currentInstrument, DRUM_INSTRUMENTS[currentInstrument].sound);
                          }
                        }}
                        activeOpacity={0.7}
                        disabled={isQuizActive && !isReplayEnabled}
                      >
                        {isQuizActive ? (
                          <Text
                            style={[styles.fixedReplayButtonText, !isReplayEnabled && styles.fixedReplayButtonTextDisabled]}
                            numberOfLines={1}
                          >
                            ↻
                          </Text>
                        ) : (
                          <DrumStickIcon direction="left" />
                        )}
                      </AnimatedTouchable>
                      {!isQuizActive && (
                        <View style={styles.pageIndicator} pointerEvents="none">
                          <Text style={styles.pageIndicatorText}>
                            {pageIndex + 1}/{ANIMATED_FLATLIST_PAGES}
                          </Text>
                        </View>
                      )}
                      {/* 오른쪽 ▶ 순차 이동: 퀴즈모드에서는 회색 처리 대신 언마운트 */}
                      {!isQuizActive && (
                        <TouchableOpacity
                          style={styles.fixedCycleButton}
                          onPress={() => horizontalDrumScrollerRef.current?.moveToNextInstrumentForCurrentPage()}
                          activeOpacity={0.7}
                        >
                          <DrumStickIcon direction="right" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </RNAnimated.View>
              </View>
            </View>
          )}

          {/* 퀴즈 오버레이: 카운트다운 (0일 때는 표시하지 않아 숫자 0이 안 보이게) */}
          {countdown !== null && countdown !== 0 && (
            <View style={[StyleSheet.absoluteFill, styles.quizOverlayCenter, styles.countdownOverlayUp]} pointerEvents="none">
              <Text style={styles.countdownText}>
                {countdown}
              </Text>
            </View>
          )}

          {/* 퀴즈 오버레이: 정답 ⭕ / 오답 ❌ (정답! 포함 시에만 정답, 오답 메시지엔 '정답은'이라 includes('정답')만 쓰면 오답도 정답으로 나감) */}
          {showFeedback && (
            <View style={[StyleSheet.absoluteFill, styles.quizOverlayCenter, styles.countdownOverlayUp]} pointerEvents="none">
              <Text style={[styles.countdownText, feedbackMessage.includes('정답!') ? styles.feedbackCorrect : styles.feedbackWrong]}>
                {feedbackMessage.includes('정답!') ? '⭕' : '❌'}
              </Text>
            </View>
          )}

          {/*
            게임 종료 결과창. 조건부 View + zIndex였을 때는 뒤로가기가 이 창이 아니라
            **탭을 나갔다.** 뒤로가기는 「나가기」와 같은 길로 보낸다 (세션 47 냉장고 완료 ·
            49 피아노 결과와 같은 처방). Modal 안에서는 절대배치가 아니라 flex로 채운다.
          */}
          <Modal
            visible={isQuizActive && isGameOver}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={exitQuiz}
          >
            <View style={styles.gameOverOverlay}>
              <DrumGameOverScreen
                score={finalScore}
                maxScore={finalMaxScore}
                onRestart={handleStartQuiz}
                onGoHome={exitQuiz}
              />
            </View>
          </Modal>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 1,
  },
  backgroundImageWrapper: {
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
  },
  fixedHeader: {
    backgroundColor: '#ffffff',
    elevation: 3,
    zIndex: 100,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20,  // 고정 헤더와의 간격
    paddingBottom: 30,
  },

  // 섹션 스타일
  section: {
    marginHorizontal: 15,
    marginVertical: 10,
  },
  /** 사운드 테스트(드럼) 영역 - 중앙 정렬 */
  sectionDrum: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 150,
  },
  // 2칸 레이아웃 (설정 버튼 없을 때)
  headerSide: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: LAYOUT.drumHeaderTextFontSize,
    fontWeight: 'bold',
    color: '#333333',
  },
  /**
   * 헤더 좌측 '⚙️ n문제' 버튼(알약형). 흰 배경 + 옅은 회색 윤곽선 —
   * 우측 '듣기연습'(코랄)이 주 버튼이므로 이쪽은 보조 버튼으로 대비를 둔다.
   * marginVertical은 이전 headerSide(paddingVertical 15)와 헤더 높이를 맞추기 위한 값 —
   * 헤더 높이는 실측(onLayout)해서 설정 패널 top에 쓰이므로 여기서 줄면 패널 위치도 따라 올라감
   */
  headerCountButton: {
    marginHorizontal: 20,
    marginVertical: 5,
    paddingHorizontal: Math.round(14 * HEADER_ACTION_SCALE),
    paddingVertical: Math.round(9 * HEADER_ACTION_SCALE),
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  headerCountButtonText: {
    fontSize: HEADER_ACTION_FONT_SIZE,
    fontWeight: 'bold',
    color: '#333333',
  },
  // 헤더 중앙 타이틀(좌우 버튼 사이 여백)
  // zIndex/elevation: 좌우 버튼(headerActionButton elevation 2)보다 위에 그려야 안드로이드에서 안 묻힘
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 4,
  },
  /** 현재 모드 배지: 좌우 버튼과 같은 회색 글자로는 묻혀서 배경 pill + 색 구분으로 부각 */
  headerCenterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    maxWidth: '100%',
  },
  headerCenterBadgeListen: {
    backgroundColor: COLORS.blueLight,
    borderColor: COLORS.blue,
  },
  headerCenterBadgeQuiz: {
    backgroundColor: COLORS.backgroundWarning,
    borderColor: COLORS.primaryDark,
  },
  headerCenterText: {
    fontSize: HEADER_BADGE_FONT_SIZE,
    fontWeight: 'bold',
    color: '#333333',
    letterSpacing: 0.5,
  },
  headerCenterTextListen: {
    color: COLORS.blue,
  },
  headerCenterTextQuiz: {
    color: COLORS.primaryDark,
  },
  /** 헤더 우측 '듣기연습' 버튼(알약형) - 중앙 모드 배지 대비 0.8배. 헤더 높이는 좌측 headerSide가 결정하므로 그대로 유지 */
  headerActionButton: {
    flexDirection: 'row',
    paddingLeft: Math.round(10 * HEADER_ACTION_SCALE),
    paddingRight: Math.round(18 * HEADER_ACTION_SCALE),
    paddingVertical: Math.round(9 * HEADER_ACTION_SCALE),
    borderRadius: 999,
    backgroundColor: '#fd7d7d',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  headerActionButtonText: {
    fontSize: HEADER_ACTION_FONT_SIZE,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  /** 👆를 올려 놓는 흰 원형 칩. 이모지 자체 색(노랑/살구)이 코랄 배경(#fd7d7d)과 명도가 비슷해 그냥 두면 안 보임 */
  headerActionIconChip: {
    width: HEADER_ACTION_ICON_CHIP_SIZE,
    height: HEADER_ACTION_ICON_CHIP_SIZE,
    borderRadius: HEADER_ACTION_ICON_CHIP_SIZE / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  /** 칩 안에 꽉 차 보이도록 글자보다 살짝 크게. lineHeight를 주지 않으면 안드로이드에서 이모지 하단이 잘림 */
  headerActionButtonIcon: {
    fontSize: HEADER_ACTION_FONT_SIZE + 1,
    lineHeight: HEADER_ACTION_FONT_SIZE + 4,
    textAlign: 'center',
  },
  // 횡스크롤 컨테이너
  horizontalScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  /**
   * 악기명 레이블 줄. 헤더 아래 가로 전체를 잡고 가운데 정렬만 한다 —
   * 폭을 고정하고 translateX로 반쯤 밀던 이전 방식과 달리 글자 길이·화면 폭을 안 탄다.
   * zIndex는 설정 드롭다운(500·501)보다 낮게: 드롭다운이 열리면 그쪽이 위다.
   */
  instrumentLabelFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 300,
  },
  quizHintFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 300,
    paddingHorizontal: LAYOUT.spacingMD,
  },
  quizHintText: {
    maxWidth: '100%',
    backgroundColor: COLORS.white,
    color: COLORS.textPrimary,
    fontSize: LAYOUT.isTablet ? 18 : 15,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: LAYOUT.spacingMD,
    paddingVertical: LAYOUT.spacingSM,
    borderRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentInstrumentDisplay: {
    minWidth: 140,
    minHeight: INSTRUMENT_LABEL_MIN_HEIGHT,
    backgroundColor: 'rgba(252, 237, 204, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentInstrumentText: {
    color: '#555457',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0,
    lineHeight: 22,
  },
  /** 드럼 오버레이를 contentWrapper 하단에 고정. zIndex로 탭 바 위에 그리기 */
  drumOverlayFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
    paddingHorizontal: 27,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  /** 한 페이지 너비만 보이도록 클리핑 → 카드당 캐릭터+버튼 1세트만 표시 */
  drumOverlayClip: {
    height: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  fixedDrumOverlayInner: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  /** 4페이지 오버레이에서 페이지당 한 칸 (캐릭터+버튼이 이 안에서 절대 위치) */
  drumOverlayPageCell: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  /** 순환 버튼: 가로 긴 직사각형, 반응형 */
  fixedCycleButton: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: FIXED_CYCLE_MARGIN_LEFT,
    width: FIXED_BUTTON_WIDTH,
    height: FIXED_BUTTON_HEIGHT,
    backgroundColor: '#FF9800',
    borderRadius: FIXED_BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  /** 왼쪽 버튼(연습=◀ / 퀴즈=↻): 순환 버튼과 대칭(좌측), 가로 긴 직사각형, 반응형 */
  fixedReplayButton: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: FIXED_REPLAY_MARGIN_LEFT,
    width: FIXED_BUTTON_WIDTH,
    height: FIXED_BUTTON_HEIGHT,
    backgroundColor: '#FF9800',
    borderRadius: FIXED_BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    elevation: 3,
  },
  fixedReplayButtonDisabled: {
    backgroundColor: '#b0b0b0',
    opacity: 0.65,
    elevation: 0,
  },
  fixedReplayButtonTextDisabled: {
    opacity: 0.7,
  },
  fixedReplayButtonText: {
    fontSize: FIXED_ICON_FONT_SIZE,
    color: '#fff',
    fontWeight: 'bold',
  },
  /** 연주 버튼 사이 페이지 표시. 1/4 = 2악기 화면. 터치는 좌우 버튼으로 통과 */
  pageIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FIXED_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndicatorText: {
    fontSize: PAGE_INDICATOR_FONT_SIZE,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  fixedCycleButtonText: {
    fontSize: FIXED_ICON_FONT_SIZE,
    color: '#fff',
    fontWeight: 'bold',
  },

  settingsDropdownPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 501,
    height: SETTINGS_PANEL_HEIGHT,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 4,
  },
  settingsDropdownBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
    backgroundColor: 'transparent',
  },
  /** 세그먼티드 컨트롤 트랙. 칸 폭은 실측 너비에서 계산되므로 매직넘버 없이 항상 정렬됨 */
  segmentedTrack: {
    width: LAYOUT.questionSelectorWidth,
    height: SEGMENTED_TRACK_HEIGHT,
    alignSelf: 'center',
    flexDirection: 'row',
    padding: SEGMENTED_TRACK_PADDING,
    borderRadius: 999,
    backgroundColor: '#f0f0f0',
  },
  /** 선택 칸을 따라 미끄러지는 pill. 폭은 실측 후 인라인으로 주입 */
  segmentedIndicator: {
    position: 'absolute',
    top: SEGMENTED_TRACK_PADDING,
    bottom: SEGMENTED_TRACK_PADDING,
    left: SEGMENTED_TRACK_PADDING,
    borderRadius: 999,
    backgroundColor: '#fd7d7d',
  },
  segmentedItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemText: {
    fontSize: LAYOUT.questionSelectorFontSize,
    fontWeight: '700',
    color: '#666',
  },
  segmentedItemTextSelected: {
    color: '#ffffff',
  },

  /** Modal 안이라 절대배치·zIndex가 필요 없다 — 판 전체를 flex로 채운다 */
  gameOverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizOverlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  countdownOverlayUp: {
    paddingBottom: 300,
  },
  countdownText: {
    fontSize: 80,
    fontWeight: 'bold',
    color: COLORS.green,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  feedbackCorrect: {
    color: '#7cbd7e',
  },
  feedbackWrong: {
    color: '#F44336',
  },
});

interface QuestionCountSelectorProps {
  readonly value: typeof QUESTION_COUNTS[number];
  readonly onChange: (value: typeof QUESTION_COUNTS[number]) => void;
}

/**
 * 문제 수 세그먼티드 컨트롤.
 * 칸 폭 = (실측 트랙 폭 - 패딩) / 항목 수 이므로, pill이 그려지는 위치와 터치 영역이
 * 화면 크기·회전과 무관하게 항상 같은 좌표계를 쓴다. (이전 Rive 구현의 정렬 어긋남 원인 제거)
 */
function QuestionCountSelector({ value, onChange }: QuestionCountSelectorProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0
    ? (trackWidth - SEGMENTED_TRACK_PADDING * 2) / QUESTION_COUNTS.length
    : 0;
  const selectedIndex = Math.max(0, QUESTION_COUNTS.indexOf(value));
  const indicatorX = useRef(new RNAnimated.Value(0)).current;
  /** 첫 실측 때는 애니메이션 없이 즉시 배치. 안 그러면 패널 열 때마다 pill이 왼쪽에서 날아옴 */
  const hasPositionedRef = useRef(false);

  useEffect(() => {
    if (segmentWidth === 0) return;
    const toValue = selectedIndex * segmentWidth;
    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      indicatorX.setValue(toValue);
      return;
    }
    RNAnimated.spring(indicatorX, {
      toValue,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [selectedIndex, segmentWidth, indicatorX]);

  return (
    <View
      style={styles.segmentedTrack}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {segmentWidth > 0 && (
        <RNAnimated.View
          pointerEvents="none"
          style={[
            styles.segmentedIndicator,
            { width: segmentWidth, transform: [{ translateX: indicatorX }] },
          ]}
        />
      )}
      {QUESTION_COUNTS.map((count) => (
        <TouchableOpacity
          key={count}
          style={styles.segmentedItem}
          activeOpacity={0.7}
          onPress={() => onChange(count)}
          accessibilityRole="radio"
          accessibilityState={{ selected: count === value }}
          accessibilityLabel={`${count}문제`}
        >
          <Text style={[
            styles.segmentedItemText,
            count === value && styles.segmentedItemTextSelected,
          ]}>
            {count}문제
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// 횡스크롤 드럼 섹션 컴포넌트
interface HorizontalDrumScrollerProps {
  readonly onInstrumentPlay: (instrumentName: string) => void;
  /**
   * 페이지마다 InteractiveDrumSet이 따로 있고 각자 선택 악기를 들고 있다.
   * 어느 페이지에서 온 알림인지 함께 넘겨야 부모가 현재 보이는 페이지 것만 그릴 수 있다.
   */
  readonly onInstrumentChange: (instrument: InstrumentType | null, pageIndex: number) => void;
  readonly isGameAudioPlaying: boolean;
  readonly isGameMode: boolean;
  /** 퀴즈 정답 대기 시 true → 악기 터치가 정답 제출로 전달됨 */
  readonly isQuizWaiting?: boolean;
  readonly onAnswerSubmit?: (instrument: InstrumentType) => void;
  /** false면 가로 스크롤 비활성화 (퀴즈 중 고정) */
  readonly scrollEnabled?: boolean;
  /** 부모에서 스크롤 위치 동기화용 (오버레이를 ScrollView 밖에서 그릴 때 사용) */
  readonly scrollX?: React.MutableRefObject<RNAnimated.Value>;
  readonly onContainerLayout?: (width: number) => void;
  readonly onScrollIndexChange?: (index: number) => void;
}

export interface HorizontalDrumScrollerRef {
  moveToNextInstrumentForCurrentPage: () => void;
  /** 현재 페이지에서 악기 순서를 역방향으로 한 칸 이동 */
  moveToPrevInstrumentForCurrentPage: () => void;
  /** 설정된 악기 수 페이지(0~3)로 스크롤 */
  scrollToPage: (index: number) => void;
  /** 현재 페이지의 캐릭터를 중립 위치로 이동 (다음 문제 준비용) */
  moveToNeutralPosition: (instrument: InstrumentType) => void;
  /** 현재 페이지의 캐릭터를 초기 위치로 되돌리고 악기 선택 해제 (퀴즈 진입용) */
  resetCharacterToInitial: () => void;
}

const ANIMATED_FLATLIST_PAGES = 4;
const AnimatedFlatList = RNAnimated.createAnimatedComponent(FlatList);

const HorizontalDrumScroller = React.forwardRef<HorizontalDrumScrollerRef, Readonly<HorizontalDrumScrollerProps>>(
  function HorizontalDrumScroller(
    { onInstrumentPlay, onInstrumentChange, isGameAudioPlaying, isGameMode, isQuizWaiting = false, onAnswerSubmit, scrollEnabled = true, scrollX: scrollXRef, onContainerLayout, onScrollIndexChange },
    ref
  ) {
    const flatListRef = useRef<FlatList>(null);
    const hasScrolled = useRef(false);
    const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
    const [currentScrollIndex, setCurrentScrollIndex] = useState(0);
    const drumSetRefs = useRef<(InteractiveDrumSetRef | null)[]>([]);
    const scrollXInternal = useRef(new RNAnimated.Value(0)).current;
    const scrollX = scrollXRef?.current ?? scrollXInternal;

    // 컨테이너의 실제 너비 측정
    const handleContainerLayout = useCallback((event: any) => {
      const { width } = event.nativeEvent.layout;
      console.log('📏 실제 컨테이너 너비:', width);
      setContainerWidth(width);
      onContainerLayout?.(width);
    }, [onContainerLayout]);

    // FlatList 레이아웃 완료 후 스크롤
    const handleFlatListLayout = useCallback(() => {
      if (!hasScrolled.current && flatListRef.current) {
        console.log('📐 FlatList 레이아웃 완료 - 스크롤 시도');
        setTimeout(() => {
          // scrollToOffset으로 정확히 0 위치로 이동
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
          hasScrolled.current = true;
          console.log('✅ 초기 스크롤 완료 (offset: 0)');
        }, 50);
      }
    }, []);

    const instrumentSections = [
      { count: 2 },
      { count: 3 },
      { count: 4 },
      { count: 5 }
    ];

    const getItemLayout = (_: any, index: number) => ({
      length: containerWidth,
      offset: containerWidth * index,
      index,
    });

    const onScrollEnd = useCallback((e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / containerWidth);
      const safeIndex = Math.min(index, instrumentSections.length - 1);
      setCurrentScrollIndex(safeIndex);
      onScrollIndexChange?.(safeIndex);
    }, [containerWidth, instrumentSections.length, onScrollIndexChange]);

    const onScroll = useCallback(
      RNAnimated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      ),
      [scrollX]
    );

    const moveToNextInstrumentForCurrentPage = useCallback(() => {
      drumSetRefs.current[currentScrollIndex]?.moveToNextInstrument();
    }, [currentScrollIndex]);

    const moveToPrevInstrumentForCurrentPage = useCallback(() => {
      drumSetRefs.current[currentScrollIndex]?.moveToPrevInstrument();
    }, [currentScrollIndex]);

    const scrollToPage = useCallback((index: number) => {
      const safeIndex = Math.max(0, Math.min(index, instrumentSections.length - 1));
      const offset = safeIndex * containerWidth;
      flatListRef.current?.scrollToOffset({ offset, animated: true });
    }, [containerWidth, instrumentSections.length]);

    const moveToNeutralPosition = useCallback((instrument: InstrumentType) => {
      drumSetRefs.current[currentScrollIndex]?.moveToNeutralPosition(instrument);
    }, [currentScrollIndex]);

    const resetCharacterToInitial = useCallback(() => {
      drumSetRefs.current[currentScrollIndex]?.resetToInitialPosition();
    }, [currentScrollIndex]);

    React.useImperativeHandle(ref, () => ({
      moveToNextInstrumentForCurrentPage,
      moveToPrevInstrumentForCurrentPage,
      scrollToPage,
      moveToNeutralPosition,
      resetCharacterToInitial,
    }), [moveToNextInstrumentForCurrentPage, moveToPrevInstrumentForCurrentPage, scrollToPage, moveToNeutralPosition, resetCharacterToInitial]);

    return (
      <View
        style={styles.horizontalScrollContainer}
        onLayout={handleContainerLayout}
      >
        <AnimatedFlatList
          ref={flatListRef}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          data={instrumentSections}
          keyExtractor={(item: unknown) => (item as { count: number }).count.toString()}
          snapToAlignment="center"
          snapToInterval={containerWidth || Dimensions.get('window').width}
          decelerationRate={0.95}
          getItemLayout={getItemLayout}
          contentOffset={{ x: 0, y: 0 }}
          onLayout={handleFlatListLayout}
          onScroll={onScroll}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            console.log('❌ 스크롤 실패, 재시도:', info.index);
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            });
          }}
          renderItem={(info) => {
            const { item, index } = info;
            const row = item as { count: number };
            return (
              <View style={{ width: containerWidth, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <InteractiveDrumSet
                  ref={(el) => { drumSetRefs.current[index] = el; }}
                  numInstruments={row.count as 2 | 3 | 4 | 5}
                  isGameAudioPlaying={isGameAudioPlaying}
                  onInstrumentPlay={(instrument) => onInstrumentPlay(instrument)}
                  onInstrumentChange={(inst) => onInstrumentChange(inst, index)}
                  isGameMode={isGameMode}
                  isQuizWaiting={isQuizWaiting}
                  onAnswerSubmit={onAnswerSubmit}
                  hideCycleButton
                />
              </View>
            );
          }}
        />
      </View>
    );
  });

