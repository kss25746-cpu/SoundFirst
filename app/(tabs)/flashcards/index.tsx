/**
 * 📚 학습 카드 스와이프 화면
 *
 * 🎯 최적화 전략:
 * ┌─────────────────────────────────────────────────────────┐
 * │ 1. 자연스러운 애니메이션 (useNativeDriver: false)        │
 * │    - 모든 애니메이션을 JS 스레드에서 일관되게 처리       │
 * │    - setValue()와 충돌 없이 안정적 동작                  │
 * ├─────────────────────────────────────────────────────────┤
 * │ 2. 깜빡임 방지 (requestAnimationFrame)                   │
 * │    - 애니메이션 완료 → 다음 프레임에서 상태 업데이트     │
 * │    - 백그라운드 카드 전환 시 깜빡임 최소화              │
 * ├─────────────────────────────────────────────────────────┤
 * │ 3. 메모이제이션 (React.memo)                             │
 * │    - StackCard: ID 기반 비교로 불필요한 리렌더링 방지    │
 * │    - WordFlashcard: key prop으로 내부 상태 초기화        │
 * └─────────────────────────────────────────────────────────┘
 *
 * ⚠️ 스와이프 제스처는 없다. 카드는 **카드네비(◀ 학습완료 ▶)로만** 넘긴다.
 *    `panX`/`panY`/`scale`/`opacity`/`rotation`은 그 넘김 연출과
 *    「학습완료 → 익힘배지로 날아가기」가 쓴다 — 제스처의 잔재가 아니다.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, ScrollView, Animated, TouchableOpacity, Pressable, Image, Modal } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EASY_WORD_PAIRS, NORMAL_WORD_PAIRS } from '../../../constants/wordSounds';
import { LAYOUT, getProgressTickSize } from '../../../constants/layout';
import { COLORS } from '../../../constants/colors';
import { WordFlashcard } from '../../../components/game/WordFlashcard';
import CompletedBadgeBg from '../../../assets/icons/completed_badge_bg.svg';

const ALL_PAIRS = [...EASY_WORD_PAIRS, ...NORMAL_WORD_PAIRS];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  // ✅ AsyncStorage 연동 상태
  const [completedCards, setCompletedCards] = useState<Set<string>>(new Set());
  const [filteredPairs, setFilteredPairs] = useState([...ALL_PAIRS]);

  /** 익힘배지를 눌렀을 때의 bounce 값 */
  const completionScale = useRef(new Animated.Value(1)).current;

  // ✅ 완료 카드 복원 모달 상태
  const [showCompletedModal, setShowCompletedModal] = useState(false);

  // ✅ AsyncStorage에서 완료 카드 로드
  const loadCompletedCards = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('completedCards');
      if (saved) {
        const completed = new Set<string>(JSON.parse(saved));
        setCompletedCards(completed);
        const filtered = ALL_PAIRS.filter(p => !completed.has(p.id));
        setFilteredPairs(filtered);
      }
    } catch (error) {
      console.log('AsyncStorage 로드 실패:', error);
    }
  }, []);

  // ✅ 앱 시작 시 AsyncStorage에서 완료 카드 로드
  useEffect(() => {
    loadCompletedCards();
  }, [loadCompletedCards]);

  // ✅ AsyncStorage에 완료 카드 저장
  const saveCompletedCards = async (completed: Set<string>) => {
    try {
      await AsyncStorage.setItem('completedCards', JSON.stringify(Array.from(completed)));
    } catch (error) {
      console.log('AsyncStorage 저장 실패:', error);
    }
  };

  // ✅ 버튼 Bounce 애니메이션 (클릭 시)
  const showBadgeAnimation = () => {
    completionScale.setValue(0.9);
    Animated.sequence([
      Animated.spring(completionScale, {
        toValue: 1.06,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(completionScale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // 학습 완료 카드를 추적하기 위한 상태 (향후 서버 동기화 시 사용)
  // completedCardsRef 제거 - completedCards 상태로 통합

  // 애니메이션 값들 초기화
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  // 배지 위치 추적 (배지로 날아가는 애니메이션용)
  const badgeRef = useRef<any>(null);
  const cardStackRef = useRef<any>(null);

  /**
   * 카드가 움직이는 동안 걸어두는 빗장.
   * 학습완료 연출은 **600ms**인데 그 사이 다시 누르면 `measure` 콜백이 겹쳐
   * **두 장이 완료되거나 인덱스가 꼬인다.** ◀▶(300ms)도 같은 빗장을 쓴다 —
   * 셋 다 **같은 카드 하나**를 움직이므로 빗장도 하나여야 한다.
   * 상태가 아니라 ref인 이유: 리렌더를 기다리면 그 사이 두 번째 탭이 통과한다.
   */
  const isCardTransitioningRef = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setCurrentIndex(0);
      };
    }, [])
  );

  const currentPair = filteredPairs[currentIndex]; // 필터된 배열에서 현재 카드 가져오기

  // 하단 화살표의 활성 여부. 판정이 버튼 세 군데(onPress·스타일·아이콘 색)에 흩어져 있으면
  // 한 곳만 고쳐져 어긋난다
  const isFirstCard = currentIndex === 0;
  const isLastCard = currentIndex >= filteredPairs.length - 1;

  /**
   * 스크롤 내용이 **하단 네비에 가리지 않게** 비워 두는 높이.
   * 네비는 높이 `tabBarHeight`짜리 절대 배치이고 `bottom: insets.bottom - flashcardsBottomOffset`에
   * 놓이므로, **가리는 높이가 그 둘에서 나온다.** 전에는 `100` 고정이라 인셋이 달라도 그대로였다.
   * 인셋이 보정값보다 작으면 네비가 화면 아래로 내려가므로 음수는 0으로 자른다.
   *
   * **여기 `tabBarHeight`는 시스템 탭바가 아니라 이 화면이 직접 그리는 하단 네비다**
   * (`navBar`가 같은 값을 `height`로 쓴다). learn 탭이 시스템 탭바 높이를 또 빼던 것은
   * 중복이라 걷어냈다 — 탭바는 보일 때 절대배치가 아니어서 화면 영역이 이미 그 위에서 끝난다.
   */
  const scrollBottomPadding =
    Math.max(0, insets.bottom - LAYOUT.flashcardsBottomOffset) +
    LAYOUT.tabBarHeight +
    LAYOUT.spacingLG;

  /**
   * 진행바 기하. 마커·눈금·채움이 **한 식**을 쓴다 — 셋이 각자 기준을 쓰면 서로 어긋난다.
   * 레일은 래퍼 폭의 90%가 가운데 정렬이라 5%에서 시작한다 (`constants/layout.ts` 참고).
   */
  const cardCount = filteredPairs.length;
  const progress = cardCount <= 1 ? 0 : Math.min(1, Math.max(0, currentIndex / (cardCount - 1)));
  const railPercent = (ratio: number) =>
    LAYOUT.progressRailStartPercent + ratio * LAYOUT.progressRailSpanPercent;
  /** 눈금은 카드 한 장씩이라 개수가 카드 수를 따라간다. 많으면 붙으므로 크기를 줄인다 */
  const tickSize = getProgressTickSize(cardCount);

  /**
   * 카드 애니메이션 값을 제자리로 **즉시** 돌린다 (`setValue`).
   *
   * **연출이 아니다.** 부르는 세 자리(`handlePrevCard` · `handleNextCard`의 `animateSwipe`
   * 완료 콜백, `handleCompleteCard`의 배지로 날아간 뒤) 모두 **카드가 이미 화면 밖으로 나가고
   * 다음 카드 내용으로 바뀐 뒤**다. 여기서 `Animated.timing`으로 되돌리면
   * 새 카드가 **밖에서 날아 들어오는 것처럼** 보인다.
   *
   * (전에 이 자리에 「`Animated.timing`을 써서 부드럽게 원위치로」라는 주석이 있었는데
   *  본문은 처음부터 `setValue`뿐이라 **코드와 반대였다.**)
   */
  const resetAnimation = () => {
    panX.setValue(0);
    panY.setValue(0);
    scale.setValue(1);
    opacity.setValue(1);
    rotation.setValue(0);
  };

  // 🔘 이전 카드 (좌측 화살표)
  const handlePrevCard = () => {
    if (isCardTransitioningRef.current) return;
    if (currentIndex > 0) {
      isCardTransitioningRef.current = true;
      animateSwipe('right', () => {
        setCurrentIndex(currentIndex - 1);
        resetAnimation();
        isCardTransitioningRef.current = false;
      });
    }
  };

  // 🔘 다음 카드 (우측 화살표)
  const handleNextCard = () => {
    if (isCardTransitioningRef.current) return;
    if (currentIndex < filteredPairs.length - 1) {
      isCardTransitioningRef.current = true;
      animateSwipe('left', () => {
        setCurrentIndex(currentIndex + 1);
        resetAnimation();
        isCardTransitioningRef.current = false;
      });
    }
  };

  // 🔘 학습 완료 (중앙 버튼) - 배지로 날아가는 애니메이션
  // 네, 여기서는 일반 함수 선언이 아니라, 함수 표현식을 const 변수에 할당한 "화살표 함수(arrow function)" 형태입니다.
  // 이렇게 하면 handleCompleteCard는 클릭 등에서 즉시 실행할 수 있는 함수 객체로 만들어집니다.
  const handleCompleteCard = () => {
    // 연출이 도는 동안은 받지 않는다 (위 `isCardTransitioningRef` 설명)
    if (isCardTransitioningRef.current) return;
    if (currentIndex >= filteredPairs.length) return;
    isCardTransitioningRef.current = true;
    //한장을 보고 있음 커렌인댁 1 렝스1  
    // 네, currentPair는 currentIndex나 filteredPairs가 바뀔 때마다 새로 할당됩니다.
    const currentPair = filteredPairs[currentIndex];   // 현재 카드 가져오기

    // 배지와 카드 위치 측정
    if (badgeRef.current && cardStackRef.current) {
      badgeRef.current.measure((bx: number, by: number, bWidth: number, bHeight: number, bPageX: number, bPageY: number) => {
        cardStackRef.current.measure((cx: number, cy: number, cWidth: number, cHeight: number, cPageX: number, cPageY: number) => {
          // 배지 중앙 위치
          const badgeCenterX = bPageX + bWidth / 2;
          const badgeCenterY = bPageY + bHeight / 2;

          // 카드 중앙 위치.
          // 재는 대상은 카드가 아니라 **스택 래퍼**(cardStackRef)다. 카드는 그 안에서
          // `flashcardsTopCardMarginTop`만큼 더 내려가 있으므로 그만큼 더해야 실제 카드 중앙이다.
          // (빼먹으면 카드가 배지보다 그 값만큼 아래에 가서 멈춘다. 이 값은 기기마다 다르다)
          const cardCenterX = cPageX + cWidth / 2;
          const cardCenterY = cPageY + cHeight / 2 + LAYOUT.flashcardsTopCardMarginTop;

          // 이동 거리 계산
          const moveX = badgeCenterX - cardCenterX;
          const moveY = badgeCenterY - cardCenterY;
          // resetAnimation은 카드의 Animated.Value들을 즉시 원래 위치(중앙)으로 돌려놓는 함수입니다.
          // 즉, panX/Y 등 모든 위치/회전/스케일 값을 기본값으로 "점프"시킵니다.
          // 애니메이션 없이 즉각적으로 값을 바꾸기 때문에, 카드가 "초기 위치로 순간이동" 합니다.
          // 실제 "날아가는" 동작은 resetAnimation에서 담당하는 것이 아니라, 
          // 날아가는 동작(배지 쪽으로 이동, fade out, shrink 등)은 handleCompleteCard 내부에서
          // Animated.parallel로 panX/panY 등 값을 변경하며 만들어집니다.
          // resetAnimation은 그 애니메이션이 끝난 뒤, 다시 준비된 카드가 원위치에서 등장하도록 리셋 역할입니다.
          // 배지로 날아가는 애니메이션
          Animated.parallel([
            Animated.timing(panX, {
              toValue: moveX,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(panY, {
              toValue: moveY,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(scale, {
              toValue: 0,
              duration: 600,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 600,
              useNativeDriver: false,
            }),
            // 시계방향 90도 => toValue: -90으로 수정 (음수: 시계방향, 양수: 반시계방향)
            Animated.timing(rotation, {
              toValue: 90,
              duration: 600,
              useNativeDriver: false,
            }),
            // 네, 여기 콜백은 위 Animated.parallel의 모든 애니메이션(duration: 600ms)이 다 끝난 후에 실행됩니다.
          ]).start(() => {
            requestAnimationFrame(() => {
              // 상태 업데이트
              const newCompleted = new Set(completedCards);
              newCompleted.add(currentPair.id);

              setCompletedCards(newCompleted);
              saveCompletedCards(newCompleted);

              // ✅ filteredPairs에서 현재 카드 제거
              const newFiltered = filteredPairs.filter(p => p.id !== currentPair.id);
              setFilteredPairs(newFiltered);

              // ✅ 완료 체크
              if (newFiltered.length === 0) {
                setCurrentIndex(0);
              } else {
                // 인덱스 조정 (현재 카드가 제거되었으므로)
                if (currentIndex >= newFiltered.length) {
                  setCurrentIndex(newFiltered.length - 1);
                }
              }

              // 다음 카드로 애니메이션 준비
              resetAnimation();
              isCardTransitioningRef.current = false;
            });
          });
        });
      });
    } else {
      // 측정 실패 시 기존 로직 실행
      const newCompleted = new Set(completedCards);
      newCompleted.add(currentPair.id);

      setCompletedCards(newCompleted);
      saveCompletedCards(newCompleted);

      const newFiltered = filteredPairs.filter(p => p.id !== currentPair.id);
      setFilteredPairs(newFiltered);

      if (newFiltered.length === 0) {
        setCurrentIndex(0);
      } else {
        if (currentIndex >= newFiltered.length) {
          setCurrentIndex(newFiltered.length - 1);
        }
      }

      isCardTransitioningRef.current = false;
    }
  };

  // 🔘 모든 카드 리셋 (다시 시작)
  const handleResetAllCards = () => {
    setCompletedCards(new Set());
    setFilteredPairs([...ALL_PAIRS]);
    setCurrentIndex(0);
    saveCompletedCards(new Set());
    setShowCompletedModal(false);
  };

  // 카드 넘김 애니메이션: 하이브리드 최적화 전략
  // ✅ 자연스러움: 모든 애니메이션을 JS 스레드에서 실행하여 일관성 유지
  // ✅ 에러 방지: setValue()와 useNativeDriver 충돌 해결
  //
  // 방향은 카드네비 ◀▶가 쓰는 'right'(이전)·'left'(다음) 둘뿐이다.
  // 아래로 떨어뜨리던 'down'은 스와이프 학습완료 전용이라 제스처와 함께 지웠다 —
  // 지금 학습완료는 `handleCompleteCard`의 「익힘배지로 날아가기」가 따로 한다.
  const animateSwipe = (direction: 'left' | 'right', onComplete?: () => void) => {
    Animated.parallel([
      Animated.timing(panX, {
        toValue: direction === 'right' ? LAYOUT.screenWidth : -LAYOUT.screenWidth,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotation, {
        toValue: direction === 'right' ? 25 : -25,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 0.85,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        onComplete?.();
      });
    });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ✅ 익힘모달 (완료 카드 복원)
          `Modal`로 감싼다 — 전에는 조건부 View + zIndex: 1000이라
          **안드로이드 뒤로가기로 닫히지 않았다.** 미션모달(`components/MissionProgressIcon.tsx`)이
          쓰는 방식과 같다. `animationType="slide"`라 시트가 아래서 올라온다(전에는 즉시 튀어나왔다). */}
      <Modal
        visible={showCompletedModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowCompletedModal(false)}
      >
        <View style={styles.modalOverlay}>
          {/* 배경은 시트를 **품지 않는다.** 전에는 시트를 자식으로 감싼 `TouchableOpacity`였는데,
              `TouchableOpacity`는 `accessible`을 끄지 않는 한 켜져 있어(RN 0.86
              `TouchableOpacity.js:303` — `accessible={this.props.accessible !== false}`)
              **시트 안이 통째로 한 덩어리로 묶여** 닫기 버튼·완료 항목·「전체 다시 하기」에
              토크백 초점이 따로 가지 않았다. 절대배치 **형제**로 내리면 시트는 형제라 안 묶인다.
              미션모달(`components/MissionProgressIcon.tsx`)이 쓰는 형태와 같다. */}
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCompletedModal(false)}
            accessibilityRole="button"
            accessibilityLabel="목록 닫기"
          />
          {/* 시트는 누르는 것이 아니라 담는 판이다. 전에는 `TouchableOpacity` +
              `e.stopPropagation()`이었는데, **RN 터치는 애초에 위로 전파되지 않아**
              하는 일이 없었다 — 시트 전체가 눌리는 것처럼 보이기만 했다 */}
          <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
            {/* 시트 손잡이. 바닥에서 올라온 판이라는 표시다 */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>학습 완료된 카드 ({completedCards.size})</Text>
              <TouchableOpacity
                onPress={() => setShowCompletedModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <Ionicons name="close" size={LAYOUT.modalCloseIconSize} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* padding은 `contentContainerStyle`에 준다. `style`에 주면 스크롤 뷰포트만
                줄고 **마지막 항목 아래 여백이 생기지 않는다** */}
            <ScrollView
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBody}
            >
              <View style={styles.completedCardsGrid}>
                {ALL_PAIRS
                  .filter(pair => completedCards.has(pair.id))
                  .map(pair => (
                    <TouchableOpacity
                      key={pair.id}
                      style={styles.completedCardItem}
                      accessibilityRole="button"
                      accessibilityLabel={`${pair.word1}, ${pair.word2}. 다시 학습 목록으로 되돌립니다`}
                      onPress={() => {
                        // 중복 확인은 updater 밖에서 한다. updater(`prev => ...`)는 **순수해야 하고**
                        // React 18에서 두 번 불릴 수 있다 — 전에는 그 안에서 `setCurrentIndex`와
                        // `console.warn`을 불렀다. 지금 도는 것은 운이었다
                        if (filteredPairs.some(p => p.id === pair.id)) {
                          if (__DEV__) {
                            console.warn('⚠️ 모달 복원 시도한 카드가 이미 filteredPairs에 존재:', pair.id);
                          }
                          return;
                        }

                        const newCompleted = new Set(completedCards);
                        newCompleted.delete(pair.id);
                        setCompletedCards(newCompleted);
                        saveCompletedCards(newCompleted);

                        // 되돌린 카드는 **맨 뒤에 붙는다.** `currentIndex`를 건드리지 않으므로
                        // 보고 있던 카드가 그대로 남는다 — 앞쪽 인덱스는 그대로이기 때문이다.
                        // (전에는 되돌린 카드로 점프해서 보던 자리를 잃었다)
                        setFilteredPairs(prev => [...prev, pair]);
                      }}
                    >

                      <View style={styles.completedCardImage}>
                        <Text style={styles.completedCardText}>{pair.word1}</Text>
                        {/* 두 단어를 가르는 표시일 뿐이다. 항목 전체의 `accessibilityLabel`이
                            「고기, 머리」로 읽어 주므로 이건 빼야 「슬래시」가 끼지 않는다 */}
                        <Text
                          style={[styles.completedCardText, { marginHorizontal: 6 }]}
                          importantForAccessibility="no"
                        >
                          /
                        </Text>
                        <Text style={styles.completedCardText}>{pair.word2}</Text>
                      </View>
                      {/* 되돌리기 표시. 전에는 `textLight`(#999) 아이콘만 오른쪽 아래에 떠 있어
                          흰 카드 위에서 2.8:1이었고, 무엇을 하는 항목인지 읽히지 않았다 */}
                      <View style={styles.replayChip}>
                        <Ionicons
                          name="arrow-undo"
                          size={LAYOUT.completedCardChipIconSize}
                          color={COLORS.successOnWhite}
                        />
                        <Text style={styles.replayChipText}>되돌리기</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
              {/* 익힘 기록을 **전부 지우는** 동작이다. 「전체 듣기」와 같은 채운 초록이면
                  같은 무게로 읽혀 실수로 눌린다 — 테두리만 있는 버튼으로 내린다.
                  완료화면의 「🔄 처음부터」는 그 화면의 **유일한 다음 걸음**이라 채운 초록 그대로다.
                  (`handleResetAllCards`가 모달을 닫으므로 여기서 또 닫지 않는다) */}
              <TouchableOpacity
                style={styles.modalResetButton}
                onPress={handleResetAllCards}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="완료한 카드를 모두 되돌려 처음부터 다시 하기"
              >
                <Ionicons
                  name="refresh"
                  size={LAYOUT.restartButtonIconSize}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.modalResetButtonText}>전체 다시 하기</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.container}>
        {/* 고정 배경 이미지 */}
        <Image
          source={require('../../../assets/bg/class_R.webp')}
          style={[
            styles.fixedBackgroundImage,
            { width: LAYOUT.screenWidth, height: LAYOUT.screenHeight },
          ]}
          resizeMode='contain'
          importantForAccessibility="no"
        />
        <View style={[styles.contentOverlay, { paddingTop: insets.top }]}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>


              <View style={styles.headerTopRow}>
                <View style={{ minWidth: LAYOUT.headerSideButtonMinWidth }} />
                <View style={styles.headerTitleCenter}>
                  {/* 제목은 배경 이미지 바로 위에 얹힌다. 이미지에 따라 대비가 흔들리므로
                      옅은 흰 pill로 받친다 — learn 탭 제목과 같은 처리 */}
                  <View style={styles.headerTitlePill}>
                    {/* 장식이다 — 스크린리더는 「단어 카드」만 읽으면 된다.
                        이모지 📖는 색을 못 바꾸고(흰 pill 안에서 혼자 컬러였다) 기기마다 모양이 달랐다.
                        뒤에 붙어 있던 공백 둘도 이모지의 어긋난 기준선을 손으로 맞춘 것이라 함께 지운다 */}
                    <Ionicons
                      name="albums"
                      size={LAYOUT.headerTitleIconSize}
                      color={COLORS.primary}
                      importantForAccessibility="no"
                    />
                    <Text style={styles.headerPanelTitle}>단어 카드</Text>
                  </View>
                </View>
                <Animated.View
                  ref={badgeRef}
                  style={{ transform: [{ scale: completionScale }] }}
                  pointerEvents={completedCards.size > 0 ? 'auto' : 'none'}
                >
                  <TouchableOpacity
                    style={styles.completedBadge}
                    onPress={() => {
                      if (completedCards.size === 0) return;
                      showBadgeAnimation();
                      setShowCompletedModal(true);
                    }}
                    disabled={completedCards.size === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`학습 완료한 카드 ${completedCards.size}개. 눌러서 목록을 엽니다`}
                    accessibilityState={{ disabled: completedCards.size === 0 }}
                  >
                    <View style={StyleSheet.absoluteFill}>
                      <CompletedBadgeBg width="100%" height="100%" />
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={LAYOUT.completedBadgeIconSize}
                      color={COLORS.white}
                      importantForAccessibility="no"
                    />
                    <Text style={styles.completedBadgeText}>{completedCards.size} 개 익힘</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* 진행바 + 진행숫자. 남은 카드가 없으면 가리킬 진행이 없다 (완료화면) */}
              {cardCount > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressLineWrapper}>
                    <View style={styles.progressLine} />
                    {/* 지나온 만큼 채운다. 눈금만으로는 어디까지 왔는지 읽기 어렵다 */}
                    <View
                      style={[
                        styles.progressLineFill,
                        { left: `${LAYOUT.progressRailStartPercent}%`, width: `${progress * LAYOUT.progressRailSpanPercent}%` },
                      ]}
                    />
                    {/* 눈금 하나가 카드 한 장이다. 전에는 카드 수와 무관하게 늘 6개였다.
                        지나온 눈금은 초록 채움 위에 놓이므로 색을 뒤집어야 보인다 */}
                    {Array.from({ length: cardCount }, (_, i) => {
                      // 채움에 **덮인** 눈금만 흰색이다. 현재 위치의 눈금(i === currentIndex)은
                      // 채움의 끝 경계에 걸쳐 있고 어차피 마커가 덮으므로 초록 쪽에 둔다.
                      // (`i <= currentIndex`로 하면 첫 카드에서 채움이 0인데 눈금이 흰색이 되어 사라진다)
                      const passed = i < currentIndex;
                      return (
                        <View
                          key={`tick-${i}`}
                          style={[
                            styles.progressTick,
                            {
                              width: tickSize,
                              height: tickSize,
                              borderRadius: tickSize / 2,
                              marginLeft: -tickSize / 2,
                              marginTop: -tickSize / 2,
                              left: `${railPercent(cardCount <= 1 ? 0 : i / (cardCount - 1))}%`,
                              backgroundColor: passed ? COLORS.white : COLORS.successOnWhite,
                            },
                          ]}
                        />
                      );
                    })}
                    <View style={[styles.progressMarker, { left: `${railPercent(progress)}%` }]}>
                      <Image
                        source={require('../../../assets/icons/mk.png')}
                        style={{ width: LAYOUT.progressMarkerIconSize, height: LAYOUT.progressMarkerIconSize }}
                        importantForAccessibility="no"
                      />
                    </View>
                  </View>
                  {/* 진행도 숫자도 배경 이미지 위에 얹힌다. 제목과 같은 pill로 받친다 */}
                  <View style={styles.progressTextPill}>
                    <Text
                      style={styles.progressText}
                      accessibilityLabel={`전체 ${cardCount}장 중 ${currentIndex + 1}번째 카드`}
                    >
                      {currentIndex + 1} / {cardCount}
                    </Text>
                  </View>
                </View>
              )}


              {/* Card Stack Swiper 영역 */}
              <View
                style={styles.cardStackContainer}
              >

                <View style={styles.cardStackWrapper} ref={cardStackRef}>

                  {/* 뒤 카드 미표시: 메인 카드만 표시 */}

                  {/* 메인 카드. 넘김은 카드네비가 하고, 여기 값들은 그 연출을 받는다 */}
                  <Animated.View
                    style={[
                      styles.topCard,
                      {
                        transform: [
                          { translateX: panX },        // X축 이동 (좌우)
                          { translateY: panY },        // Y축 이동 (상하)
                          {
                            rotateZ: rotation.interpolate({
                              inputRange: [-30, 0, 30],
                              outputRange: ['-30deg', '0deg', '30deg']
                            })
                          },                            // Z축 회전
                          { scale },                   // 크기 조절
                        ],
                        opacity,                       // 불투명도
                      },
                    ]}
                  >
                    <View style={styles.topCardBackground}>
                      <Image
                        source={require('../../../assets/bg/iroawa.png')}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        importantForAccessibility="no"
                      />
                      {/* 반투명 베이지 오버레이 (첨부 이미지 스타일) */}
                      <View style={styles.cardOverlay} />
  
                      {filteredPairs.length === 0 ? (
                        <View style={styles.completionContainer}>
                          {/* 🎉는 글자와 한 줄에 있어 기준선이 어긋났다. 아이콘은 위에 따로 세운다 */}
                          <Ionicons
                            name="trophy"
                            size={LAYOUT.completionIconSize}
                            color={COLORS.primary}
                            importantForAccessibility="no"
                            style={styles.completionIcon}
                          />
                          <Text style={styles.completionText}>학습을 완료하였습니다!</Text>
                          <Text style={styles.completionSubText}>모든 카드를 성공적으로 학습했습니다.</Text>
                          <TouchableOpacity
                            style={styles.completionRestartButton}
                            onPress={handleResetAllCards}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="처음부터 다시 학습하기"
                          >
                            <Ionicons
                              name="refresh"
                              size={LAYOUT.restartButtonIconSize}
                              color={COLORS.white}
                            />
                            <Text style={styles.completionRestartButtonText}>처음부터</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        currentPair && (
                          <WordFlashcard
  
                            key={currentPair.id}
                            wordPair={currentPair}
                          />
                        )
                      )}
                    </View>
                  </Animated.View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* 🔘 하단 네비게이션: 화살표 + 학습완료 버튼 - ScrollView 밖으로 이동 */}
          <View
            style={[
              styles.bottomNavigationContainer,
              { bottom: insets.bottom - LAYOUT.flashcardsBottomOffset },
            ]}
          >
            {/* 좌측 화살표.
                `onPress={undefined}`로 막으면 눌리는 시각 반응은 그대로 나고 보조기기도 알 수 없다.
                `disabled`로 막아야 상태가 함께 전달된다 */}
            <TouchableOpacity
              onPress={handlePrevCard}
              disabled={isFirstCard}
              style={[
                styles.navigationArrowButton,
                isFirstCard && styles.navigationArrowButtonDisabled
              ]}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="이전 카드"
              accessibilityState={{ disabled: isFirstCard }}
            >
              <Ionicons
                name="chevron-back"
                size={LAYOUT.navArrowIconSize}
                color={isFirstCard ? COLORS.textSecondary : COLORS.textPrimary}
              />
            </TouchableOpacity>

            {/* 중앙 학습완료 버튼.
                완료화면에서는 표시할 카드가 없어 눌러도 아무 일도 일어나지 않는다.
                화살표와 같이 `disabled`로 막아야 눌리는 시각 반응도 나지 않는다 */}
            <TouchableOpacity
              onPress={handleCompleteCard}
              disabled={cardCount === 0}
              style={[styles.completeButton, cardCount === 0 && styles.completeButtonDisabled]}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="이 카드를 학습 완료로 표시"
              accessibilityState={{ disabled: cardCount === 0 }}
            >
              <Text style={[styles.completeButtonText, cardCount === 0 && styles.completeButtonTextDisabled]}>
                학습완료
              </Text>
            </TouchableOpacity>

            {/* 우측 화살표 */}
            <TouchableOpacity
              onPress={handleNextCard}
              disabled={isLastCard}
              style={[
                styles.navigationArrowButton,
                isLastCard && styles.navigationArrowButtonDisabled
              ]}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="다음 카드"
              accessibilityState={{ disabled: isLastCard }}
            >
              <Ionicons
                name="chevron-forward"
                size={LAYOUT.navArrowIconSize}
                color={isLastCard ? COLORS.textSecondary : COLORS.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fixedBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  contentOverlay: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.modalHeaderPaddingH,
    paddingVertical: LAYOUT.modalHeaderPaddingV,
    backgroundColor: COLORS.backgroundStar,
  },
  modalTitle: {
    fontSize: LAYOUT.modalTitleFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    // paddingBottom은 렌더에서 인라인으로 더한다 (`scrollBottomPadding`) —
    // 하단 네비 위치가 `insets`에 걸려 있어 스타일 시트에서는 알 수 없다
  },

  // 섹션 스타일 (나무/종이 패널 느낌)
  section: {
    marginHorizontal: LAYOUT.sectionMarginH,
    marginVertical: LAYOUT.sectionMarginV,
    position: 'relative',
  },
  /**
   * 제목 받침. 제목은 카드 밖, 배경 이미지 바로 위에 놓여서 이미지에 따라 대비가 흔들린다.
   * flashcards는 learn과 달리 흰 오버레이도 깔려 있지 않아 조건이 더 나쁘다.
   * 그림자는 elevation으로만 낸다 (규칙 4 — 안드로이드 전용).
   */
  headerTitlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LAYOUT.spacingSM,
    paddingHorizontal: LAYOUT.spacingMD,
    // 세로 패딩은 spacingSM이 아니라 XS다. 제목 글자가 배지 글자보다 커서, SM을 주면
    // pill이 배지보다 10px 높아지고 헤더 줄이 그만큼 두꺼워져 아래 전부가 내려간다
    paddingVertical: LAYOUT.spacingXS,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceOnImage,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },

  headerPanelTitle: {
    fontSize: LAYOUT.sectionTitleFontSize,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.textPrimary,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LAYOUT.headerTopRowMarginBottom,
  },
  headerTitleCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * 배경·테두리·그림자를 주지 않는다 — 뒤에 깔린 SVG(`CompletedBadgeBg`)가 그 셋을 대신한다.
   * 예전에는 여기에 초록 배경과 elevation이 있었지만 렌더에서 인라인으로 전부 덮여 죽은 값이었다.
   */
  completedBadge: {
    minWidth: LAYOUT.headerSideButtonMinWidth,
    paddingHorizontal: LAYOUT.headerSideButtonPaddingH,
    paddingVertical: LAYOUT.headerSideButtonPaddingV,
    borderRadius: LAYOUT.headerSideButtonBorderRadius,
    /* 아이콘과 글자를 한 줄에 세운다. 뒤에 깔린 SVG는 절대배치라 이 흐름 밖이다 */
    flexDirection: 'row',
    gap: LAYOUT.spacingXS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadgeText: {
    fontSize: LAYOUT.completedBadgeTextFontSize,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  progressContainer: {
    position: 'absolute',
    top: LAYOUT.flashcardsProgressTop,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: LAYOUT.spacingSM,
    gap: LAYOUT.spacingSM,
  },

  progressLineWrapper: {
    position: 'relative',
    width: '100%',
    height: LAYOUT.progressLineWrapperHeight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },

  /**
   * 레일은 흰색, 눈금은 진한 초록이다.
   * 전에는 레일 `successLight`(#C8E6C9) · 눈금 `success`(#7cbd7e)였는데, 둘 다 밝은 배경
   * **사진 위**에 놓여 거의 보이지 않았다 (브랜드 초록은 흰 바탕에서도 2.2:1이다).
   * 눈금은 레일(3px)보다 커서 사진 위로 삐져나오므로 글자와 같은 `successOnWhite`를 쓴다.
   * 지나온 눈금만 흰색으로 뒤집는다 — 그 자리는 초록 채움 위라 초록끼리 묻는다.
   */
  progressLine: {
    position: 'absolute',
    width: LAYOUT.progressLineWidthPercent,
    height: LAYOUT.progressLineHeight,
    backgroundColor: COLORS.surfaceOnImage,
    borderRadius: LAYOUT.progressLineBorderRadius,
    top: '50%',
    marginTop: -LAYOUT.progressLineHeight / 2,
  },

  /** 지나온 구간. 레일과 같은 자리에 겹쳐 깔린다 (폭만 진행도를 따라간다) */
  progressLineFill: {
    position: 'absolute',
    height: LAYOUT.progressLineHeight,
    backgroundColor: COLORS.successOnWhite,
    borderRadius: LAYOUT.progressLineBorderRadius,
    top: '50%',
    marginTop: -LAYOUT.progressLineHeight / 2,
  },

  /**
   * 눈금 하나가 카드 한 장이다. 개수·크기·색은 렌더에서 정하고(카드 수에 따라 달라진다),
   * 여기서는 **자리 잡는 방식**만 둔다 — 마커와 같은 식으로 절대배치해야 둘이 어긋나지 않는다.
   * (전에는 `space-between` 컨테이너라 마커와 기준이 달랐다)
   */
  progressTick: {
    position: 'absolute',
    top: '50%',
  },

  progressMarker: {
    position: 'absolute',
    width: LAYOUT.progressMarkerSize,
    height: LAYOUT.progressMarkerSize,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: LAYOUT.progressMarkerMarginLeft,
    zIndex: 10,
    marginTop: LAYOUT.progressMarkerMarginTop,
  },

  /** 진행도 숫자 받침. 제목 pill과 같은 처리이되 세로로 얇게 (숫자 한 줄이다) */
  progressTextPill: {
    marginTop: LAYOUT.progressTextMarginTop,
    paddingHorizontal: LAYOUT.spacingMD,
    paddingVertical: LAYOUT.spacingXS,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceOnImage,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  progressText: {
    fontSize: LAYOUT.progressTextFontSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },

  // Card Stack 컨테이너
  cardStackContainer: {
    backgroundColor: 'transparent',
    borderRadius: LAYOUT.cardBorderRadius,
    elevation: 0,
    minHeight: LAYOUT.cardStackMinHeight,
    marginTop: LAYOUT.cardStackMarginTop,
  },
  cardStackWrapper: {
    position: 'relative',
    height: LAYOUT.cardStackHeight,
    width: '100%',
  },

  topCard: {
    position: 'absolute',
    left: LAYOUT.cardWidthInsetPercent,
    right: LAYOUT.cardWidthInsetPercent,
    height: '100%',
    borderRadius: LAYOUT.cardBorderRadius,
    borderWidth: 0,
    justifyContent: 'center',
    zIndex: 100,
    overflow: 'hidden',
    // 70 고정이던 값. 화면 높이에 비례한다 — 카드는 반응형인데 밀어내기만 고정이었다
    marginTop: LAYOUT.flashcardsTopCardMarginTop,
  },
  topCardBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: LAYOUT.topCardBackgroundBorderRadius,
    borderWidth: 2,
    borderColor: COLORS.successOnWhite,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.cardWarmOverlay,
  },
  /**
   * 완료 항목 2열. 열 사이 간격은 `columnGap`이 아니라 **space-between**이 만든다 —
   * 마지막 줄에 항목이 하나만 남아도 왼쪽에 붙는다(늘어나지 않는다).
   */
  completedCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: LAYOUT.spacingSM,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  /**
   * 폭을 고정한다. 전에는 `minWidth: '45%'`라 단어가 길면 항목이 늘어나
   * 줄마다 폭이 달라 2열이 어긋났다.
   * 바탕도 `backgroundLight`(#f0f0f0)에서 흰색으로 올렸다 — 시트가 `backgroundStar`(#FFF9E6)라
   * 회색 카드는 바탕과 구분이 약했다.
   */
  completedCardItem: {
    width: LAYOUT.completedCardItemWidthPercent,
    backgroundColor: COLORS.white,
    padding: LAYOUT.completedCardItemPadding,
    borderRadius: LAYOUT.completedCardItemBorderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: LAYOUT.completedCardItemElevation,
  },
  completedCardText: {
    fontSize: LAYOUT.completedCardTextFontSize,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  /** 「↺ 되돌리기」. 아이콘만 있던 자리에 글자를 붙여 무엇을 하는 항목인지 드러낸다 */
  replayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: LAYOUT.spacingXS,
    marginTop: LAYOUT.spacingSM,
    paddingHorizontal: LAYOUT.spacingSM,
    paddingVertical: LAYOUT.spacingXS,
    borderRadius: 999,
    backgroundColor: COLORS.backgroundSuccess,
  },
  replayChipText: {
    fontSize: LAYOUT.completedCardChipFontSize,
    fontWeight: '600',
    color: COLORS.successOnWhite,
  },

  // ✅ 익힘모달 스타일 (미션모달과 이름만 같다 — StyleSheet가 파일마다 따로다)
  /**
   * `Modal` 안이라 절대배치·zIndex가 필요 없다. 전에는 화면 위에 얹는 View라
   * `position: 'absolute'` + `zIndex: 1000`이었다.
   */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  /**
   * 어둡게 덮는 것도 **닫기 버튼**도 이 판이다. 시트의 부모가 아니라 **절대배치 형제**라
   * 시트가 이 판의 접근성 덩어리에 들어가지 않는다 (위 렌더의 주석).
   * 절대배치는 흐름 밖이라 시트의 `justifyContent: 'flex-end'` 배치는 그대로다.
   */
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.overlayModal,
  },
  /**
   * 바닥 인셋은 `paddingBottom`으로 렌더에서 더한다 — 제스처바에 「전체 다시 하기」가 물렸다.
   * 여기 `paddingBottom`을 두면 렌더의 인라인 값에 덮인다.
   */
  modalContent: {
    backgroundColor: COLORS.backgroundStar,
    borderTopLeftRadius: LAYOUT.modalContentBorderRadius,
    borderTopRightRadius: LAYOUT.modalContentBorderRadius,
    maxHeight: '80%',
    paddingTop: LAYOUT.spacingSM,
    elevation: 10,
  },
  modalHandle: {
    width: LAYOUT.modalHandleWidth,
    height: LAYOUT.modalHandleHeight,
    borderRadius: LAYOUT.modalHandleHeight / 2,
    backgroundColor: COLORS.borderGray,
    alignSelf: 'center',
    marginBottom: LAYOUT.spacingSM,
  },
  modalCloseBtn: {
    width: LAYOUT.modalCloseBtnSize,
    height: LAYOUT.modalCloseBtnSize,
    borderRadius: LAYOUT.modalCloseBtnSize / 2,
    backgroundColor: COLORS.backgroundSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * 스크롤 상자 자체. 시트가 `maxHeight: '80%'`라 **이 상자가 줄어들 수 있어야**
   * 안에서 스크롤이 된다. `flexShrink`가 0(기본값)이면 내용 높이 그대로 잡혀
   * 시트 밖으로 넘친 만큼이 잘리기만 한다 — 완료 카드가 많을 때 아래가 안 보였다.
   */
  modalBodyScroll: {
    flexShrink: 1,
  },
  /** 내용쪽 padding. `style`이 아니라 `contentContainerStyle`에 준다 */
  modalBody: {
    paddingHorizontal: LAYOUT.modalBodyPaddingH,
    paddingTop: LAYOUT.modalBodyPaddingV,
    paddingBottom: LAYOUT.modalBodyPaddingBottom,
  },
  /**
   * 익힘모달의 「전체 다시 하기」. 완료 기록을 **전부 지우는** 동작이라
   * 채운 초록(`completionRestartButton`)과 나눈다 — 같은 색이면 「전체 듣기」와
   * 같은 무게로 읽혀 실수로 눌린다.
   */
  modalResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LAYOUT.spacingSM,
    alignSelf: 'center',
    marginTop: LAYOUT.completionRestartButtonMarginTop,
    marginBottom: LAYOUT.spacingMD,
    paddingHorizontal: LAYOUT.completionRestartButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.completionRestartButtonBorderRadius,
    borderWidth: LAYOUT.modalResetButtonBorderWidth,
    borderColor: COLORS.borderGray,
    backgroundColor: 'transparent',
  },
  modalResetButtonText: {
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // 🔘 하단 네비게이션 스타일 (scrollContainer의 zIndex:1 위에 올리기 위해 zIndex 필요)
  bottomNavigationContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    height: LAYOUT.tabBarHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.bottomNavPaddingH,
    paddingVertical: 0,
    gap: LAYOUT.bottomNavGap,
    backgroundColor: 'transparent',
  },
  navigationArrowButton: {
    width: LAYOUT.navArrowButtonSize,
    height: LAYOUT.navArrowButtonSize,
    borderRadius: LAYOUT.navArrowButtonBorderRadius,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: LAYOUT.navArrowButtonElevation,
  },
  /**
   * 비활성 화살표. 아이콘 색은 렌더에서 `textSecondary`(#666)로 준다 —
   * 전에는 `borderGray`(#BDBDBD)라 이 배경(#E0E0E0) 위에서 1.2:1이라 아이콘이 사라졌다.
   * 활성(#333)과는 여전히 색이 다르고, elevation이 0이라 떠 있지도 않다.
   */
  navigationArrowButtonDisabled: {
    backgroundColor: COLORS.grayLight,
    elevation: 0,
  },
  completeButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.completeButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.completeButtonBorderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: LAYOUT.completeButtonElevation,
    minHeight: LAYOUT.navArrowButtonSize,
  },
  /** 화살표 비활성과 같은 처리 (`navigationArrowButtonDisabled`) */
  completeButtonDisabled: {
    backgroundColor: COLORS.grayLight,
    elevation: 0,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
  /** 회색 바탕 위 흰 글자는 1.5:1이라 읽히지 않는다. 비활성 화살표와 같은 #666을 쓴다 */
  completeButtonTextDisabled: {
    color: COLORS.textSecondary,
  },

  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LAYOUT.completionContainerPadding,
  },
  completionIcon: {
    marginBottom: LAYOUT.spacingSM,
  },
  completionText: {
    fontSize: LAYOUT.completionTextFontSize,
    fontWeight: 'bold',
    // 글자에 `success`(#7cbd7e)를 쓰면 흰 배경에서 2.2:1이라 큰 글씨 기준 3:1에 못 미친다.
    // `constants/colors.ts`가 이미 적어 둔 규칙이다 — 글자는 `successOnWhite`
    color: COLORS.successOnWhite,
    textAlign: 'center',
    marginBottom: LAYOUT.completionTextMarginBottom,
  },
  completionSubText: {
    fontSize: LAYOUT.completionSubTextFontSize,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  completionRestartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: LAYOUT.spacingSM,
    marginTop: LAYOUT.completionRestartButtonMarginTop,
    marginBottom: LAYOUT.completionRestartButtonMarginBottom,
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.completionRestartButtonPaddingH,
    paddingVertical: LAYOUT.completeButtonPaddingV,
    borderRadius: LAYOUT.completionRestartButtonBorderRadius,
    elevation: 3,
    alignSelf: 'center',
  },
  completionRestartButtonText: {
    color: COLORS.white,
    fontSize: LAYOUT.buttonTextFontSize,
    fontWeight: '600',
  },
  completedCardImage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // 「단어1 / 단어2」 사이. 값이 `spacingSM`과 같아 폰(8)에서는 그대로이고
    // 태블릿에서만 10으로 벌어진다 — 320dp의 빠듯한 폭(안쪽 108)은 건드리지 않는다.
    gap: LAYOUT.spacingSM,
  },
});