import type { Difficulty, Note } from '../types/music';

// 사운드 파일 경로 (52개 수동 제공 M4A 파일 매핑)
export const soundFiles: { [key in Note]: any } = {
  'C1': require('../assets/sounds/piano_mp4/C1.m4a'), 'C#1': require('../assets/sounds/piano_mp4/C_sharp1.m4a'),
  'D1': require('../assets/sounds/piano_mp4/D1.m4a'), 'D#1': require('../assets/sounds/piano_mp4/D_sharp1.m4a'),
  'E1': require('../assets/sounds/piano_mp4/E1.m4a'), 'F1': require('../assets/sounds/piano_mp4/F1.m4a'),
  'F#1': require('../assets/sounds/piano_mp4/F_sharp1.m4a'), 'G1': require('../assets/sounds/piano_mp4/G1.m4a'),
  'G#1': require('../assets/sounds/piano_mp4/G_sharp1.m4a'), 'A1': require('../assets/sounds/piano_mp4/A1.m4a'),
  'A#1': require('../assets/sounds/piano_mp4/A_sharp1.m4a'), 'B1': require('../assets/sounds/piano_mp4/B1.m4a'),
  'C2': require('../assets/sounds/piano_mp4/C2.m4a'), 'C#2': require('../assets/sounds/piano_mp4/C_sharp2.m4a'),
  'D2': require('../assets/sounds/piano_mp4/D2.m4a'), 'D#2': require('../assets/sounds/piano_mp4/D_sharp2.m4a'),
  'E2': require('../assets/sounds/piano_mp4/E2.m4a'), 'F2': require('../assets/sounds/piano_mp4/F2.m4a'),
  'F#2': require('../assets/sounds/piano_mp4/F_sharp2.m4a'), 'G2': require('../assets/sounds/piano_mp4/G2.m4a'),
  'G#2': require('../assets/sounds/piano_mp4/G_sharp2.m4a'), 'A2': require('../assets/sounds/piano_mp4/A2.m4a'),
  'A#2': require('../assets/sounds/piano_mp4/A_sharp2.m4a'), 'B2': require('../assets/sounds/piano_mp4/B2.m4a'),
  'C3': require('../assets/sounds/piano_mp4/C3.m4a'), 'C#3': require('../assets/sounds/piano_mp4/C_sharp3.m4a'),
  'D3': require('../assets/sounds/piano_mp4/D3.m4a'), 'D#3': require('../assets/sounds/piano_mp4/D_sharp3.m4a'),
  'E3': require('../assets/sounds/piano_mp4/E3.m4a'), 'F3': require('../assets/sounds/piano_mp4/F3.m4a'),
  'F#3': require('../assets/sounds/piano_mp4/F_sharp3.m4a'), 'G3': require('../assets/sounds/piano_mp4/G3.m4a'),
  'G#3': require('../assets/sounds/piano_mp4/G_sharp3.m4a'), 'A3': require('../assets/sounds/piano_mp4/A3.m4a'),
  'A#3': require('../assets/sounds/piano_mp4/A_sharp3.m4a'), 'B3': require('../assets/sounds/piano_mp4/B3.m4a'),
  'C4': require('../assets/sounds/piano_mp4/C4.m4a'), 'C#4': require('../assets/sounds/piano_mp4/C_sharp4.m4a'),
  'D4': require('../assets/sounds/piano_mp4/D4.m4a'), 'D#4': require('../assets/sounds/piano_mp4/D_sharp4.m4a'),
  'E4': require('../assets/sounds/piano_mp4/E4.m4a'), 'F4': require('../assets/sounds/piano_mp4/F4.m4a'),
  'F#4': require('../assets/sounds/piano_mp4/F_sharp4.m4a'), 'G4': require('../assets/sounds/piano_mp4/G4.m4a'),
  'G#4': require('../assets/sounds/piano_mp4/G_sharp4.m4a'), 'A4': require('../assets/sounds/piano_mp4/A4.m4a'),
  'A#4': require('../assets/sounds/piano_mp4/A_sharp4.m4a'), 'B4': require('../assets/sounds/piano_mp4/B4.m4a'),
  'C5': require('../assets/sounds/piano_mp4/C5.m4a'), 'C#5': require('../assets/sounds/piano_mp4/C_sharp5.m4a'),
  'D5': require('../assets/sounds/piano_mp4/D5.m4a'), 'D#5': require('../assets/sounds/piano_mp4/D_sharp5.m4a'),
};

