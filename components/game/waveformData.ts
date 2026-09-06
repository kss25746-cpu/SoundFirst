/** 단어에 따른 불변 파형 데이터 반환 */
export function getImmutableWaveformData(word: string): readonly number[] {
  // 만약 빈 문자열 또는 null이 들어오면 빈 배열 반환.
  // 사용처(WordFlashcard 등)에서 빈 배열도 안전하게 처리하므로,
  // 별도의 예외 처리나 경고 없이 빈 배열 반환만 해도 괜찮음.
  if (!word) return [];
  const seed = word.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const bars = Array.from({ length: 24 }, (_, i) => {
    const t = (i + seed) * 0.3;
    return 0.2 + 0.6 * (Math.sin(t) * 0.5 + 0.5);
  });
  return Object.freeze(bars);
}
