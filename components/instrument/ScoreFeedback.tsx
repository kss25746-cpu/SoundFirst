import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SEMANTIC } from '../../constants/instrumentTheme';

type ScoreFeedbackProps = {
  /** `null`이면 점수 줄을 숨긴다 (피아노는 곡 연주 모드에서 점수를 안 쓴다) */
  score?: number | null;
  feedback?: string;
  /** 디버그용 정답 노출. 없으면 숨긴다 */
  hint?: string | null;
  scoreFontSize?: number;
  feedbackFontSize?: number;
  /**
   * 피드백을 몇 줄까지 보일지. 기본은 제한 없음.
   *
   * 제어반이 낮은 화면(기타)은 `1`을 넘겨 잘라야 한다. 반대로 피아노는 제한하면 안 된다 —
   * "난이도를 선택하고 [문제 재생]을 눌러 시작하세요!" 같은 안내가 잘려 뜻이 사라진다.
   */
  feedbackLines?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * 제어반 왼쪽의 점수 · 피드백 묶음. 피아노 `infoSection`이 원본이다.
 *
 * 피드백 색은 정답/오답을 가리지 않고 `SEMANTIC.feedback` 하나다 —
 * 오답일 때 빨강으로 바꾸면 아래 '훈련 종료'(빨강)와 뜻이 섞인다.
 */
export function ScoreFeedback({
  score = null,
  feedback,
  hint = null,
  scoreFontSize,
  feedbackFontSize,
  feedbackLines,
  style,
}: ScoreFeedbackProps) {
  return (
    <View style={[styles.section, style]}>
      {score !== null && (
        <Text style={[styles.score, scoreFontSize != null && { fontSize: scoreFontSize }]}>
          점수: {score}
        </Text>
      )}
      {!!feedback && (
        <Text
          style={[styles.feedback, feedbackFontSize != null && { fontSize: feedbackFontSize }]}
          numberOfLines={feedbackLines}
        >
          {feedback}
        </Text>
      )}
      {!!hint && <Text style={styles.hint}>★ 정답: {hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SEMANTIC.score,
    marginBottom: 4,
  },
  feedback: {
    fontSize: 15,
    color: SEMANTIC.feedback,
    fontWeight: 'bold',
    marginTop: 2,
  },
  hint: {
    color: SEMANTIC.hint,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
