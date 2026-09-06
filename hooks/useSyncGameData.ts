import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'; // [추가]

export const useSyncGameData = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const syncData = useCallback(async (gameId: string, data: Record<string, any>) => {

        return;
        
        setIsSyncing(true);
        setSyncError(null);

        try {
            const API_URL = 'http://192.168.0.54:1357/sync';
            
            // 👇 [추가] 로컬에서 방금 입력받았던 유저 이름 가져오기
            const username = await AsyncStorage.getItem('@username') || 'Unknown User';
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: username, // 👈 팝업에서 입력한 이름이 여기에 들어갑니다!
                    gameId: gameId,
                    gameData: data,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log(`✅ [${gameId}] 서버 동기화 성공! (유저: ${username})`);
            setIsSyncing(false);
            return true;

        } catch (error) {
            console.error(`❌ [${gameId}] 서버 동기화 실패:`, error);
            setSyncError(error instanceof Error ? error.message : 'Unknown error');
            setIsSyncing(false);
            return false;
        }
    }, []);

    return { syncData, isSyncing, syncError };
};