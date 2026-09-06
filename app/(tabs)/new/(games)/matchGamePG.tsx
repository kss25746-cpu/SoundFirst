import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { memo, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MissionProgressIcon from '../../../../components/MissionProgressIcon';
import WaveRipple from '../../../../components/WaveRipple';
import { ClearContext } from '../../../../context/ClearContext';
import { StarContext } from '../../../../context/StarContext';
import { LAYOUT } from '../../../../constants/layout';
import { COLORS } from '../../../../constants/colors';
import { SOUNDS_CONFIG } from '../../../../constants/animalSounds';
import { gameAudioManager } from '../../../../services/GameAudioManager';
import { useSyncGameData } from '../../../../hooks/useSyncGameData';
import { useStopAudioOnBlur } from '../../../../hooks/useStopAudioOnBlur';

const LEARNING_RATE = 0.1;

const MAX_CHOICES = 3;
const STORAGE_KEY = '@AuditoryTrainingAppPG:gameState';

type GameStatus = 'HOME' | 'LOADING' | 'LISTENING' | 'PLAYING' | 'RESULTS' | 'STATS';
type GameMode = 'STANDARD' | 'WEAKNESS';
type Policy = { [state: string]: { [action: string]: number } };
type UserStats = { [sound: string]: { correct: number; total: number } };

type GameState = {
    status: GameStatus;
    mode: GameMode;
    difficulty: number;
    policy: Policy;
    userStats: UserStats;
    remainingChoices: number;
    correctSoundNames: Set<string>;
    userSelections: { [key: string]: 'correct' | 'incorrect' };
    score: number;
    roundResult: 'WIN' | 'LOSE' | null;
    hasLostChanceInRun: boolean; // 기회 소모 여부 추적
    // 전송용 데이터 수집 상태
    playedDifficulty: number;      // 이번 라운드 시작 시 난이도
    gameStartTime: number | null;  // 조작 시작 시간
    roundWrongAttempts: string[];  // 이번 라운드 오답 목록
};

type Action =
    | { type: 'LOAD_DATA_SUCCESS'; payload: Partial<Pick<GameState, 'difficulty' | 'policy' | 'userStats'>> }
    | { type: 'LOAD_DATA_FAILURE' }
    | { type: 'SET_STATUS'; payload: GameStatus }
    | { type: 'START_GAME'; payload: { mode: GameMode; correctNames: Set<string>; isNewRun: boolean } }
    | { type: 'SELECT_ANSWER'; payload: { selectedName: string; isCorrect: boolean } };

const initialPolicy = SOUNDS_CONFIG.reduce((acc, s) => ({
    ...acc,
    [s.name]: SOUNDS_CONFIG.reduce((policy, i) => ({ ...policy, [i.name]: 1 / SOUNDS_CONFIG.length }), {})
}), {});

const initialUserStats = SOUNDS_CONFIG.reduce((acc, s) => ({ ...acc, [s.name]: { correct: 0, total: 0 } }), {});

const initialState: GameState = {
    status: 'LOADING',
    mode: 'STANDARD',
    difficulty: 1,
    policy: initialPolicy,
    userStats: initialUserStats,
    remainingChoices: MAX_CHOICES,
    correctSoundNames: new Set(),
    userSelections: {},
    score: 0,
    roundResult: null,
    hasLostChanceInRun: false, // 초기값 설정
    playedDifficulty: 1,
    gameStartTime: null,
    roundWrongAttempts: [],
};

function gameReducer(state: GameState, action: Action): GameState {
    switch (action.type) {
        case 'LOAD_DATA_SUCCESS':
            return { ...state, ...action.payload, status: 'HOME' };
        case 'LOAD_DATA_FAILURE':
             return { ...state, status: 'HOME' };
        case 'SET_STATUS':
            return { ...state, status: action.payload };
        case 'START_GAME':
            return {
                ...state,
                status: 'PLAYING',
                mode: action.payload.mode,
                correctSoundNames: action.payload.correctNames,
                userSelections: {},
                score: 0,
                remainingChoices: MAX_CHOICES,
                roundResult: null,
                // 새로운 게임 시작 시에만 기회 소모 여부 초기화
                hasLostChanceInRun: action.payload.isNewRun ? false : state.hasLostChanceInRun,
                // 라운드 기록 초기화 및 현재 난이도 고정
                playedDifficulty: state.difficulty,
                roundWrongAttempts: [],
                gameStartTime: Date.now(), // 반응 시간 측정 시작
            };
        case 'SELECT_ANSWER': {
            const { selectedName, isCorrect } = action.payload;
            if (state.userSelections[selectedName]) return state;

            const newSelections = { ...state.userSelections, [selectedName]: isCorrect ? 'correct' : 'incorrect' as 'correct' | 'incorrect' };
            const newStats = { ...state.userStats };
            const statsForSelection = newStats[selectedName] || { correct: 0, total: 0 };
            newStats[selectedName] = { correct: statsForSelection.correct + (isCorrect ? 1 : 0), total: statsForSelection.total + 1 };
            const newPolicy = JSON.parse(JSON.stringify(state.policy));
            const reward = isCorrect ? 1 : -1;
            const policyForState = newPolicy[selectedName];
            const currentProb = policyForState[selectedName];
            const newUnnormalizedProb = currentProb * Math.exp(LEARNING_RATE * reward);
            policyForState[selectedName] = newUnnormalizedProb;
            const totalProb = Object.values(policyForState).reduce((sum: number, p: any) => sum + p, 0);

            if (totalProb > 0) {
                Object.keys(policyForState).forEach(actionKey => {
                    policyForState[actionKey] /= totalProb;
                });
            }

            const newCorrectNames = new Set(state.correctSoundNames);
            if (isCorrect) newCorrectNames.delete(selectedName);

            const didWin = newCorrectNames.size === 0;
            const didLose = !isCorrect && state.remainingChoices - 1 <= 0;
            const isFinished = didWin || didLose;
            const newDifficulty = didWin ? state.difficulty + 1 : (didLose && state.difficulty > 1 ? state.difficulty - 1 : state.difficulty);

            return {
                ...state,
                userSelections: newSelections,
                correctSoundNames: newCorrectNames,
                remainingChoices: isCorrect ? state.remainingChoices : state.remainingChoices - 1,
                score: isCorrect ? state.score + (10 * state.difficulty) : state.score,
                status: isFinished ? 'RESULTS' : 'PLAYING',
                difficulty: newDifficulty,
                userStats: newStats,
                policy: newPolicy,
                roundResult: isFinished ? (didWin ? 'WIN' : 'LOSE') : null,
                // 오답 시 기회 소모 기록
                hasLostChanceInRun: state.hasLostChanceInRun || !isCorrect,
                // 오답일 경우 어떤 동물을 눌렀는지 기록
                roundWrongAttempts: isCorrect ? state.roundWrongAttempts : [...state.roundWrongAttempts, selectedName],
            };
        }
        default:
            return state;
    }
}

// ===================================================================================
// 📁 src/hooks/useAuditoryGame.ts
// ===================================================================================
const useAuditoryGame = () => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const { syncData } = useSyncGameData(); // 전송용 데이터
    
    const starContext = useContext(StarContext);
    const clearContext = useContext(ClearContext);
    
    // 이전 난이도를 추적하기 위한 ref
    const prevDifficultyRef = useRef<number>(state.difficulty);
    useEffect(() => {
        prevDifficultyRef.current = state.difficulty;
    });
    const previousDifficulty = prevDifficultyRef.current;
    
    // 난이도 변경 감지하여 미션/클리어 조건 확인
    useEffect(() => {
        // 난이도가 2에서 3으로 상승하는 순간
        if (previousDifficulty === 2 && state.difficulty === 3) {
            starContext?.addStar('matchGamePG'); // 별 획득
            if (!state.hasLostChanceInRun) {
                clearContext?.markAsCleared('matchGamePG'); // 기회 소모 없었으면 클리어
            }
        }
    }, [state.difficulty, state.hasLostChanceInRun, previousDifficulty, starContext, clearContext]);

    useEffect(() => {
        const loadData = async () => {
            try {
                await gameAudioManager.loadSoundsAsync();
                const savedData = await AsyncStorage.getItem(STORAGE_KEY);
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    dispatch({ type: 'LOAD_DATA_SUCCESS', payload: { ...parsedData } });
                } else {
                    dispatch({ type: 'LOAD_DATA_FAILURE' });
                }
            } catch (e) {
                console.error("데이터 로딩 실패", e);
                dispatch({ type: 'LOAD_DATA_FAILURE' });
            }
        };
        loadData();
    }, []);

    /**
     * 🐾 화면을 떠나면 동물 12개를 **반납한다.**
     * 남겨두면 앱을 끌 때까지 AudioTrack 12칸을 붙잡아, 아무 소리도 내지 않으면서
     * 피아노·기타 예산을 그만큼 깎는다(안드로이드는 앱당 약 40개 제한).
     * 재진입 시 다시 만드는 것은 `startGame` 첫 줄이 맡는다.
     * 경위: `doc/audio-무음-원인과-방향.md`
     */
    useStopAudioOnBlur(() => {
        gameAudioManager.unloadAll();
    });

    // RESULTS 상태가 되면 전송
    useEffect(() => {
        if (state.status === 'RESULTS') {
            const endTime = Date.now();
            const durationSeconds = state.gameStartTime ? (endTime - state.gameStartTime) / 1000 : 0;

            const medicalDataPayload = {
                difficulty: state.playedDifficulty, // 💡 실제 플레이했던 난이도
                score: state.score,
                roundResult: state.roundResult,
                userStats: state.userStats,         // 전체 누적 통계
                wrong_selections: state.roundWrongAttempts, // 이번 판 구체적 오답
                error_count: state.roundWrongAttempts.length,
                completion_time_seconds: parseFloat(durationSeconds.toFixed(2)) // 소수점 2자리
            };

            console.log("🚀 [의료 데이터 전송] matchGamePG:", medicalDataPayload);
            syncData('matchGamePG', medicalDataPayload);
        }
    }, [state.status, syncData]);

    useEffect(() => {
        if (state.status !== 'LOADING') {
            const dataToSave = {
                difficulty: state.difficulty,
                policy: state.policy,
                userStats: state.userStats,
            };
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
        }
    }, [state.difficulty, state.policy, state.userStats]);

    const startGame = useCallback(async (mode: GameMode, isNewRun: boolean = false) => {
        // 떠났다 돌아온 뒤라면 여기서 다시 만든다 (이미 있으면 즉시 돌아온다)
        await gameAudioManager.loadSoundsAsync();

        let quizSounds: { name: string; file: any }[] = [];
        const soundCount = Math.min(2 + state.difficulty, SOUNDS_CONFIG.length);
        let useStandardMode = mode === 'STANDARD';

        if (mode === 'WEAKNESS') {
            const accuracies = Object.entries(state.userStats)
                .map(([name, { correct, total }]) => ({ name, acc: total < 3 ? 1 : correct / total }))
                .sort((a, b) => a.acc - b.acc);
            
            const weakSoundsSet = new Set(accuracies.slice(0, soundCount).map(s => s.name));
            
            if (weakSoundsSet.size >= 2) {
                quizSounds = SOUNDS_CONFIG.filter(s => weakSoundsSet.has(s.name));
            } else {
                useStandardMode = true;
            }
        }

        // ✅ 소리 재생 전: "LISTENING" 상태로 전환
        dispatch({ type: 'SET_STATUS', payload: 'LISTENING' });
        
        if (useStandardMode) {
            const shuffled = [...SOUNDS_CONFIG].sort(() => 0.5 - Math.random());
            quizSounds = shuffled.slice(0, soundCount);
        }

        // --- 디버그 로그: 제거 시 아래 블록 전체 삭제 후, 맨 아래 주석 처리된 원본 for 루프 주석 해제 ---
        const playOrder = quizSounds.map((s) => s.name);
        console.log('[matchGamePG] 이번 라운드 재생 순서 (정답 후보):', playOrder.join(' → '));

        for (let i = 0; i < quizSounds.length; i++) {
            const sound = quizSounds[i];
            console.log(`[matchGamePG] 재생 ${i + 1}/${quizSounds.length}: "${sound.name}"`);
            await gameAudioManager.playSound(sound.name);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        // --- /디버그 ---

        // [원본] 로그 없이 재생 (위 디버그 블록 삭제 후 이 주석만 해제)
        // for (const sound of quizSounds) {
        //     await gameAudioManager.playSound(sound.name);
        //     await new Promise(resolve => setTimeout(resolve, 800));
        // }

        dispatch({ type: 'START_GAME', payload: { mode, correctNames: new Set(quizSounds.map(s => s.name)), isNewRun } });
    }, [state.difficulty, state.userStats]);

    const handleSelectAnswer = useCallback((selectedName: string) => {
        if (state.status !== 'PLAYING') return;
        const isCorrect = state.correctSoundNames.has(selectedName);
        dispatch({ type: 'SELECT_ANSWER', payload: { selectedName, isCorrect } });
    }, [state.status, state.correctSoundNames]);

    const navigate = (status: GameStatus) => dispatch({ type: 'SET_STATUS', payload: status });

    return { state, startGame, handleSelectAnswer, navigate };
};

