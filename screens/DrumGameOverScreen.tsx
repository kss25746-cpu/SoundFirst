import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text, Pressable, LayoutChangeEvent } from "react-native";
import Rive, { Fit } from "rive-react-native";
import { COLORS } from "../constants/colors";
import { LAYOUT } from "../constants/layout";


interface DrumGameOverScreenProps {
  score: number;
  maxScore: number;
  onRestart: () => void;
  /**
   * 주 버튼 글자. 기본값은 드럼의 「다시 하기」다.
   *
   * learn은 **「확인」**을 넘긴다 — 눌러도 게임이 바로 시작하지 않고 `WordGame`이 다시 마운트돼
   * 「시작하기」로 돌아가므로, 「다시 하기」가 강제처럼 읽혔다 (`doc/learn-그만하기.md`).
   * 하는 일은 양쪽이 같다 — **이름만 다르다.**
   */
  restartLabel?: string;
  /**
   * 결과를 접고 **돌아갈 화면이 있을 때만** 넘긴다. 안 넘기면 「나가기」를 그리지 않는다.
   *
   * 드럼은 퀴즈를 접고 **연주 모드**로 돌아가므로 넘긴다.
   * learn은 탭 전체가 퀴즈라 접고 갈 데가 없어 — 넘기던 함수가 결과창만 닫아
   * **「다시 하기」와 결과가 같았다** (세션 52).
   */
  onGoHome?: () => void;
}

/**
 * 결과 등급. 메시지와 색을 **한 표에** 둔다 — 따로 두면 한쪽만 고쳐져 어긋난다.
 *
 * 색은 밝기가 아니라 **색상(hue)으로** 가른다 (세션 28에 미션 아이콘에서 세운 원칙).
 * 셋 다 **흰 카드 위**에 올라가므로 원색 그대로는 흐리다 — 금 `#FFD700`은 흰 배경에서 2.2:1,
 * 초록 `#7cbd7e`도 2.2:1이라 큰 글씨 기준(3:1)에 못 미친다. 그래서 한 톤씩 내린 값이다.
 */
const RESULT_TIERS = {
  perfect: { message: "완벽해요!", color: "#B8860B" },
  good: { message: "잘했어요!", color: COLORS.successOnWhite },
  tryAgain: { message: "아쉬워요!", color: "#6B7280" },
} as const;

/**
 * 카드·게이지 치수.
 * 카드가 `width: '100%'`뿐이라 태블릿에서는 카드만 넓어지고 게이지는 220px로 남았다.
 * 카드에 상한을 주고, 게이지는 **실측한 카드 폭**을 따라가게 한다.
 */
const CARD_MAX_WIDTH = LAYOUT.isTablet ? 520 : 400;
const CARD_PADDING = LAYOUT.isTablet ? 24 : 20;
const GAUGE_MAX_WIDTH = LAYOUT.isTablet ? 340 : 240;
const GAUGE_MIN_WIDTH = 160;
/** 원본 Rive 아트보드 비율(220 × 40). 폭이 바뀌어도 이 비율을 지킨다. */
const GAUGE_ASPECT = 220 / 40;

/**
 * 만점 콘페티. 카드 폭 실측(`onLayout`)으로 게이지가 다시 그려져도
 * 콘페티가 처음부터 다시 돌지 않게 화면과 나눈다.
 */
