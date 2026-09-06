import { Ionicons } from '@expo/vector-icons';
import React, { useContext, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView, Pressable, Alert, StyleProp, ViewStyle } from 'react-native';
import { ClearContext } from '../context/ClearContext';
import { StarContext } from '../context/StarContext';

/**
 * 아이콘 색 — **밝기가 아니라 색상으로** 세 단계를 가른다.
 *
 * 이 컴포넌트는 검은 배경(피아노 `#000` · 기타 `#1a120b`)과 흰 배경(게임 4화면
 * `#ffffff`~`#f0f0f0`) **양쪽에** 올라간다. 밝기로만 구분하면 밝은 쪽이 흰 배경에서
 * 사라진다 — 예전 은색 `#c0c0c0`이 회색 `#a0a0a0`과 구분되지 않던 이유다.
 */
const ICON_COLOR = {
  /** 아무것도 못 얻음 */
  none: '#a0a0a0',
  /** 하나라도 별을 얻음. 동메달 → 금메달 순서라 뜻도 읽힌다 */
  partial: '#CD7F32',
  /** 전부 클리어 */
  cleared: '#FFD700',
} as const;

// 컴포넌트가 받을 props의 타입을 정의합니다.
interface MissionProgressIconProps {
  gameId: string;
  title: string;
  missionText: string;
  clearText: string;
  progressItems: { label: string; value: string | number }[];
  /** 우상단 위치를 화면이 정한다. 악기 두 화면은 `useInstrumentMetrics().missionIconStyle`을 넘긴다 */
  style?: StyleProp<ViewStyle>;
  onReset?: () => void;
  /**
   * 난이도별로 별·클리어가 갈리는 화면(피아노 5단계 · 기타 4단계)은 난이도 이름을 넘긴다.
   * 저장 키가 `${gameId}_${난이도}` 꼴이기 때문이다.
   *
   * 안 넘기면 `gameId` 하나로 판정한다 (게임 화면들이 그렇다).
   */
  levelNames?: string[];
}

