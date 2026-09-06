import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, RoundedRect, Line, vec } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue, runOnJS, useDerivedValue, withTiming } from 'react-native-reanimated';
import { Song, SongNote } from '../data/songs';
import type { Note } from '../types/music';

interface FallingNoteTrackProps {
  song: Song | null;
  isPlaying: boolean;
  bpm?: number;
  onNoteSchedule?: (note: Note, expectedTimestamp: number, beat: number) => void;
  onNoteHit?: (note: Note, beat: number, reachedTimestamp: number, hitX: number, hitY: number) => void;
  onSongEnd?: () => void;
  viewportStartIdx?: number;
  dynamicWhiteKeyWidth?: number;
  laneStartX?: number;
  whiteIdxMap?: Record<string, number>;
  hitNoteIds?: string[];
  missNoteIds?: string[];
  judgmentPulseKey?: number;
  missPulseKey?: number;
  onTrackMetrics?: (metrics: {
    x: number;
    y: number;
    judgmentLineY: number;
    laneWidth: number;
    laneStartX: number;
  }) => void;
}

const LEAD_BEATS = 4; // 화면에 미리 보여질 박자 수
const INTRO_BEATS = LEAD_BEATS; // 첫 노트가 바로 판정선에서 시작하지 않도록 준비 박자 제공
const LANE_MARGIN = 10;
const getNoteId = (note: Note, beat: number) => `${note}-${beat}`;

