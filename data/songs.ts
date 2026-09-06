/**
 * songs.ts
 * ------------------------------------------------------------------
 * 낙하노트 훈련모드용 곡 데이터 (음 + 타이밍 목록)
 *
 * 구성: 전곡 퍼블릭 도메인. 5음(penta5) 4곡 + 8음(white8) 4곡 = 총 8곡.
 *   - 5음(penta5): C3·D3·E3·G3·A3   (입문 8건반 뷰포트 안에 들어오는 장5음계)
 *   - 8음(white8): C4·D4·E4·F4·G4·A4·B4·C5   (백건 1옥타브 = 도레미파솔라시도)
 *
 * 템포: beat = 판정선 도달 시점(박, 4분음표 1박 기준).
 *   - normalBpm : '보통' = 그 곡 성격(자장가·행진 등)이 어색하지 않은 속도
 *   - slowBpm   : '느림' = 따라치기 쉽게 약 20% 느리게. 느낌을 잃지 않을 정도만 내린다
 *   UI 표기는 '보통 / 느림'. 전곡 동일 구간이 아니라 곡별로 상대적으로 둔다.
 *
 * ※ 5음 곡은 C·D·E·G·A(장5음계, F·B 없음, 음역 = 장6도) 안에 넣어야 하므로,
 *   원곡에 F/B가 있거나 음역이 넘칠 경우 인접 5음으로 살짝 옮겨 단순화한다.
 *   → 각 5음 곡 주석에 [단순화: 없음 / 있음-내용] 을 표기했다.
 *   (원곡 100% 재현이 아니라, 5음 범위에 맞춘 몸풀기용 편곡이다.)
 *
 * ※ 이전에 후보로 언급했던 Amazing Grace / Auld Lang Syne / Swing Low 는
 *   F/B가 아니라 '음역'이 장6도를 초과해(옥타브+) 5음 뷰포트에 안 들어와 제외.
 *   대신 장6도 안에 들어오는 5음 전통곡으로 채웠다.
 *
 * ※ 법적: 8곡 모두 저작권 소멸(19세기 이전 전통곡 및 베토벤 등) → 저작권/초상권 문제 없음.
 * ※ 낙하노트 엔진 자체는 아직 미구현. 이 파일은 '데이터'만 제공.
 *    (Not verified: 엔진 연동/실기기 재생, 각 곡의 음 단위 정확성은 미확인)
 * ※ Note 타입은 types/music.ts에서 공유한다.
 */

import type { Note } from '../types/music';

export type SongScale = 'penta5' | 'white8';
export type WarmupType = 'five-note' | 'eight-note' | 'long-form';

export interface SongNote {
  note: Note;   // 재생할 음 (App.tsx의 Note / soundFiles 키와 동일)
  beat: number; // 판정선 도달 시점(박)
}

export interface Song {
  id: string;
  title: string;
  origin: 'original' | 'public_domain';
  scale: SongScale;
  warmupType: WarmupType;
  tags: string[];
  description: string;
  palette: Note[];   // 이 곡이 쓰는 음 집합 (건반 필터 / 레인 구성용)
  normalBpm: number; // 보통(곡 성격에 맞는 속도)
  slowBpm: number;   // 느림(약 20% 느리게, 느낌 유지)
  notes: SongNote[];
}

// 음 집합 (레인/건반 구성에 그대로 사용)
const PENTA5: Note[] = ['C3', 'D3', 'E3', 'G3', 'A3'];
const WHITE8: Note[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];