// 흑건 여부 맵 (52음 전체)
export const isBlackKeyMap: { [key in Note]: boolean } = {
  'C1': false, 'C#1': true, 'D1': false, 'D#1': true, 'E1': false, 'F1': false, 'F#1': true, 'G1': false, 'G#1': true, 'A1': false, 'A#1': true, 'B1': false,
  'C2': false, 'C#2': true, 'D2': false, 'D#2': true, 'E2': false, 'F2': false, 'F#2': true, 'G2': false, 'G#2': true, 'A2': false, 'A#2': true, 'B2': false,
  'C3': false, 'C#3': true, 'D3': false, 'D#3': true, 'E3': false, 'F3': false, 'F#3': true, 'G3': false, 'G#3': true, 'A3': false, 'A#3': true, 'B3': false,
  'C4': false, 'C#4': true, 'D4': false, 'D#4': true, 'E4': false, 'F4': false, 'F#4': true, 'G4': false, 'G#4': true, 'A4': false, 'A#4': true, 'B4': false,
  'C5': false, 'C#5': true, 'D5': false, 'D#5': true,
};

export const allNotes = Object.keys(isBlackKeyMap) as Note[];
export const whiteNotes = allNotes.filter(note => !isBlackKeyMap[note]);

// 각 Note별 백건 인덱스 맵 구성 (포커싱 및 매핑용)
export const whiteIdxRefById = new Map<string, number>();
let whiteCount = 0;
let lastWhiteIdx = 0;
allNotes.forEach(note => {
  const isBlack = isBlackKeyMap[note];
  if (isBlack) {
    whiteIdxRefById.set(note, lastWhiteIdx);
  } else {
    whiteIdxRefById.set(note, whiteCount);
    lastWhiteIdx = whiteCount;
    whiteCount++;
  }
});

export const whiteIdxMap: Record<string, number> = {};
whiteIdxRefById.forEach((val, key) => { whiteIdxMap[key] = val; });

export const difficultyLevels: { name: Difficulty, label: string }[] = [
  { name: '1단계', label: '입문' },
  { name: '2단계', label: '초급' },
  { name: '3단계', label: '중급' },
  { name: '4단계', label: '상급' },
  { name: '5단계', label: '전문' },
];

// 키보드-음계 매핑 (물리 건반 단축키용)
export const keyToNoteMap: { [key: string]: Note } = {
  'q': 'C3', 'w': 'D3', 'e': 'E3', 'r': 'F3', 't': 'G3', 'y': 'A3', 'u': 'B3',
  'i': 'C4', 'o': 'D4', 'p': 'E4', '[': 'F4', ']': 'G4', '\\': 'A4', 'a': 'B4',
  's': 'C5', 'd': 'D5',
  'Q': 'C#3', 'W': 'D#3', 'R': 'F#3', 'T': 'G#3', 'Y': 'A#3',
  'I': 'C#4', 'O': 'D#4', '{': 'F#4', '}': 'G#4', '|': 'A#4',
  'S': 'C#5', 'D': 'D#5',
  'f': 'C1', 'g': 'D1', 'h': 'E1', 'j': 'F1', 'k': 'G1', 'l': 'A1', ';': 'B1',
  "'": 'C2', 'z': 'D2', 'x': 'E2', 'c': 'F2', 'v': 'G2', 'b': 'A2', 'n': 'B2',
  'F': 'C#1', 'G': 'D#1', 'J': 'F#1', 'K': 'G#1', 'L': 'A#1',
  '"': 'C#2', 'Z': 'D#2', 'C': 'F#2', 'V': 'G#2', 'B': 'A#2',
};

export const noteToKeyMap = Object.entries(keyToNoteMap).reduce((acc, [key, note]) => {
  acc[note] = key;
  return acc;
}, {} as { [note in Note]?: string });

export const level1_absoluteBeginner: Note[] = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];
export const level2_beginner: Note[] = allNotes.slice(allNotes.indexOf('C3'), allNotes.indexOf('C5') + 1).filter(note => !isBlackKeyMap[note]);
export const level3_intermediate: Note[] = allNotes.slice(allNotes.indexOf('C3'), allNotes.indexOf('B4') + 1);
export const level4_advanced: Note[] = allNotes;
export const level5_specialTraining: Note[] = allNotes.filter(note => isBlackKeyMap[note]);

export const MUSIC_PROGRESS_KEY = '@MiniGameApp:musicProgress';

export interface MusicProgress {
  [difficulty: string]: {
    cumulativeSuccesses: number;
    highestScore: number;
  };
}