export const FallingNoteTrack: React.FC<FallingNoteTrackProps> = ({
  song,
  isPlaying,
  bpm = 72,
  onNoteSchedule,
  onNoteHit,
  onSongEnd,
  viewportStartIdx,
  dynamicWhiteKeyWidth,
  laneStartX = LANE_MARGIN,
  whiteIdxMap,
  hitNoteIds = [],
  missNoteIds = [],
  judgmentPulseKey = 0,
  missPulseKey = 0,
  onTrackMetrics,
}) => {
  const { width, height } = useWindowDimensions();
  const trackRef = useRef<View>(null);
  const trackOriginX = useSharedValue(0);
  const trackOriginY = useSharedValue(0);
  const [trackSize, setTrackSize] = useState({ width, height });
  const trackWidth = trackSize.width || width;
  const trackHeight = trackSize.height || height;
  const JUDGMENT_LINE_Y = Math.max(40, trackHeight - 24);
  const effectiveBpm = bpm;
  const [judgmentPulse, setJudgmentPulse] = useState(false);
  const [missPulse, setMissPulse] = useState(false);
  
  // 상태 변수 (SharedValue for UI Thread)
  const startTimestamp = useSharedValue(-1);
  const currentTime = useSharedValue(0);
  
  // JS 스레드용 스케줄 체크 배열 (원래 SharedValue 배열 수정은 까다로우므로 JS 스레드 타이머 사용 방안도 있음)
  // 여기서는 구조를 최대한 단순화하여, 재생 시작 시 JS 스레드에서 전체 스케줄을 순회하며 emit 하는 방식을 씁니다.
  // 어차피 "예정 시각"을 알려주는 것이 목표이므로, 재생 시작(t=0) 시점에 모든 노트의 예상 타임스탬프를 계산해서 던져줘도 됩니다!
  
  const [baseTimestamp, setBaseTimestamp] = useState<number | null>(null);
  const songEndFired = useRef(false);
  const scheduledKeyRef = useRef<string | null>(null);

  const measureTrackOrigin = (measuredWidth?: number, measuredHeight?: number) => {
    const widthForLane = measuredWidth ?? trackWidth;
    const heightForLine = measuredHeight ?? trackHeight;
    if (heightForLine <= 0) return;
    const judgmentLineY = Math.max(40, heightForLine - 24);

    trackRef.current?.measureInWindow((x, y) => {
      trackOriginX.value = x;
      trackOriginY.value = y;
      if (song) {
        const laneWidth = dynamicWhiteKeyWidth ?? (widthForLane - LANE_MARGIN * 2) / song.palette.length;
        onTrackMetrics?.({
          x,
          y,
          judgmentLineY,
          laneWidth,
          laneStartX,
        });
      }
    });
  };

  useEffect(() => {
    if (judgmentPulseKey === 0) return;
    setJudgmentPulse(true);
    const timer = setTimeout(() => setJudgmentPulse(false), 140);
    return () => clearTimeout(timer);
  }, [judgmentPulseKey]);

  useEffect(() => {
    if (missPulseKey === 0) return;
    setMissPulse(true);
    const timer = setTimeout(() => setMissPulse(false), 180);
    return () => clearTimeout(timer);
  }, [missPulseKey]);

  // isPlaying이 바뀔 때 트랙 내부 1회성 플래그 리셋
  useEffect(() => {
    if (!isPlaying) {
      songEndFired.current = false;
      scheduledKeyRef.current = null;
    }
  }, [isPlaying]);

  useFrameCallback((frame) => {
    if (!isPlaying) {
      startTimestamp.value = -1;
      if (baseTimestamp !== null) runOnJS(setBaseTimestamp)(null);
      return;
    }

    if (startTimestamp.value === -1) {
      startTimestamp.value = frame.timestamp;
      runOnJS(setBaseTimestamp)(Date.now());
    }

    // TODO: 병합 안정화 단계에서 부모의 단일 프레임 시계 주입 방식으로 교체 예정.
    currentTime.value = frame.timestamp - startTimestamp.value;

    // 곡 종료 감지: 마지막 노트 beat + 여유 2박 경과 시 1회 콜백
    if (song && onSongEnd && !songEndFired.current) {
      const lastBeat = song.notes[song.notes.length - 1]?.beat ?? 0;
      const currentBeat = (currentTime.value / 1000 / 60) * effectiveBpm;
      if (currentBeat > lastBeat + INTRO_BEATS + 2) {
        songEndFired.current = true;
        runOnJS(onSongEnd)();
      }
    }
  }, true);

  // 재생이 시작되어 baseTimestamp가 세팅되면, 모든 노트의 스케줄을 부모에게 전달합니다.
  useEffect(() => {
    if (!isPlaying || baseTimestamp === null || !onNoteSchedule || !song) {
      return;
    }

    const scheduleKey = `${song.id}-${baseTimestamp}`;
    if (scheduledKeyRef.current === scheduleKey) {
      return;
    }

    scheduledKeyRef.current = scheduleKey;
    song.notes.forEach((note) => {
      // beat를 ms로 변환
      const hitTimeMs = ((note.beat + INTRO_BEATS) / effectiveBpm) * 60 * 1000;
      const expectedTimestamp = baseTimestamp + hitTimeMs;
      onNoteSchedule(note.note, expectedTimestamp, note.beat);
    });
  }, [baseTimestamp, effectiveBpm, isPlaying, song, onNoteSchedule]);

  // 렌더링 로직
  if (!song) return null;

  // 레인(Lane) 계산
  const palette = song.palette;
  const isIntegrated = whiteIdxMap && dynamicWhiteKeyWidth && viewportStartIdx !== undefined;
  const laneWidth = dynamicWhiteKeyWidth ?? (trackWidth - LANE_MARGIN * 2) / palette.length;

  const getLaneX = (noteStr: Note) => {
    if (isIntegrated) {
      const idx = whiteIdxMap![noteStr];
      if (idx === undefined) return -100;
      const relativeIdx = idx - viewportStartIdx!;
      return laneStartX + relativeIdx * laneWidth;
    }
    const idx = palette.indexOf(noteStr);
    if (idx === -1) return -100; // 화면 밖
    return laneStartX + idx * laneWidth;
  };

  // 레인 구분선 X 좌표 계산 (통합 모드에서도 건반에 맞춤)
  const laneLineXs = palette.map((note) => getLaneX(note));
  const firstLaneX = laneLineXs.length > 0 ? laneLineXs[0] : 0;
  const lastLaneX = laneLineXs.length > 0 ? laneLineXs[laneLineXs.length - 1] + laneWidth : trackWidth;

  return (
    <View
      ref={trackRef}
      style={styles.container}
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        setTrackSize({ width: nextWidth, height: nextHeight });
        measureTrackOrigin(nextWidth, nextHeight);
      }}
    >
      <Canvas style={{ flex: 1 }}>
        {/* 레인 구분선 (통합 모드: 건반 좌표 기반) */}
        {laneLineXs.map((x, i) => (
          <Line
            key={`lane-${i}`}
            p1={vec(x, 0)}
            p2={vec(x, trackHeight)}
            color="rgba(255, 255, 255, 0.1)"
            strokeWidth={1}
          />
        ))}
        <Line
          p1={vec(lastLaneX, 0)}
          p2={vec(lastLaneX, trackHeight)}
          color="rgba(255, 255, 255, 0.1)"
          strokeWidth={1}
        />

        {/* 판정선 (레인 영역에 클리핑) */}
        <Line
          p1={vec(firstLaneX, JUDGMENT_LINE_Y)}
          p2={vec(lastLaneX, JUDGMENT_LINE_Y)}
          color={missPulse ? '#ff453a' : judgmentPulse ? '#ffffff' : '#00ffcc'}
          strokeWidth={judgmentPulse || missPulse ? 6 : 3}
        />

        {/* 노트 렌더링 (Custom Drawing Component) */}
        <NotesRenderer 
          song={song} 
          currentTime={currentTime} 
          laneWidth={laneWidth}
          getLaneX={getLaneX}
          judgmentLineY={JUDGMENT_LINE_Y}
          trackOriginX={trackOriginX}
          trackOriginY={trackOriginY}
          hitNoteIds={hitNoteIds}
          missNoteIds={missNoteIds}
          baseTimestamp={baseTimestamp}
          effectiveBpm={effectiveBpm}
          isPlaying={isPlaying}
          onNoteHit={onNoteHit}
        />
      </Canvas>
    </View>
  );
};



