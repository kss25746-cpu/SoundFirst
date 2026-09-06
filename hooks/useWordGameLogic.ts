import { useState, useCallback, useEffect, useRef } from 'react';
import { WORD_DIFFICULTY_LEVELS, WordPair, WordDifficultyType } from '../constants/wordSounds';

export type GameState = 'ready' | 'playing' | 'answered' | 'waitingForNextRound';

interface UseWordGameLogicProps {
  difficulty: WordDifficultyType;
  onGameComplete?: (score: number, maxScore: number, percentage: number) => void;
}

export function useWordGameLogic({ difficulty, onGameComplete }: UseWordGameLogicProps) {
  const [currentWordPair, setCurrentWordPair] = useState<WordPair | null>(null);
  const [correctWord, setCorrectWord] = useState<'word1' | 'word2' | null>(null);
  const [correctSound, setCorrectSound] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [round, setRound] = useState(1);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLastAnswerCorrect, setIsLastAnswerCorrect] = useState<boolean | null>(null);
  const [answerHistory, setAnswerHistory] = useState<boolean[]>([]); // 정답/오답 기록
  const [usedPairs, setUsedPairs] = useState<Set<number>>(new Set()); // 이미 사용한 단어 쌍 인덱스

  /**
   * 채점 빗장. 정답을 한 번 받으면 다음 문제가 나올 때까지 잠근다.
   * `gameState`(state)로만 막으면 **같은 프레임의 두 번째 탭이 갱신 전 값을 봐서** 그대로 통과했다 —
   * 두 선택지를 동시에 눌러도 둘 다 채점됐고 아래 타이머가 2개 걸려 라운드가 2칸 뛰었다.
   * 렌더에서 읽지 않으므로 ref다 (기타 세션 48 · 피아노 49의 채점 빗장과 같은 처방).
   */
  const isGradingLockedRef = useRef(false);

  /**
   * 점수. **화면에 그리는 곳이 없으므로 ref 하나로만 든다.**
   * 예전에는 `score + 1`을 렌더 클로저에서 더해, 한 프레임에 두 번 들어오면 1점만 올랐다.
   * state와 ref 양쪽에 들면 초기값이 갈리므로(기타 48 · 피아노 49 · 드럼 50에서 나온 자리)
   * 여기서는 ref만 둔다.
   */
  const scoreRef = useRef(0);

  /** 다음 문제로 넘기는 타이머. 끊지 않으면 종료·난이도 변경·언마운트·탭 이탈 뒤에 늦게 도착한다 */
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNextRoundTimer = useCallback(() => {
    if (nextRoundTimerRef.current) {
      clearTimeout(nextRoundTimerRef.current);
      nextRoundTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearNextRoundTimer();
    };
  }, [clearNextRoundTimer]);

  const currentDifficulty = WORD_DIFFICULTY_LEVELS[difficulty];
  const availablePairs = currentDifficulty.pairs;
  const maxRounds = currentDifficulty.rounds;

  const startNewRound = useCallback(() => {
    // 새 문제를 내는 순간 채점을 다시 받는다
    isGradingLockedRef.current = false;

    setUsedPairs(prev => {
      // 아직 사용하지 않은 단어 쌍 찾기
      const availableIndices = availablePairs
        .map((_, index) => index)
        .filter(index => !prev.has(index));

      // 모든 단어 쌍을 사용했다면 리셋
      let indicesToUse = availableIndices;
      let newUsedPairs = prev;
      
      if (availableIndices.length === 0) {
        indicesToUse = availablePairs.map((_, index) => index);
        newUsedPairs = new Set();
      }

      // 랜덤으로 단어 쌍 선택
      const randomIndex = indicesToUse[Math.floor(Math.random() * indicesToUse.length)];
      const selectedPair = availablePairs[randomIndex];
      
      setCurrentWordPair(selectedPair);

      // 랜덤으로 word1 또는 word2 중 하나를 정답으로 선택
      const isWord1 = Math.random() < 0.5;
      setCorrectWord(isWord1 ? 'word1' : 'word2');
      setCorrectSound(isWord1 ? selectedPair.sound1 : selectedPair.sound2);
      setSelectedAnswer(null);
      setIsLastAnswerCorrect(null);

      setGameState('ready');
      
      // 사용한 단어 쌍 기록하여 반환
      return new Set([...newUsedPairs, randomIndex]);
    });
  }, [availablePairs]);

  const handleAnswer = useCallback(
    (selectedWord: string) => {
      if (isGradingLockedRef.current || gameState !== 'answered' || !currentWordPair || !correctWord) {
        return;
      }

      // 이 라운드의 채점은 여기서 한 번뿐이다. 다음 문제(`startNewRound`)에서 풀린다
      isGradingLockedRef.current = true;

      const correctWordText = currentWordPair[correctWord];
      const isCorrect = selectedWord === correctWordText;
      setSelectedAnswer(selectedWord);
      setIsLastAnswerCorrect(isCorrect);

      // 점수는 ref 하나로만 더한다 — 렌더 클로저의 `score + 1`은 겹친 입력에서 하나를 잃는다
      if (isCorrect) {
        scoreRef.current += 1;
      }
      setFeedbackMessage(isCorrect ? '⭕' : '❌');
      setShowFeedback(true);
      
      // 정답/오답 기록 추가
      setAnswerHistory(prev => [...prev, isCorrect]);

      setGameState('waitingForNextRound');

      // 600ms 후 자동으로 다음 문제 진행
      clearNextRoundTimer();
      nextRoundTimerRef.current = setTimeout(() => {
        nextRoundTimerRef.current = null;
        setShowFeedback(false);
        if (round >= maxRounds) {
          onGameComplete?.(scoreRef.current, maxRounds, Math.round((scoreRef.current / maxRounds) * 100));
        } else {
          setRound((prevRound) => prevRound + 1);
          startNewRound();
        }
      }, 600);
    },
    [gameState, currentWordPair, correctWord, round, maxRounds, onGameComplete, startNewRound, clearNextRoundTimer]
  );

  const resetGame = useCallback(() => {
    clearNextRoundTimer();
    scoreRef.current = 0;
    setRound(1);
    setAnswerHistory([]);
    setUsedPairs(new Set());
    setShowFeedback(false);
    setFeedbackMessage('');
    startNewRound();
  }, [startNewRound, clearNextRoundTimer]);

  const resetGameWithoutStarting = useCallback(() => {
    clearNextRoundTimer();
    isGradingLockedRef.current = false;
    scoreRef.current = 0;
    setRound(1);
    setCurrentWordPair(null);
    setCorrectWord(null);
    setCorrectSound(null);
    setSelectedAnswer(null);
    setIsLastAnswerCorrect(null);
    setGameState('ready');
    setShowFeedback(false);
    setFeedbackMessage('');
    setAnswerHistory([]);
    setUsedPairs(new Set());
  }, [clearNextRoundTimer]);

  /**
   * 「그만하기」 — 조기 종료. 정상 종료(마지막 라운드 타이머)와 **같은 `onGameComplete`**로 나간다.
   * 설계 원문은 `doc/learn-그만하기.md`.
   *
   * 1. 타이머를 먼저 끊는다 — `waitingForNextRound`의 600ms가 뒤에 도착하면
   *    다음 문제나 결과가 **한 번 더** 나간다
   * 2. `maxScore`에는 `maxRounds`(5·10)가 아니라 **푼 수**를 넣는다.
   *    3문제에서 접으면 `3/3`이지 `3/5`가 아니다
   *
   * 푼 수는 **채점이 끝난 라운드**만 센다 — `waitingForNextRound`(고르고 피드백이 떠 있다)만
   * 이번 라운드를 세고, `ready`·`playing`·`answered`는 `round - 1`이다.
   * `answered`는 이름과 달리 **선택지가 떠 있고 아직 안 고른** 상태다 —
   * 여기서 접으면 안 푼 문제가 분모에 들어가 `3/4`가 됐다 (세션 60에 사용자가 고른 것).
   *
   * 소리를 끊는 것은 부르는 쪽(`WordGame`)이 한다 — 오디오는 이 훅이 들고 있지 않다.
   */
  const endGameEarly = useCallback(() => {
    clearNextRoundTimer();

    const answeredCount = gameState === 'waitingForNextRound' ? round : round - 1;
    const percentage =
      answeredCount > 0 ? Math.round((scoreRef.current / answeredCount) * 100) : 0;

    onGameComplete?.(scoreRef.current, answeredCount, percentage);
  }, [gameState, round, onGameComplete, clearNextRoundTimer]);

  const startPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const setAnswered = useCallback(() => {
    setGameState('answered');
  }, []);

  return {
    // State
    currentWordPair,
    correctWord,
    correctSound,
    gameState,
    round,
    showFeedback,
    feedbackMessage,
    selectedAnswer,
    isLastAnswerCorrect,
    currentDifficulty,
 
    
    // Actions
    startNewRound,
    handleAnswer,
    resetGame,
    resetGameWithoutStarting,
    endGameEarly,
    startPlaying,
    setAnswered,
    clearNextRoundTimer,
  };
}