const PerfectConfetti = React.memo(function PerfectConfetti() {
  return (
    <View style={styles.confettiOverlay} pointerEvents="none" importantForAccessibility="no">
      <Rive
        resourceName="confetti"
        artboardName="Confetti"
        stateMachineName="State Machine 1"
        autoplay
        fit={Fit.Cover}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

function DrumGameOverScreen({
  score,
  maxScore,
  onRestart,
  restartLabel = "다시 하기",
  onGoHome,
}: DrumGameOverScreenProps) {
  // 점수에 따른 등급(메시지 + 색)
  const clampedMaxScore = Math.max(maxScore, 1);
  // `maxScore`가 0이면 만점이 아니다 — learn 「그만하기」는 **한 문제도 안 푼 채** 접을 수 있어
  // `0/0`이 들어온다. 막지 않으면 콘페티가 깔리고 「완벽해요!」가 뜬다
  const isPerfect = maxScore > 0 && score === maxScore;
  const tier =
    isPerfect
      ? RESULT_TIERS.perfect
      : score >= clampedMaxScore * 0.7
        ? RESULT_TIERS.good
        : RESULT_TIERS.tryAgain;

  // 카드 폭 실측. 이 컴포넌트는 드럼(전체 화면 오버레이)과 learn(페이지 안)에서 함께 쓰는데
  // 두 호스트의 폭이 달라 화면 폭만으로는 못 맞춘다.
  // 소수점 끝자리가 흔들리면 onLayout → 리렌더 → onLayout이 도니 반올림한다 (세션 32).
  const [measuredCardWidth, setMeasuredCardWidth] = useState(0);
  const handleCardLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setMeasuredCardWidth(prev => (prev === width ? prev : width));
  };

  // 실측 전 첫 프레임은 **하한**으로 그린다. 큰 값으로 어림잡으면 폭이 좁은 호스트(learn)에서
  // 한 프레임 동안 게이지가 카드 밖으로 삐져나온다. 작게 시작해 실측 후 커지는 편이 안전하다.
  const gaugeWidth = measuredCardWidth
    ? Math.max(GAUGE_MIN_WIDTH, Math.round(Math.min(measuredCardWidth - CARD_PADDING * 2, GAUGE_MAX_WIDTH)))
    : GAUGE_MIN_WIDTH;
  const gaugeHeight = Math.round(gaugeWidth / GAUGE_ASPECT);

  // Rive 진행 게이지 컨트롤용 ref
  const riveRef = useRef<any>(null);

  // 점수 비율(0~1) → 0~100 구간 값으로 변환
  const targetGaugeValue = (score / clampedMaxScore) * 100;

  // 결과 화면이 열릴 때 게이지가 0 → targetGaugeValue 까지 짧게 차오르게 함
  useEffect(() => {
    if (!riveRef.current) return;

    const duration = 600; // 전체 애니메이션 시간(ms)
    const steps = 30;
    const stepTime = duration / steps;
    const stepDelta = targetGaugeValue / steps;

    let current = 0;
    let cancelled = false;
    let timeoutId: any;

    // 초기값 0으로 리셋
    riveRef.current.setInputState("State Machine 1", "Number 1", 0);

    const tick = () => {
      if (cancelled || !riveRef.current) return;
      current += stepDelta;
      const clamped = Math.min(current, targetGaugeValue);

      riveRef.current.setInputState("State Machine 1", "Number 1", clamped);

      if (clamped < targetGaugeValue) {
        timeoutId = setTimeout(tick, stepTime);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [targetGaugeValue]);

  return (
    <View style={styles.container}>
      <View style={styles.resultWrapper}>
        <View style={styles.resultContent}>


          {/* 점수 카드 */}
          <View style={styles.scoreCard} onLayout={handleCardLayout}>
            {/* 점수와 진행 바를 함께 배치 */}
            <View style={styles.scoreContainer}>


              {/* 점수 진행 바 - Rive 게이지 */}
              <View style={styles.progressBar}>
                <Rive
                  ref={riveRef}
                  resourceName="pro_box33"
                  stateMachineName="State Machine 1"
                  style={{ width: gaugeWidth, height: gaugeHeight }}
                  autoplay
                />
              </View>
              <Text style={styles.scoreMessage}>{tier.message}</Text>
              <Text style={[styles.scoreCombined, { color: tier.color }]}>
                {score}/{maxScore}
              </Text>
            </View>


          </View>

          {/* 버튼 — 주 동작만 채우고, 결과를 닫는 나가기는 아웃라인으로 구분한다.
              `onGoHome`이 없으면 주 버튼 하나가 칸을 채운다 (learn).
              글자는 `restartLabel` — 드럼 「다시 하기」 · learn 「확인」 */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={onRestart}
              accessibilityRole="button"
              accessibilityLabel={restartLabel}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.buttonText}>{restartLabel}</Text>
            </Pressable>

            {onGoHome && (
              <Pressable
                onPress={onGoHome}
                accessibilityRole="button"
                accessibilityLabel="나가기"
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.secondaryButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>나가기</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
      {isPerfect && <PerfectConfetti />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    elevation: 8,
  },
  resultWrapper: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  resultContent: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  scoreCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: CARD_PADDING,
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: "center",
    alignItems: "center",
    // 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용 앱).
    // learn 탭은 배경이 밝아(#F0F2F5) 그림자가 없으면 흰 카드가 배경에 묻으므로
    // 옅은 테두리를 함께 둔다.
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  scoreCombined: {
    marginTop: 16,
    fontSize: LAYOUT.isTablet ? 34 : 28,
    fontWeight: "bold",
    // 색은 등급에 따라 렌더에서 준다 (RESULT_TIERS)
    textAlign: "center",
  },
  scoreContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  scoreMessage: {
    fontSize: LAYOUT.isTablet ? 40 : 32,
    color: COLORS.textPrimary,
    marginTop: 5,
    fontWeight: "bold",
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 15,
    gap: 6,
  },
  buttonContainer: {
    width: "100%",
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: "center",
    gap: 15,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    minHeight: LAYOUT.isTablet ? 92 : 80,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
  },
  buttonText: {
    fontSize: LAYOUT.isTablet ? 24 : 20,
    fontWeight: "bold",
    color: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.successOnWhite,
  },
  pressedButton: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },
});

export default DrumGameOverScreen;
