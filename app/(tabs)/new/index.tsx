import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, Text, View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ClearContext } from '../../../context/ClearContext';
import { StarContext } from '../../../context/StarContext';
import { useRouter } from 'expo-router';

/** [DEV] 나중에 삭제: resetAll 관련 - 게임 저장 키들 */
const GAME_STORAGE_KEYS = [
    '@AuditoryTrainingAppPG:gameState',
    '@AuditoryTrainingApp:gameState',
];
const SUBTITLE_TEXT = '원하는 게임을 선택하여 청능 훈련을 시작하세요!';

// 게임 목록 직접 정의
const games = [
    { 
        id: 'matchGame', 
        name: '소리 맞추기', 
        desc: '들린 동물 소리를 골라보세요',
        route: '/new/(games)/matchGame',
        color: '#6FE0B0',
        emoji: '🐾'
    },
    { 
        id: 'orderGame', 
        name: '소리 순서', 
        desc: '들은 순서대로 배열하세요',
        route: '/new/(games)/orderGame',
        color: '#FFD54F',
        emoji: '🔀'
    },
    { 
        id: 'matchGameAI', 
        name: '강화학습', 
        desc: 'AI가 약점을 분석해 훈련해요',
        route: '/new/(games)/matchGameAI',
        color: '#FF7A8A',
        emoji: '🚀'
    },
    { 
        id: 'matchGamePG', 
        name: 'PG', 
        desc: '정책 기반 강화학습 모드',
        route: '/new/(games)/matchGamePG',
        color: '#A78BFA',
        emoji: '📊'
    },
] as const;

