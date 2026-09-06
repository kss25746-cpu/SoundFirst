import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  PanResponder,
  useWindowDimensions,
  ActivityIndicator,

} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Context 및 컴포넌트 임포트
import { LandscapeBackButton } from '../components/LandscapeBackButton';
import MissionProgressIcon from '../components/MissionProgressIcon';
import {
  DifficultyRow,
  InstrumentButton,
  InstrumentControlBar,
  ScoreFeedback,
  useInstrumentMetrics,
} from '../components/instrument';
import { CONTROL_BAR, INSTRUMENT_ACCENT, SEMANTIC } from '../constants/instrumentTheme';
import { ClearContext } from '../context/ClearContext';
import { StarContext } from '../context/StarContext';
import { RippleLayer } from '../components/RippleLayer';
import { ParticleVisualizer } from '../components/ParticleVisualizer';
import { MiniKeyboardMap } from '../components/MiniKeyboardMap';
import { FallingNoteTrack } from '../components/FallingNoteTrack';
import { FallingReplayPrompt, FallingResultOverlay } from '../components/FallingResultOverlays';
import SongSlotFrame from '../assets/icons/pan_res.svg';
import ConsoleFrame from '../assets/icons/console_res.svg';
import { songs, type Song, type SongScale } from '../data/songs';
import { useStopAudioOnBlur } from '../hooks/useStopAudioOnBlur';
import type { Difficulty, Note } from '../types/music';
import {
  MUSIC_PROGRESS_KEY,
  allNotes,
  difficultyLevels,
  isBlackKeyMap,
  level1_absoluteBeginner,
  level2_beginner,
  level3_intermediate,
  level4_advanced,
  level5_specialTraining,
  noteToKeyMap,
  soundFiles,
  whiteIdxRefById,
  type MusicProgress,
} from '../constants/music';
import {
  HIT_WINDOW_MS,
  computeFocusStart,
  fallingScaleLabels,
  fallingTempoLabels,
  getFallingClearTarget,
  getFallingNoteId,
  getJudgmentGrade,
  type FallingResult,
  type FallingTempoMode,
  type FallingTrackMetrics,
  type ScheduledFallingNote,
} from './musicTrainingHelpers';
import { useSyncGameData } from '../hooks/useSyncGameData';



const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PIANO = INSTRUMENT_ACCENT.piano;

const useAutoFocusViewport = ({
  currentNote,
  viewportStartIdx,
  setViewportStartIdx,
  totalWhite,
  viewportSize = 14,
}: {
  currentNote: string | null;
  viewportStartIdx: number;
  setViewportStartIdx: React.Dispatch<React.SetStateAction<number>>;
  totalWhite: number;
  viewportSize?: number;
}) => {
  const startRef = useRef(viewportStartIdx);

  useEffect(() => {
    startRef.current = viewportStartIdx;
  }, [viewportStartIdx]);

  useEffect(() => {
    if (currentNote == null) return;
    const noteWhiteIdx = whiteIdxRefById.get(currentNote);
    if (noteWhiteIdx == null) return;

    const base = startRef.current;
    const target = computeFocusStart(noteWhiteIdx, base, viewportSize, totalWhite);
    if (target === base) return;

    startRef.current = target;
    setViewportStartIdx(target);
  }, [currentNote, totalWhite, viewportSize, setViewportStartIdx]);
};

/**
 * 상주시킬 건반 플레이어 수.
 *
 * 안드로이드는 **앱(UID)당 동시 AudioTrack을 약 40개로 제한**한다. `createAudioPlayer`는
 * 재생 여부와 무관하게 만드는 즉시 트랙 하나를 잡으므로(내부에서 `prepare()`까지 한다),
 * 52개를 미리 만들면 한도를 넘겨 **만들어지자마자 죽고 `play()`가 무음이 된다.**
 * 넘겼을 때 뜨는 로그: `AF::Track: no more tracks available` / `Cannot create AudioTrack`.
 *
 * 12인 이유: 동물 12 · 단어 8 · 드럼 5 · 냉장고 1 = **26개가 앱 수명 동안 상주**하므로
 * 이 화면 몫은 14 안팎이다. 여유 2를 두었다. 예전 15는 그 계산 없이 고른 값이었다.
 *
 * 화면에는 27건반(백건 16 + 흑건 11)이 보이므로 **12는 한 화면을 다 못 덮는다.**
 * 처음 누르는 음과 축출된 음을 다시 누를 때 지연이 있다. 한도 안에서의 의도된 절충이다.
 *
 * 근거·다른 방향: `doc/audio-무음-원인과-방향.md`
 */
const CACHE_LIMIT = 12;

type TrainingMode = 'random' | 'falling' | null;

