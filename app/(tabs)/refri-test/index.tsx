import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Modal,
  type LayoutChangeEvent,
} from "react-native";
import { LAYOUT } from "../../../constants/layout";
import { COLORS } from "../../../constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import Rive from "rive-react-native";
import StarIcon from "../../../assets/icons/star.svg";
import RefriStartBtn from "../../../assets/icons/refri_start_btnco1.svg";
import { MONO_ITEMS, type MonoItem } from "../../../constants/refriItems";
import { useStopAudioOnBlur } from "../../../hooks/useStopAudioOnBlur";
import * as Haptics from "expo-haptics";

const REFRI_RIVE_AVAILABLE = true;
const REFRI_SCENE_MAX_H =
  LAYOUT.screenHeight * LAYOUT.refriSceneHeightRatio;

type QuizItem = MonoItem;
const CARD_SLOTS = 6;
const MAX_ABSORB = 6; // Rive 용기 최대 개수

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type RefriState = "closed" | "open";

export default function RefriTestScreen() {
  const insets = useSafeAreaInsets();
  /** 냉장고 칸의 실측 높이. 상한은 `REFRI_SCENE_MAX_H`. 짧은 폰만 더 작다. */
  const [sceneSlotH, setSceneSlotH] = useState(REFRI_SCENE_MAX_H);
  const sceneScale =
    sceneSlotH < REFRI_SCENE_MAX_H ? sceneSlotH / REFRI_SCENE_MAX_H : 1;
  const onSceneSlotLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setSceneSlotH((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
  }, []);
  const [remainingIds, setRemainingIds] = useState<string[]>(() =>
    MONO_ITEMS.map((i) => i.id),
  );
  const [slotItems, setSlotItems] = useState<(QuizItem | null)[]>(() =>
    new Array(CARD_SLOTS).fill(null),
  );
  const [currentState, setCurrentState] = useState<RefriState>("closed");
  const [currentQuiz, setCurrentQuiz] = useState<QuizItem>(MONO_ITEMS[0]);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  /** 다음 문항을 세울 때까지의 구간. 이 동안 「다시 듣기」는 잠근다 */
  const [isRoundLoading, setIsRoundLoading] = useState(false);

  /**
   * 애니메이션 잠금은 **ref로 든다.** state로 두면 550ms·250ms 타이머 콜백이
   * 누른 시점 렌더의 옛 값을 보고 서로의 잠금을 먼저 푼다.
   */
  const isAnimatingRef = useRef(false);

  // Rive absorbAmount: 문제수÷6 = 용기당 문제수 → correctCount 기준 0~6
  const totalProblems = MONO_ITEMS.length;
  const absorbAmount = Math.min(
    MAX_ABSORB,
    Math.floor((correctCount / totalProblems) * MAX_ABSORB),
  );
  const totalAttempts = correctCount + wrongCount;
  const correctRate =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;

  // 애니메이션 값
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const gaugeBlink = useRef(new Animated.Value(1)).current;
  const blinkLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  /** 완료화면 별 루프 4개. 참조를 안 들면 「다시 하기」마다 루프가 쌓인다 */
  const starLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  /** 예약한 타이머를 모아 둔다 (`matchGame`과 같은 방식) */
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 버튼 애니메이션 값들 제거 (단순 TouchableOpacity 사용)

  // 상자 애니메이션 값들 (4개 상자)
  const crateOpacities = useRef([
    new Animated.Value(1), // 왼쪽 아래
    new Animated.Value(1), // 왼쪽 위
    new Animated.Value(1), // 오른쪽 아래
    new Animated.Value(1), // 오른쪽 위
  ]).current;

  const crateScales = useRef([
    new Animated.Value(1), // 왼쪽 아래
    new Animated.Value(1), // 왼쪽 위
    new Animated.Value(1), // 오른쪽 아래
    new Animated.Value(1), // 오른쪽 위
  ]).current;

  // 별 애니메이션 (메인 별 + 반짝임 3개)
  const starMainScale = useRef(new Animated.Value(0.9)).current;
  const starMainOpacity = useRef(new Animated.Value(0.8)).current;
  const sparkle1Scale = useRef(new Animated.Value(0)).current;
  const sparkle1Opacity = useRef(new Animated.Value(0)).current;
  const sparkle2Scale = useRef(new Animated.Value(0)).current;
  const sparkle2Opacity = useRef(new Animated.Value(0)).current;
  const sparkle3Scale = useRef(new Animated.Value(0)).current;
  const sparkle3Opacity = useRef(new Animated.Value(0)).current;

  /** 별 루프를 멈추고 값도 처음으로 되돌린다 */
  const stopStarAnimation = () => {
    starLoopsRef.current.forEach((loop) => loop.stop());
    starLoopsRef.current = [];
    starMainScale.setValue(0.9);
    starMainOpacity.setValue(0.8);
    sparkle1Scale.setValue(0);
    sparkle1Opacity.setValue(0);
    sparkle2Scale.setValue(0);
    sparkle2Opacity.setValue(0);
    sparkle3Scale.setValue(0);
    sparkle3Opacity.setValue(0);
  };

  // 별 애니메이션 시작
  const startStarAnimation = useCallback(() => {
    // 메인 별 pulse 애니메이션 (2초 주기)
    const mainPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(starMainScale, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(starMainOpacity, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(starMainScale, {
            toValue: 0.9,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(starMainOpacity, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 1 (0.2초 딜레이)
    const sparkle1Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(sparkle1Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle1Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle1Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle1Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 2 (0.7초 딜레이)
    const sparkle2Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(sparkle2Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle2Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle2Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle2Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 반짝임 3 (1.2초 딜레이)
    const sparkle3Blink = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(sparkle3Scale, {
            toValue: 1.2,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle3Opacity, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(sparkle3Scale, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(sparkle3Opacity, {
            toValue: 0,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    // 남아 있던 루프를 먼저 걷어낸다 — 안 그러면 「다시 하기」마다 쌓인다
    stopStarAnimation();
    starLoopsRef.current = [
      mainPulse,
      sparkle1Blink,
      sparkle2Blink,
      sparkle3Blink,
    ];
    starLoopsRef.current.forEach((loop) => loop.start());
  }, [
    starMainScale,
    starMainOpacity,
    sparkle1Scale,
    sparkle1Opacity,
    sparkle2Scale,
    sparkle2Opacity,
    sparkle3Scale,
    sparkle3Opacity,
  ]);

  // 퀴즈 카드 애니메이션 (정답 흡입) — MONO_ITEMS 6개 모두
  const answerAnimations = useRef(
    MONO_ITEMS.reduce(
      (acc, item) => {
        acc[item.id] = {
          translateX: new Animated.Value(0),
          translateY: new Animated.Value(0),
          scale: new Animated.Value(1),
          opacity: new Animated.Value(1),
        };
        return acc;
      },
      {} as Record<
        string,
        {
          translateX: Animated.Value;
          translateY: Animated.Value;
          scale: Animated.Value;
          opacity: Animated.Value;
        }
      >,
    ),
  ).current;

  const fridgeRef = useRef<View | null>(null);
  const answerRefs = useRef<Record<string, View | null>>({});
  const remainingIdsRef = useRef<string[]>(remainingIds);

  /**
   * 문제음 재생용 **상주 플레이어 하나**. 문항마다 만들고 버리지 않고 음원만 갈아끼운다.
   * 화면을 벗어나도 해제하지 않는다 — 다시 들어올 때의 첫 소리 지연을 만들지 않기 위해서다.
   */
  const soundRef = useRef<AudioPlayer | null>(null);

  /** 상주 플레이어를 처음 쓸 때 한 번만 만든다 */
  const ensurePlayer = (): AudioPlayer => {
    if (!soundRef.current) {
      soundRef.current = createAudioPlayer(null, { updateInterval: 500 });
    }
    return soundRef.current;
  };
  const riveRef = useRef<any>(null);

  useEffect(() => {
    remainingIdsRef.current = remainingIds;
  }, [remainingIds]);

  // ❄️ 탭을 떠날 때 울리던 소리를 끊는다.
  // 탭은 언마운트되지 않으므로 아래 언마운트 클린업(remove)은 탭 전환 때 실행되지 않는다.
  // 해제하지 않고 멈추기만 해서 '다시 듣기'가 그대로 동작하도록 둔다.
  const isScreenFocused = useStopAudioOnBlur(() => {
    try {
      soundRef.current?.pause();
    } catch (error) {}
  });

  // Rive 문 직접 제어 (stale closure 우회)
  const setRiveDoor = (isOpen: boolean) => {
    if (riveRef.current) {
      riveRef.current.setInputState("Refri_SM", "isOpen", isOpen);
    }
  };

  // Rive absorbAmount 동기화 (0~6)
  useEffect(() => {
    if (riveRef.current) {
      riveRef.current.setInputState("Refri_SM", "absorbAmount", absorbAmount);
    }
  }, [absorbAmount]);

  useEffect(() => {
    // 오디오 모드는 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
    return () => {
      if (soundRef.current) {
        try {
          soundRef.current.remove();
        } catch (error) {}
        // 해제한 플레이어를 계속 붙들고 있으면 다음 재생 때 죽은 플레이어를 건드린다
        soundRef.current = null;
      }
      if (blinkLoopRef.current) {
        blinkLoopRef.current.stop();
      }
      starLoopsRef.current.forEach((loop) => loop.stop());
      starLoopsRef.current = [];
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current.length = 0;
    };
  }, []);

  // 상태 전환 애니메이션 (정답: 냉장고 열림)
  const switchState = useCallback(
    (newState: RefriState) => {
      if (newState === currentState) return;
      if (isAnimatingRef.current) return;

      isAnimatingRef.current = true;
      setCurrentState(newState);

      // Rive 애니메이션 제어
      if (riveRef.current) {
        const isOpen = newState === "open";
        riveRef.current.setInputState("Refri_SM", "isOpen", isOpen);
      }

      // Rive 애니메이션 완료 후 잠금 해제 (열림/닫힘 약 500ms)
      const doorTimer = setTimeout(() => {
        isAnimatingRef.current = false;
      }, 550);
      timerRefs.current.push(doorTimer);
    },
    [currentState],
  );

  // 흔들림 애니메이션 (오답 효과)
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);

    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 12,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -12,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 3,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  // 바운스 애니메이션 (정답 축하 효과)
  const triggerBounce = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimatingRef.current = false;
    });
  }, [scaleAnim]);

  const stopGaugeBlink = () => {
    gaugeBlink.setValue(1);
    if (blinkLoopRef.current) {
      blinkLoopRef.current.stop();
      blinkLoopRef.current = null;
    }
  };

  const startGaugeBlink = () => {
    stopGaugeBlink();
    blinkLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(gaugeBlink, {
          toValue: 0.45,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(gaugeBlink, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
      ]),
    );
    blinkLoopRef.current.start();
  };

  const setGaugeToValue = (value: number) => {
    const v = Math.min(100, Math.max(0, value));
    setGauge(v);
    Animated.timing(gaugeAnim, {
      toValue: v,
      duration: 220,
      useNativeDriver: false,
    }).start();
    updateCrateVisibility(v);
    if (v >= 100) startGaugeBlink();
    else stopGaugeBlink();
  };

  // 상자 가시성 업데이트 함수
  const updateCrateVisibility = (currentGauge: number) => {
    // 4개 상자가 25%, 50%, 75%, 100%에서 각각 사라짐
    const crateThresholds = [25, 50, 75, 100];

    crateThresholds.forEach((threshold, index) => {
      if (currentGauge >= threshold) {
        // 상자 사라짐 애니메이션 (scale + opacity)
        Animated.parallel([
          Animated.timing(crateOpacities[index], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(crateScales[index], {
            toValue: 0.3,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]).start();
      }
    });
  };

  const resetAnswerAnimations = () => {
    MONO_ITEMS.forEach((item) => {
      const anim = answerAnimations[item.id];
      if (anim) {
        anim.translateX.setValue(0);
        anim.translateY.setValue(0);
        anim.scale.setValue(1);
        anim.opacity.setValue(1);
      }
    });
  };

  // 버튼 애니메이션 함수들 제거 (단순 TouchableOpacity activeOpacity 사용)

  const playSound = async (item: QuizItem) => {
    if (!item.sound) return;
    // 정답 뒤 다음 문제는 애니메이션이 끝난 뒤 타이머로 예약된다(`applyCorrectAndNext`).
    // 그 사이에 탭을 떠났다면 다른 탭에서 소리가 울리므로 재생하지 않는다.
    if (!isScreenFocused.current) {
      // 조용히 return하면 "문제는 넘어갔는데 소리가 안 난다"의 원인을 찾기 어렵다.
      // 탭을 떠난 동안에만 찍히므로 평소에는 나오지 않는다.
      console.warn("❄️ 포커스를 잃은 상태라 재생을 건너뜀");
      return;
    }

    try {
      // 상주 플레이어의 음원만 갈아끼운다.
      // 재생마다 `remove()` + `createAudioPlayer()`를 하면 앞 플레이어를 네이티브에서
      // 정리하는 도중에 새 플레이어가 재생을 시작하게 되고, 가끔 그 소리가 통째로 누락된다.
      // (20문항 중 2~3개가 무작위로 안 들리던 원인. 드럼 풀·단어 캐시와 같은 해법이다)
      const player = ensurePlayer();
      player.replace(item.sound);
      player.volume = 1.0;
      player.play();
    } catch (error) {
      console.warn("사운드 재생 실패", error);
    }
  };

  const pickRandomAndPlay = useCallback(async (pool: string[]) => {
    if (pool.length === 0) return;
    const items = pool
      .map((id) => MONO_ITEMS.find((i) => i.id === id))
      .filter((x): x is QuizItem => x != null);
    const shuffled = shuffle(items);
    const slots: (QuizItem | null)[] = [];
    const slotCount = Math.min(CARD_SLOTS, shuffled.length);
    for (let i = 0; i < CARD_SLOTS; i++)
      slots.push(i < shuffled.length ? shuffled[i] : null);
    const next = shuffled[Math.floor(Math.random() * slotCount)];

    // 문을 닫고 다음 문항을 세울 때까지 「다시 듣기」를 잠근다.
    // 안 잠그면 아직 갈아끼우지 않은 `currentQuiz`의 소리가 난다 —
    // 첫 라운드는 `MONO_ITEMS[0]`(아스파라거스), 그 뒤로는 직전 문항이다.
    setIsRoundLoading(true);
    setRiveDoor(false);
    setCurrentState("closed");
    isAnimatingRef.current = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    isAnimatingRef.current = false;

    // 상태 전환은 대기가 끝난 뒤에 몰아서 한다
    resetAnswerAnimations();
    setIsAnswerLocked(false);
    setSlotItems(slots);
    setCurrentQuiz(next);
    setIsRoundLoading(false);
    await playSound(next);
  }, []);

  const startGame = useCallback(async () => {
    // 첫 라운드를 세우는 600ms 동안 시작 버튼이 아직 보인다
    if (isRoundLoading) return;
    Haptics.selectionAsync().catch(() => {});
    setIsGameStarted(true);
    await pickRandomAndPlay(remainingIds);
  }, [isRoundLoading, pickRandomAndPlay, remainingIds]);

  const handleReplay = async () => {
    // 준비 중에는 `currentQuiz`가 아직 이번 문항이 아니다
    if (isRoundLoading) return;
    await playSound(currentQuiz); // 다시 듣기
  };

  // 게임 리셋 함수
  const resetGame = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    // 예약된 타이머와 별 루프를 먼저 걷어낸다 — 안 그러면 다시 할 때마다 쌓인다
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current.length = 0;
    stopStarAnimation();

    // 게이지 초기화
    setGauge(0);
    gaugeAnim.setValue(0);
    stopGaugeBlink(); //

    // 냉장고 상태 초기화
    setCurrentState("closed");
    if (riveRef.current) {
      riveRef.current.setInputState("Refri_SM", "isOpen", false);
      riveRef.current.setInputState("Refri_SM", "absorbAmount", 0);
    }

    // 상자 초기화 (모든 상자 다시 보이기)
    crateOpacities.forEach((opacity) => {
      opacity.setValue(1);
    });
    crateScales.forEach((scale) => {
      scale.setValue(1);
    });

    // 퀴즈 상태 초기화
    resetAnswerAnimations();
    isAnimatingRef.current = false;
    setIsAnswerLocked(false);
    setIsRoundLoading(false);
    setIsGameStarted(false);
    setIsGameComplete(false);
    setCorrectCount(0);
    setWrongCount(0);
    setRemainingIds(MONO_ITEMS.map((i) => i.id));
    setSlotItems(new Array(CARD_SLOTS).fill(null));
    setCurrentQuiz(MONO_ITEMS[0]);
  }, [gaugeAnim]);

  const applyCorrectAndNext = (id: string) => {
    const current = remainingIdsRef.current;
    const nextRemaining = current.filter((i) => i !== id);
    setRemainingIds(nextRemaining);
    const solvedCount = MONO_ITEMS.length - nextRemaining.length;
    setCorrectCount(solvedCount);
    setGaugeToValue((solvedCount / MONO_ITEMS.length) * 100);
    if (nextRemaining.length === 0) {
      // 6용기 상태를 잠깐 보여준 뒤 결과 메시지 표시
      const showResultDelay = 800;
      const resultTimer = setTimeout(() => {
        resetAnswerAnimations();
        setIsAnswerLocked(false);
        setIsGameComplete(true);
        startStarAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, showResultDelay);
      timerRefs.current.push(resultTimer);
    } else {
      // 100ms 대기 구간까지 「다시 듣기」를 덮는다
      setIsRoundLoading(true);
      const nextTimer = setTimeout(() => pickRandomAndPlay(nextRemaining), 100);
      timerRefs.current.push(nextTimer);
    }
  };

  const animateCorrectAnswer = (id: string) => {
    const ref = answerRefs.current[id];
    if (!ref || !fridgeRef.current) {
      triggerBounce();
      applyCorrectAndNext(id);
      return;
    }

    ref.measure((ax, ay, aw, ah, aPageX, aPageY) => {
      fridgeRef.current?.measure((fx, fy, fw, fh, fPageX, fPageY) => {
        const moveX = fPageX + fw / 2 - (aPageX + aw / 2);
        const moveY = fPageY + fh / 2 - (aPageY + ah / 2);
        const anim = answerAnimations[id];

        Animated.parallel([
          Animated.timing(anim.translateX, {
            toValue: moveX,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: moveY,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.scale, {
            toValue: 0.3,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 520,
            useNativeDriver: true,
          }),
        ]).start(() => {
          applyCorrectAndNext(id);
        });
      });
    });
  };

  const handleSelectAnswer = (item: QuizItem) => {
    if (!isGameStarted) return;
    if (isAnswerLocked) return;
    setIsAnswerLocked(true);
    const isCorrect = item.id === currentQuiz.id;
    if (isCorrect) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // 타이밍 맞춰 문 열기 → 카드 흡입 (Rive 문 애니메이션과 부드럽게 연결)
      switchState("open");
      const absorbTimer = setTimeout(() => {
        animateCorrectAnswer(item.id);
      }, 250);
      timerRefs.current.push(absorbTimer);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // 오답: 오답 횟수 증가 + 냉장고 흔들림 + 해당 카드 바운스 후 다시 선택 가능
      setWrongCount((prev) => prev + 1);
      const shakeTimer = setTimeout(() => {
        triggerShake();
      }, 200);
      timerRefs.current.push(shakeTimer);
      // 카드 제자리 바운스
      const anim = answerAnimations[item.id];
      if (anim) {
        Animated.sequence([
          Animated.timing(anim.scale, {
            toValue: 1.12,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.spring(anim.scale, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
      const unlockTimer = setTimeout(() => setIsAnswerLocked(false), 700);
      timerRefs.current.push(unlockTimer);
    }
  };

  const gaugeColor = () => {
    if (gauge >= 100) return "#F44336";
    if (gauge >= 90) return "#FB8C00";
    if (gauge >= 70) return "#43A047";
    return "#66BB6A";
  };

  const gaugeWidth = gaugeAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  // 배경 렌더링 (고정, 흔들림 없음)
  const renderBackground = () => {
    if (!REFRI_RIVE_AVAILABLE) {
      return (
        <View
          style={{
            width: LAYOUT.refriRiveWidth,
            height: LAYOUT.refriRiveHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        >
          <Text style={{ color: "#888", fontSize: 12 }}>배경 리소스 없음</Text>
          <Text style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
            refri_bg.riv
          </Text>
        </View>
      );
    }
    return (
      <Rive
        resourceName="refri_bg"
        style={{ width: LAYOUT.refriRiveWidth, height: LAYOUT.refriRiveHeight }}
        autoplay={false}
      />
    );
  };

  // 냉장고 렌더링 (State Machine 포함, shake 적용 대상)
  const renderFridge = () => {
    if (!REFRI_RIVE_AVAILABLE) {
      return (
        <View
          style={{
            width: LAYOUT.refriRiveWidth,
            height: LAYOUT.refriRiveHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        >
          <Text style={{ color: "#888", fontSize: 12 }}>리소스 없음</Text>
          <Text style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
            refribon.riv
          </Text>
        </View>
      );
    }
    return (
      <Rive
        ref={riveRef}
        resourceName="refrigerator_obj"
        stateMachineName="Refri_SM"
        style={{ width: LAYOUT.refriRiveWidth, height: LAYOUT.refriRiveHeight }}
        autoplay={false}
      />
    );
  };

  const CRATE_IMAGE = require("../../../assets/refri/crate_tall2x.webp");

  // 상자 렌더링 함수 (위→아래 순서: 3,2,1,0)
  const renderCrates = () => (
    <View style={styles.cratesContainer}>
      <View style={styles.leftCrateStack}>
        {[3, 2, 1, 0].map((idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.crateWrapper,
              {
                opacity: crateOpacities[idx],
                transform: [{ scale: crateScales[idx] }],
              },
            ]}
          >
            <Image source={CRATE_IMAGE} style={styles.crateBox} />
          </Animated.View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 게이지 — 항상 표시 (시작 전 0%, 시작 후 진행률) */}
      <View style={styles.gaugeSection}>
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeTrack}>
            {/* 단계별 구분선 */}
            <View style={[styles.gaugeMilestone, { left: "70%" }]}>
              <View
                style={[styles.milestoneIcon, { backgroundColor: "#43A047" }]}
              />
            </View>
            <View style={[styles.gaugeMilestone, { left: "90%" }]}>
              <View
                style={[styles.milestoneIcon, { backgroundColor: "#FB8C00" }]}
              />
            </View>

            <Animated.View
              style={[
                styles.gaugeFill,
                {
                  width: gaugeWidth,
                  backgroundColor: gaugeColor(),
                  opacity: gauge >= 100 ? gaugeBlink : 1,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* 냉장고 + 상자 표시 영역 */}
      <View
        style={[
          styles.refriContainer,
          sceneScale < 1 ? styles.refriContainerClip : null,
        ]}
        ref={fridgeRef}
        onLayout={onSceneSlotLayout}
      >
        <View
          style={[
            styles.refriWithCratesWrapper,
            sceneScale < 1 ? { transform: [{ scale: sceneScale }] } : null,
          ]}
        >
          {/* 상자들 (먼저 렌더링 = 뒤에 표시) */}
          {renderCrates()}

          {/* 배경 (고정, 흔들림 없음) */}
          <View style={styles.backgroundWrapper}>{renderBackground()}</View>

          {/* 냉장고 (State Machine 포함, shake 적용) */}
          <Animated.View
            style={[
              styles.fridgeWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
              },
            ]}
          >
            {renderFridge()}
          </Animated.View>
        </View>
      </View>

      {/* 게임 완료 화면 — 뒤로가기로도 닫히도록 `Modal`이다 (익힘모달과 같은 갈래) */}
      <Modal
        visible={isGameComplete}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={resetGame}
      >
        <View style={styles.completeOverlay}>
          <View style={styles.completeBox}>
            <View style={styles.completeEmoji}>
              <Animated.View
                style={{
                  transform: [{ scale: starMainScale }],
                  opacity: starMainOpacity,
                }}
              >
                <StarIcon
                  width={LAYOUT.refriCompleteEmojiFontSize}
                  height={LAYOUT.refriCompleteEmojiFontSize}
                />
              </Animated.View>

              {/* 반짝임 1 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    top: "15%",
                    left: "20%",
                    transform: [{ scale: sparkle1Scale }],
                    opacity: sparkle1Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>

              {/* 반짝임 2 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    top: "10%",
                    right: "20%",
                    transform: [{ scale: sparkle2Scale }],
                    opacity: sparkle2Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>

              {/* 반짝임 3 */}
              <Animated.View
                style={[
                  styles.sparkleIcon,
                  {
                    bottom: "25%",
                    right: "15%",
                    transform: [{ scale: sparkle3Scale }],
                    opacity: sparkle3Opacity,
                  },
                ]}
              >
                <View style={styles.sparkleShape} />
              </Animated.View>
            </View>
            <Text style={styles.completeTitle}>모두 완료!</Text>

            <Text style={styles.completeStats}>정답률: {correctRate}%</Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={resetGame}
              activeOpacity={0.88}
            >
              <Ionicons
                name="refresh"
                size={LAYOUT.refriReplayIconSize}
                color="white"
              />
              <Text style={styles.completeButtonText}>다시 하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 정답 카드 6슬롯 — 선반(Tray) 위에 배치 */}
      <View style={styles.answersContainer}>
        {slotItems.map((item, i) => {
          const cardWidth = LAYOUT.refriAnswerCardWidth;
          if (item == null) {
            return null;
          }
          const anim = answerAnimations[item.id];
          if (!anim)
            return <View key={`slot-${i}`} style={{ width: cardWidth }} />;
          return (
            <View
              key={`slot-${i}`}
              ref={(node) => {
                answerRefs.current[item.id] = node;
              }}
              collapsable={false}
              style={{ width: cardWidth }}
            >
              <Animated.View
                style={[
                  styles.answerCard,
                  {
                    transform: [
                      { translateX: anim.translateX },
                      { translateY: anim.translateY },
                      { scale: anim.scale },
                    ],
                    opacity: anim.opacity,
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.answerInner, { width: cardWidth }]}
                  activeOpacity={0.88}
                  onPress={() => handleSelectAnswer(item)}
                  disabled={isAnswerLocked}
                >
                  <Image
                    source={item.imageSource}
                    style={styles.answerImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.answerLabel}>{item.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        })}

        {/* 다시 듣기 (게임 중일 때만) — **선반 안**에 절대배치한다.
            화면 바닥을 기준으로 두면 `refriTrayPaddingBottom`(선반 안쪽 값)과
            **기준이 갈린다.** 세로 스택(게이지·냉장고·선반)에 `flex: 1`이 없어
            남는 높이가 선반 아래에 남고, 그만큼 버튼이 칸 밖으로 내려갔다
            (411×868은 +7~31이라 티가 덜 났고 태블릿은 계산상 +212다).
            선반의 자식이면 `bottom`이 그 88 칸을 바로 가리킨다. */}
        {isGameStarted && (
          <View
            style={[
              styles.floatingReplayWrap,
              { bottom: LAYOUT.refriFloatingReplayBottom },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.floatingReplayBtn}
              onPress={handleReplay}
              activeOpacity={0.88}
              disabled={isRoundLoading}
            >
              <Ionicons
                name="volume-high"
                size={LAYOUT.refriVolumeIconSize}
                color="#444"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 시작 버튼 — 게임 시작 전에만 하단 고정 */}
      {!isGameStarted && (
        <View
          style={[
            styles.controlSection,
            { paddingBottom: insets.bottom + LAYOUT.refriBottomInsetOffset },
          ]}
        >
          <TouchableOpacity
            onPress={startGame}
            activeOpacity={0.88}
            style={styles.controlBtnStartWrap}
          >
            <RefriStartBtn
              width={LAYOUT.refriStartBtnWidth}
              height={LAYOUT.refriStartBtnHeight}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  gaugeSection: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: LAYOUT.refriGaugeSectionPaddingV,
    paddingHorizontal: LAYOUT.refriGaugeSectionPaddingH,
    marginBottom: LAYOUT.refriGaugeToFridgeGap,
    height: LAYOUT.refriGaugeSectionHeight,
    zIndex: 100,
  },
  gaugeContainer: {
    width: LAYOUT.refriGaugeContainerWidthPercent,
    position: "relative",
    marginTop: 40,
  },
  gaugeTrack: {
    height: LAYOUT.refriGaugeTrackHeight,
    borderRadius: LAYOUT.refriGaugeTrackBorderRadius,
    backgroundColor: "#E0E6ED",
    overflow: "hidden",
    position: "relative",
  },
  gaugeMilestone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  milestoneIcon: {
    width: LAYOUT.refriGaugeMilestoneSize,
    height: LAYOUT.refriGaugeMilestoneSize,
    borderRadius: LAYOUT.refriGaugeMilestoneSize / 2,
  },
  gaugeFill: {
    height: "100%",
    borderRadius: LAYOUT.refriGaugeTrackBorderRadius,
  },

  // 냉장고 + 상자 영역. 높이는 화면 40%가 상한이고, 짧은 폰은 남은 칸만 쓴다.
  refriContainer: {
    flex: 1,
    maxHeight: REFRI_SCENE_MAX_H,
    minHeight: 0,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: LAYOUT.refriContainerMarginTop,
  },
  /** 칸이 상한보다 짧을 때만. 확인 기기에서는 켜지지 않는다(지금 그림이 칸 밖으로 나옴). */
  refriContainerClip: {
    overflow: "hidden",
  },
  refriWithCratesWrapper: {
    position: "relative",
    width: "100%",
    height: REFRI_SCENE_MAX_H,
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  fridgeWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  // 상자 스타일 (반응형)
  cratesContainer: {
    position: "absolute",
    left: 0,
    bottom: LAYOUT.screenHeight * LAYOUT.refriCratesBottomRatio,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingLeft: LAYOUT.screenWidth * LAYOUT.refriCratesPaddingLeftRatio,
    paddingBottom: LAYOUT.screenHeight * LAYOUT.refriCratesPaddingBottomRatio,
    zIndex: 10,
  },
  leftCrateStack: {
    flexDirection: "column-reverse",
    alignItems: "center",
  },
  crateWrapper: {
    marginBottom:
      LAYOUT.screenHeight * LAYOUT.refriCrateWrapperMarginBottomRatio,
    top: LAYOUT.screenHeight * LAYOUT.refriCrateWrapperTopRatio,
  },
  crateBox: {
    width: LAYOUT.screenWidth * LAYOUT.refriCrateBoxSizeRatio,
    height: LAYOUT.screenWidth * LAYOUT.refriCrateBoxSizeRatio,
    resizeMode: "contain",
  },

  /**
   * 다시 듣기 — **선반(`answersContainer`)을 기준으로** 절대배치한다.
   * `bottom`은 선반이 아래로 비운 칸(`refriTrayPaddingBottom`) 안의 가운데다
   * (`LAYOUT.refriFloatingReplayBottom`). 화면 바닥 기준이던 것을 옮긴 이유는
   * 그 둘이 **선반 바닥이 화면 바닥에 닿을 때만** 같은 자리이기 때문이다.
   */
  floatingReplayWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: LAYOUT.refriZIndexFloatingReplay,
  },
  floatingReplayBtn: {
    width: LAYOUT.refriFloatingReplaySize,
    height: LAYOUT.refriFloatingReplaySize,
    borderRadius: LAYOUT.refriFloatingReplaySize / 2,
    backgroundColor: "#F0EDE8",
    justifyContent: "center",
    alignItems: "center",
    elevation: LAYOUT.refriFloatingReplayElevation,
  },
  // 컨트롤 섹션 — 시작 버튼만 하단 고정
  controlSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: LAYOUT.refriZIndexControlSection,
    alignItems: "center",
    paddingHorizontal: LAYOUT.refriControlSectionPaddingH,
  },
  controlBtnStartWrap: {
    minWidth: LAYOUT.refriControlBtnMinWidth,
  },

  // 하단 단어 카드 전용 선반(Tray)
  answersContainer: {
    // 다시 듣기가 이 상자를 기준으로 절대배치된다 (RN 기본값이지만 뜻을 적어 둔다)
    position: "relative",
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingTop: LAYOUT.refriTrayPaddingTop,
    paddingHorizontal: LAYOUT.refriTrayPaddingH,
    paddingBottom: LAYOUT.refriTrayPaddingBottom,
    gap: LAYOUT.refriTrayGap,
    zIndex: LAYOUT.refriZIndexAnswers,
    minHeight: LAYOUT.screenHeight * LAYOUT.refriTrayMinHeightRatio,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderTopLeftRadius: LAYOUT.refriTrayBorderRadius,
    borderTopRightRadius: LAYOUT.refriTrayBorderRadius,
  },
  answerCard: {
    backgroundColor: "white",
    borderRadius: LAYOUT.refriAnswerCardBorderRadius,
    padding: LAYOUT.refriAnswerCardPadding,
    borderWidth: 2,
    borderColor: "#BDBDBD",
    elevation: LAYOUT.refriAnswerCardElevation,
    alignItems: "center",
  },
  answerInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: LAYOUT.refriAnswerInnerMinHeight,
  },
  answerImage: {
    width: LAYOUT.refriAnswerImageSize,
    height: LAYOUT.refriAnswerImageSize,
  },
  answerLabel: {
    marginTop: LAYOUT.refriAnswerLabelMarginTop,
    fontSize: LAYOUT.refriAnswerLabelFontSize,
    fontWeight: "700",
    color: "#263238",
    textAlign: "center",
  },

  // 게임 완료 화면
  completeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: LAYOUT.refriZIndexCompleteOverlay,
  },
  completeBox: {
    backgroundColor: "white",
    borderRadius: LAYOUT.refriCompleteBoxBorderRadius,
    padding: LAYOUT.refriCompleteBoxPadding,
    alignItems: "center",
    elevation: LAYOUT.refriCompleteBoxElevation,
    minWidth: LAYOUT.refriCompleteBoxMinWidth,
  },
  completeEmoji: {
    marginBottom: LAYOUT.spacingSM,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: LAYOUT.refriCompleteEmojiFontSize,
    height: LAYOUT.refriCompleteEmojiFontSize,
  },
  sparkleIcon: {
    position: "absolute",
    width: 8,
    height: 8,
  },
  sparkleShape: {
    width: 8,
    height: 8,
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  completeTitle: {
    fontSize: LAYOUT.refriCompleteTitleFontSize,
    fontWeight: "800",
    color: COLORS.successOnWhite,
    marginBottom: LAYOUT.spacingSM,
  },

  completeStats: {
    fontSize: LAYOUT.refriCompleteStatsFontSize,
    fontWeight: "700",
    color: "#263238",
    marginBottom: LAYOUT.spacingLG,
  },
  completeButton: {
    flexDirection: "row",
    backgroundColor: "#7cbd7e",
    paddingHorizontal: LAYOUT.refriCompleteButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.refriControlBtnBorderRadius,
    alignItems: "center",
    gap: LAYOUT.refriCompleteButtonGap,
    elevation: LAYOUT.completeButtonElevation,
  },
  completeButtonText: {
    color: "white",
    fontSize: LAYOUT.refriCompleteSubtitleFontSize,
    fontWeight: "700",
  },
});
