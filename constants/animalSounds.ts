/**
 * 동물 소리/이미지 설정 통합
 * matchGame, matchGameAI, matchGamePG, orderGame에서 공통 사용
 */

/** 기본 동물 데이터 (Rive 애니메이션 순서 기준) */
const ANIMAL_ITEMS = [
  { name: '고양이', soundFile: require('../assets/sounds/animal_sound/cat.mp3'), imageFile: require('../assets/images/cat.webp'), riveIndex: 0 },
  { name: '닭', soundFile: require('../assets/sounds/animal_sound/cock.mp3'), imageFile: require('../assets/images/cock.webp'), riveIndex: 1 },
  { name: '소', soundFile: require('../assets/sounds/animal_sound/cow.mp3'), imageFile: require('../assets/images/cow.webp'), riveIndex: 2 },
  { name: '개', soundFile: require('../assets/sounds/animal_sound/dog.mp3'), imageFile: require('../assets/images/dog.webp'), riveIndex: 3 },
  { name: '오리', soundFile: require('../assets/sounds/animal_sound/duck.mp3'), imageFile: require('../assets/images/duck.webp'), riveIndex: 4 },
  { name: '코끼리', soundFile: require('../assets/sounds/animal_sound/elephant.mp3'), imageFile: require('../assets/images/elephant.webp'), riveIndex: 5 },
  { name: '염소', soundFile: require('../assets/sounds/animal_sound/goat.mp3'), imageFile: require('../assets/images/goat.webp'), riveIndex: 6 },
  { name: '말', soundFile: require('../assets/sounds/animal_sound/horse.mp3'), imageFile: require('../assets/images/horse.webp'), riveIndex: 7 },
  { name: '사자', soundFile: require('../assets/sounds/animal_sound/lion.mp3'), imageFile: require('../assets/images/lion.webp'), riveIndex: 8 },
  { name: '원숭이', soundFile: require('../assets/sounds/animal_sound/monkey.mp3'), imageFile: require('../assets/images/monkey.webp'), riveIndex: 9 },
  { name: '돼지', soundFile: require('../assets/sounds/animal_sound/pig.mp3'), imageFile: require('../assets/images/pig.webp'), riveIndex: 10 },
  { name: '늑대', soundFile: require('../assets/sounds/animal_sound/wolf.mp3'), imageFile: require('../assets/images/wolf.webp'), riveIndex: 11 },
] as const;

/** matchGameAI, matchGamePG용: { name, file } */
export const SOUNDS_CONFIG = ANIMAL_ITEMS.map(({ name, soundFile }) => ({ name, file: soundFile }));

/** orderGame용: { sound, image, name } */
export const SOUNDS_WITH_IMAGE = ANIMAL_ITEMS.map(({ name, soundFile, imageFile }) => ({
  sound: soundFile,
  image: imageFile,
  name,
}));

/** matchGame용: { sound, image, name, riveIndex } */
export const SOUNDS_WITH_RIVE = ANIMAL_ITEMS.map(({ name, soundFile, imageFile, riveIndex }) => ({
  sound: soundFile,
  image: imageFile,
  name,
  riveIndex,
}));