// ===================================================================================
// 📁 src/screens/ (UI 화면 컴포넌트들)
// ===================================================================================
const HomeScreen = memo(({ onStartGame, onShowStats }: { onStartGame: (mode: GameMode, isNewRun: boolean) => void, onShowStats: () => void }) => (
    <View style={styles.centered}>
        <Text style={styles.mainTitle}>🎯 청능 훈련 (PG)</Text>
        <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onStartGame('STANDARD', true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="표준 모드 시작"
        >
            <Text style={styles.primaryButtonText}>🎮 표준 모드</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => onStartGame('WEAKNESS', true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="약점 훈련 모드 시작"
        >
            <Text style={styles.secondaryButtonText}>🔥 약점 훈련 모드</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={styles.statsButton}
            onPress={onShowStats}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="내 통계 보기"
        >
            <Text style={styles.statsButtonText} numberOfLines={1}>📊 내 통계 보기</Text>
        </TouchableOpacity>
    </View>
));

const GameScreen = memo(({ state, onSelect }: { state: GameState, onSelect: (name: string) => void }) => (
    <View style={styles.centered}>
        <Text style={styles.statusText}>난이도: {state.difficulty} | 남은 기회: {state.remainingChoices} | 점수: {state.score}</Text>
        <Text style={styles.statusText}>들었던 소리를 모두 선택하세요</Text>
        <View style={styles.gameBoard}>
            {SOUNDS_CONFIG.map(({ name }) => {
                const status = state.userSelections[name];
                return (
                    <TouchableOpacity
                        key={name}
                        style={[
                            styles.gameButton,
                            status === 'correct' && styles.correctButton,
                            status === 'incorrect' && styles.incorrectButton,
                            !!status && styles.disabledButton,
                        ]}
                        onPress={() => onSelect(name)}
                        disabled={!!status}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        // 정답·오답이 색으로만 구분돼 토크백에는 안 읽힌다 — 라벨이 결과를 말한다
                        accessibilityLabel={status ? `${name}, ${status === 'correct' ? '정답' : '오답'}` : name}
                        accessibilityState={{ disabled: !!status, selected: status === 'correct' }}
                    >
                        <Text style={[
                            styles.gameButtonText,
                            !!status && styles.disabledButtonText
                        ]}>
                            {name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
));

const ResultsScreen = memo(({ state, onContinue, onGoHome }: { state: GameState, onContinue: (mode: GameMode, isNewRun: boolean) => void, onGoHome: () => void }) => (
    <View style={styles.centered}>
        <Text style={styles.mainTitle}>{state.roundResult === 'WIN' ? '🎉 라운드 성공! 🎉' : '😥 라운드 실패 😥'}</Text>
        <Text style={styles.resultText}>최종 점수: {state.score}</Text>
        {state.roundResult === 'LOSE' &&
            <Text style={styles.resultText}>남은 정답: {[...state.correctSoundNames].join(', ') || '없음'}</Text>
        }
        <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => onContinue(state.mode, false)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="계속하기"
        >
            <Text style={styles.primaryButtonText}>▶️ 계속하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={styles.statsBackButton}
            onPress={onGoHome}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="홈으로"
        >
            <Text style={styles.statsBackButtonText} numberOfLines={1}>🏠 홈으로</Text>
        </TouchableOpacity>
    </View>
));

const StatsScreen = memo(({ stats, onGoHome }: { stats: UserStats, onGoHome: () => void }) => {
    
    const sortedStats = Object.entries(stats)
        .sort(([,a],[,b])=>(a.total === 0 ? 1 : a.correct/a.total) - (b.total === 0 ? 1 : b.correct/b.total));
    
    // 전체 통계 계산
    const totalAttempts = sortedStats.reduce((sum, [, { total }]) => sum + total, 0);
    const totalCorrect = sortedStats.reduce((sum, [, { correct }]) => sum + correct, 0);
    const overallAccuracy = totalAttempts === 0 ? 0 : (totalCorrect / totalAttempts) * 100;

    // 등급 함수
    const getGrade = (correct: number, total: number) => {
        if (total === 0) return { emoji: '❓', label: '미도전', color: COLORS.gradeUntried };
        const acc = (correct / total) * 100;
        if (acc >= 90) return { emoji: '🔥', label: '완벽', color: COLORS.gradePerfect };
        if (acc >= 75) return { emoji: '⭐', label: '우수', color: COLORS.gradeExcellent };
        if (acc >= 50) return { emoji: '👍', label: '보통', color: COLORS.gradeNormal };
        return { emoji: '💪', label: '연습필요', color: COLORS.gradePractice };
    };

    return (
        <View style={styles.container}>
            <View style={styles.statsHeaderSection}>
                <Text style={styles.title}>📊 내 통계</Text>
                <View style={styles.overallStatsCard}>
                    <Text style={styles.overallStatsTitle}>전체 정확도</Text>
                    <Text style={styles.overallStatsValue}>
                        {totalAttempts === 0 ? 'N/A' : `${Math.round(overallAccuracy)}%`}
                    </Text>
                    <Text style={styles.overallStatsDetail}>
                        총 {totalAttempts}회 시도 · {totalCorrect}회 정답
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.statsContainer}>
                {sortedStats.map(([name, { correct, total }]) => {
                    const accuracy = total === 0 ? 'N/A' : `${Math.round((correct / total) * 100)}%`;
                    const grade = getGrade(correct, total);
                    return (
                        <View key={name} style={styles.statCard}>
                            <View style={styles.statCardHeader}>
                                <Text style={styles.statName}>{name}</Text>
                                <View style={styles.gradeContainer}>
                                    <Text style={styles.gradeEmoji}>{grade.emoji}</Text>
                                    <Text style={[styles.gradeLabel, { color: grade.color }]}>
                                        {grade.label}
                                    </Text>
                                </View>
                            </View>
                            
                            {total > 0 ? (
                                <>
                                    <View style={styles.progressBarContainer}>
                                        <View 
                                            style={[
                                                styles.progressBar, 
                                                { 
                                                    width: `${(correct / total) * 100}%`,
                                                    backgroundColor: grade.color 
                                                }
                                            ]} 
                                        />
                                    </View>
                                    <View style={styles.statDetails}>
                                        <Text style={styles.accuracyText}>
                                            {accuracy}
                                        </Text>
                                        <Text style={styles.attemptText}>
                                            {correct}/{total}회
                                        </Text>
                                    </View>
                                </>
                            ) : (
                                <Text style={styles.noDataText}>아직 시도하지 않았습니다</Text>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            <TouchableOpacity
                style={styles.statsBackButton}
                onPress={onGoHome}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="홈으로"
            >
                <Text style={styles.statsBackButtonText} numberOfLines={1}>🏠 홈으로</Text>
            </TouchableOpacity>
        </View>
    );
});

// ===================================================================================
// 📁 App.tsx
// ===================================================================================
export default function MatchGamePG() {
    const { state, startGame, handleSelectAnswer, navigate } = useAuditoryGame();

    const renderScreen = () => {
        switch (state.status) {
            case 'HOME': return <HomeScreen onStartGame={startGame} onShowStats={() => navigate('STATS')} />;
            case 'PLAYING': return <GameScreen state={state} onSelect={handleSelectAnswer} />;
            case 'RESULTS': return <ResultsScreen state={state} onContinue={startGame} onGoHome={() => navigate('HOME')} />;
            case 'STATS': return <StatsScreen stats={state.userStats} onGoHome={() => navigate('HOME')} />;
            case 'LISTENING':
                            return (
                                <View style={styles.loadingContainer}>
                                <WaveRipple
                                    size={LAYOUT.auditoryWaveAnimationSize}
                                    color="#79A1FF"
                                    style={styles.waveAnimation}
                                />
                                <Text style={styles.loadingText}>소리를 재생하고 있습니다...</Text>
                                </View>
                            );
            case 'LOADING': default: return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.activityIndicator} /></View>;
        }
    };

        return (
      <View style={styles.container}>
        {state.status !== 'LOADING' && state.status !== 'HOME' && (
          <MissionProgressIcon
            gameId="matchGamePG"
            title="PG 훈련 미션"
            missionText="난이도 3 도달하기"
            clearText="기회 소모 없이 난이도 3 도달"
            progressItems={[
              { label: '현재 난이도', value: state.difficulty },
              { label: '이번 런 기회 소모', value: state.hasLostChanceInRun ? '있음' : '없음' }
            ]}
          />
        )}
        {renderScreen()}
      </View>
    );
}

// ===================================================================================
// 📁 src/styles.ts
// ===================================================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.backgroundGray },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: LAYOUT.spacingMD },
    mainTitle: { fontSize: LAYOUT.sectionTitleFontSize, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: LAYOUT.spacingLG, textAlign: 'center' },
    title: { fontSize: LAYOUT.completionTextFontSize, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: LAYOUT.spacingLG, textAlign: 'center' },
    statusText: { fontSize: LAYOUT.hintTextFontSize, fontWeight: '500', color: COLORS.textMuted, marginBottom: LAYOUT.spacingMD, textAlign: 'center' },
    gameBoard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
    resultText: { fontSize: LAYOUT.completedTitleFontSize, marginVertical: LAYOUT.spacingXS, textAlign: 'center' },
    statsHeaderSection: {
        paddingHorizontal: LAYOUT.spacingMD,
        paddingTop: LAYOUT.spacingMD,
        paddingBottom: LAYOUT.spacingSM,
    },
    overallStatsCard: {
        backgroundColor: COLORS.background,
        borderRadius: LAYOUT.cardBorderRadius,
        padding: LAYOUT.spacingMD,
        marginTop: LAYOUT.spacingSM,
        elevation: 3,
        alignItems: 'center',
    },
    overallStatsTitle: {
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: COLORS.textSecondary,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsValue: {
        fontSize: LAYOUT.auditoryOverallStatsValueFontSize,
        fontWeight: 'bold',
        color: COLORS.blue,
        marginBottom: LAYOUT.spacingXS,
    },
    overallStatsDetail: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textLight,
    },
    statsContainer: { 
        paddingHorizontal: LAYOUT.spacingMD, 
        paddingTop: LAYOUT.spacingSM,
        paddingBottom: LAYOUT.spacingMD 
    },
    statCard: {
        backgroundColor: COLORS.background,
        borderRadius: LAYOUT.auditoryStatsCardBorderRadius,
        padding: LAYOUT.auditoryStatsCardPadding,
        marginBottom: LAYOUT.auditoryStatsCardMarginBottom,
        elevation: 2,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: LAYOUT.spacingSM,
    },
    statName: {
        fontSize: LAYOUT.completedTitleFontSize,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    gradeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: LAYOUT.spacingXS,
    },
    gradeEmoji: {
        fontSize: LAYOUT.completedTitleFontSize,
    },
    gradeLabel: {
        fontSize: LAYOUT.totalCountFontSize,
        fontWeight: '600',
    },
    progressBarContainer: {
        height: LAYOUT.auditoryProgressBarHeight,
        backgroundColor: COLORS.grayLight,
        borderRadius: LAYOUT.auditoryProgressBarBorderRadius,
        overflow: 'hidden',
        marginBottom: LAYOUT.spacingXS,
    },
    progressBar: {
        height: '100%',
        borderRadius: LAYOUT.auditoryProgressBarBorderRadius,
    },
    statDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    accuracyText: {
        fontSize: LAYOUT.smallButtonTextFontSize,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    attemptText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textSecondary,
    },
    noDataText: {
        fontSize: LAYOUT.totalCountFontSize,
        color: COLORS.textLight,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: LAYOUT.spacingXS,
    },
    primaryButton: {
        backgroundColor: COLORS.blue,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: LAYOUT.cardBorderRadius,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        elevation: 3,
    },
    primaryButtonText: {
        color: COLORS.white,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryButton: {
        backgroundColor: COLORS.orange,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: LAYOUT.cardBorderRadius,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        elevation: 3,
    },
    secondaryButtonText: {
        color: COLORS.white,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    statsButton: {
        backgroundColor: COLORS.successGreen,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: LAYOUT.cardBorderRadius,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryPrimaryButtonWidthPercent,
        elevation: 3,
    },
    statsButtonText: {
        color: COLORS.white,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: 'bold',
        textAlign: 'center',
        flexShrink: 0,
    },
    statsBackButton: {
        backgroundColor: COLORS.successGreen,
        paddingVertical: LAYOUT.completeButtonPaddingV,
        paddingHorizontal: LAYOUT.spacingLG,
        borderRadius: LAYOUT.cardBorderRadius,
        marginVertical: LAYOUT.spacingXS,
        width: LAYOUT.auditoryStatsBackButtonWidthPercent,
        alignSelf: 'center',
        elevation: 3,
    },
    statsBackButtonText: {
        color: COLORS.white,
        fontSize: LAYOUT.buttonTextFontSize,
        fontWeight: 'bold',
        textAlign: 'center',
        flexShrink: 0,
    },
    gameButton: {
        backgroundColor: COLORS.blueLight,
        paddingVertical: LAYOUT.spacingSM,
        paddingHorizontal: LAYOUT.spacingMD,
        borderRadius: LAYOUT.auditoryStatsCardBorderRadius,
        borderWidth: 2,
        borderColor: COLORS.blue,
        margin: LAYOUT.auditoryGameButtonMargin,
        minWidth: LAYOUT.auditoryGameButtonMinWidth,
    },
    correctButton: {
        backgroundColor: COLORS.successLight,
        borderColor: COLORS.success,
    },
    incorrectButton: {
        backgroundColor: COLORS.errorLight,
        borderColor: COLORS.error,
    },
    disabledButton: {
        backgroundColor: COLORS.backgroundGray,
        borderColor: COLORS.borderGray,
        opacity: 0.6,
    },
    gameButtonText: {
        color: COLORS.textPrimary,
        fontSize: LAYOUT.smallButtonTextFontSize,
        fontWeight: '600',
        textAlign: 'center',
    },
    disabledButtonText: {
        color: COLORS.textLight,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: LAYOUT.auditoryLoadingTextMarginTop,
        fontSize: LAYOUT.smallButtonTextFontSize,
        color: COLORS.textLoading,
        textAlign: 'center',
        fontWeight: '500',
    },
    waveAnimation: {
        width: LAYOUT.auditoryWaveAnimationSize,
        height: LAYOUT.auditoryWaveAnimationSize,
    },
});