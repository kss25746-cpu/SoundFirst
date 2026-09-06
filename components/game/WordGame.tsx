import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWordGameLogic, GameState } from '../../hooks/useWordGameLogic';
import { useWordAudioPlayer } from '../../hooks/useWordAudioPlayer';
import { useStopAudioOnBlur } from '../../hooks/useStopAudioOnBlur';
import { WordDifficultyType } from '../../constants/wordSounds';
import { getWordGameMetrics } from '../../constants/layout';

interface AnimatedTapButtonProps {
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly pressedScale?: number;
}

function AnimatedTapButton({
  onPress,
  style,
  children,
  disabled = false,
  pressedScale = 0.97,
}: Readonly<AnimatedTapButtonProps>) {
  const isPressed = useSharedValue(0);

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onBegin(() => {
      isPressed.value = 1;
    })
    .onFinalize(() => {
      isPressed.value = 0;
    })
    .onEnd((_event, success) => {
      if (success && !disabled) {
        runOnJS(onPress)();
      }
    });

  const pressedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(isPressed.value ? pressedScale : 1, {
          damping: 16,
          stiffness: 220,
          mass: 0.9,
        }),
      },
    ],
    opacity: isPressed.value ? 0.88 : 1,
  }));

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[style, pressedAnimatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * **액션줄은 부모(`learn/index.tsx`)가 그리고, 하는 일은 여기서 한다.**
 * 소리·라운드·상태를 이 컴포넌트가 들고 있어서 부모가 직접 할 수 없다
 * (설계: `doc/learn-액션줄.md` · `doc/learn-그만하기.md`).
 */
export interface WordGameRef {
  /** 지금 점수·푼 수로 결과를 낸다. 소리와 다음 문제 타이머를 함께 끊는다 */
  quit: () => void;
  /** 「시작하기」/「계속하기」 — 정답 소리를 틀고 끝나면 선택지를 연다 */
  start: () => void;
  /** 「다시 듣기」 — `answered`일 때만 같은 정답 소리를 다시 튼다 */
  replay: () => void;
}

interface WordGameProps {
  readonly difficulty: WordDifficultyType;
  readonly onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
  readonly onAnswerShown?: () => void;
  /**
   * 라운드·상태·재생 여부 알림. 부모가 **액션줄을 무엇으로 그릴지** 정하는 데 쓴다 —
   * 왼쪽 라벨(시작·계속·다시 듣기·비움)과 「그만하기」 숨김
   * (`round === 1 && 'ready'`이면 숨긴다 — 아직 「시작하기」다).
   *
   * 버튼을 이 컴포넌트 안에 두지 않는 이유는 상태가 넷이라 **자리마다 복제**되기 때문이다.
   * 설계 원문은 `doc/learn-그만하기.md` · `doc/learn-액션줄.md`.
   *
   * `isPlaying`을 위해 **콜백을 하나 더 만들지 않는다** — 이 길에 실어 보낸다.
   *
   * 매 렌더 새로 만들어 넘기면 아래 이펙트가 계속 돈다 — 부모에서 `useCallback`으로 고정한다.
   */
  readonly onProgressChange?: (progress: {
    round: number;
    gameState: GameState;
    isPlaying: boolean;
  }) => void;
}

function WordGameInner(
  { difficulty = 'easy', onGameComplete, onAnswerShown, onProgressChange }: Readonly<WordGameProps>,
  ref: React.Ref<WordGameRef>,
) {
  const { width, height } = useWindowDimensions();
  const metrics = getWordGameMetrics(width, height);
  const gameLogic = useWordGameLogic({ difficulty, onGameComplete });
  const audioPlayer = useWordAudioPlayer();
  const isMountedRef = useRef(true);

  const {
    currentWordPair,
    correctWord,
    correctSound,
    gameState,
    showFeedback,
    feedbackMessage,
    selectedAnswer,
    isLastAnswerCorrect,
    round,
    handleAnswer,
    resetGame,
    startPlaying,
    setAnswered,
    endGameEarly,
    clearNextRoundTimer,
  } = gameLogic;

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      audioPlayer.stopSound();
    };
  }, []);

  // 🎧 탭을 떠날 때 단어 소리와 다음 문제 타이머를 끊는다.
  // 탭은 언마운트되지 않으므로 위 언마운트 클린업은 탭 전환 때 실행되지 않는다.
  // (`learn/index.tsx`가 블러에서 난이도를 'easy'로 되돌리면 아래 이펙트가 stopSound를 부르지만,
  //  이미 'easy'였으면 값이 그대로라 이펙트가 다시 돌지 않아 소리가 남았다)
  useStopAudioOnBlur(() => {
    audioPlayer.stopSound();
    clearNextRoundTimer();

    // 재생을 끊으면 '재생 완료' 콜백(:138)도 오지 않아 gameState가 'playing'에 갇힌다.
    // '듣는 중...' 화면에는 버튼이 없어(:218) 스스로 빠져나올 수 없으므로 선택지 화면으로 넘겨 둔다.
    // 문제·점수·라운드는 그대로이고, 돌아와서 '다시 듣기'로 같은 문제를 다시 들을 수 있다.
    if (gameState === 'playing') {
      setAnswered();
    } else if (gameState === 'waitingForNextRound') {
      // 타이머만 끊고 여기 두면 채점 빗장이 잠긴 채 피드백에 굳는다.
      // 다음 문제·결과는 나가지 않는다 — 마지막 라운드였다면 다른 탭에서 결과 창이 떴다.
      resetGame();
    }
  });

  // 난이도 변경 시 게임 리셋
  useEffect(() => {
    audioPlayer.stopSound();
    resetGame();
  }, [difficulty, resetGame]);

  // 라운드·상태·재생 여부가 바뀔 때마다 부모에게 알린다. 부모는 이것으로 액션줄을 그린다
  useEffect(() => {
    onProgressChange?.({ round, gameState, isPlaying: audioPlayer.isPlaying });
  }, [round, gameState, audioPlayer.isPlaying, onProgressChange]);

  // 답안 표시 시 스크롤
  useEffect(() => {
    if (gameState === 'answered' && onAnswerShown) {
      setTimeout(() => {
        onAnswerShown();
      }, 100);
    }
  }, [gameState, onAnswerShown]);

  const handleStartGame = () => {
    if (!currentWordPair || !correctSound) return;

    startPlaying();

    // 음성 즉시 재생
    audioPlayer.playWordSound(
      correctSound,
      currentWordPair[correctWord!],
      () => {
        if (isMountedRef.current) {
          setAnswered();
        }
      }
    );
  };

  const handleChoicePress = (word: string) => {
    if (gameState === 'answered') {
      handleAnswer(word);
    }
  };

  const handleReplaySound = () => {
    if (gameState === 'answered' && correctSound && currentWordPair && correctWord) {
      audioPlayer.playWordSound(correctSound, currentWordPair[correctWord]);
    }
  };

  /**
   * 액션줄 셋(시작·다시 듣기·그만하기)이 **부르는 길**이다. 버튼은 부모가 그리지만
   * 소리·타이머·라운드는 여기 있으므로 **본문은 그대로 두고 자리만 넘긴다.**
   *
   * 「그만하기」는 오디오를 여기서 끊고, 타이머 취소와 결과 통보는 훅(`endGameEarly`)이 한다.
   * 결과가 뜨면 부모가 이 컴포넌트를 언마운트하므로 `gameState`를 따로 되돌리지 않는다.
   *
   * 의존성 배열을 두지 않아 **매 렌더 최신 클로저**로 갱신한다 — `stopSound`도,
   * `handleStartGame`·`handleReplaySound`가 읽는 문제·상태도 매 렌더 새 값이다.
   */
  useImperativeHandle(ref, () => ({
    quit: () => {
      audioPlayer.stopSound();
      endGameEarly();
    },
    start: handleStartGame,
    replay: handleReplaySound,
  }));

  const getChoiceFeedbackStyle = (word: string): ViewStyle[] => {
    if (!selectedAnswer || !correctWord || !currentWordPair) {
      return [];
    }

    const correctWordText = currentWordPair[correctWord];
    const feedbackStyles: ViewStyle[] = [];

    if (word === correctWordText) {
      feedbackStyles.push(styles.choiceButtonCorrect);
    }

    if (selectedAnswer === word && isLastAnswerCorrect === false) {
      feedbackStyles.push(styles.choiceButtonWrong);
    }

    if (selectedAnswer !== word && word !== correctWordText) {
      feedbackStyles.push(styles.choiceButtonDimmed);
    }

    return feedbackStyles;
  };

  if (!currentWordPair) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>게임을 준비하는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 게임 상태에 따른 UI */}
      <View style={styles.gameContentArea}>
        {gameState === 'ready' && (
          <View
            style={[
              styles.readyContainer,
              {
                paddingTop: Math.round(metrics.contentTopPadding * 0.4),
                paddingBottom: metrics.contentBottomPadding,
              },
            ]}
          >
            {/* 「시작하기」/「계속하기」는 여기 없다 — 난이도 아래 **액션줄**이 그린다
                (`app/(tabs)/learn/index.tsx` · 설계 `doc/learn-액션줄.md`).
                누름은 `WordGameRef.start`로 이 컴포넌트에 돌아온다 */}
            <Text style={styles.readyTitle}>준비되셨나요?</Text>
          </View>
        )}

        {gameState === 'playing' && (
          <View style={styles.playingContainer}>
            <Ionicons name="volume-high" size={80} color="#706c6c" />
            <Text style={styles.playingText}>듣는 중...</Text>
     
          </View>
        )}

        {/* answered 또는 waitingForNextRound: 퀴즈 화면 유지, 선택지 위치는 고정, 피드백은 오버레이로 표시 */}
        {(gameState === 'answered' || gameState === 'waitingForNextRound') && (
          <View
            style={[
              styles.answeredContainer,
              {
                paddingTop: metrics.contentTopPadding,
                paddingBottom: metrics.contentBottomPadding,
              },
            ]}
          >
            {showFeedback && (
              <View style={styles.feedbackFloating}>
                <Text style={styles.feedbackText}>{feedbackMessage}</Text>
              </View>
            )}

            <View style={styles.choicesContainer}>
              <AnimatedTapButton
                style={[
                  styles.choiceButton,
                  { paddingVertical: metrics.choiceVerticalPadding },
                  ...getChoiceFeedbackStyle(currentWordPair.word1),
                ]}
                onPress={() => handleChoicePress(currentWordPair.word1)}
                disabled={gameState !== 'answered'}
                pressedScale={0.96}
              >
                <Text style={[styles.choiceText, { fontSize: metrics.choiceTextSize }]}>{currentWordPair.word1}</Text>
              </AnimatedTapButton>

              <AnimatedTapButton
                style={[
                  styles.choiceButton,
                  { paddingVertical: metrics.choiceVerticalPadding },
                  ...getChoiceFeedbackStyle(currentWordPair.word2),
                ]}
                onPress={() => handleChoicePress(currentWordPair.word2)}
                disabled={gameState !== 'answered'}
                pressedScale={0.96}
              >
                <Text style={[styles.choiceText, { fontSize: metrics.choiceTextSize }]}>{currentWordPair.word2}</Text>
              </AnimatedTapButton>
            </View>
            {/* 「다시 듣기」도 여기 없다 — 액션줄이 그리고 `WordGameRef.replay`로 돌아온다.
                바닥에 두던 자리는 탭바가 덮던 자리다 (세션 61) */}
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `flex: 1`이 이 화면의 뿌리다. 전에는 없어서 **남은 칸을 받는 경로가 아예 없었고**,
   * 높이가 내용과 `minHeight`로만 정해져 위에서 깎인 만큼 아래로 넘쳤다.
   * 부모 `learn/index.tsx`의 `gameContentInner`가 `flex: 1`이라 여기서 받으면 된다.
   */
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  /**
   * `minHeight: 400`이었다. 창 전체 높이와 무관한 고정값이라 짧은 폰에서
   * **남은 칸(360×640에서 ≈156)을 244px 넘겼다.** 뿌리가 `flex: 1`이 된 지금은
   * 부모가 준 칸을 그대로 채우면 되므로 하한이 필요 없다 — 하한을 남기면
   * 그게 다시 넘침의 원인이 된다.
   */
  gameContentArea: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readyContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 0,
  },
  // ── 여기 **없는** 것: 바닥에 붙던 래퍼 둘(`readyActionWrapper`·`replayWrapper`)과
  //    초록 알약(`startButton`·`startButtonPlaying`·`startButtonText`).
  //    버튼이 액션줄로 올라갔으므로 그리는 곳도, 스타일도 부모가 갖는다.
  //    `marginTop: 'auto'`도 함께 사라졌다 — 바닥에 붙일 것이 없다.
  volumeHint: {
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '600',
  },
  playingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // center → flex-start
    paddingTop: 20,               // 필요에 따라 10~40 조절
  },
  playingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },

  answeredContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  choicesContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 15,
  },
  choiceButton: {
    flex: 1,
    backgroundColor: '#52abf2',
    paddingHorizontal: 30,
    borderRadius: 18,
    alignItems: 'center',
    elevation: 3,
  },
  choiceButtonCorrect: {
    backgroundColor: '#4CAF50',
  },
  choiceButtonWrong: {
    backgroundColor: '#E53935',
  },
  choiceButtonDimmed: {
    opacity: 0.75,
  },
  choiceText: {
    color: 'white',
    fontWeight: 'bold',
  },
  feedbackFloating: {
    position: 'absolute',
    top: -75,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 24,
  
  },
});

export const WordGame = forwardRef<WordGameRef, WordGameProps>(WordGameInner);

export default WordGame;