// UI 스레드에서만 도는 노트 렌더러
const NotesRenderer = ({ song, currentTime, laneWidth, getLaneX, judgmentLineY, trackOriginX, trackOriginY, hitNoteIds, missNoteIds, baseTimestamp, effectiveBpm, isPlaying, onNoteHit }: any) => {
  return (
    <>
      {song.notes.map((n: SongNote, i: number) => {
        const x = getLaneX(n.note);
        if (x < 0) return null;
        const noteId = getNoteId(n.note, n.beat);
        const isHit = hitNoteIds.includes(noteId);
        const isMiss = missNoteIds.includes(noteId);
        return (
          <AnimatedNote
            key={`note-${n.note}-${n.beat}-${i}`}
            n={n}
            targetBeat={n.beat + INTRO_BEATS}
            isHit={isHit}
            isMiss={isMiss}
            song={song}
            currentTime={currentTime}
            x={x}
            laneWidth={laneWidth}
            judgmentLineY={judgmentLineY}
            trackOriginX={trackOriginX}
            trackOriginY={trackOriginY}
            baseTimestamp={baseTimestamp}
            effectiveBpm={effectiveBpm}
            isPlaying={isPlaying}
            onNoteHit={onNoteHit}
          />
        );
      })}
    </>
  );
};

const AnimatedNote = ({ n, targetBeat, currentTime, x, laneWidth, judgmentLineY, trackOriginX, trackOriginY, isHit, isMiss, baseTimestamp, effectiveBpm, isPlaying, onNoteHit }: any) => {
  const reachFired = useSharedValue(false);
  const resolveOpacity = useSharedValue(1);
  const noteHorizontalInset = 2;
  const noteWidth = Math.max(8, laneWidth - noteHorizontalInset * 2);

  useEffect(() => {
    if (isHit || isMiss) {
      resolveOpacity.value = 1;
      resolveOpacity.value = withTiming(0, { duration: isHit ? 220 : 320 });
    }
  }, [isHit, isMiss, resolveOpacity]);

  const y = useDerivedValue(() => {
    const currentBeat = (currentTime.value / 1000 / 60) * effectiveBpm;
    const distanceBeats = targetBeat - currentBeat;
    return judgmentLineY - (distanceBeats / LEAD_BEATS) * judgmentLineY - 20; // 20은 노트 높이 절반 오프셋
  });

  useDerivedValue(() => {
    if (!isPlaying || !onNoteHit || reachFired.value) return;

    const currentBeat = (currentTime.value / 1000 / 60) * effectiveBpm;
    if (currentBeat >= targetBeat) {
      reachFired.value = true;
      const reachedTimestamp = baseTimestamp !== null ? baseTimestamp + currentTime.value : Date.now();
      const hitX = trackOriginX.value + x + laneWidth / 2;
      const hitY = trackOriginY.value + judgmentLineY;
      runOnJS(onNoteHit)(n.note, n.beat, reachedTimestamp, hitX, hitY);
    }
  });

  const opacity = useDerivedValue(() => {
    if (!isPlaying) return 0;
    if (isHit || isMiss) return resolveOpacity.value;
    const currentBeat = (currentTime.value / 1000 / 60) * effectiveBpm;
    const distanceBeats = targetBeat - currentBeat;
    // 판정선 약간 아래(-1박자)부터 화면 상단(LEAD_BEATS)까지만 렌더링
    const isVisible = distanceBeats <= LEAD_BEATS && distanceBeats >= -1;
    return isVisible ? 1 : 0;
  });

  return (
    <RoundedRect
      x={x + noteHorizontalInset}
      y={y}
      width={noteWidth}
      height={40}
      color={isMiss ? '#ff453a' : isHit ? '#00ffcc' : '#a78bfa'}
      r={8}
      opacity={opacity}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
