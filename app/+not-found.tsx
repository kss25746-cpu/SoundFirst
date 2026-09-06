import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router"; // expo-router를 사용하고 계시므로 Link 사용

export default function NotFound() {
  return (
    <View style={styles.container}>
      {/* 1. 시각적 강조: 큰 제목 */}
      <Text style={styles.title}>길을 잃으셨나요?</Text>
      
      {/* 2. 상태 코드 */}
      <Text style={styles.errorCode}>404</Text> 
      
      {/* 3. 친절한 설명 */}
      <Text style={styles.description}>
        죄송합니다! 요청하신 페이지를 찾을 수 없습니다. 주소를 다시 확인해 주세요.
      </Text>

      {/* 4. 사용자 안내: 홈으로 돌아가기 버튼 (Expo Router의 Link 사용) */}
      <Link href="/" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>홈 화면으로 돌아가기</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center', // 가로 중앙 정렬
    justifyContent: 'center', // 세로 중앙 정렬
    padding: 20,
    backgroundColor: '#F5F5F5', // 배경색
  },
  errorCode: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FF4D4D', // 강조 색상
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF', // 버튼 색상
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});