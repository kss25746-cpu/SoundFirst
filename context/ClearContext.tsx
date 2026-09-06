import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useEffect, useState, useMemo } from 'react';

const CLEAR_STORAGE_KEY = '@MiniGameApp:clearData';

interface ClearData {
    [gameId: string]: true;
}

interface ClearContextType {
    clearData: ClearData;
    markAsCleared: (gameId: string) => void;
    resetAll: () => Promise<void>;
}

export const ClearContext = createContext<ClearContextType | undefined>(undefined);

export const ClearProvider = ({ children }: { children: ReactNode }) => {
    const [clearData, setClearData] = useState<ClearData>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadClearData = async () => {
            try {
                const savedData = await AsyncStorage.getItem(CLEAR_STORAGE_KEY);
                if (savedData) {
                    setClearData(JSON.parse(savedData));
                }
            } catch (e) {
                console.error('Failed to load clear data.', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadClearData();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            AsyncStorage.setItem(CLEAR_STORAGE_KEY, JSON.stringify(clearData))
                .catch(e => console.error('Failed to save clear data.', e));
        }
    }, [clearData, isLoading]);

    const markAsCleared = (gameId: string) => {
        if (clearData[gameId]) {
            return;
        }
        console.log(`🎉 '${gameId}' 게임을 클리어했습니다! 🎉`);
        setClearData(prevData => ({
            ...prevData,
            [gameId]: true,
        }));
    };

    const resetAll = async () => {
        try {
            await AsyncStorage.removeItem(CLEAR_STORAGE_KEY);
            setClearData({});
            console.log('Clear 데이터 초기화 완료');
        } catch (e) {
            console.error('Failed to reset clear data.', e);
        }
    };

    const value = useMemo(() => ({ clearData, markAsCleared, resetAll }), [clearData, markAsCleared]);

    return (
        <ClearContext.Provider value={value}>
            {children}
        </ClearContext.Provider>
    );
};