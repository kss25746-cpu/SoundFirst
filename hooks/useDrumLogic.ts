import { useState, useCallback, useEffect, useRef } from 'react';
import { DRUM_INSTRUMENTS, InstrumentType } from '../constants/drumSounds';

export type GameState = 'ready' | 'playing' | 'answered' | 'waitingForNextRound';

interface UseGameLogicProps {
  questionCount: number;
  instrumentCount: number;
  onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
}

export function useGameLogic({ questionCount, instrumentCount, onGameComplete }: UseGameLogicProps) {
  const [currentInstrument, setCurrentInstrument] = useState<InstrumentType | null>(null);
  const [choices, setChoices] = useState<InstrumentType[]>([]);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState(0);
  /**
   * 점수의 참값. 렌더 클로저의 `score`로 더하면 한 프레임에 두 번 처리될 때 하나만 오르고,
   * 무엇보다 아래 대기 타이머가 **예약된 시점의 옛 점수**를 결과 화면으로 넘긴다.
   * 쓰는 통로는 `applyScore` 하나뿐이다 — 두 곳에서 따로 세팅하면 조용히 어긋난다.
   */
  const scoreRef = useRef(0);
  const roundRef = useRef(1);
  const [round, setRound] = useState(1);
  const isAnsweringRef = useRef(false);

  const applyScore = useCallback((next: number) => {
    scoreRef.current = next;
    setScore(next);
  }, []);

  /**
   * 다음 라운드 대기 타이머 모음 (`MusicTrainingScreen.tsx:356`과 같은 방식).
   *
   * 담아두지 않으면 「그만하기」·탭 이탈 뒤에도 예약된 콜백이 살아나 **끝난 퀴즈가 혼자
   * 다음 문제로 넘어간다.** 터진 타이머는 자기 id를 스스로 뺀다 — 한 게임 동안 쌓이지 않게.
   */
  const roundTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const clearRoundTimers = useCallback(() => {
    roundTimersRef.current.forEach(clearTimeout);
    roundTimersRef.current.clear();
  }, []);
  const scheduleRoundTimer = useCallback((run: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      roundTimersRef.current.delete(id);
      run();
    }, delayMs);
    roundTimersRef.current.add(id);
  }, []);

  // 화면이 사라질 때 예약분을 반드시 끊는다
  useEffect(() => clearRoundTimers, [clearRoundTimers]);

  // round 변경 감지 및 ref 동기화
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [answerHistory, setAnswerHistory] = useState<boolean[]>([]); 

  // 악기 수에 따라 사용 가능한 악기 설정
  const availableInstruments: InstrumentType[] = (() => {
    let instruments: InstrumentType[];
    switch (instrumentCount) {
      case 2:
        instruments = ['kick', 'snare'];
        break;
      case 3:
        instruments = ['kick', 'snare', 'hihat'];
        break;
      case 4:
        instruments = ['kick', 'snare', 'hihat', 'cymbal'];
        break;
      case 5:
      default:
        instruments = ['kick', 'snare', 'hihat', 'cymbal', 'tom'];
        break;
    }
    return instruments;
  })();
  const maxRounds = questionCount;

  const startNewRound = useCallback(() => {
    // 정답 악기 랜덤 선택
    const correctInstrument =
      availableInstruments[Math.floor(Math.random() * availableInstruments.length)];
    setCurrentInstrument(correctInstrument);

    // 오답 선택지 생성 (사용 가능한 악기 수에 맞춰 조정)
    const wrongChoicesCount = Math.min(2, availableInstruments.length - 1);
    const wrongChoices = availableInstruments
      .filter((inst) => inst !== correctInstrument)
      .sort(() => 0.5 - Math.random())
      .slice(0, wrongChoicesCount);

    // 전체 선택지 섞기
    const allChoices = [correctInstrument, ...wrongChoices].sort(
      () => 0.5 - Math.random()
    );

    setChoices(allChoices);
    setGameState('ready');
  }, [availableInstruments]);

  const startPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  /**
   * 피드백을 잠깐 보여준 뒤 다음 라운드로 넘긴다. 정답·오답·시간초과 세 갈래가 꼬리는 같았다 —
   * 한 곳으로 묶어야 타이머를 담는 자리도 하나로 끝난다.
   * 점수는 예약 시점이 아니라 **터지는 시점의 `scoreRef`**를 읽는다.
   */
  const scheduleNextRound = useCallback((delayMs: number) => {
    scheduleRoundTimer(() => {
      setShowFeedback(false);
      isAnsweringRef.current = false;
      const currentRound = roundRef.current;
      if (currentRound >= maxRounds) {
        const finalScore = scoreRef.current;
        onGameComplete?.(finalScore, maxRounds, Math.round((finalScore / maxRounds) * 100));
      } else {
        setRound(currentRound + 1);
        startNewRound();
        startPlaying();
      }
    }, delayMs);
  }, [maxRounds, onGameComplete, scheduleRoundTimer, startNewRound, startPlaying]);

  const handleAnswer = useCallback(
    (selectedInstrument: InstrumentType | null) => {
      // 이미 답 처리 중이면 무시 (연타 방지)
      if (isAnsweringRef.current) {
        console.log('⚠️ 답안 처리 중 - 중복 호출 무시');
        return;
      }
      isAnsweringRef.current = true;

      // 시간 초과일 경우 gameState 관계없이 처리
      if (selectedInstrument === null) {
        setFeedbackMessage('⏰ 시간 초과!');
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, false]);
        setGameState('waitingForNextRound');

        // 0.5초 후 다음 문제 진행
        scheduleNextRound(500);
        return;
      }

      // 시간 초과 외에는 playing 또는 answered 상태에서만 처리
      if (gameState !== 'answered' && gameState !== 'playing') {
        console.log('⚠️ 답안 선택 무시 - gameState:', gameState);
        isAnsweringRef.current = false;
        return;
      }
      
      console.log('✅ 답안 처리:', { selectedInstrument, currentInstrument, gameState });

      const isCorrect = selectedInstrument === currentInstrument;

      if (isCorrect) {
        // 정답
        applyScore(scoreRef.current + 1);
        setFeedbackMessage('✅ 정답!');
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, true]);
      } else {
        // 오답
        setFeedbackMessage(
          `❌ 오답! 정답은 "${DRUM_INSTRUMENTS[currentInstrument!].name}"`
        );
        setShowFeedback(true);
        setAnswerHistory(prev => [...prev, false]);
      }
      setGameState('waitingForNextRound');

      // 1초 후 다음 문제
      scheduleNextRound(1000);
    },
    [gameState, currentInstrument, applyScore, scheduleNextRound]
  );

  const resetGame = useCallback(() => {
    clearRoundTimers();
    applyScore(0);
    setRound(1);
    setAnswerHistory([]);
    isAnsweringRef.current = false;
    startNewRound();
  }, [applyScore, clearRoundTimers, startNewRound]);

  const resetGameWithoutStarting = useCallback(() => {
    clearRoundTimers();
    applyScore(0);
    setRound(1);
    setCurrentInstrument(null);
    setChoices([]);
    setGameState('ready');
    setShowFeedback(false);
    setFeedbackMessage('');
    setAnswerHistory([]);
    isAnsweringRef.current = false;
  }, [applyScore, clearRoundTimers]);

  const setAnswered = useCallback(() => {
    setGameState('answered');
  }, []);

  /**
   * 예약된 다음 라운드를 끊는다 — 「그만하기」·탭 이탈처럼 게임을 도중에 접을 때.
   * 피드백 중이었다면 답안 빗장이 걸린 채로 멈추므로 함께 푼다.
   */
  const stopPendingRounds = useCallback(() => {
    clearRoundTimers();
    setShowFeedback(false);
    isAnsweringRef.current = false;
  }, [clearRoundTimers]);

  return {
    // State
    currentInstrument,
    choices,
    gameState,
    score,
    round,
    showFeedback,
    feedbackMessage,
    maxRounds,
    answerHistory,
    
    
    startNewRound,
    handleAnswer,
    resetGame,
    resetGameWithoutStarting,
    startPlaying,
    setAnswered,
    stopPendingRounds,
  };
}
