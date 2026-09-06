import type { Song, SongScale } from '../data/songs';
import type { Note } from '../types/music';

export const HIT_WINDOW_MS = 300;

export type JudgmentGrade = 'Perfect' | 'Great' | 'Good' | 'Miss';

export interface ScheduledFallingNote {
  id: string;
  note: Note;
  expectedTimestamp: number;
  hitX?: number;
  hitY?: number;
  judgment?: JudgmentGrade;
  hit: boolean;
  reached: boolean;
  missed: boolean;
  beat: number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export interface FallingTrackMetrics {
  x: number;
  y: number;
  judgmentLineY: number;
  laneWidth: number;
  laneStartX: number;
}

export interface FallingResult {
  title: string;
  totalNotes: number;
  perfect: number;
  great: number;
  good: number;
  cleared: boolean;
}

export type FallingTempoMode = 'normal' | 'slow';

export const fallingScaleLabels: Record<SongScale, string> = {
  penta5: '5음',
  white8: '8음',
};

export const fallingTempoLabels: Record<FallingTempoMode, string> = {
  normal: '보통',
  slow: '느림',
};

export const computeFocusStart = (
  noteWhiteIdx: number,
  currentStart: number,
  viewportSize: number,
  totalWhite: number
) => {
  // 14건반 페이지 스냅에 맞춘 포커싱 처리
  if (noteWhiteIdx <= 13) return 0;
  if (noteWhiteIdx <= 27) return 14;
  return 16;
};

export const getFallingNoteId = (note: Note, beat: number) => `${note}-${beat}`;

export const getJudgmentGrade = (driftMs: number): JudgmentGrade => {
  const absDrift = Math.abs(driftMs);
  if (absDrift <= 80) return 'Perfect';
  if (absDrift <= 170) return 'Great';
  if (absDrift <= HIT_WINDOW_MS) return 'Good';
  return 'Miss';
};

export const getFallingClearTarget = (song: Song | null) => (song?.scale === 'penta5' ? 70 : 80);