export default function MissionProgressIcon({
  gameId,
  title,
  missionText,
  clearText,
  progressItems,
  style,
  onReset,
  levelNames,
}: MissionProgressIconProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const starContext = useContext(StarContext);
  const clearContext = useContext(ClearContext);

  // 컨텍스트 데이터가 없으면 아무것도 렌더링하지 않습니다.
  if (!starContext || !clearContext) {
    return null;
  }

  // 임시 디버그용 별 및 클리어 초기화 핸들러
  const handleReset = () => {
    Alert.alert(
      '데이터 초기화',
      '별 획득 및 클리어 기록을 초기화하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '초기화', 
          style: 'destructive',
          onPress: async () => {
            try {
              await starContext.resetAll();
              await clearContext.resetAll();
              if (onReset) {
                onReset();
              }
              Alert.alert('초기화 완료', '기록이 성공적으로 초기화되었습니다.');
            } catch (e) {
              console.error('Reset failed', e);
            }
          }
        }
      ]
    );
  };

  // 난이도가 여럿인 화면은 난이도별 키를, 아니면 gameId 하나를 본다
  const keys = levelNames?.length
    ? levelNames.map(level => `${gameId}_${level}`)
    : [gameId];
  const starCount = keys.filter(key => starContext.starData[key]).length;
  const clearCount = keys.filter(key => clearContext.clearData[key]).length;

  // 모달의 별·체크 표시는 예전대로 **전부 달성**이 기준이다
  const hasStar = starCount === keys.length;
  const isCleared = clearCount === keys.length;

  /**
   * 아이콘 색은 **하나만 얻어도 바뀐다.**
   * 전부 달성해야 바뀌면 피아노는 다섯 단계를 채우는 동안 아무 변화가 없어,
   * 별을 얻었는지 모달을 열어야만 알 수 있었다.
   */
  const iconColor = isCleared
    ? ICON_COLOR.cleared
    : starCount > 0
      ? ICON_COLOR.partial
      : ICON_COLOR.none;

  return (
    <>
      {/* 화면 우상단에 위치할 아이콘 버튼 */}
      <TouchableOpacity
        style={[styles.iconContainer, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`${title} 안내 열기`}
      >
        <Ionicons name="help-circle-outline" size={32} color={iconColor} importantForAccessibility="no" />
      </TouchableOpacity>

      {/* 아이콘 클릭 시 나타날 모달 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          {/* Sibling Pressable Backdrop to capture background taps without blocking child gestures */}
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="미션 안내 닫기"
          />
          
          <View style={[styles.modalContent, { overflow: 'hidden' }]}>
            {/* Top Accent Bar */}
            <View style={styles.topAccentBar} />
            
            <ScrollView showsVerticalScrollIndicator={true} style={{ maxHeight: 220, paddingTop: 10 }}>
              {/* 타이틀 및 초기화 버튼 영역 (임시 디버그용) */}
              <View style={styles.titleContainer}>
                <Text style={styles.modalTitle}>{title}</Text>
                <TouchableOpacity
                  onPress={handleReset}
                  style={styles.resetButton}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel="별·클리어 기록 초기화"
                >
                  <Ionicons name="refresh-circle-outline" size={24} color="#E53E3E" importantForAccessibility="no" />
                </TouchableOpacity>
              </View>
              
              {/* 미션 조건 (별 카드) */}
              <View style={[styles.conditionCard, styles.starCard]}>
                {/* 달성 여부는 이 아이콘의 모양·색에만 있었다. 아이콘은 장식으로 내리고
                    글자 쪽 라벨이 「획득/미획득」을 대신 읽는다 — 보이는 글자는 그대로다 */}
                <Ionicons name={hasStar ? "star" : "star-outline"} size={22} color={hasStar ? '#FFD700' : '#8E8E93'} importantForAccessibility="no" />
                <Text
                  style={styles.conditionText}
                  accessibilityLabel={`별 ${hasStar ? '획득' : '미획득'}. 조건 ${missionText}`}
                >
                  별 획득: {missionText}
                </Text>
              </View>
              
              {/* 클리어 조건 (클리어 카드) */}
              <View style={[styles.conditionCard, styles.clearCard]}>
                <Ionicons name={isCleared ? "checkmark-circle" : "ellipse-outline"} size={22} color={isCleared ? '#34C759' : '#8E8E93'} importantForAccessibility="no" />
                <Text
                  style={styles.conditionText}
                  accessibilityLabel={`${isCleared ? '클리어함' : '클리어 못 함'}. 조건 ${clearText}`}
                >
                  클리어: {clearText}
                </Text>
              </View>

              <View style={styles.divider} />
              
              {/* 현재 진행 상황 */}
              <View style={styles.progressCard}>
                <Text style={styles.progressTitle}>현재 진행 상황</Text>
                {progressItems.map((item, index) => (
                  <View key={index} style={styles.progressRow}>
                    <Text style={styles.progressBullet}>•</Text>
                    <Text style={styles.progressText}>
                      {item.label}: {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={styles.closeButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
    elevation: 100,
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    width: '75%',
    maxWidth: 500,
    elevation: 8,
    zIndex: 1,
  },
  topAccentBar: {
    height: 4,
    backgroundColor: '#4F46E5',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  resetButton: {
    marginLeft: 8,
    padding: 2,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  conditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  starCard: {
    backgroundColor: '#FFFDF0',
    borderColor: '#FEF08A',
  },
  clearCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  conditionText: {
    fontSize: 18,
    color: '#34495E',
    marginLeft: 10,
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  progressCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  progressBullet: {
    fontSize: 17,
    color: '#4F46E5',
    marginRight: 6,
    lineHeight: 22,
  },
  progressText: {
    fontSize: 17,
    color: '#4A5568',
    flexShrink: 1,
    lineHeight: 22,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: '#4A5568',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});