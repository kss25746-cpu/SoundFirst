import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { FallingResult } from '../screens/musicTrainingHelpers';

interface FallingReplayPromptProps {
  result: FallingResult;
  onReplay: () => void;
  onShowResult: () => void;
  /** 안드로이드 뒤로가기. 없으면 이 창은 뒤로가기로 닫히지 않는다 */
  onDismiss: () => void;
}

/**
 * 조건부 `View`가 아니라 **`Modal`**이다.
 *
 * `zIndex`로 띄운 오버레이는 **안드로이드 뒤로가기를 받지 못한다.** 이 화면은
 * 가로모드라 탭바도 숨겨져 있어 시스템 뒤로가기가 유일한 나가기 경로일 때가 있다.
 * 냉장고 완료 화면(세션 47) · 익힘모달(세션 39)과 같은 갈래다.
 */
export function FallingReplayPrompt({
  result,
  onReplay,
  onShowResult,
  onDismiss,
}: FallingReplayPromptProps) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.replayOverlay}>
        <View style={styles.replayBox}>
          <Text style={styles.replayTitle}>{result.title}</Text>
          <Text style={styles.replaySubText}>한 번 더 연습할까요?</Text>
          <TouchableOpacity style={styles.replayIconButton} onPress={onReplay}>
            <Ionicons name="refresh-circle" size={64} color="#E6A800" />
            <Text style={styles.replayIconText}>리플레이</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resultCloseButton} onPress={onShowResult}>
            <Text style={styles.buttonText}>결과 보기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface FallingResultOverlayProps {
  result: FallingResult;
  accuracy: number;
  hits: number;
  misses: number;
  onClose: () => void;
}

/** 위 `FallingReplayPrompt`와 같은 이유로 `Modal`이다. 뒤로가기는 「확인」과 같은 길이다 */
export function FallingResultOverlay({
  result,
  accuracy,
  hits,
  misses,
  onClose,
}: FallingResultOverlayProps) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.resultOverlay}>
        <View style={styles.resultBox}>
          <Text
            style={[
              styles.resultTitle,
              result.cleared ? styles.resultTitleCleared : styles.resultTitleRetry,
            ]}
          >
            {result.cleared ? '클리어!' : '연습 필요'}
          </Text>
          <Text style={styles.resultLine}>
            정확도 {accuracy}% · {hits}/{result.totalNotes} 맞춤
          </Text>
          <View style={styles.resultStatRow}>
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatValue, styles.resultStatPerfect]}>{result.perfect}</Text>
              <Text style={styles.resultStatLabel}>완벽</Text>
            </View>
            <View style={styles.resultStatDivider} />
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatValue, styles.resultStatGreat]}>{result.great}</Text>
              <Text style={styles.resultStatLabel}>훌륭</Text>
            </View>
            <View style={styles.resultStatDivider} />
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatValue, styles.resultStatGood]}>{result.good}</Text>
              <Text style={styles.resultStatLabel}>양호</Text>
            </View>
            <View style={styles.resultStatDivider} />
            <View style={styles.resultStat}>
              <Text style={[styles.resultStatValue, styles.resultStatMiss]}>{misses}</Text>
              <Text style={styles.resultStatLabel}>놓침</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.resultCloseButton} onPress={onClose}>
            <Text style={styles.buttonText}>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  replayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  replayBox: {
    width: '86%',
    maxWidth: 440,
    backgroundColor: '#F4F7FB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E6A800',
    paddingVertical: 18,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  replayTitle: {
    color: '#334155',
    fontSize: 18,
    fontWeight: '900',
  },
  replaySubText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
  replayIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  replayIconText: {
    color: '#E6A800',
    fontSize: 14,
    fontWeight: '900',
    marginTop: -4,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 96,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resultBox: {
    width: '86%',
    maxWidth: 440,
    backgroundColor: '#F4F7FB',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E6A800',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
  },
  resultTitleCleared: {
    color: '#1A7A6D',
  },
  resultTitleRetry: {
    color: '#C45C2A',
  },
  resultLine: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '800',
  },
  resultStatRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  resultStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#D7E3F0',
  },
  resultStatValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  resultStatLabel: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  resultStatPerfect: {
    color: '#E6A800',
  },
  resultStatGreat: {
    color: '#0F8A9A',
  },
  resultStatGood: {
    color: '#2A9A7A',
  },
  resultStatMiss: {
    color: '#C63B3B',
  },
  resultCloseButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 14,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
