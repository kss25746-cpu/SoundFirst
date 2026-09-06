import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWordAudioPlayer } from '../../hooks/useWordAudioPlayer';
import { useStopAudioOnBlur } from '../../hooks/useStopAudioOnBlur';
import { WordPair } from '../../constants/wordSounds';
import { LAYOUT } from '../../constants/layout';
import { COLORS, WAVEFORM_GRADIENT } from '../../constants/colors';
import { Waveform } from './Waveform';
import { getImmutableWaveformData } from './waveformData';

interface WordFlashcardProps {
  readonly wordPair: WordPair;
}

export function WordFlashcard({ wordPair }: Readonly<WordFlashcardProps>) {
  const audioPlayer = useWordAudioPlayer();
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  // ✅ SSOT: showWaveform은 playingWord에서 파생
  const showWaveform = playingWord !== null;

  /**
   * 파형 데이터도 `playingWord`에서 파생한다.
   * **`useMemo`가 필수다** — 새 배열을 주면 `Waveform`의 `useDerivedValue` 의존성이 바뀌어
   * 렌더마다 mapper가 정지·재시작된다 (`useDerivedValue.ts:72-80`).
   */
  const waveformData = useMemo(() => getImmutableWaveformData(playingWord ?? ''), [playingWord]);

  /**
   * 지금 소리 나는 단어카드. 전체듣기는 단어1 → 단어2로 **혼자 넘어가므로**,
   * 어느 쪽이 울리고 있는지 화면에 표시가 없으면 파형만 바뀌고 이유를 알 수 없다.
   * 전에는 전체듣기 중 두 장을 똑같이 흐리게만 했다.
   */
  const isWord1Playing = playingWord === wordPair.word1;
  const isWord2Playing = playingWord === wordPair.word2;

  /** '전체 듣기'에서 단어1 → 단어2로 넘어가는 대기 타이머 (탭을 떠날 때 취소해야 한다) */
  const playAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // wordPair 변경 시 상태 초기화
  useEffect(() => {
    setPlayingWord(null);
    setIsPlayingAll(false);
    // showWaveform은 자동으로 false가 됨 (파생 상태)
  }, [wordPair]);

  // 📖 탭을 떠날 때 단어 소리를 끊는다.
  // 탭은 언마운트되지 않으므로 화면의 `setCurrentIndex(0)`만으로는 소리가 멈추지 않는다.
  // 대기 중인 '전체 듣기' 타이머도 같이 취소해야 떠난 뒤에 단어2가 울리지 않는다.
  useStopAudioOnBlur(() => {
    if (playAllTimerRef.current) {
      clearTimeout(playAllTimerRef.current);
      playAllTimerRef.current = null;
    }
    audioPlayer.stopSound();
    setPlayingWord(null);
    setIsPlayingAll(false);
  });

  // 단어 1 재생 핸들러
  const handlePlayWord1 = () => {
    if (isPlayingAll) return;
    
    // ✅ SSOT: playingWord만 설정, showWaveform은 자동 파생
    setPlayingWord(wordPair.word1);
    
    // 재생 완료 시 상태 초기화
    audioPlayer.playWordSound(wordPair.sound1, wordPair.word1, () => {
      setPlayingWord(null);
      // showWaveform은 자동으로 false가 됨
    });
  };

  // 단어 2 재생 핸들러
  const handlePlayWord2 = () => {
    if (isPlayingAll) return;
    
    // ✅ SSOT: playingWord만 설정, showWaveform은 자동 파생
    setPlayingWord(wordPair.word2);
    
    // 재생 완료 시 상태 초기화
    audioPlayer.playWordSound(wordPair.sound2, wordPair.word2, () => {
      setPlayingWord(null);
      // showWaveform은 자동으로 false가 됨
    });
  };

  // word1 재생 완료 후 word2 준비
  const handleWord1Complete = () => {
    playAllTimerRef.current = setTimeout(() => {
      playAllTimerRef.current = null;
      setPlayingWord(wordPair.word2);
      audioPlayer.playWordSound(wordPair.sound2, wordPair.word2, handleWord2Complete);
    }, 300);
  };

  // word2 재생 완료 후 상태 초기화
  const handleWord2Complete = () => {
    setPlayingWord(null);
    setIsPlayingAll(false);
  };

  // ✅ 전체 듣기 핸들러 - 단순하고 안정적인 순차 재생
  const handlePlayAll = () => {
    if (isPlayingAll) return;
    
    setIsPlayingAll(true);
    setPlayingWord(wordPair.word1);
    audioPlayer.playWordSound(wordPair.sound1, wordPair.word1, handleWord1Complete);
  };

  return (
    <View style={styles.container}>
      {/* 단어 쌍 카드 + 파형. 남는 세로 공간을 이 블록이 위아래로 나눠 갖는다 */}
      <View style={styles.wordsBlock}>
        <View style={styles.wordsRow}>
          {/* 단어 1 */}
          <View style={styles.wordColumnContainer}>
            <TouchableOpacity
              style={[
                styles.wordCard,
                isWord1Playing && styles.wordCardPlaying,
                isPlayingAll && !isWord1Playing && styles.wordCardDimmed,
              ]}
              onPress={handlePlayWord1}
              disabled={isPlayingAll}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${wordPair.word1} 듣기`}
              accessibilityState={{ disabled: isPlayingAll, busy: isWord1Playing }}
            >
              <Text style={styles.wordText}>{wordPair.word1}</Text>
              <View style={styles.playButton}>
                <Ionicons
                  name={isWord1Playing ? 'volume-high' : 'volume-medium-outline'}
                  size={LAYOUT.wordPlayIconSize}
                  color={isWord1Playing ? COLORS.successOnWhite : COLORS.success}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* VS 표시 */}
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          {/* 단어 2 */}
          <View style={styles.wordColumnContainer}>
            <TouchableOpacity
              style={[
                styles.wordCard,
                isWord2Playing && styles.wordCardPlaying,
                isPlayingAll && !isWord2Playing && styles.wordCardDimmed,
              ]}
              onPress={handlePlayWord2}
              disabled={isPlayingAll}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${wordPair.word2} 듣기`}
              accessibilityState={{ disabled: isPlayingAll, busy: isWord2Playing }}
            >
              <Text style={styles.wordText}>{wordPair.word2}</Text>
              <View style={styles.playButton}>
                <Ionicons
                  name={isWord2Playing ? 'volume-high' : 'volume-medium-outline'}
                  size={LAYOUT.wordPlayIconSize}
                  color={isWord2Playing ? COLORS.successOnWhite : COLORS.success}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 파형 표시 영역 - 고정 공간.
            전체듣기 중에도 그린다. 전에는 `!isPlayingAll`로 막혀 있어서, 정작 소리가
            이어서 나는 동안 파형 자리가 빈 채로 남았다 (자리는 늘 차지하고 있었다) */}
        <View style={styles.waveformContainer}>
          {showWaveform && (
            <Waveform
              data={waveformData}
              color={WAVEFORM_GRADIENT.start}
              width={LAYOUT.waveformWidth}
              height={LAYOUT.waveformHeight}
              progress={audioPlayer.progress}
            />
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.playAllButton, isPlayingAll && styles.playAllButtonDisabled]}
        onPress={handlePlayAll}
        disabled={isPlayingAll}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={isPlayingAll ? '두 단어를 이어서 재생 중입니다' : '두 단어를 이어서 듣기'}
        accessibilityState={{ disabled: isPlayingAll, busy: isPlayingAll }}
      >
        {/* 아이콘이 글자 앞에 선다. 전에는 자식이 글자 하나뿐이라 style의 gap 8이 죽은 값이었다 */}
        <Ionicons
          name={isPlayingAll ? 'musical-notes' : 'volume-high'}
          size={LAYOUT.playAllButtonIconSize}
          color={isPlayingAll ? COLORS.textSecondary : COLORS.white}
        />
        <Text style={[styles.playAllButtonText, isPlayingAll && styles.playAllButtonTextDisabled]}>
          {isPlayingAll ? '재생 중...' : '전체 듣기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: LAYOUT.containerPaddingV,
    paddingHorizontal: LAYOUT.containerPaddingH,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: LAYOUT.playAllButtonPaddingH,
    paddingVertical: LAYOUT.playAllButtonPaddingV,
    borderRadius: LAYOUT.playAllButtonBorderRadius,
    // `marginTop: 'auto'`는 남는 공간을 **전부** 버튼 위에 몰아넣는다.
    // 태블릿처럼 카드가 커지면 단어 카드는 위에 붙고 버튼만 바닥에 떨어져 균형이 깨진다.
    // 지금은 `wordsBlock`(flex: 1, 가운데 정렬)이 여유를 나눠 갖고, 여기서는 최소 간격만 준다.
    marginTop: LAYOUT.playAllButtonMarginTop,
    marginBottom: LAYOUT.playAllButtonMarginBottom,
    elevation: LAYOUT.playAllButtonElevation,
    gap: 8,
  },
  /**
   * 재생 중(비활성). 화살표·학습완료 버튼과 같은 처리다 (`navigationArrowButtonDisabled`).
   * 전에는 `borderGray`(#BDBDBD)에 `opacity: 0.6`을 덮고 글자가 흰색이라
   * 「재생 중...」이 1.5:1로 사라졌다 — 정작 상태를 알려야 할 때 안 읽혔다.
   */
  playAllButtonDisabled: {
    backgroundColor: COLORS.grayLight,
    elevation: 0,
  },
  playAllButtonText: {
    fontSize: LAYOUT.playAllButtonFontSize,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  playAllButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  wordsBlock: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: LAYOUT.wordsRowMarginBottom,
  },
  wordColumnContainer: {
    alignItems: 'center',
    gap: LAYOUT.wordColumnContainerGap,
  },
  wordCard: {
    backgroundColor: COLORS.white,
    borderRadius: LAYOUT.wordCardBorderRadius,
    padding: LAYOUT.wordCardPadding,
    alignItems: 'center',
    minWidth: LAYOUT.wordCardMinWidth,
    elevation: 4,
    // 테두리는 늘 자리를 차지하되 평소에는 보이지 않는다.
    // 재생 중에만 색을 넣으면 카드 크기가 그대로라 글자가 흔들리지 않는다
    borderWidth: 2,
    borderColor: 'transparent',
  },
  /** 지금 소리 나는 카드 */
  wordCardPlaying: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.backgroundSuccess,
    elevation: 8,
  },
  /** 전체듣기 중 지금 울리지 않는 쪽 */
  wordCardDimmed: {
    opacity: 0.5,
  },
  wordText: {
    fontSize: LAYOUT.wordTextFontSize,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: LAYOUT.wordTextMarginBottom,
  },
  playButton: {
    padding: LAYOUT.playButtonPadding,
  },
  vsContainer: {
    backgroundColor: WAVEFORM_GRADIENT.start,
    borderRadius: 24,
    paddingHorizontal: LAYOUT.vsPaddingH,
    paddingVertical: LAYOUT.vsPaddingV,
  },
  vsText: {
    fontSize: LAYOUT.vsFontSize,
    fontWeight: 'bold',
    color: 'white',
  },
  /**
   * 파형 자리. **높이를 Canvas와 같은 값으로 둔다** — 전에는 상자 39에 Canvas 60이라
   * Canvas가 21px 삐져나왔고 `paddingVertical`은 그 아래 깔려 뜻이 없었다.
   */
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: LAYOUT.waveformHeight,
  },
});

export default WordFlashcard;