// 2.5D 타격감을 제공하는 개별 피아노 건반 컴포넌트 (UI 스레드 구동)
const PianoKey = React.memo(({
  note,
  isBlack,
  isVisible,
  width,
  height,
  leftPosition,
  onPressIn,
  onPressOut,
  showKeyLabels,
  keyboardLabel,
}: {
  note: Note;
  isBlack: boolean;
  isVisible: boolean;
  width: number;
  height: number;
  leftPosition?: number;
  onPressIn: (note: Note, event: any) => void;
  onPressOut: (note: Note) => void;
  showKeyLabels: boolean;
  keyboardLabel?: string;
}) => {
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      backgroundColor: isBlack
        ? (translateY.value > 0 ? '#2a2a2a' : '#111111')
        : (translateY.value > 0 ? '#ececec' : '#ffffff'),
    };
  });

  const handlePressIn = (event: any) => {
    if (!isVisible) return;

    // Y축으로 즉시 눌림 작동 (백건 18px, 흑건 14px)
    translateY.value = isBlack ? 9 : 12;

    onPressIn(note, event);
  };

  const handlePressOut = () => {
    if (!isVisible) return;

    // 부드럽게 원위치로 복구
    translateY.value = withTiming(0, { duration: 80 });

    onPressOut(note);
  };

  if (isBlack) {
    return (
      <AnimatedPressable
        disabled={!isVisible}
        style={[
          styles.blackKey,
          { width, height, left: leftPosition },
          animatedStyle,
          !isVisible && styles.keyDisabled,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.blackKeyTextLabel, !isVisible && styles.keyLabelDisabled]}>{note}</Text>
        {showKeyLabels && keyboardLabel && (
          <Text style={[styles.blackKeyLabel, !isVisible && styles.keyLabelDisabled]}>{keyboardLabel}</Text>
        )}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      disabled={!isVisible}
      style={[
        styles.whiteKey,
        { width, height },
        animatedStyle,
        !isVisible && styles.whiteKeyDisabled,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={[styles.keyTextLabel, !isVisible && styles.keyLabelDisabled]}>{note}</Text>
      {showKeyLabels && keyboardLabel && (
        <Text style={[styles.whiteKeyLabel, !isVisible && styles.keyLabelDisabled]}>{keyboardLabel}</Text>
      )}
    </AnimatedPressable>
  );
});

// 옥타브 시프트 뷰포트 하의 건반 렌더링
const renderPianoViewportRow = (
  notes: Note[],
  visibleNotes: Set<Note>,
  activeNotes: any,
  handlers: any,
  dynamicStyles: any,
  showKeyLabels: boolean,
  viewportStartIdx: number,
  viewportSize: number
) => {
  const whiteKeys = notes.filter(note => !isBlackKeyMap[note]);

  // 전체 백건 중 현재 뷰포트에 포함될 14개의 백건 필터링
  const visibleWhiteKeys = whiteKeys.slice(viewportStartIdx, viewportStartIdx + viewportSize);
  const visibleWhiteKeySet = new Set(visibleWhiteKeys);

  // 뷰포트 내 백건들에 인접한 흑건들만 도출
  const visibleBlackKeys = notes.filter(note => {
    if (!isBlackKeyMap[note]) return false;

    // 이 흑건에 바로 선행하는 백건 찾기
    const noteName = note.substring(0, note.length - 1);
    const octave = note.substring(note.length - 1);
    let precedingWhiteKeyNote: Note | undefined;
    switch (noteName) {
      case 'C#': precedingWhiteKeyNote = `C${octave}` as Note; break;
      case 'D#': precedingWhiteKeyNote = `D${octave}` as Note; break;
      case 'F#': precedingWhiteKeyNote = `F${octave}` as Note; break;
      case 'G#': precedingWhiteKeyNote = `G${octave}` as Note; break;
      case 'A#': precedingWhiteKeyNote = `A${octave}` as Note; break;
    }
    return precedingWhiteKeyNote ? visibleWhiteKeySet.has(precedingWhiteKeyNote) : false;
  });

  const getBlackKeyPosition = (note: Note): number | null => {
    const { whiteKeyWidth, blackKeyWidth } = dynamicStyles;
    const noteName = note.substring(0, note.length - 1);
    const octave = note.substring(note.length - 1);
    let precedingWhiteKeyNote: Note | undefined;
    switch (noteName) {
      case 'C#': precedingWhiteKeyNote = `C${octave}` as Note; break;
      case 'D#': precedingWhiteKeyNote = `D${octave}` as Note; break;
      case 'F#': precedingWhiteKeyNote = `F${octave}` as Note; break;
      case 'G#': precedingWhiteKeyNote = `G${octave}` as Note; break;
      case 'A#': precedingWhiteKeyNote = `A${octave}` as Note; break;
    }
    if (!precedingWhiteKeyNote) return null;
    const index = visibleWhiteKeys.indexOf(precedingWhiteKeyNote);
    if (index === -1) return null;
    // 뷰포트 상대적 위치로 흑건 위치 계산
    return (index + 1) * whiteKeyWidth - (blackKeyWidth / 2);
  };

  return (
    <View style={styles.rowContainer}>
      {visibleWhiteKeys.map(note => {
        const isVisible = visibleNotes.has(note);
        return (
          <PianoKey
            key={note}
            note={note}
            isBlack={false}
            isVisible={isVisible}
            width={dynamicStyles.whiteKeyWidth}
            height={dynamicStyles.whiteKeyHeight}
            onPressIn={handlers.handleNotePressIn}
            onPressOut={handlers.handleNotePressOut}
            showKeyLabels={showKeyLabels}
            keyboardLabel={noteToKeyMap[note]}
          />
        );
      })}
      {visibleBlackKeys.map(note => {
        const isVisible = visibleNotes.has(note);
        const leftPosition = getBlackKeyPosition(note);
        if (leftPosition === null) return null;
        return (
          <PianoKey
            key={note}
            note={note}
            isBlack={true}
            isVisible={isVisible}
            width={dynamicStyles.blackKeyWidth}
            height={dynamicStyles.blackKeyHeight}
            leftPosition={leftPosition}
            onPressIn={handlers.handleNotePressIn}
            onPressOut={handlers.handleNotePressOut}
            showKeyLabels={showKeyLabels}
            keyboardLabel={noteToKeyMap[note]}
          />
        );
      })}
    </View>
  );
};

export function MusicTrainingScreen() {

  // 전송용 데이터
  const { syncData } = useSyncGameData();
  
  // 데이터 수집 상태
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);
  const [sessionLog, setSessionLog] = useState<any[]>([]);

  /**
   * 정답 뒤 다음 문제가 나올 때까지의 **채점 빗장.**
   *
   * `currentNote`는 1초(미션 성공은 2.5초) 뒤에야 바뀐다. 그 사이 같은 건반을 또 누르면
   * 계속 정답이라 **한 문제 연타로 5점(클리어)**이 됐다. 막는 것은 **채점뿐**이다 —
   * 소리는 그대로 낸다. 렌더에서 읽지 않으므로 state가 아니라 ref다.
   */
  const isScoringLockedRef = useRef(false);

  /**
   * 정답 처리용 타이머 모음 (`matchGame.tsx:66`과 같은 방식).
   *
   * 담아두지 않으면 「훈련 종료」·난이도 변경 뒤에도 예약된 `playNextQuestion`이 살아나
   * **끝난 훈련에서 문제음이 나고**, 바꾸기 전 난이도의 음이 출제된다.
   * 터진 타이머는 자기 id를 스스로 뺀다 — 한 훈련 동안 쌓이지 않게.
   */
  const trainingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const clearTrainingTimers = useCallback(() => {
    trainingTimersRef.current.forEach(clearTimeout);
    trainingTimersRef.current.clear();
  }, []);
  const scheduleTrainingTimer = useCallback((run: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      trainingTimersRef.current.delete(id);
      run();
    }, delayMs);
    trainingTimersRef.current.add(id);
  }, []);

  const KEYBOARD_ENABLED = false;
  const VISUALIZER_MODE: 'ripple' | 'particle' = 'particle'; // 스위치 제공 ('ripple'로 변경 시 이전 물결로 복구)
  const SHOW_ANSWER_HINT = true; // 테스트용 정답 힌트 노출 스위치 (true 활성화 / false 비활성화)
  const [isReady, setIsReady] = useState(false);

  // 청능 훈련 상태 관리
  const [activeNotes, setActiveNotes] = useState<{ [key in Note]?: boolean }>({});
  const [mode, setMode] = useState<TrainingMode>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('3단계');
  const [progress, setProgress] = useState<MusicProgress>({});

  /**
   * `score`·`progress`의 동기 사본과 **유일한 쓰기 통로.**
   *
   * 정답 처리가 `score + 1` · `{...progress}`로 **렌더 클로저 값**을 읽고 있었다
   * (오답 쪽만 updater였다). 한 프레임에 두 건반이 들어오면 둘이 같은 값을 계산해
   * 점수·누적이 하나만 오른다. updater 안에서는 `addStar`를 못 부르므로(세션 40)
   * 사본을 두되, **쓰는 자리를 아래 둘로 좁혀** 두 곳이 갈라지지 않게 한다.
   */
  const scoreRef = useRef(0);
  const progressRef = useRef<MusicProgress>({});
  const applyScore = useCallback((next: number) => {
    scoreRef.current = next;
    setScore(next);
  }, []);
  const applyProgress = useCallback((next: MusicProgress) => {
    progressRef.current = next;
    setProgress(next);
  }, []);
  const [showMissionSuccess, setShowMissionSuccess] = useState(false);
  const [hasShownMissionSuccess, setHasShownMissionSuccess] = useState(false);

  // 낙하노트 모드 상태 관리
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [selectedSongScale, setSelectedSongScale] = useState<SongScale>('penta5');
  const [selectedSongId, setSelectedSongId] = useState(songs.find(song => song.scale === 'penta5')?.id ?? songs[0]?.id ?? '');
  const [selectedTempoMode, setSelectedTempoMode] = useState<FallingTempoMode>('normal');
  const [lastFallingResult, setLastFallingResult] = useState<FallingResult | null>(null);
  const [showFallingReplayPrompt, setShowFallingReplayPrompt] = useState(false);
  const scheduledNotesRef = useRef<ScheduledFallingNote[]>([]);
  const [hitNoteIds, setHitNoteIds] = useState<string[]>([]);
  const [missNoteIds, setMissNoteIds] = useState<string[]>([]);
  const [fallingResult, setFallingResult] = useState<FallingResult | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [judgmentPulseKey, setJudgmentPulseKey] = useState(0);
  const [missPulseKey, setMissPulseKey] = useState(0);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackMetricsRef = useRef<FallingTrackMetrics | null>(null);
  const isTraining = mode !== null;
  const isFallingNoteActive = mode === 'falling';
  const availableFallingSongs = songs.filter(song => song.scale === selectedSongScale);
  const selectedFallingSong = availableFallingSongs.find(song => song.id === selectedSongId)
    ?? availableFallingSongs[0]
    ?? songs[0]
    ?? null;
  const fallingSongIndex = Math.max(0, availableFallingSongs.findIndex(song => song.id === selectedFallingSong?.id));
  const prevFallingSongTitle = availableFallingSongs.length > 1
    ? availableFallingSongs[(fallingSongIndex - 1 + availableFallingSongs.length) % availableFallingSongs.length].title
    : '';
  const nextFallingSongTitle = availableFallingSongs.length > 1
    ? availableFallingSongs[(fallingSongIndex + 1) % availableFallingSongs.length].title
    : '';
  const activeFallingSong = currentSong ?? selectedFallingSong;
  const activeFallingBpm = activeFallingSong
    ? selectedTempoMode === 'normal'
      ? activeFallingSong.normalBpm
      : activeFallingSong.slowBpm
    : 72;

  const clearFallingNoteTimers = useCallback(() => {
    scheduledNotesRef.current.forEach((scheduledNote) => {
      if (scheduledNote.timeoutId) {
        clearTimeout(scheduledNote.timeoutId);
      }
    });
    scheduledNotesRef.current = [];
  }, []);

  const handleNoteSchedule = useCallback((note: Note, expectedTimestamp: number, beat: number) => {
    const id = getFallingNoteId(note, beat);
    if (scheduledNotesRef.current.some(scheduledNote => scheduledNote.id === id)) {
      return;
    }

    scheduledNotesRef.current.push({
      id,
      note,
      expectedTimestamp,
      hit: false,
      reached: false,
      missed: false,
      beat,
    });
  }, []);

  const handleTrackNoteHit = useCallback((note: Note, beat: number, reachedTimestamp: number, hitX: number, hitY: number) => {
    const id = getFallingNoteId(note, beat);
    const targetNote = scheduledNotesRef.current.find(scheduledNote => scheduledNote.id === id);
    if (!targetNote || targetNote.reached) {
      return;
    }

    targetNote.reached = true;
    targetNote.hitX = hitX;
    targetNote.hitY = hitY;
    // 타이머 id를 노트에 기록해야 clearFallingNoteTimers가 실제로 취소할 수 있다.
    // 기록하지 않으면 다시하기·재시작 때 이전 판의 미스 판정이 살아남아
    // 같은 id(음+박)로 새로 예약된 노트에 미스를 꽂는다.
    targetNote.timeoutId = setTimeout(() => {
      const latestNote = scheduledNotesRef.current.find(scheduledNote => scheduledNote.id === id);
      if (latestNote && !latestNote.hit && !latestNote.missed) {
        latestNote.missed = true;
        latestNote.judgment = 'Miss';
        setMissNoteIds(prev => [...prev, id]);
        setMissPulseKey(prev => prev + 1);
      }
    }, HIT_WINDOW_MS);
  }, []);

  // 대기(자유 연주) 건반은 훈련 난이도와 분리. 훈련 종료 후에도 항상 3단계 레이아웃.
  const keyboardDifficulty: Difficulty = mode === 'random' ? difficulty : '3단계';

  // 옥타브 시프트 뷰포트 상태 (난이도에 따라 백건 개수 가변)
  const getViewportSize = () => {
    if (keyboardDifficulty === '1단계') return 8;
    if (keyboardDifficulty === '2단계') return 15;
    return 16; // 3단계(중급) 및 4단계(상급)에서 16건반 지원
  };
  const VIEWPORT_SIZE = getViewportSize();

  const [viewportStartIdx, setViewportStartIdx] = useState(14);
  const [fallingTrackWidth, setFallingTrackWidth] = useState(0);

  // 1, 2, 3단계에서는 시작 옥타브 인덱스를 C3(14)로 강제 고정
  const isFixedViewport = keyboardDifficulty === '1단계' || keyboardDifficulty === '2단계' || keyboardDifficulty === '3단계';
  const currentStartIdx = isFixedViewport ? 14 : viewportStartIdx;

  // 옥타브 버튼 애니메이션용 Shared Values
  const leftArrowOpacity = useSharedValue(1);
  const leftArrowTranslateX = useSharedValue(0);
  const rightArrowOpacity = useSharedValue(1);
  const rightArrowTranslateX = useSharedValue(0);

  // 옥타브 가이드 애니메이션 제어
  useEffect(() => {
    if (!isTraining || !currentNote) {
      leftArrowOpacity.value = withTiming(1, { duration: 200 });
      leftArrowTranslateX.value = withTiming(0, { duration: 200 });
      rightArrowOpacity.value = withTiming(1, { duration: 200 });
      rightArrowTranslateX.value = withTiming(0, { duration: 200 });
      return;
    }

    const noteWhiteIdx = whiteIdxRefById.get(currentNote);
    if (noteWhiteIdx == null) return;

    // 오직 4단계(상급) 모드에서만 화면 밖에 음이 있을 때 화살표 힌트 가이드 애니메이션 기동
    const isGuideActive = difficulty === '4단계';
    const showLeftGuide = isGuideActive && noteWhiteIdx < currentStartIdx;
    const showRightGuide = isGuideActive && noteWhiteIdx >= currentStartIdx + VIEWPORT_SIZE;

    if (showLeftGuide) {
      leftArrowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500, easing: Easing.ease }),
          withTiming(1, { duration: 500, easing: Easing.ease })
        ),
        -1,
        true
      );
      leftArrowTranslateX.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 400, easing: Easing.ease }),
          withTiming(0, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      );
    } else {
      leftArrowOpacity.value = withTiming(1, { duration: 200 });
      leftArrowTranslateX.value = withTiming(0, { duration: 200 });
    }

    if (showRightGuide) {
      rightArrowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 500, easing: Easing.ease }),
          withTiming(1, { duration: 500, easing: Easing.ease })
        ),
        -1,
        true
      );
      rightArrowTranslateX.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 400, easing: Easing.ease }),
          withTiming(0, { duration: 400, easing: Easing.ease })
        ),
        -1,
        true
      );
    } else {
      rightArrowOpacity.value = withTiming(1, { duration: 200 });
      rightArrowTranslateX.value = withTiming(0, { duration: 200 });
    }
  }, [isTraining, currentNote, currentStartIdx, difficulty, VIEWPORT_SIZE]);

  // 터치 물결 효과용 Shared Values
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  const rippleProgress = useSharedValue(0);
  const triggerTime = useSharedValue(0); // 파티클 트리거용 시간 Shared Value

  // 오디오 플레이어 캐시 (최대 CACHE_LIMIT개). 맨 앞이 가장 최근에 친 음이다
  const soundCache = useRef<{ [key in Note]?: any }>({});
  const recentlyUsedNotes = useRef<Note[]>([]);
  const starContext = useContext(StarContext) as any;
  const clearContext = useContext(ClearContext) as any;

  const { height, width, insets, safeAreaFrameStyle, missionIconStyle } = useInstrumentMetrics();

  // 자동 옥타브 포커싱 훅 결합 (기존 포커싱 기능은 완전히 비활성화하여 수동 이동 유도)
  useAutoFocusViewport({
    currentNote: null,
    viewportStartIdx,
    setViewportStartIdx,
    totalWhite: allNotes.filter(n => !isBlackKeyMap[n]).length,
    viewportSize: VIEWPORT_SIZE,
  });

  // 초기화 및 라이프사이클 관리
  useEffect(() => {
    let isMounted = true;

    // 화면 방향은 `app/(tabs)/_layout.tsx`가 단독으로 건다. 여기서 걸면 기타 탭과 서로 덮어쓴다.
    // 오디오 모드는 `AudioManagerProvider`가 앱 시작 시 1회 설정한다(4-B에서 일원화).
    setIsReady(true);

    // 저장 기록 로드
    const loadProgress = async () => {
      try {
        const savedProgress = await AsyncStorage.getItem(MUSIC_PROGRESS_KEY);
        if (savedProgress) {
          applyProgress(JSON.parse(savedProgress));
        }
      } catch (e) {
        console.error('Failed to load music progress.', e);
      }
    };
    loadProgress();

    return () => {
      isMounted = false;
      clearFallingNoteTimers();
      clearTrainingTimers();
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
      // 사운드 리소스 안전 해제 (메모리 누수 차단)
      for (const player of Object.values(soundCache.current)) {
        try {
          player?.remove();
        } catch (e) {
          console.warn('Failed to release audio player on unmount', e);
        }
      }
      // 캐시 강제 소거로 핫 리로드 시 발생하는 release 충돌 해결
      soundCache.current = {};
      recentlyUsedNotes.current = [];
    };
  }, [clearFallingNoteTimers, clearTrainingTimers, applyProgress]);

  // 저장 기록 동기화
  useEffect(() => {
    if (Object.keys(progress).length > 0) {
      AsyncStorage.setItem(MUSIC_PROGRESS_KEY, JSON.stringify(progress)).catch(e =>
        console.error('Failed to save music progress.', e)
      );
    }
  }, [progress]);

  useEffect(() => {
    if (!isFallingNoteActive || previewCount === null) return;

    previewTimerRef.current = setTimeout(() => {
      setPreviewCount(prev => {
        if (prev === null) return null;
        return prev > 0 ? prev - 1 : null;
      });
    }, previewCount === 0 ? 500 : 700);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [isFallingNoteActive, previewCount]);

  const handleSelectSongScale = (scale: SongScale) => {
    setSelectedSongScale(scale);
    const firstSongForScale = songs.find(song => song.scale === scale);
    if (firstSongForScale) {
      setSelectedSongId(firstSongForScale.id);
    }
  };

  const handleCycleFallingSong = useCallback((direction: 1 | -1 = 1) => {
    const list = songs.filter(song => song.scale === selectedSongScale);
    if (list.length === 0) return;
    const currentIndex = list.findIndex(song => song.id === selectedSongId);
    const nextSong = list[(Math.max(currentIndex, 0) + direction + list.length) % list.length];
    setSelectedSongId(nextSong.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [selectedSongScale, selectedSongId]);

  const handleCycleFallingSongRef = useRef(handleCycleFallingSong);
  handleCycleFallingSongRef.current = handleCycleFallingSong;

  const songSlotPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy <= -12) {
          handleCycleFallingSongRef.current(1);
        } else if (gesture.dy >= 12) {
          handleCycleFallingSongRef.current(-1);
        } else {
          handleCycleFallingSongRef.current(1);
        }
      },
    })
  ).current;

  const getVisibleNoteSet = (): Set<Note> => {
    switch (keyboardDifficulty) {
      case '1단계': return new Set(level1_absoluteBeginner);
      case '2단계': return new Set(level2_beginner);
      case '3단계': return new Set(level3_intermediate);
      case '4단계': return new Set(level4_advanced);
      case '5단계': return new Set(level5_specialTraining);
      default: return new Set(level3_intermediate);
    }
  };
  const visibleNoteSet = getVisibleNoteSet();

  const handleTrackMetrics = useCallback((metrics: FallingTrackMetrics) => {
    trackMetricsRef.current = metrics;
  }, []);

  const triggerFallingHitEffect = useCallback((note: Note, fallbackX?: number, fallbackY?: number) => {
    const metrics = trackMetricsRef.current;
    const laneIndex = currentSong?.palette.indexOf(note) ?? -1;
    const canUseTrackMetrics = metrics && laneIndex >= 0;
    const hitX = canUseTrackMetrics
      ? metrics.x + metrics.laneStartX + laneIndex * metrics.laneWidth + metrics.laneWidth / 2
      : fallbackX ?? width / 2;
    const hitY = canUseTrackMetrics
      ? metrics.y + metrics.judgmentLineY
      : fallbackY ?? height / 2;

    touchX.value = hitX;
    touchY.value = hitY;
    triggerTime.value = Date.now();
    setJudgmentPulseKey(prev => prev + 1);
  }, [currentSong, height, touchX, touchY, triggerTime, width]);

  const resetFallingStats = () => {
    setHitNoteIds([]);
    setMissNoteIds([]);
    setFallingResult(null);
    setLastFallingResult(null);
    setShowFallingReplayPrompt(false);
    setJudgmentPulseKey(0);
    setMissPulseKey(0);
  };

  /**
   * 가장 오래 안 쓴 음부터 플레이어를 해제해 AudioTrack을 돌려준다.
   * **울리는 중인 음은 건너뛴다** — 해제하면 나던 소리가 끊긴다.
   * 해제에 성공하면 true.
   */
  const evictLeastRecentlyUsedNote = (): boolean => {
    for (let i = recentlyUsedNotes.current.length - 1; i >= 0; i--) {
      const candidate = recentlyUsedNotes.current[i];
      const player = soundCache.current[candidate];
      if (player?.playing) continue;

      recentlyUsedNotes.current.splice(i, 1);
      delete soundCache.current[candidate];
      try {
        player?.remove();
      } catch (e) { }
      return true;
    }
    return false;
  };

  const playSound = async (note: Note) => {
    try {
      let player = soundCache.current[note];
      if (!player) {
        // 만드는 순간 AudioTrack을 잡으므로 **만들기 전에** 자리를 비운다.
        // 전부 울리는 중이라 못 비우면 그냥 만든다 — 여유 2를 남겨 둔 이유다.
        while (recentlyUsedNotes.current.length >= CACHE_LIMIT) {
          if (!evictLeastRecentlyUsedNote()) break;
        }
        player = createAudioPlayer(soundFiles[note]);
        const createdPlayer = player;
        soundCache.current[note] = createdPlayer;

        // 죽은 플레이어는 예외도 로그도 없이 무음이 된다. 유일한 통보 경로가 이 이벤트다.
        //
        // 알리기만 하면 **죽은 플레이어가 캐시에 남는다.** 다음 터치도 같은 플레이어를
        // 재사용하므로 그 건반은 계속 무음이다 — 탭을 나갔다 오거나(`useStopAudioOnBlur`)
        // LRU에 밀려날 때까지. 캐시에서 빼두면 다음 터치 때 새로 만들어 바로 회복한다.
        try {
          createdPlayer.addListener('playbackStatusUpdate', (status: any) => {
            if (!status?.error) return;
            console.warn(`[audio] '${note}' 재생 에러:`, status.error);

            // 그 사이에 교체·축출됐다면 남의 플레이어다. 건드리지 않는다
            if (soundCache.current[note] !== createdPlayer) return;
            delete soundCache.current[note];
            recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
            try { createdPlayer.remove(); } catch (e) { }
          });
        } catch (e) { }
      }

      // 방금 친 음을 맨 앞으로 (맨 뒤가 가장 오래 안 쓴 음 = 축출 대상)
      recentlyUsedNotes.current = recentlyUsedNotes.current.filter(n => n !== note);
      recentlyUsedNotes.current.unshift(note);

      // 탭을 떠날 때 pause()만 하면 currentTime이 0이어도 play()가 무음이 된다.
      // 동물게임과 같이 항상 되감은 뒤 재생한다.
      await player.seekTo(0);
      player.play();
    } catch (error) {
      console.log(`'${note}' 음원 재생 실패:`, error);
    }
  };

  /**
   * 🎹 탭을 떠날 때 건반 소리를 끊고 **플레이어를 해제한다.**
   * 탭은 언마운트되지 않으므로 위 언마운트 클린업은 탭 전환 때 실행되지 않는다.
   *
   * 이전에는 `pause()`만 하고 캐시를 남겼다(재진입 첫 음 지연을 피하려고).
   * 그런데 `pause()`는 소리만 멈추고 **AudioTrack은 계속 붙잡는다.** 그래서 피아노를
   * 다녀오면 기타·단어 탭까지 앱 전체 한도에 걸려 무음이 됐다.
   * **자리를 돌려주려면 해제해야 한다.** 재진입 첫 음 지연은 그 대가로 받아들인 것이다.
   */
  useStopAudioOnBlur(() => {
    for (const player of Object.values(soundCache.current)) {
      try {
        player?.remove();
      } catch (e) { }
    }
    soundCache.current = {};
    recentlyUsedNotes.current = [];
  });

  const playNextQuestion = useCallback(() => {
    let notesToUse: Note[];
    switch (difficulty) {
      case '1단계': notesToUse = level1_absoluteBeginner; break;
      case '2단계': notesToUse = level2_beginner; break;
      case '3단계': notesToUse = level3_intermediate; break;
      case '4단계': notesToUse = level4_advanced; break;
      case '5단계': notesToUse = level5_specialTraining; break;
      default: notesToUse = level3_intermediate; break;
    }
    const randomIndex = Math.floor(Math.random() * notesToUse.length);
    const randomNote = notesToUse[randomIndex];
    setCurrentNote(randomNote);
    setRepeatCount(0);
    // 응답 시간의 기준은 **출제하는 이 자리에서 동기로** 찍는다.
    // 여기서 안 찍으면 기준이 `null`이라 첫 문제들은 `null || 0` → 응답시간 0초로,
    // 한 번 오답을 낸 뒤로는 **그 오답 시각**이 다음 문제들의 기준으로 남는다.
    // 서버 `detailed_logs`에 그대로 담긴다.
    setQuestionStartTime(Date.now());
    isScoringLockedRef.current = false;
    playSound(randomNote);
  }, [difficulty]);

  const handleDifficultyChange = (name: Difficulty) => {
    setDifficulty(name);
    if (mode === 'random') {
      // 예약된 출제를 먼저 끊는다. 남겨두면 바꾸기 전 난이도의 음이 뒤늦게 나온다
      clearTrainingTimers();
      isScoringLockedRef.current = false;
      setCurrentNote(null);
      applyScore(0);
      setFeedback(`난이도가 ${name}로 변경되었습니다. [문제 재생]을 누르세요.`);
    }
  };

  const startTraining = () => {
    clearFallingNoteTimers();
    clearTrainingTimers();
    isScoringLockedRef.current = false;
    setQuestionStartTime(null);
    setMode('random');
    applyScore(0);
    setSessionLog([]); // 세션 로그 초기화
    setFeedback('난이도를 선택하고 [문제 재생]을 눌러 시작하세요!');
    setShowMissionSuccess(false);
    setHasShownMissionSuccess(false);
    setCurrentSong(null);
    setCurrentNote(null);
  };

  const handleResetProgress = async () => {
    try {
      await AsyncStorage.removeItem(MUSIC_PROGRESS_KEY);
      // 문제를 지우므로 예약된 출제도 함께 끊는다 — 안 끊으면 초기화 직후 되살아난다
      clearTrainingTimers();
      isScoringLockedRef.current = false;
      applyProgress({});
      applyScore(0);
      setCurrentNote(null);
      setFeedback('기록이 초기화되었습니다.');
    } catch (e) {
      console.error('Failed to reset music progress.', e);
    }
  };

  const startFallingNoteMode = (songToPlay: Song | null = selectedFallingSong) => {
    if (!songToPlay) return;

    clearFallingNoteTimers();
    clearTrainingTimers();
    isScoringLockedRef.current = false;
    setMode('falling');
    applyScore(0);
    resetFallingStats();
    setCurrentNote(null);
    setPreviewCount(3);
    setCurrentSong(songToPlay);
  };

  const stopTraining = () => {
    // 훈련 종료시 데이터 전송
    if (mode === 'random' && sessionLog.length > 0) {
      const correctCount = sessionLog.filter(log => log.is_correct).length;
      
      const medicalDataPayload = {
        difficulty_level: difficulty,
        total_attempts: sessionLog.length,
        correct_count: correctCount,
        accuracy_rate: parseFloat(((correctCount / sessionLog.length) * 100).toFixed(1)),
        detailed_logs: sessionLog // 모든 건반 터치 기록 포함
      };

      console.log("🚀 [의료 데이터 전송] music:", medicalDataPayload);
      syncData('music', medicalDataPayload);
    }
    
    clearFallingNoteTimers();
    clearTrainingTimers();
    isScoringLockedRef.current = false;
    setQuestionStartTime(null);
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setMode(null);
    setCurrentNote(null);
    setCurrentSong(null);
    setPreviewCount(null);
    resetFallingStats();
    setShowMissionSuccess(false);
    setHasShownMissionSuccess(false);
    setFeedback('');
  };

  const handleSongEnd = useCallback(() => {
    const totalNotes = currentSong?.notes.length ?? 0;
    const perfect = scheduledNotesRef.current.filter(note => note.judgment === 'Perfect').length;
    const great = scheduledNotesRef.current.filter(note => note.judgment === 'Great').length;
    const good = scheduledNotesRef.current.filter(note => note.judgment === 'Good').length;
    const hits = perfect + great + good;
    const misses = Math.max(0, totalNotes - hits);
    const accuracy = totalNotes > 0 ? Math.round((hits / totalNotes) * 100) : 0;
    const clearTarget = getFallingClearTarget(currentSong);
    const cleared = accuracy >= clearTarget && misses <= 3;

    setLastFallingResult({
      title: currentSong?.title ?? '낙하노트',
      totalNotes,
      perfect,
      great,
      good,
      cleared,
    });
    clearFallingNoteTimers();
    setMode(null);
    setCurrentNote(null);
    setPreviewCount(null);
    setShowFallingReplayPrompt(true);
  }, [clearFallingNoteTimers, currentSong]);

  const replayFallingSong = () => {
    startFallingNoteMode(currentSong ?? selectedFallingSong);
  };

  /** 뒤로가기로 리플레이 안내를 닫는다. 결과는 버리고 대기 화면으로 돌아간다 */
  const dismissFallingReplayPrompt = () => {
    setShowFallingReplayPrompt(false);
    setLastFallingResult(null);
    setCurrentSong(null);
  };

  const showLastFallingResult = () => {
    if (!lastFallingResult) return;
    setShowFallingReplayPrompt(false);
    setFallingResult(lastFallingResult);
    setCurrentSong(null);
  };

  const closeFallingResult = () => {
    setFallingResult(null);
    setLastFallingResult(null);
    setCurrentSong(null);
  };

  const repeatSound = () => {
    if (currentNote) {
      setRepeatCount(prev => prev + 1); // 횟수 증가
      playSound(currentNote);
    }
  };

  const handleNotePressIn = useCallback((note: Note, event: any) => {
    // 1. 소리 재생
    playSound(note);
    setActiveNotes(prev => ({ ...prev, [note]: true }));

    // 2. 터치한 절대 좌표 위치(pageX, pageY)를 이용한 물결(Ripple) 이펙트 트리거
    const nativeEvent = event?.nativeEvent;
    if (nativeEvent && !isFallingNoteActive) {
      const { pageX, pageY } = nativeEvent;
      touchX.value = pageX;
      touchY.value = pageY;
      triggerTime.value = Date.now(); // 파티클 트리거 시간 갱신

      rippleProgress.value = 0;
      rippleProgress.value = withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      );
    }

    // 3. 청능 훈련 채점 판단
    if (mode === 'falling' && currentSong) {
      const now = Date.now();
      const targetCandidate = scheduledNotesRef.current
        .map((scheduledNote, index) => ({
          index,
          drift: Math.abs(scheduledNote.expectedTimestamp - now),
          scheduledNote,
        }))
        .filter(({ drift, scheduledNote }) =>
          !scheduledNote.hit && !scheduledNote.missed && scheduledNote.note === note && drift <= HIT_WINDOW_MS
        )
        .sort((a, b) => a.drift - b.drift)[0];
      const targetIndex = targetCandidate?.index ?? -1;

      if (targetIndex !== -1) {
        const hitNote = scheduledNotesRef.current[targetIndex];
        const driftMs = now - hitNote.expectedTimestamp;
        const judgment = getJudgmentGrade(driftMs);
        scheduledNotesRef.current[targetIndex].hit = true;
        scheduledNotesRef.current[targetIndex].judgment = judgment;
        // 판정이 끝났으니 대기 중인 미스 타이머를 즉시 해제한다.
        if (hitNote.timeoutId) {
          clearTimeout(hitNote.timeoutId);
          scheduledNotesRef.current[targetIndex].timeoutId = undefined;
        }
        setHitNoteIds(prev => [...prev, hitNote.id]);

        triggerFallingHitEffect(note, hitNote.hitX ?? nativeEvent?.pageX, hitNote.hitY ?? nativeEvent?.pageY);

        if (judgment === 'Perfect') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        }
      } else {
        setMissPulseKey(prev => prev + 1);
      }
    } else if (mode === 'random' && currentNote) {
      // 정답을 맞힌 뒤 다음 문제가 나오기 전까지는 **채점하지 않는다.**
      // 소리는 위 1번에서 이미 냈다 — 막는 것은 채점뿐이다
      if (isScoringLockedRef.current) return;

      const isCorrect = note === currentNote;
      const responseTime = questionStartTime ? (Date.now() - questionStartTime) / 1000 : 0;

      // 이번 터치에 대한 상세 정보 로그 저장
      const attemptRecord = {
        target_note: currentNote,
        selected_note: note,
        is_correct: isCorrect,
        response_time_seconds: parseFloat(responseTime.toFixed(2)), // 💡 반응 시간은 소수점 2자리
        repeat_listens: repeatCount
      };
      setSessionLog(prev => [...prev, attemptRecord]);

      if (isCorrect) {
        isScoringLockedRef.current = true;

        const newScore = scoreRef.current + 1;
        applyScore(newScore);

        const currentProgress = progressRef.current[difficulty] || { cumulativeSuccesses: 0, highestScore: 0 };
        const newCumulativeSuccesses = currentProgress.cumulativeSuccesses + 1;

        const updatedProgress = {
          ...progressRef.current,
          [difficulty]: {
            cumulativeSuccesses: newCumulativeSuccesses,
            highestScore: Math.max(currentProgress.highestScore, newScore),
          },
        };
        applyProgress(updatedProgress);

        // 조건을 넘긴 뒤로는 **정답마다** 다시 부르고 있었다.
        // 두 Provider가 안에서도 막지만(`StarContext.addStar` · `ClearContext.markAsCleared`),
        // 부르는 쪽에서 한 번만 부르는 것이 뜻이 분명하다
        const missionKey = `music_${difficulty}`;
        if (newCumulativeSuccesses >= 3 && !starContext?.starData?.[missionKey]) {
          starContext?.addStar(missionKey);
        }
        if (newScore >= 5 && !clearContext?.clearData?.[missionKey]) {
          clearContext?.markAsCleared(missionKey);
        }

        if (newScore >= 5 && !hasShownMissionSuccess) {
          // 훈련 세션당 1회만 성공 피드백을 제공해 반복 모달을 방지
          setHasShownMissionSuccess(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowMissionSuccess(true);
          setFeedback('정답!');
          scheduleTrainingTimer(() => {
            setShowMissionSuccess(false);
            setFeedback('다음 문제');
            playNextQuestion();
          }, 2500);
        } else {
          setFeedback('정답!');
          scheduleTrainingTimer(() => {
            setFeedback('다음 문제');
            playNextQuestion();
          }, 1000);
        }
      } else {
        applyScore(Math.max(0, scoreRef.current - 1));
        setFeedback('오답! 다시 들어보세요.');
        // 오답 시 재시도 시간을 새로 재기 위해 타이머 리셋
        setQuestionStartTime(Date.now());
      }
    }
  }, [mode, currentNote, currentSong, isFallingNoteActive, playNextQuestion, difficulty, hasShownMissionSuccess, starContext, clearContext, triggerFallingHitEffect, questionStartTime, repeatCount, applyScore, applyProgress, scheduleTrainingTimer]);

  const handleNotePressOut = useCallback((note: Note) => {
    setActiveNotes(prev => {
      const newActiveNotes = { ...prev };
      delete newActiveNotes[note];
      return newActiveNotes;
    });
  }, []);

  const handleShiftLeft = () => {
    setViewportStartIdx(0);
  };

  const handleShiftRight = () => {
    setViewportStartIdx(14);
  };


  const isFallingResultVisible = fallingResult !== null;
  const shouldUseFallingBottomPanel = isFallingNoteActive || isFallingResultVisible || showFallingReplayPrompt;
  const bottomPanelHeight = shouldUseFallingBottomPanel
    ? CONTROL_BAR.compactHeight
    : CONTROL_BAR.standardHeight;

  /**
   * 두 오버레이가 깔고 앉을 프레임.
   *
   * 오버레이는 `midgroundLayer`의 **형제**라 인셋을 자동으로 받지 못한다.
   * 제어반은 `safeAreaFrameStyle`(인셋 안쪽)에 들어 있으니 오버레이도 같은 프레임을
   * 쓰고, 거기서 제어반 높이만큼 더 띄워야 둘이 같은 자리를 본다.
   * 인셋을 빼면 `insets.bottom`만큼 제어반을 파고들고, 가로모드 노치 쪽
   * `insets.left`/`right`만큼 카운트다운 숫자가 옆으로 밀린다
   */
  const overlayFrameStyle = {
    ...safeAreaFrameStyle,
    bottom: insets.bottom + bottomPanelHeight,
  };
  const usableWidth = Math.max(1, width - insets.left - insets.right);
  const usableHeight = Math.max(1, height - insets.top - insets.bottom);
  const PIANO_AREA_PADDING = 20;
  const consoleInnerHeight = CONTROL_BAR.standardHeight - CONTROL_BAR.paddingVertical * 2;
  const consoleWidth = Math.max(1, (usableWidth - 100) * (2.4 / 5.4));
  const consoleWellWidth = consoleWidth * 0.91;
  const consoleWellHeight = consoleInnerHeight * 0.62;
  const clampConsole = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const consoleFit = {
    toggleFont: Math.round(clampConsole(consoleWellHeight * 0.22, 12, 16)),
    actionFont: Math.round(clampConsole(consoleWellHeight * 0.24, 13, 17)),
    togglePadV: Math.round(clampConsole(consoleWellHeight * 0.07, 3, 8)),
    togglePadH: Math.round(clampConsole(consoleWellWidth * 0.032, 6, 16)),
    actionPadV: Math.round(clampConsole(consoleWellHeight * 0.1, 4, 10)),
    actionPadH: Math.round(clampConsole(consoleWellWidth * 0.032, 8, 18)),
    gap: Math.round(clampConsole(consoleWellWidth * 0.018, 4, 10)),
    rowGap: Math.round(clampConsole(consoleWellHeight * 0.06, 2, 6)),
  };
  const pianoAreaWidth = Math.max(1, usableWidth - PIANO_AREA_PADDING);
  const availablePlayHeight = Math.max(1, usableHeight - bottomPanelHeight - 20);
  const standardWhiteKeyHeight = Math.max(80, usableHeight - bottomPanelHeight - 90);
  const fallingWhiteKeyHeight = Math.max(108, Math.min(156, availablePlayHeight * 0.4));
  const fallingNotePalette = isFallingNoteActive ? currentSong?.palette ?? null : null;
  const pianoNotes: Note[] = fallingNotePalette ?? allNotes;
  const pianoVisibleNoteSet: Set<Note> = fallingNotePalette ? new Set<Note>(fallingNotePalette) : visibleNoteSet;
  const pianoViewportStartIdx = fallingNotePalette ? 0 : currentStartIdx;
  const pianoViewportSize = fallingNotePalette ? fallingNotePalette.length : VIEWPORT_SIZE;

  const measuredPianoAreaWidth = isFallingNoteActive && fallingTrackWidth > 0
    ? fallingTrackWidth
    : pianoAreaWidth;
  const dynamicWhiteKeyWidth = measuredPianoAreaWidth / pianoViewportSize;
  const dynamicStyles = {
    whiteKeyWidth: dynamicWhiteKeyWidth,
    blackKeyWidth: dynamicWhiteKeyWidth * 0.6,
    whiteKeyHeight: isFallingNoteActive ? fallingWhiteKeyHeight : standardWhiteKeyHeight,
    blackKeyHeight: (isFallingNoteActive ? fallingWhiteKeyHeight : standardWhiteKeyHeight) * 0.65,
  };

  const handlers = { handleNotePressIn, handleNotePressOut };
  const fallingResultHits = fallingResult
    ? fallingResult.perfect + fallingResult.great + fallingResult.good
    : 0;
  const fallingResultMisses = fallingResult
    ? Math.max(0, fallingResult.totalNotes - fallingResultHits)
    : 0;
  const fallingResultAccuracy = fallingResult && fallingResult.totalNotes > 0
    ? Math.round((fallingResultHits / fallingResult.totalNotes) * 100)
    : 0;
  const progressItems = difficultyLevels.map(level => {
    const levelProgress = progress[level.name] || { cumulativeSuccesses: 0, highestScore: 0 };
    const starStatus = starContext?.starData[`music_${level.name}`] ? '★' : '☆';
    const clearStatus = clearContext?.clearData[`music_${level.name}`] ? '✓' : '✗';
    return {
      label: `${level.label} (${starStatus}, ${clearStatus})`,
      value: `누적 ${levelProgress.cumulativeSuccesses}회 / 최고 ${levelProgress.highestScore}점`,
    };
  });

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={[]} style={styles.fullScreen}>
      <MissionProgressIcon
        gameId="music"
        title="피아노 미션"
        missionText="각 난이도에서 정답 누적 3회"
        clearText="각 난이도에서 총점 5점 달성"
        levelNames={difficultyLevels.map(level => level.name)}
        progressItems={progressItems}
        style={missionIconStyle}
        onReset={handleResetProgress}
      />
      {/* 2. Midground Layer (Piano & 훈련 인터페이스) */}
      <View style={[styles.midgroundLayer, safeAreaFrameStyle]} pointerEvents="box-none">
        {/* 상단 피아노 건반 영역 */}
        <View style={styles.pianoArea} pointerEvents="box-none">
          {isFallingNoteActive && currentSong ? (
            <View style={styles.fallingModeLayout} pointerEvents="box-none">
              <View
                style={styles.fallingTrackArea}
                pointerEvents="none"
                onLayout={(event) => {
                  const nextWidth = event.nativeEvent.layout.width;
                  setFallingTrackWidth(prev => Math.abs(prev - nextWidth) < 0.5 ? prev : nextWidth);
                }}
              >
                <FallingNoteTrack
                  song={currentSong}
                  bpm={activeFallingBpm}
                  onNoteSchedule={handleNoteSchedule}
                  onNoteHit={handleTrackNoteHit}
                  onSongEnd={handleSongEnd}
                  hitNoteIds={hitNoteIds}
                  missNoteIds={missNoteIds}
                  judgmentPulseKey={judgmentPulseKey}
                  missPulseKey={missPulseKey}
                  onTrackMetrics={handleTrackMetrics}
                  dynamicWhiteKeyWidth={dynamicWhiteKeyWidth}
                  laneStartX={0}
                  isPlaying={isFallingNoteActive && previewCount === null}
                />
              </View>

              <View style={styles.fallingKeyboardArea} pointerEvents="box-none">
                <View style={[styles.pianoContainer, styles.fallingPianoContainer]} pointerEvents="box-none">
                  <View style={styles.pianoWrapper} pointerEvents="box-none">
                    {renderPianoViewportRow(
                      pianoNotes,
                      pianoVisibleNoteSet,
                      activeNotes,
                      handlers,
                      dynamicStyles,
                      KEYBOARD_ENABLED,
                      pianoViewportStartIdx,
                      pianoViewportSize
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <>
              {!isFixedViewport && (
                <View style={styles.octaveController}>
                  <Animated.View style={{
                    opacity: leftArrowOpacity,
                    transform: [{ translateX: leftArrowTranslateX }]
                  }}>
                    <TouchableOpacity
                      style={[
                        styles.octaveBtn,
                        viewportStartIdx === 0 && styles.octaveBtnDisabled,
                        (isTraining && currentNote && (whiteIdxRefById.get(currentNote) ?? 0) < viewportStartIdx && difficulty === '4단계') && styles.octaveBtnHighlight
                      ]}
                      onPress={handleShiftLeft}
                      disabled={viewportStartIdx === 0}
                    >
                      <Ionicons name="chevron-back" size={24} color="#fff" />
                      <Text style={styles.octaveBtnText}>옥타브 낮춤</Text>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* 중앙 미니 피아노 맵 배치 */}
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <MiniKeyboardMap
                      viewportStartIdx={currentStartIdx}
                      setViewportStartIdx={setViewportStartIdx}
                      currentNote={currentNote}
                      isTraining={isTraining}
                      viewportSize={VIEWPORT_SIZE}
                    />
                  </View>

                  <Animated.View style={{
                    opacity: rightArrowOpacity,
                    transform: [{ translateX: rightArrowTranslateX }]
                  }}>
                    <TouchableOpacity
                      style={[
                        styles.octaveBtn,
                        viewportStartIdx === 14 && styles.octaveBtnDisabled,
                        (isTraining && currentNote && (whiteIdxRefById.get(currentNote) ?? 0) >= viewportStartIdx + VIEWPORT_SIZE && difficulty === '4단계') && styles.octaveBtnHighlight
                      ]}
                      onPress={handleShiftRight}
                      disabled={viewportStartIdx === 14}
                    >
                      <Text style={styles.octaveBtnText}>옥타브 높임</Text>
                      <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}

              <View style={styles.pianoContainer} pointerEvents="box-none">
                <View style={styles.pianoWrapper} pointerEvents="box-none">
                  {renderPianoViewportRow(
                    pianoNotes,
                    pianoVisibleNoteSet,
                    activeNotes,
                    handlers,
                    dynamicStyles,
                    KEYBOARD_ENABLED,
                    pianoViewportStartIdx,
                    pianoViewportSize
                  )}
                </View>
              </View>
            </>
          )}
        </View>

        {/* 하단 미션 제어반 */}
        <InstrumentControlBar
          height={bottomPanelHeight}
          background={PIANO.bar}
          paddingVertical={shouldUseFallingBottomPanel ? 5 : CONTROL_BAR.paddingVertical}
        >
          <LandscapeBackButton style={styles.landscapeBackButton} />
          {/* 왼쪽 영역: 점수 및 피드백 */}
          {!shouldUseFallingBottomPanel && (
            <ScoreFeedback
              score={mode === 'random' ? score : null}
              feedback={feedback}
              hint={SHOW_ANSWER_HINT && isTraining ? currentNote : null}
              style={styles.infoSection}
            />
          )}

          {!isTraining && !isFallingResultVisible && !showFallingReplayPrompt && (
            <View style={styles.songSlotSection} {...songSlotPanResponder.panHandlers}>
              <View style={styles.songSlotWindow} pointerEvents="none">
                <View style={styles.songSlotFrame}>
                  <SongSlotFrame width="100%" height="100%" preserveAspectRatio="none" />
                </View>
                {!!prevFallingSongTitle && (
                  <Text style={styles.songSlotPeek} numberOfLines={1}>{prevFallingSongTitle}</Text>
                )}
                <Text style={styles.songSlotTitle} numberOfLines={1}>
                  {selectedFallingSong?.title ?? ''}
                </Text>
                {!!nextFallingSongTitle && (
                  <Text style={styles.songSlotPeek} numberOfLines={1}>{nextFallingSongTitle}</Text>
                )}
              </View>
            </View>
          )}

          {mode === 'random' && (
            <View style={styles.fallingPickerSection}>
              <DifficultyRow
                levels={difficultyLevels}
                selected={difficulty}
                onSelect={handleDifficultyChange}
                color={PIANO.idle}
                activeColor={PIANO.accent}
                style={styles.difficultyRow}
              />
            </View>
          )}

          {!isTraining && !isFallingResultVisible && !showFallingReplayPrompt && (
            <View style={styles.consoleSection}>
              <View style={styles.consoleWindow}>
                <View style={styles.consoleFrame} pointerEvents="none">
                  <ConsoleFrame width="100%" height="100%" preserveAspectRatio="none" />
                </View>
                <View style={styles.consoleContent}>
                  <View style={styles.consoleToggles}>
                    <View style={[styles.scaleToggleRow, { marginBottom: consoleFit.rowGap }]}>
                      {(['penta5', 'white8'] as SongScale[]).map(scale => (
                        <InstrumentButton
                          key={scale}
                          variant="toggle"
                          label={fallingScaleLabels[scale]}
                          active={selectedSongScale === scale}
                          activeColor={PIANO.accent}
                          fontSize={consoleFit.toggleFont}
                          paddingVertical={consoleFit.togglePadV}
                          paddingHorizontal={consoleFit.togglePadH}
                          style={styles.consoleToggleButton}
                          onPress={() => handleSelectSongScale(scale)}
                        />
                      ))}
                    </View>
                    <View style={[styles.scaleToggleRow, styles.scaleToggleRowLast]}>
                      {(['normal', 'slow'] as FallingTempoMode[]).map(tempoMode => (
                        <InstrumentButton
                          key={tempoMode}
                          variant="toggle"
                          label={fallingTempoLabels[tempoMode]}
                          active={selectedTempoMode === tempoMode}
                          activeColor={PIANO.accent}
                          fontSize={consoleFit.toggleFont}
                          paddingVertical={consoleFit.togglePadV}
                          paddingHorizontal={consoleFit.togglePadH}
                          style={styles.consoleToggleButton}
                          onPress={() => setSelectedTempoMode(tempoMode)}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={[styles.consoleActions, { gap: consoleFit.gap }]}>
                    <InstrumentButton
                      label="연주 시작"
                      color={PIANO.accent}
                      fontSize={consoleFit.actionFont}
                      paddingVertical={consoleFit.actionPadV}
                      paddingHorizontal={consoleFit.actionPadH}
                      style={styles.consoleActionButton}
                      textStyle={styles.consoleActionText}
                      onPress={() => startFallingNoteMode()}
                    />
                    <InstrumentButton
                      label="훈련 모드"
                      color={PIANO.accent}
                      fontSize={consoleFit.actionFont}
                      paddingVertical={consoleFit.actionPadV}
                      paddingHorizontal={consoleFit.actionPadH}
                      style={styles.consoleActionButton}
                      textStyle={styles.consoleActionText}
                      onPress={startTraining}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}

          {isTraining && (
            <View style={styles.actionSection}>
              <InstrumentButton
                label="훈련 종료"
                active
                activeColor={SEMANTIC.stop}
                onPress={stopTraining}
              />
              {!isFallingNoteActive && (
                <InstrumentButton
                  label={currentNote ? '다시 듣기' : '문제 재생'}
                  // 낼 음이 없으면 '다시 듣기'가 아니라 '문제 재생'이다. 뜻이 다르니 색도 다르다
                  color={currentNote ? SEMANTIC.repeat : PIANO.accent}
                  onPress={currentNote ? repeatSound : playNextQuestion}
                />
              )}
            </View>
          )}
        </InstrumentControlBar>
      </View>

      {/* 미션 성공 오버레이 (터치 차단 포함) */}
      {showMissionSuccess && (
        <View style={[styles.missionOverlay, overlayFrameStyle]}>
          <View style={styles.missionOverlayBox}>
            <Text style={styles.missionOverlayText}>★ 미션 성공! ★</Text>
            <Text style={styles.missionOverlaySubText}>자유롭게 계속 도전해보세요!</Text>
          </View>
        </View>
      )}

      {isFallingNoteActive && previewCount !== null && (
        <View style={[styles.previewOverlay, overlayFrameStyle]} pointerEvents="none">
          <Text style={styles.previewText}>{previewCount === 0 ? 'Start' : previewCount}</Text>
        </View>
      )}

      {showFallingReplayPrompt && lastFallingResult && !fallingResult && (
        <FallingReplayPrompt
          result={lastFallingResult}
          onReplay={replayFallingSong}
          onShowResult={showLastFallingResult}
          onDismiss={dismissFallingReplayPrompt}
        />
      )}

      {fallingResult && !isTraining && (
        <FallingResultOverlay
          result={fallingResult}
          accuracy={fallingResultAccuracy}
          hits={fallingResultHits}
          misses={fallingResultMisses}
          onClose={closeFallingResult}
        />
      )}

      {/* 3. Ripple Effect Layer / Particle Visualizer (가장 상위 레이어 zIndex: 99 강제 배치) */}
      <View style={styles.rippleContainer} pointerEvents="none">
        {VISUALIZER_MODE === 'particle' ? (
          <ParticleVisualizer
            touchX={touchX}
            touchY={touchY}
            triggerTime={triggerTime}
            particleCount={20}
            particleSizeScale={isFallingNoteActive ? 0.85 : 1}
            particleSpeedScale={isFallingNoteActive ? 0.85 : 1}
            maxParticles={isFallingNoteActive ? 80 : 120}
          />
        ) : (
          <RippleLayer touchX={touchX} touchY={touchY} rippleProgress={rippleProgress} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'column',
  },
  midgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    zIndex: 2,
  },
  landscapeBackButton: {
    marginRight: 4,
  },
  infoSection: {
    flex: 1.2,
  },
  fallingPickerSection: {
    flex: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleSection: {
    flex: 2.4,
    minWidth: 0,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  consoleWindow: {
    height: '100%',
    overflow: 'hidden',
  },
  consoleFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  consoleContent: {
    position: 'absolute',
    top: '19%',
    bottom: '19%',
    left: '4.5%',
    right: '4.5%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  consoleToggles: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleActions: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleToggleButton: {
    minWidth: 0,
    flexShrink: 1,
  },
  consoleActionButton: {
    flexShrink: 1,
  },
  consoleActionText: {
    textAlign: 'center',
  },
  songSlotSection: {
    flex: 1.8,
    minWidth: 0,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  songSlotWindow: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  songSlotFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  songSlotPeek: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  songSlotTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 2,
  },
  actionSection: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  pianoArea: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  fallingModeLayout: {
    flex: 1,
    width: '100%',
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  fallingTrackArea: {
    flex: 1,
    width: '100%',
    marginBottom: 6,
    minHeight: 0,
    overflow: 'hidden',
  },
  fallingKeyboardArea: {
    width: '100%',
    justifyContent: 'center',
    paddingTop: 2,
    paddingBottom: 6,
    flexShrink: 0,
    zIndex: 12,
    elevation: 12,
  },
  octaveController: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '95%',
    backgroundColor: 'rgba(41, 41, 41, 0.8)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  octaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PIANO.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  octaveBtnHighlight: {
    backgroundColor: PIANO.highlight,
    elevation: 10,
  },
  octaveBtnDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  octaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  difficultyRow: {
    marginBottom: 5,
  },
  scaleToggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scaleToggleRowLast: {
    marginBottom: 0,
  },
  pianoContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  fallingPianoContainer: {
    flex: 0,
    paddingHorizontal: 0,
  },
  pianoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    position: 'relative',
    marginVertical: 8,
  },
  whiteKey: {
    borderWidth: 1,
    borderColor: PIANO.keys.whiteBorder,
    backgroundColor: PIANO.keys.white,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 15,
    // 2.5D 입체감 그림자
    elevation: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  blackKey: {
    position: 'absolute',
    backgroundColor: PIANO.keys.black,
    borderRadius: 4,
    zIndex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
    // 2.5D 입체감 그림자
    elevation: 15,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  keyTextLabel: {
    fontSize: 14,
    color: PIANO.keys.label,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blackKeyTextLabel: {
    fontSize: 11,
    color: PIANO.keys.labelOnBlack,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  whiteKeyLabel: {
    fontSize: 11,
    color: PIANO.keys.labelSub,
    fontWeight: '600',
  },
  blackKeyLabel: {
    fontSize: 10,
    color: PIANO.keys.labelSub,
    fontWeight: '600',
  },
  whiteKeyDisabled: {
    backgroundColor: PIANO.keys.whiteDisabled,
    borderColor: PIANO.keys.whiteBorderDisabled,
    opacity: 0.25,
  },
  keyDisabled: {
    opacity: 0.25,
  },
  keyLabelDisabled: {
    color: PIANO.keys.labelDisabled,
  },
  rippleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    elevation: 99,
  },
  missionOverlay: {
    // 하단 제어반을 제외한 피아노 영역 전체를 덮어 터치를 막는다.
    // 네 변은 렌더에서 `overlayFrameStyle`로 준다 — 인셋은 기기마다,
    // 제어반 높이는 모드마다 다르다 (평소 110 · 낙하 76). 고정값은 어긋난다
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  missionOverlayBox: {
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PIANO.highlight,
    alignItems: 'center',
    elevation: 10,
  },
  missionOverlayText: {
    color: PIANO.highlight,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  missionOverlaySubText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  previewOverlay: {
    // 위치는 `missionOverlay`와 같은 이유로 렌더에서 준다. 숫자가 연주 영역
    // 한가운데에 오려면 제어반 높이와 인셋을 둘 다 알아야 한다
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 95,
  },
  previewText: {
    color: PIANO.highlight,
    fontSize: 54,
    fontWeight: '900',
    textShadowColor: PIANO.highlight,
    textShadowRadius: 14,
  },
});