export const songs: Song[] = [
  // ══════════════════════════════════════════════════════
  //  5음 (PENTA5 · C3 D3 E3 G3 A3)
  // ══════════════════════════════════════════════════════

  // ── 5음 1 · Hot Cross Buns (전통 · PD) ─────────────────
  // [단순화: 없음]  사용 음 = C·D·E (5음 중 3음만 사용). F/B 없음, 음역 장3도.
  // 1절 = 원곡 멜로디 전부. 추가로 이을 소절 없음.
  {
    id: 'pd_hotcross',
    title: '핫 크로스 번',
    origin: 'public_domain',
    scale: 'penta5',
    warmupType: 'five-note',
    tags: ['5음', '짧음', '반복', '퍼블릭 도메인'],
    description: '도·레·미 3음만 오가며 손과 귀를 여는 가장 쉬운 몸풀기 곡',
    palette: PENTA5,
    normalBpm: 88,
    slowBpm: 72,
    notes: [
      { note: 'E3', beat: 0 }, { note: 'D3', beat: 1 }, { note: 'C3', beat: 2 },
      { note: 'E3', beat: 4 }, { note: 'D3', beat: 5 }, { note: 'C3', beat: 6 },
      { note: 'C3', beat: 8 }, { note: 'C3', beat: 9 }, { note: 'C3', beat: 10 }, { note: 'C3', beat: 11 },
      { note: 'D3', beat: 12 }, { note: 'D3', beat: 13 }, { note: 'D3', beat: 14 }, { note: 'D3', beat: 15 },
      { note: 'E3', beat: 16 }, { note: 'D3', beat: 17 }, { note: 'C3', beat: 18 },
    ],
  },

  // ── 5음 2 · Ring Around the Rosie (전통 · PD) ──────────
  // [단순화: 없음]  사용 음 = C·D·E·G·A (5음 전부). F/B 없음, 음역 장6도(딱 맞음).
  // 1절 = 통용 멜로디 한 바퀴. 추가로 이을 소절 없음.
  {
    id: 'pd_ring',
    title: '링 어라운드 더 로지',
    origin: 'public_domain',
    scale: 'penta5',
    warmupType: 'five-note',
    tags: ['5음', '움직임', '5음 전체', '퍼블릭 도메인'],
    description: '5음 전체를 위아래로 오가며 상대음정 느낌을 익히는 몸풀기 곡',
    palette: PENTA5,
    normalBpm: 96,
    slowBpm: 78,
    notes: [
      { note: 'G3', beat: 0 }, { note: 'G3', beat: 1 }, { note: 'E3', beat: 2 }, { note: 'A3', beat: 3 },
      { note: 'G3', beat: 4 }, { note: 'E3', beat: 5 },
      { note: 'G3', beat: 7 }, { note: 'G3', beat: 8 }, { note: 'E3', beat: 9 }, { note: 'A3', beat: 10 },
      { note: 'G3', beat: 11 }, { note: 'E3', beat: 12 },
      { note: 'A3', beat: 14 }, { note: 'A3', beat: 15 },
      { note: 'G3', beat: 16 }, { note: 'E3', beat: 17 }, { note: 'D3', beat: 18 }, { note: 'C3', beat: 19 },
    ],
  },

  // ── 5음 3 · Jingle Bells (Pierpont, 1857 · PD) ─────────
  // [단순화: 있음]  후렴 한 바퀴. F('oh what fun') → G, 종지 G-G-F-D-C의 F → E.
  //   사용 음 = C·D·E·G.
  {
    id: 'pd_jingle',
    title: '징글벨',
    origin: 'public_domain',
    scale: 'penta5',
    warmupType: 'five-note',
    tags: ['5음', '익숙한 멜로디', '반복', '퍼블릭 도메인'],
    description: '한 음(미) 반복 뒤 도·레·솔로 뛰는 익숙한 후렴 몸풀기 곡',
    palette: PENTA5,
    normalBpm: 120,
    slowBpm: 96,
    notes: [
      { note: 'E3', beat: 0 }, { note: 'E3', beat: 1 }, { note: 'E3', beat: 2 },
      { note: 'E3', beat: 4 }, { note: 'E3', beat: 5 }, { note: 'E3', beat: 6 },
      { note: 'E3', beat: 8 }, { note: 'G3', beat: 9 }, { note: 'C3', beat: 10 }, { note: 'D3', beat: 11 }, { note: 'E3', beat: 12 },
      { note: 'G3', beat: 14 }, { note: 'G3', beat: 15 }, { note: 'G3', beat: 16 }, { note: 'G3', beat: 17 },
      { note: 'G3', beat: 18 }, { note: 'E3', beat: 19 }, { note: 'E3', beat: 20 }, { note: 'E3', beat: 21 },
      { note: 'E3', beat: 22 }, { note: 'D3', beat: 23 }, { note: 'D3', beat: 24 }, { note: 'E3', beat: 25 },
      { note: 'D3', beat: 26 }, { note: 'G3', beat: 28 },
      { note: 'E3', beat: 30 }, { note: 'E3', beat: 31 }, { note: 'E3', beat: 32 },
      { note: 'E3', beat: 34 }, { note: 'E3', beat: 35 }, { note: 'E3', beat: 36 },
      { note: 'E3', beat: 38 }, { note: 'G3', beat: 39 }, { note: 'C3', beat: 40 }, { note: 'D3', beat: 41 }, { note: 'E3', beat: 42 },
      { note: 'G3', beat: 44 }, { note: 'G3', beat: 45 }, { note: 'G3', beat: 46 }, { note: 'G3', beat: 47 },
      { note: 'G3', beat: 48 }, { note: 'E3', beat: 49 }, { note: 'E3', beat: 50 }, { note: 'E3', beat: 51 },
      { note: 'G3', beat: 52 }, { note: 'G3', beat: 53 }, { note: 'E3', beat: 54 }, { note: 'D3', beat: 55 },
      { note: 'C3', beat: 56 },
    ],
  },

  // ── 5음 4 · Old MacDonald Had a Farm (전통 · PD) ───────
  // [단순화: 있음]  'E-I-E-I-O'의 시(B)를 라(A)로 내림(B→A). 그 외 1절 통용 멜로디.
  //   사용 음 = D·E·G·A. 원곡 음역은 5음 뷰포트(장6도) 안에 들어옴.
  {
    id: 'pd_oldmac',
    title: '올드 맥도날드',
    origin: 'public_domain',
    scale: 'penta5',
    warmupType: 'five-note',
    tags: ['5음', '익숙한 멜로디', '반복', '퍼블릭 도메인'],
    description: '반복 후렴으로 집중을 유지하며 5음에 익숙해지는 몸풀기 곡',
    palette: PENTA5,
    normalBpm: 104,
    slowBpm: 84,
    notes: [
      { note: 'G3', beat: 0 }, { note: 'G3', beat: 1 }, { note: 'G3', beat: 2 }, { note: 'D3', beat: 3 },
      { note: 'E3', beat: 4 }, { note: 'E3', beat: 5 }, { note: 'D3', beat: 6 },
      { note: 'A3', beat: 8 }, { note: 'A3', beat: 9 }, { note: 'A3', beat: 10 }, { note: 'A3', beat: 11 }, { note: 'G3', beat: 12 },
      { note: 'G3', beat: 14 }, { note: 'G3', beat: 15 }, { note: 'G3', beat: 16 }, { note: 'D3', beat: 17 },
      { note: 'E3', beat: 18 }, { note: 'E3', beat: 19 }, { note: 'D3', beat: 20 },
      { note: 'A3', beat: 22 }, { note: 'A3', beat: 23 }, { note: 'A3', beat: 24 }, { note: 'A3', beat: 25 }, { note: 'G3', beat: 26 },
      { note: 'D3', beat: 28 }, { note: 'D3', beat: 29 }, { note: 'D3', beat: 30 }, { note: 'D3', beat: 31 },
      { note: 'E3', beat: 32 }, { note: 'E3', beat: 33 }, { note: 'D3', beat: 34 },
      { note: 'D3', beat: 36 }, { note: 'D3', beat: 37 }, { note: 'D3', beat: 38 }, { note: 'D3', beat: 39 },
      { note: 'E3', beat: 40 }, { note: 'E3', beat: 41 }, { note: 'D3', beat: 42 },
      { note: 'D3', beat: 44 }, { note: 'D3', beat: 45 }, { note: 'E3', beat: 46 }, { note: 'E3', beat: 47 },
      { note: 'D3', beat: 48 }, { note: 'D3', beat: 49 }, { note: 'E3', beat: 50 }, { note: 'E3', beat: 51 },
      { note: 'D3', beat: 52 }, { note: 'D3', beat: 53 }, { note: 'D3', beat: 54 }, { note: 'D3', beat: 55 },
      { note: 'E3', beat: 56 }, { note: 'E3', beat: 57 }, { note: 'D3', beat: 58 },
      { note: 'G3', beat: 60 }, { note: 'G3', beat: 61 }, { note: 'G3', beat: 62 }, { note: 'D3', beat: 63 },
      { note: 'E3', beat: 64 }, { note: 'E3', beat: 65 }, { note: 'D3', beat: 66 },
      { note: 'A3', beat: 68 }, { note: 'A3', beat: 69 }, { note: 'A3', beat: 70 }, { note: 'A3', beat: 71 }, { note: 'G3', beat: 72 },
    ],
  },

  // ══════════════════════════════════════════════════════
  //  8음 (WHITE8 · C4 D4 E4 F4 G4 A4 B4 C5)
  // ══════════════════════════════════════════════════════

  // ── 8음 1 · 반짝반짝 작은별 (원곡 "Ah! vous dirai-je, maman", 18세기 · PD) ──
  // 통용 멜로디 한 바퀴(6소절). 사용 음 = C·D·E·F·G·A.
  {
    id: 'pd_twinkle',
    title: '반짝반짝 작은별',
    origin: 'public_domain',
    scale: 'white8',
    warmupType: 'eight-note',
    tags: ['8음', '익숙한 멜로디', '퍼블릭 도메인'],
    description: '도레미파솔라시도 8음 범위에 익숙해지는 멜로디 곡',
    palette: WHITE8,
    normalBpm: 80,
    slowBpm: 64,
    notes: [
      { note: 'C4', beat: 0 }, { note: 'C4', beat: 1 }, { note: 'G4', beat: 2 }, { note: 'G4', beat: 3 },
      { note: 'A4', beat: 4 }, { note: 'A4', beat: 5 }, { note: 'G4', beat: 6 },
      { note: 'F4', beat: 8 }, { note: 'F4', beat: 9 }, { note: 'E4', beat: 10 }, { note: 'E4', beat: 11 },
      { note: 'D4', beat: 12 }, { note: 'D4', beat: 13 }, { note: 'C4', beat: 14 },
      { note: 'G4', beat: 16 }, { note: 'G4', beat: 17 }, { note: 'F4', beat: 18 }, { note: 'F4', beat: 19 },
      { note: 'E4', beat: 20 }, { note: 'E4', beat: 21 }, { note: 'D4', beat: 22 },
      { note: 'G4', beat: 24 }, { note: 'G4', beat: 25 }, { note: 'F4', beat: 26 }, { note: 'F4', beat: 27 },
      { note: 'E4', beat: 28 }, { note: 'E4', beat: 29 }, { note: 'D4', beat: 30 },
      { note: 'C4', beat: 32 }, { note: 'C4', beat: 33 }, { note: 'G4', beat: 34 }, { note: 'G4', beat: 35 },
      { note: 'A4', beat: 36 }, { note: 'A4', beat: 37 }, { note: 'G4', beat: 38 },
      { note: 'F4', beat: 40 }, { note: 'F4', beat: 41 }, { note: 'E4', beat: 42 }, { note: 'E4', beat: 43 },
      { note: 'D4', beat: 44 }, { note: 'D4', beat: 45 }, { note: 'C4', beat: 46 },
    ],
  },

  // ── 8음 2 · 메리의 어린 양 (전통 멜로디 · PD) ──────────
  // 1절 = 통용 멜로디 한 바퀴. 2절은 같은 음이라 추가하지 않음.
  {
    id: 'pd_mary',
    title: '메리의 어린 양',
    origin: 'public_domain',
    scale: 'white8',
    warmupType: 'long-form',
    tags: ['8음', '긴 곡', '반복', '퍼블릭 도메인'],
    description: '반복 패턴과 집중 유지를 연습하는 조금 긴 몸풀기 곡',
    palette: WHITE8,
    normalBpm: 88,
    slowBpm: 70,
    notes: [
      { note: 'E4', beat: 0 }, { note: 'D4', beat: 1 }, { note: 'C4', beat: 2 }, { note: 'D4', beat: 3 },
      { note: 'E4', beat: 4 }, { note: 'E4', beat: 5 }, { note: 'E4', beat: 6 },
      { note: 'D4', beat: 8 }, { note: 'D4', beat: 9 }, { note: 'D4', beat: 10 },
      { note: 'E4', beat: 12 }, { note: 'G4', beat: 13 }, { note: 'G4', beat: 14 },
      { note: 'E4', beat: 16 }, { note: 'D4', beat: 17 }, { note: 'C4', beat: 18 }, { note: 'D4', beat: 19 },
      { note: 'E4', beat: 20 }, { note: 'E4', beat: 21 }, { note: 'E4', beat: 22 }, { note: 'E4', beat: 23 },
      { note: 'D4', beat: 25 }, { note: 'D4', beat: 26 }, { note: 'E4', beat: 27 }, { note: 'D4', beat: 28 },
      { note: 'C4', beat: 29 },
    ],
  },

  // ── 8음 3 · 환희의 송가 (Beethoven 교향곡 9번 · PD) ────
  // 통용 주제 한 바퀴(A + A' + B + A). 사용 음 = C·D·E·F·G. 8분음표는 4분음표로 단순화.
  {
    id: 'pd_ode',
    title: '환희의 송가',
    origin: 'public_domain',
    scale: 'white8',
    warmupType: 'eight-note',
    tags: ['8음', '익숙한 멜로디', '순차진행', '퍼블릭 도메인'],
    description: '이웃한 음이 계단처럼 이어져 음정 간격을 익히기 좋은 곡',
    palette: WHITE8,
    normalBpm: 100,
    slowBpm: 80,
    notes: [
      { note: 'E4', beat: 0 }, { note: 'E4', beat: 1 }, { note: 'F4', beat: 2 }, { note: 'G4', beat: 3 },
      { note: 'G4', beat: 4 }, { note: 'F4', beat: 5 }, { note: 'E4', beat: 6 }, { note: 'D4', beat: 7 },
      { note: 'C4', beat: 8 }, { note: 'C4', beat: 9 }, { note: 'D4', beat: 10 }, { note: 'E4', beat: 11 },
      { note: 'E4', beat: 12 }, { note: 'D4', beat: 13 }, { note: 'D4', beat: 14 },
      { note: 'E4', beat: 16 }, { note: 'E4', beat: 17 }, { note: 'F4', beat: 18 }, { note: 'G4', beat: 19 },
      { note: 'G4', beat: 20 }, { note: 'F4', beat: 21 }, { note: 'E4', beat: 22 }, { note: 'D4', beat: 23 },
      { note: 'C4', beat: 24 }, { note: 'C4', beat: 25 }, { note: 'D4', beat: 26 }, { note: 'E4', beat: 27 },
      { note: 'D4', beat: 28 }, { note: 'C4', beat: 29 }, { note: 'C4', beat: 30 },
      { note: 'D4', beat: 32 }, { note: 'D4', beat: 33 }, { note: 'E4', beat: 34 }, { note: 'C4', beat: 35 },
      { note: 'D4', beat: 36 }, { note: 'E4', beat: 37 }, { note: 'F4', beat: 38 }, { note: 'E4', beat: 39 },
      { note: 'C4', beat: 40 },
      { note: 'D4', beat: 42 }, { note: 'E4', beat: 43 }, { note: 'F4', beat: 44 }, { note: 'E4', beat: 45 },
      { note: 'D4', beat: 46 }, { note: 'C4', beat: 47 }, { note: 'D4', beat: 48 }, { note: 'G4', beat: 49 },
      { note: 'E4', beat: 52 }, { note: 'E4', beat: 53 }, { note: 'F4', beat: 54 }, { note: 'G4', beat: 55 },
      { note: 'G4', beat: 56 }, { note: 'F4', beat: 57 }, { note: 'E4', beat: 58 }, { note: 'D4', beat: 59 },
      { note: 'C4', beat: 60 }, { note: 'C4', beat: 61 }, { note: 'D4', beat: 62 }, { note: 'E4', beat: 63 },
      { note: 'D4', beat: 64 }, { note: 'C4', beat: 65 }, { note: 'C4', beat: 66 },
    ],
  },

  // ── 8음 4 · 성자의 행진 (When the Saints Go Marching In · 전통 · PD) ──
  // 1절 통용 멜로디(마지막 "when the saints go marching in" 포함). 사용 음 = C·D·E·F·G.
  {
    id: 'pd_saints',
    title: '성자의 행진',
    origin: 'public_domain',
    scale: 'white8',
    warmupType: 'long-form',
    tags: ['8음', '긴 곡', '도약진행', '퍼블릭 도메인'],
    description: '도약과 순차를 섞어 8음 범위를 넓게 움직이는 조금 긴 곡',
    palette: WHITE8,
    normalBpm: 120,
    slowBpm: 96,
    notes: [
      { note: 'C4', beat: 0 }, { note: 'E4', beat: 1 }, { note: 'F4', beat: 2 }, { note: 'G4', beat: 3 },
      { note: 'C4', beat: 5 }, { note: 'E4', beat: 6 }, { note: 'F4', beat: 7 }, { note: 'G4', beat: 8 },
      { note: 'C4', beat: 10 }, { note: 'E4', beat: 11 }, { note: 'F4', beat: 12 }, { note: 'G4', beat: 13 },
      { note: 'E4', beat: 14 }, { note: 'C4', beat: 15 }, { note: 'E4', beat: 16 }, { note: 'D4', beat: 17 },
      { note: 'E4', beat: 19 }, { note: 'E4', beat: 20 }, { note: 'D4', beat: 21 }, { note: 'C4', beat: 22 },
      { note: 'D4', beat: 23 }, { note: 'E4', beat: 24 }, { note: 'C4', beat: 25 },
      { note: 'C4', beat: 27 }, { note: 'E4', beat: 28 }, { note: 'F4', beat: 29 }, { note: 'G4', beat: 30 },
      { note: 'E4', beat: 31 }, { note: 'C4', beat: 32 }, { note: 'D4', beat: 33 }, { note: 'C4', beat: 34 },
    ],
  },
];

// 선택지별 조회 헬퍼 (5음 / 8음 두 갈래)
export const songsByScale = (scale: SongScale): Song[] =>
  songs.filter((s) => s.scale === scale);
