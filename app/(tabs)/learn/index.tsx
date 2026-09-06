import { Text, View, StyleSheet, TouchableOpacity, Image, Modal, Animated as RNAnimated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { WordGame, WordGameRef } from '../../../components/game/WordGame';
import { GameState } from '../../../hooks/useWordGameLogic';
import DrumGameOverScreen from '../../../screens/DrumGameOverScreen';
import { WORD_DIFFICULTY_LEVELS, WordDifficultyType } from '../../../constants/wordSounds';
import { LAYOUT } from '../../../constants/layout';
import { COLORS } from '../../../constants/colors';

/** 냉장고 게이지와 같은 단계 색. 연습(5문항)은 `GAUGE_FILL`만 쓴다 */
const GAUGE_TRACK = '#E0E6ED';
const GAUGE_FILL = '#66BB6A';
const GAUGE_FILL_70 = '#43A047';
const GAUGE_FILL_90 = '#FB8C00';
const GAUGE_FILL_100 = '#F44336';

export default function Index() {
  const insets = useSafeAreaInsets();

  // 상태 관리
  const [currentDifficulty, setCurrentDifficulty] = useState<WordDifficultyType>('easy');
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalMaxScore, setFinalMaxScore] = useState(0);

  /**
   * 액션줄을 그리는 값. 라운드·상태·재생 여부는 `WordGame` 안에 있어 부모가 모른다 —
   * 자식이 바뀔 때마다 알려 준다 (설계: `doc/learn-액션줄.md` · `doc/learn-그만하기.md`).
   */
  const [gameProgress, setGameProgress] = useState<{
    round: number;
    gameState: GameState;
    isPlaying: boolean;
  }>({
    round: 1,
    gameState: 'ready',
    isPlaying: false,
  });
  const wordGameRef = useRef<WordGameRef>(null);

  /**
   * 진행 게이지. 냉장고와 같은 RN Animated(폭은 native driver 불가).
   * 푼 수 / 문항 수. 「그만하기」와 같은 식 — `answered`는 아직 안 고른 상태다
   * (`useWordGameLogic` 주석).
   */
  const [gauge, setGauge] = useState(0);
  const gaugeAnim = useRef(new RNAnimated.Value(0)).current;
  const gaugeBlink = useRef(new RNAnimated.Value(1)).current;
  const blinkLoopRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const maxRounds = WORD_DIFFICULTY_LEVELS[currentDifficulty].rounds;
  const answeredCount =
    gameProgress.gameState === 'waitingForNextRound'
      ? gameProgress.round
      : Math.max(0, gameProgress.round - 1);
  const gaugeTarget = maxRounds > 0 ? (answeredCount / maxRounds) * 100 : 0;

  const stopGaugeBlink = useCallback(() => {
    gaugeBlink.setValue(1);
    if (blinkLoopRef.current) {
      blinkLoopRef.current.stop();
      blinkLoopRef.current = null;
    }
  }, [gaugeBlink]);

  const startGaugeBlink = useCallback(() => {
    stopGaugeBlink();
    blinkLoopRef.current = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(gaugeBlink, {
          toValue: 0.45,
          duration: 350,
          useNativeDriver: false,
        }),
        RNAnimated.timing(gaugeBlink, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
      ]),
    );
    blinkLoopRef.current.start();
  }, [gaugeBlink, stopGaugeBlink]);

  const setGaugeToValue = useCallback((value: number) => {
    const v = Math.min(100, Math.max(0, value));
    setGauge(v);
    RNAnimated.timing(gaugeAnim, {
      toValue: v,
      // 냉장고는 220ms·칸이 작다. 연습은 한 칸 20%라 같은 시간이면 툭 끊긴다.
      // 다음 문항 타이머(600ms)보다 짧게 두어 다음 문제가 나오기 전에 끝나게 한다.
      // out만 쓰면 앞에서 튀어 1~2번째(막대가 짧을 때)가 끊겨 보인다.
      duration: 450,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    // 연습(5문항)은 색이 안 바뀌고 100%에서도 깜빡이지 않는다
    if (currentDifficulty === 'normal' && v >= 100) startGaugeBlink();
    else stopGaugeBlink();
  }, [gaugeAnim, currentDifficulty, startGaugeBlink, stopGaugeBlink]);

  useEffect(() => {
    setGaugeToValue(gaugeTarget);
  }, [gaugeTarget, setGaugeToValue]);

  useEffect(() => {
    return () => {
      stopGaugeBlink();
    };
  }, [stopGaugeBlink]);

  // 매 렌더 새 함수를 넘기면 자식의 알림 이펙트가 계속 돈다
  const handleProgressChange = useCallback(
    (progress: { round: number; gameState: GameState; isPlaying: boolean }) =>
      setGameProgress(progress),
    []
  );

  /** 1라운드 준비 화면에서는 숨긴다 — 아직 「시작하기」라 접을 것이 없다 */
  const canQuit = !(gameProgress.round === 1 && gameProgress.gameState === 'ready');

  /**
   * 액션줄 **왼쪽은 칸 하나**다. 상태가 라벨·아이콘·동작을 바꾼다 —
   * 버튼을 셋 두지 않는다 (설계 `doc/learn-액션줄.md`).
   *
   * | 지금 | 왼쪽 |
   * |---|---|
   * | `ready` | 「시작하기」(1라운드) / 「계속하기」 |
   * | `playing` | **비움** — 「듣는 중...」은 아래 `WordGame`이 맡는다 |
   * | `answered` · `waitingForNextRound` | 「다시 듣기」 (재생 중이면 「재생 중...」) |
   */
  const isReplayState =
    gameProgress.gameState === 'answered' || gameProgress.gameState === 'waitingForNextRound';
  const leftAction = (() => {
    if (gameProgress.gameState === 'ready') {
      return {
        label: gameProgress.round === 1 ? '시작하기' : '계속하기',
        icon: 'play' as const,
        onPress: () => wordGameRef.current?.start(),
        disabled: false,
        playing: false,
      };
    }
    if (isReplayState) {
      return {
        label: gameProgress.isPlaying ? '재생 중...' : '다시 듣기',
        icon: gameProgress.isPlaying ? ('volume-high' as const) : ('refresh' as const),
        onPress: () => wordGameRef.current?.replay(),
        disabled: gameProgress.gameState !== 'answered',
        playing: gameProgress.isPlaying,
      };
    }
    return null;
  })();

  // 애니메이션 값들
  const easyScale = useSharedValue(1);
  const normalScale = useSharedValue(1);

  // 탭이 포커스될 때마다 상태 리셋
  useFocusEffect(
    React.useCallback(() => {
      // 탭에 들어올 때 (포커스 얻음)
      console.log('📚 Learn 탭 포커스 얻음');

      return () => {
        // 탭을 떠날 때 (포커스 잃음) - 모든 오디오 정리
        console.log('📚 Learn 탭 포커스 잃음 - 오디오 정리');
        setIsGameOver(false);
        setFinalScore(0);
        setFinalMaxScore(0);
        setCurrentDifficulty('easy');
        setGameProgress({ round: 1, gameState: 'ready', isPlaying: false });
        setGauge(0);
        gaugeAnim.setValue(0);
        stopGaugeBlink();
        easyScale.value = withSpring(1);
        normalScale.value = withSpring(1);
      };
    }, [])
  );



  // 난이도 선택
  const handleDifficultyPress = (difficulty: WordDifficultyType) => {
    setCurrentDifficulty(difficulty);
    easyScale.value = withSpring(difficulty === 'easy' ? 1.1 : 1);
    normalScale.value = withSpring(difficulty === 'normal' ? 1.1 : 1);
    handleRestartGame();
  };

  // 게임 완료
  const handleGameComplete = (score: number, maxScore: number) => {
    setFinalScore(score);
    setFinalMaxScore(maxScore);
    setIsGameOver(true);
    stopGaugeBlink();
  };

  // 게임 재시작
  const handleRestartGame = () => {
    setIsGameOver(false);
    setFinalScore(0);
    setFinalMaxScore(0);
    // 결과를 닫으면 `WordGame`이 다시 마운트돼 1라운드 준비 화면으로 돌아간다.
    // 자식의 알림을 기다리지 않고 여기서 함께 되돌린다 — 한 프레임 동안 「그만하기」가 남지 않게
    setGameProgress({ round: 1, gameState: 'ready', isPlaying: false });
    setGauge(0);
    gaugeAnim.setValue(0);
    stopGaugeBlink();
  };

  /**
   * 「그만하기」 — 확인창 없이 **지금 점수 그대로** 결과를 낸다.
   * 소리 정지·타이머 취소·결과 통보는 자식이 한 길로 처리한다 (`WordGameRef.quit`).
   */
  const handleQuitGame = () => {
    wordGameRef.current?.quit();
  };

  // 애니메이션 스타일
  const easyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: easyScale.value }],
  }));

  const normalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: normalScale.value }],
  }));

  /** 연습은 한 색. 도전만 70·90·100에서 냉장고와 같이 바뀐다 */
  const gaugeColor =
    currentDifficulty === 'easy'
      ? GAUGE_FILL
      : gauge >= 100
        ? GAUGE_FILL_100
        : gauge >= 90
          ? GAUGE_FILL_90
          : gauge >= 70
            ? GAUGE_FILL_70
            : GAUGE_FILL;

  const gaugeWidth = gaugeAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const showGaugeMilestones = currentDifficulty === 'normal';
  const gaugeBlinkOpacity = currentDifficulty === 'normal' && gauge >= 100 ? gaugeBlink : 1;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* 전체 화면 배경 (drum과 동일한 영역) */}
        <View style={[StyleSheet.absoluteFill, styles.backgroundImageWrapper]}>
          <Image
            source={require('../../../assets/images/class_s.webp')}
            style={{ width: LAYOUT.screenWidth, height: LAYOUT.screenHeight }}
            resizeMode="contain"
          />
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backgroundOverlay]} />
        {/**
         * 바닥에서 `tabBarHeight`(64)를 **더 빼지 않는다.** 탭바는 보일 때
         * 절대배치가 아니라(`BottomTabBar.js:248` — `isTabBarHidden`일 때만 `absolute`)
         * **이 화면의 영역이 이미 탭바 위에서 끝난다.** 64를 또 빼면 게임 칸이
         * 그만큼 줄어 `WordGame`이 아래로 넘치고, 넘친 끝을 탭바가 덮었다
         * (0-2절 세션 52 · 근거는 세션 53에 확정).
         *
         * `insets.bottom`은 남긴다 — 제스처바와 겹치는 자리라 갈래가 다르다
         * (냉장고 47 · 드럼 50은 아직 📱 기기 대기다).
         */}
        <View
          style={[
            styles.contentWrapper,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.contentInner}>
            <View style={styles.section}>
              {/* 타이틀은 카드 밖 상단에 배치.
                  배경 이미지 위에 글자가 바로 얹히므로 옅은 흰 pill로 받친다 */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitlePill}>
                  <Text style={styles.sectionTitle}>🎧 소리 구별 퀴즈</Text>
                </View>
                {!isGameOver && (
                  <View
                    style={styles.gaugeSection}
                    accessibilityRole="progressbar"
                    accessibilityLabel="퀴즈 진행"
                    accessibilityValue={{ min: 0, max: maxRounds, now: answeredCount }}
                  >
                    <View style={styles.gaugeContainer}>
                      <View style={styles.gaugeTrack}>
                        {showGaugeMilestones && (
                          <>
                            <View style={[styles.gaugeMilestone, { left: '70%' }]}>
                              <View style={[styles.milestoneIcon, { backgroundColor: GAUGE_FILL_70 }]} />
                            </View>
                            <View style={[styles.gaugeMilestone, { left: '90%' }]}>
                              <View style={[styles.milestoneIcon, { backgroundColor: GAUGE_FILL_90 }]} />
                            </View>
                          </>
                        )}
                        <RNAnimated.View
                          style={[
                            styles.gaugeFill,
                            {
                              width: gaugeWidth,
                              backgroundColor: gaugeColor,
                              opacity: gaugeBlinkOpacity,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* 난이도 선택 + 게임을 담는 영역.
                  배경 이미지를 살리려고 배경색은 주지 않는다 — 카드가 아니다 */}
              <View style={styles.gameSection}>
                {!isGameOver && (
                  <View style={styles.difficultyContainer}>

                    <View style={styles.difficultyButtons}>
                      <Animated.View style={easyAnimatedStyle}>
                        <TouchableOpacity
                          style={[
                            styles.difficultyButton,
                            currentDifficulty === 'easy' && styles.difficultyButtonActive,
                          ]}
                          onPress={() => handleDifficultyPress('easy')}
                          accessibilityRole="button"
                          accessibilityLabel="연습 난이도"
                          accessibilityState={{ selected: currentDifficulty === 'easy' }}
                        >
                          <Image
                            source={require('../../../assets/images/hoshi1.webp')}
                            style={styles.starIcon}
                            resizeMode="contain"
                          />
                          <Text
                            style={[
                              styles.difficultyName,
                              currentDifficulty === 'easy' && styles.difficultyNameActive,
                            ]}
                          >
                            연습
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>

                      <Animated.View style={normalAnimatedStyle}>
                        <TouchableOpacity
                          style={[
                            styles.difficultyButton,
                            currentDifficulty === 'normal' && styles.difficultyButtonActive,
                          ]}
                          onPress={() => handleDifficultyPress('normal')}
                          accessibilityRole="button"
                          accessibilityLabel="도전 난이도"
                          accessibilityState={{ selected: currentDifficulty === 'normal' }}
                        >
                          <View style={styles.starsRowContainer}>
                            <View style={styles.starCellFirst}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                            <View style={styles.starCellSecond}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                            <View style={styles.starCellThird}>
                              <Image
                                source={require('../../../assets/images/hoshi2.webp')}
                                style={styles.multiStarIcon}
                                resizeMode="contain"
                              />
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.difficultyName,
                              currentDifficulty === 'normal' && styles.difficultyNameActive,
                            ]}
                          >
                            도전
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>

                    {/* 액션줄 — 왼쪽 토글(시작·계속·다시 듣기) + 오른쪽 「그만하기」.
                        난이도 버튼과 붙이면 오탭이라 **줄 아래**에 두고, 줄 높이는
                        버튼이 없을 때도 잡아 둔다 — 나타났다 사라져도 게임이 밀리지 않는다.
                        배경 사진 위라 글자를 바로 얹지 않는다 (설계 `doc/learn-액션줄.md`).

                        빈 `View`를 왼쪽에 남긴다 — `space-between`은 자식이 하나면
                        그 하나를 **왼쪽**으로 보내므로, 왼쪽이 비었을 때 「그만하기」가
                        따라 넘어오지 않게 자리를 잡아 준다 */}
                    <View style={styles.actionRow}>
                      {leftAction ? (
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            leftAction.playing && styles.actionButtonPlaying,
                            leftAction.disabled && styles.actionButtonDisabled,
                          ]}
                          onPress={leftAction.onPress}
                          disabled={leftAction.disabled}
                          accessibilityRole="button"
                          accessibilityLabel={leftAction.label}
                          accessibilityState={{ disabled: leftAction.disabled }}
                        >
                          <Ionicons
                            name={leftAction.icon}
                            size={LAYOUT.learnActionButtonIconSize}
                            color={COLORS.white}
                          />
                          {/* 두 알약이 한 줄이라 **글자가 접히면 줄 높이가 뛴다.**
                              320dp에서 「재생 중...」이 가장 길다 (설계 「한 줄이 두 줄로
                              접히지 않게 한다」 · `GameExitButton`과 같은 처리) */}
                          <Text style={styles.actionButtonText} numberOfLines={1}>
                            {leftAction.label}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View />
                      )}

                      {canQuit && (
                        <TouchableOpacity
                          style={styles.quitButton}
                          onPress={handleQuitGame}
                          accessibilityRole="button"
                          accessibilityLabel="퀴즈 그만하기"
                        >
                          <Text style={styles.quitButtonText} numberOfLines={1}>그만하기</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.gameContentInner}>
                  {!isGameOver && (
                    <WordGame
                      ref={wordGameRef}
                      difficulty={currentDifficulty}
                      onGameComplete={handleGameComplete}
                      onProgressChange={handleProgressChange}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* 게임 종료 오버레이 — 드럼(`drum/index.tsx`)과 같은 방식.
              결과를 페이지 안에 끼워 넣지 않고 검은 스크림 위에 띄운다.
              WordGame은 위에서 언마운트해 오디오·타이머가 뒤에 남지 않게 한다.

              조건부 View + zIndex였을 때는 뒤로가기가 이 창이 아니라 **탭을 나갔다.**
              뒤로가기는 「다시 하기」와 같은 길로 보낸다 (냉장고 세션 47 · 피아노 49 ·
              드럼 50과 같은 처방 — 드럼은 이 컴포넌트를 함께 쓰면서 먼저 고쳤다).

              **`onGoHome`은 넘기지 않는다** — 이 탭은 전체가 퀴즈라 결과를 접고 갈 화면이 없다.
              넘기면 「나가기」가 그려지는데 하는 일이 「다시 하기」와 같았다 (세션 52).
              드럼은 연주 모드로 돌아가므로 그쪽은 그대로 넘긴다.
              Modal 안에서는 절대배치가 아니라 flex로 채운다. */}
          <Modal
            visible={isGameOver}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={handleRestartGame}
          >
            <View style={styles.gameOverOverlay}>
              <DrumGameOverScreen
                score={finalScore}
                maxScore={finalMaxScore}
                onRestart={handleRestartGame}
                restartLabel="확인"
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
    backgroundColor: COLORS.backgroundSoft,
  },
  backgroundImageWrapper: {
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundOverlay: {
    zIndex: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  contentWrapper: {
    flex: 1,
    zIndex: 1,
  },
  contentInner: {
    flex: 1,
    paddingBottom: LAYOUT.spacingSM,
  },
  section: {
    flex: 1,
    marginHorizontal: LAYOUT.learnSectionMarginH,
    marginTop: LAYOUT.learnSectionMarginTop,
  },
  /**
   * 제목 아래 마진은 게이지가 먹는다. spacingMD(16)를 두면 트랙(14)과 겹쳐 늘고,
   * 320×569 여유가 ≈2px라(0-2절 세션 61) 순증을 만들 수 없다.
   */
  sectionHeader: {
    marginBottom: LAYOUT.spacingXS,
    alignItems: 'center',
  },
  gaugeSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: LAYOUT.spacingXS,
    marginBottom: LAYOUT.spacingSM,
  },
  gaugeContainer: {
    width: LAYOUT.learnGaugeContainerWidthPercent,
    position: 'relative',
  },
  gaugeTrack: {
    height: LAYOUT.learnGaugeTrackHeight,
    borderRadius: LAYOUT.learnGaugeTrackBorderRadius,
    backgroundColor: GAUGE_TRACK,
    overflow: 'hidden',
    position: 'relative',
  },
  gaugeMilestone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  milestoneIcon: {
    width: LAYOUT.learnGaugeMilestoneSize,
    height: LAYOUT.learnGaugeMilestoneSize,
    borderRadius: LAYOUT.learnGaugeMilestoneSize / 2,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: LAYOUT.learnGaugeTrackBorderRadius,
  },
  /**
   * 제목 받침. 제목은 카드 밖, 배경 이미지 바로 위에 놓여서 이미지에 따라 대비가 흔들린다.
   * 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용 앱).
   */
  sectionTitlePill: {
    paddingHorizontal: LAYOUT.spacingMD,
    paddingVertical: LAYOUT.spacingSM,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceOnImage,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: LAYOUT.learnSectionTitleFontSize,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  gameSection: {
    flex: 1,
    padding: LAYOUT.learnGameSectionPadding,
  },
  difficultyContainer: {
    marginBottom: LAYOUT.learnDifficultyContainerMarginBottom,
  },
  difficultyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: LAYOUT.learnDifficultyButtonsGap,
  },
  difficultyButton: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.learnDifficultyButtonBorderRadius,
    padding: LAYOUT.learnDifficultyButtonPadding,
    width: LAYOUT.learnDifficultyButtonSize,
    height: LAYOUT.learnDifficultyButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
    // 흰 버튼이 밝은 배경(이미지 + 흰 오버레이 22%) 위에 놓인다. 경계가 서게
    // elevation과 옅은 테두리를 함께 준다 — 결과 화면 카드와 같은 처리 (규칙 4)
    borderWidth: 2,
    borderColor: COLORS.border,
    elevation: 3,
  },
  /**
   * 선택된 난이도. 전에는 테두리 색과 거의 흰색인 배경(#F9FFF9)뿐이라 구분이 약했다.
   * 배경을 한 단계 올리고 떠오르게 해서, 색 하나에만 기대지 않게 한다.
   */
  difficultyButtonActive: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.backgroundSuccess,
    elevation: 6,
  },
  starIcon: {
    width: LAYOUT.learnStarIconSize,
    height: LAYOUT.learnStarIconSize,
    marginBottom: LAYOUT.spacingSM,
  },
  starsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '100%',
    height: LAYOUT.learnStarsRowContainerHeight,
    marginBottom: LAYOUT.spacingXS,
  },
  starCellFirst: {
    marginTop: LAYOUT.spacingSM,
    marginHorizontal: LAYOUT.spacingXS,
  },
  starCellSecond: {
    marginHorizontal: LAYOUT.spacingXS,
  },
  starCellThird: {
    marginTop: 0,
    marginHorizontal: LAYOUT.spacingXS,
  },
  multiStarIcon: {
    width: LAYOUT.learnMultiStarIconWidth,
    height: LAYOUT.learnMultiStarIconHeight,
  },
  difficultyName: {
    fontSize: LAYOUT.learnDifficultyNameFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  /** 선택 표시를 글자에도 준다. 흰 배경 위 초록 글자는 successOnWhite다 (브랜드 초록은 2.2:1) */
  difficultyNameActive: {
    color: COLORS.successOnWhite,
  },
  /**
   * 액션줄. 난이도 버튼과 간격을 두고, 버튼이 하나도 없을 때(듣는 중 · 1라운드 준비)도
   * 높이를 잡는다 (규칙 3) — 나타났다 사라져도 아래 게임이 뛰지 않는다.
   * 작은 폰에서도 난이도 터치 영역과 겹치지 않게 `marginTop`을 준다.
   *
   * 두 알약이 한 줄에 들어가야 하므로 **줄바꿈을 허용하지 않는다**(RN 기본 `nowrap`).
   * 좁은 기기에서는 안쪽 여백·글자가 `scaleActionByWidth`로 함께 줄어든다.
   */
  actionRow: {
    marginTop: LAYOUT.spacingMD,
    minHeight: LAYOUT.learnQuitButtonMinHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: LAYOUT.learnActionRowGap,
  },
  /**
   * 왼쪽 토글. `WordGame` 바닥에 있던 `startButton`을 그대로 옮긴 것이다 —
   * 색·글자·아이콘을 새로 고르지 않았다. 리터럴이던 초록·파랑만 `COLORS`로 옮겼다.
   */
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: LAYOUT.learnQuitButtonMinHeight,
    paddingHorizontal: LAYOUT.learnActionButtonPaddingH,
    borderRadius: 999,
    backgroundColor: COLORS.success,
    gap: LAYOUT.learnActionButtonGap,
    // 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용 앱)
    elevation: 2,
    // 알약 둘이 한 줄이라, 좁아지면 왼쪽이 먼저 줄어 「그만하기」를 밀지 않는다
    flexShrink: 1,
  },
  /** 소리가 나는 동안. 라벨도 「재생 중...」으로 바뀐다 */
  actionButtonPlaying: {
    backgroundColor: COLORS.playingBlue,
  },
  /** 채점을 기다리는 동안(`waitingForNextRound`)의 「다시 듣기」 */
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.learnActionButtonFontSize,
    fontWeight: 'bold',
  },
  quitButton: {
    minHeight: LAYOUT.learnQuitButtonMinHeight,
    paddingHorizontal: LAYOUT.learnQuitButtonPaddingH,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: COLORS.surfaceOnImage,
    borderWidth: 1,
    borderColor: COLORS.border,
    // 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용 앱)
    elevation: 2,
    // 왼쪽 초록이 커도 이 알약은 줄지 않는다 — 글자가 두 줄로 접히지 않게
    flexShrink: 0,
  },
  quitButtonText: {
    fontSize: LAYOUT.learnQuitButtonFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  gameContentInner: {
    flex: 1,
    justifyContent: 'flex-start',
    marginTop: LAYOUT.learnGameContentMarginTop,
  },
  /**
   * 게임 종료 오버레이 — 드럼(`drum/index.tsx`의 gameOverOverlay)과 같은 값.
   * Modal 안이라 절대배치·zIndex가 필요 없다 — 판 전체를 flex로 채운다.
   */
  gameOverOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
