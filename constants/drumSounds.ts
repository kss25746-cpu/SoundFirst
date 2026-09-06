export interface DrumInstrument {
  name: string;
  description: string;
  sound: any;
  image: any;
}

export const DRUM_INSTRUMENTS= {
  kick: {
    name: '킥드럼',
    description: '둔탁하고 깊은 저음',
    sound: require('@/assets/sounds/drum_sound/Kick.wav'),
    image: require('@/assets/images/kick_drum.png'),
  },
  snare: {
    name: '스네어',
    description: '날카롭게 튀는 소리',
    sound: require('@/assets/sounds/drum_sound/Snare_15.wav'),
    image: require('@/assets/images/snare_drum.png'),
  },
  hihat: {
    name: '하이햇',
    description: '짧고 선명한 금속음',
    sound: require('@/assets/sounds/drum_sound/HiHatOpen_15.wav'),
    image: require('@/assets/images/hihat_n.png'),
  },
  cymbal: {
    name: '심벌',
    description: '긴 울림의 금속음',
    sound: require('@/assets/sounds/drum_sound/Crash_15.wav'),
    image: require('@/assets/images/crash.png'),
  },
  tom: {
    name: '탐',
    description: '중음역의 둥근 소리',
    sound: require('@/assets/sounds/drum_sound/Tom_20.wav'),
    image: require('@/assets/images/tom_fit.png'),
  },
}  as const satisfies Record<string, DrumInstrument>;



export const DIFFICULTY_LEVELS = {
  beginner: {
    name: '초급',
    instruments: ['kick', 'snare'] as const,
    rounds: 5,
    description: '2가지 악기'
  },
  intermediate_3: {
    name: '중급',
    instruments: ['kick', 'snare', 'hihat'] as const,
    rounds: 7,
    description: '3가지 악기'
  },
  intermediate_4: {
    name: '상급',
    instruments: ['kick', 'snare', 'hihat', 'cymbal'] as const,
    rounds: 8,
    description: '4가지 악기'
  },
  intermediate: {
    name: '고급',
    instruments: ['kick', 'snare', 'hihat', 'cymbal', 'tom'] as const,
    rounds: 10,
    description: '5가지 악기'
  }
};

export type InstrumentType = keyof typeof DRUM_INSTRUMENTS;
export type DifficultyType = keyof typeof DIFFICULTY_LEVELS;
