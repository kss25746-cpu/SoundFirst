export interface WordPair {
  readonly id: string; // 🔑 Stable ID for React keys
  word1: string;
  word2: string;
  sound1: any;
  sound2: any;
  difficulty: 'easy' | 'normal';
}

// ✅ 쉬운 난이도 단어 쌍 - Object.freeze로 불변성 보장
export const EASY_WORD_PAIRS: readonly WordPair[] = Object.freeze([

  {
    id: 'easy-물불',
    word1: '물',
    word2: '불',
    sound1: require('../assets/sounds/generated_words/물.wav'),
    sound2: require('../assets/sounds/generated_words/불.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-산살',
    word1: '산',
    word2: '살',
    sound1: require('../assets/sounds/generated_words/산.wav'),
    sound2: require('../assets/sounds/generated_words/살.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-코쿠',
    word1: '코',
    word2: '쿠',
    sound1: require('../assets/sounds/generated_words/코.wav'),
    sound2: require('../assets/sounds/generated_words/쿠.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-사싸',
    word1: '사',
    word2: '싸',
    sound1: require('../assets/sounds/generated_words/사.wav'),
    sound2: require('../assets/sounds/generated_words/싸.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-달탈',
    word1: '달',
    word2: '탈',
    sound1: require('../assets/sounds/generated_words/달.wav'),
    sound2: require('../assets/sounds/generated_words/탈.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-눈룬',
    word1: '눈',
    word2: '룬',
    sound1: require('../assets/sounds/generated_words/눈.wav'),
    sound2: require('../assets/sounds/generated_words/룬.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-나라',
    word1: '나',
    word2: '라',
    sound1: require('../assets/sounds/generated_words/나.wav'),
    sound2: require('../assets/sounds/generated_words/라.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-밤밥',
    word1: '밤',
    word2: '밥',
    sound1: require('../assets/sounds/generated_words/밤.wav'),
    sound2: require('../assets/sounds/generated_words/밥.wav'),
    difficulty: 'easy',
  },
  {
    id: 'easy-고기도기',
    word1: '고기',
    word2: '도기',
    sound1: require('../assets/sounds/generated_words/고기.wav'),
    sound2: require('../assets/sounds/generated_words/도기.wav'),
    difficulty: 'easy',
  },

] as const);

// ✅ 보통 난이도 단어 쌍 - Object.freeze로 불변성 보장
export const NORMAL_WORD_PAIRS: readonly WordPair[] = Object.freeze([
  {
    id: 'normal-머리멀리',
    word1: '머리',
    word2: '멀리',
    sound1: require('../assets/sounds/generated_words/머리.wav'),
    sound2: require('../assets/sounds/generated_words/멀리.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-길빌',
    word1: '길',
    word2: '빌',
    sound1: require('../assets/sounds/generated_words/길.wav'),
    sound2: require('../assets/sounds/generated_words/빌.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-칼탈',
    word1: '칼',
    word2: '탈',
    sound1: require('../assets/sounds/generated_words/칼.wav'),
    sound2: require('../assets/sounds/generated_words/탈.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-문민',
    word1: '문',
    word2: '민',
    sound1: require('../assets/sounds/generated_words/문.wav'),
    sound2: require('../assets/sounds/generated_words/민.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-돌놀',
    word1: '돌',
    word2: '놀',
    sound1: require('../assets/sounds/generated_words/돌.wav'),
    sound2: require('../assets/sounds/generated_words/놀.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-손돈',
    word1: '손',
    word2: '돈',
    sound1: require('../assets/sounds/generated_words/손.wav'),
    sound2: require('../assets/sounds/generated_words/돈.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-말멀',
    word1: '말',
    word2: '멀',
    sound1: require('../assets/sounds/generated_words/말.wav'),
    sound2: require('../assets/sounds/generated_words/멀.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-비피',
    word1: '비',
    word2: '피',
    sound1: require('../assets/sounds/generated_words/비.wav'),
    sound2: require('../assets/sounds/generated_words/피.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-닭달',
    word1: '닭',
    word2: '달',
    sound1: require('../assets/sounds/generated_words/닭.wav'),
    sound2: require('../assets/sounds/generated_words/달.wav'),
    difficulty: 'normal',
  },
  {
    id: 'normal-봄몸',
    word1: '봄',
    word2: '몸',
    sound1: require('../assets/sounds/generated_words/봄.wav'),
    sound2: require('../assets/sounds/generated_words/몸.wav'),
    difficulty: 'normal',
  },

] as const);




// 난이도별 설정
export const WORD_DIFFICULTY_LEVELS = {
  easy: {
    name: '맛보기',
    pairs: EASY_WORD_PAIRS,
    rounds: 5,
    description: '5문제 · 힌트 있음',
  },
  normal: {
    name: '도전',
    pairs: NORMAL_WORD_PAIRS,
    rounds: 10,
    description: '10문제 · 힌트 없음',
  },
} as const;

export type WordDifficultyType = keyof typeof WORD_DIFFICULTY_LEVELS;