export default function App() {
    const insets = useSafeAreaInsets();
    const starContext = useContext(StarContext);
    const clearContext = useContext(ClearContext);
    const router = useRouter();
    const [isResetting, setIsResetting] = useState(false);
    const [displayedSubtitle, setDisplayedSubtitle] = useState('');
    const [isSubtitleDone, setIsSubtitleDone] = useState(false);

    useEffect(() => {
        let index = 0;
        let interval: ReturnType<typeof setInterval> | undefined;
        const timeout = setTimeout(() => {
            interval = setInterval(() => {
                index += 1;
                setDisplayedSubtitle(SUBTITLE_TEXT.slice(0, index));

                if (index >= SUBTITLE_TEXT.length) {
                    clearInterval(interval);
                    setIsSubtitleDone(true);
                }
            }, 60);
        }, 450);

        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, []);

    /** [DEV] 나중에 삭제: 전체 초기화 핸들러 */
    const handleResetAll = async () => {
        Alert.alert(
            '전체 초기화',
            '별, 완료, 게임 진행 데이터를 모두 초기화합니다. 계속할까요?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '초기화',
                    style: 'destructive',
                    onPress: async () => {
                        if (isResetting) return;
                        setIsResetting(true);
                        try {
                            await clearContext?.resetAll();
                            await starContext?.resetAll();
                            await AsyncStorage.multiRemove(GAME_STORAGE_KEYS);
                            Alert.alert('완료', '모든 데이터가 초기화되었습니다.');
                        } catch (e) {
                            console.error('Reset failed:', e);
                            Alert.alert('오류', '초기화에 실패했습니다.');
                        } finally {
                            setIsResetting(false);
                        }
                    },
                },
            ]
        );
    };

    if (!starContext || !clearContext) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <Text style={styles.loadingText}>로딩 중...</Text>
                </View>
            </GestureHandlerRootView>
        );
    }

    const { starData } = starContext;
    const { clearData } = clearContext;
    const totalStars = games.filter((game) => !!starData[game.id]).length;
    const totalClears = games.filter((game) => !!clearData[game.id]).length;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View
                style={[
                    styles.container,
                    { paddingTop: insets.top, paddingBottom: insets.bottom },
                ]}
            >
                <View style={styles.glowTop} />
                <View style={styles.glowLeft} />
                <View style={styles.glowBottom} />
                <ScrollView 
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 섹션: 게임 선택 */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.titleRow}>
                                <View style={styles.titleBlock}>
                                    <Text style={styles.kicker}>AUDITORY TRAINING</Text>
                                    <Text style={styles.sectionTitle}>🎯 청능 훈련 게임</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    {totalStars > 0 && (
                                        <View style={styles.starSummary}>
                                            <Ionicons name="star" size={14} color="#FFD54F" />
                                            <Text style={styles.starSummaryText}>{totalStars}</Text>
                                        </View>
                                    )}
                                    {totalClears > 0 && (
                                        <View style={styles.clearSummary}>
                                            <Ionicons name="checkmark" size={14} color="#5EE7A8" />
                                            <Text style={styles.clearSummaryText}>{totalClears}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={styles.subtitleBox}>
                                <Text style={styles.sectionSubtitle}>
                                    {displayedSubtitle}
                                    {!isSubtitleDone && <Text style={styles.cursorText}>|</Text>}
                                </Text>
                            </View>
                        </View>

                        {/* 게임 그리드 */}
                        <View style={styles.gameGrid}>
                            {games.map((game) => {
                                const hasStar = !!starData[game.id];
                                const isCleared = !!clearData[game.id];

                                return (
                                    <TouchableOpacity 
                                        key={game.id} 
                                        style={styles.gameCard} 
                                        onPress={() => router.push(game.route as any)}
                                        activeOpacity={0.82}
                                        accessibilityRole="button"
                                        // 별·클리어는 배지 아이콘에만 있어 토크백이 못 읽는다. 라벨이 대신 읽는다
                                        accessibilityLabel={
                                            `${game.name}, ${game.desc}` +
                                            (hasStar ? ', 별 획득' : '') +
                                            (isCleared ? ', 클리어 완료' : '')
                                        }
                                    >
                                        {/* 별 배지 */}
                                        {hasStar && (
                                            <View style={styles.starBadge}>
                                                <Ionicons name="star" size={16} color="#FFD54F" />
                                            </View>
                                        )}
                                        
                                        {/* 클리어 배지 */}
                                        {isCleared && (
                                            <View style={styles.clearedBadge}>
                                                <Ionicons name="checkmark" size={12} color="#1A1420" />
                                            </View>
                                        )}

                                        {/* 아이콘 컨테이너 */}
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { borderColor: isCleared ? '#FFD54F' : `${game.color}66` },
                                            ]}
                                        >
                                            <View style={[styles.cardAccent, { backgroundColor: game.color }]} />
                                            <Text style={styles.gameEmoji}>{game.emoji}</Text>
                                        </View>
                                        
                                        {/* 게임 이름 */}
                                        <Text style={styles.gameName}>{game.name}</Text>
                                        <Text style={styles.gameDesc}>{game.desc}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* [DEV] 나중에 삭제: 초기화 버튼 */}
                        <TouchableOpacity
                            style={[styles.resetButton, isResetting && styles.resetButtonDisabled]}
                            onPress={handleResetAll}
                            disabled={isResetting}
                        >
                            <Ionicons name="refresh" size={14} color="#FFB4C8" />
                            <Text style={styles.resetButtonText}>
                                {isResetting ? '초기화 중...' : '전체 초기화'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#352B46',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 36,
    },
    loadingText: {
        fontSize: 16,
        color: '#FFF7E8',
        textAlign: 'center',
    },
    glowTop: {
        position: 'absolute',
        top: -80,
        right: -40,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255, 213, 79, 0.10)',
    },
    glowLeft: {
        position: 'absolute',
        top: 260,
        left: -110,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(255, 79, 138, 0.10)',
    },
    glowBottom: {
        position: 'absolute',
        right: -70,
        bottom: 40,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(167, 139, 250, 0.10)',
    },

    // 섹션 스타일
    section: {
        flex: 1,
        marginHorizontal: 18,
        paddingTop: 18,
    },
    sectionHeader: {
        marginBottom: 72,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    titleBlock: {
        flex: 1,
    },
    kicker: {
        color: 'rgba(255, 247, 232, 0.68)',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 3,
        marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 25,
        fontWeight: '900',
        color: '#FFF7E8',
        letterSpacing: -0.5,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
    },
    starSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 213, 79, 0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255, 213, 79, 0.35)',
    },
    starSummaryText: {
        color: '#FFD54F',
        fontSize: 13,
        fontWeight: '900',
    },
    clearSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(94, 231, 168, 0.13)',
        borderWidth: 1,
        borderColor: 'rgba(94, 231, 168, 0.35)',
    },
    clearSummaryText: {
        color: '#5EE7A8',
        fontSize: 13,
        fontWeight: '900',
    },
    subtitleBox: {
        minHeight: 58,
        justifyContent: 'center',
        paddingHorizontal: 18,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 247, 232, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.07)',
        elevation: 1,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 247, 232, 0.72)',
        lineHeight: 21,
    },
    cursorText: {
        color: '#FFD54F',
        fontWeight: '900',
    },
    resetButton: {
        alignSelf: 'center',
        marginTop: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 18,
        backgroundColor: 'rgba(255, 79, 138, 0.12)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 79, 138, 0.30)',
    },
    resetButtonDisabled: {
        opacity: 0.55,
    },
    resetButtonText: {
        fontSize: 13,
        color: '#FFB4C8',
        fontWeight: '800',
    },

    // 게임 그리드
    gameGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 38,
        rowGap: 34,
    },

    // 게임 카드
    gameCard: {
        width: 128,
        alignItems: 'center',
        position: 'relative',
    },
    cardAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        zIndex: 2,
    },
    // 아이콘 컨테이너
    iconContainer: {
        width: 104,
        height: 104,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
        backgroundColor: '#1F1A32',
        borderWidth: 1.5,
        overflow: 'hidden',
        elevation: 4,
    },
    gameEmoji: {
        fontSize: 38,
    },

    // 게임 이름
    gameName: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFF7E8',
        textAlign: 'center',
        marginBottom: 8,
    },
    gameDesc: {
        fontSize: 12,
        color: 'rgba(255, 247, 232, 0.68)',
        textAlign: 'center',
        lineHeight: 17,
    },

    // 별 배지
    starBadge: {
        position: 'absolute',
        top: 10,
        right: 18,
        zIndex: 3,
    },

    // 클리어 배지
    clearedBadge: {
        position: 'absolute',
        top: 84,
        right: 17,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFD54F',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
});