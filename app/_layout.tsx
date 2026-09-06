import { Stack } from "expo-router";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, StyleSheet, Animated, Modal, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from '@react-native-async-storage/async-storage'; // [추가]
import { StarProvider } from "../context/StarContext";
import { ClearProvider } from "../context/ClearContext";
import { AudioManagerProvider } from "../context/AudioManager";

SplashScreen.preventAutoHideAsync().catch(() => {});

// --- (AnimatedSplashScreen 컴포넌트는 기존과 동일) ---
function AnimatedSplashScreen({ children, image }: { children: React.ReactNode; image: number }) {
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);
  const animation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAppReady) {
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(animation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        })
      ]).start(() => {
        setAnimationComplete(true);
      });
    }
  }, [isAppReady]);

  const onImageLoaded = async () => {
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      console.error(e);
    } finally {
      setAppReady(true);
    }
  };

  const animatedValues = useMemo(() => ({
    rotateValue: animation.interpolate({
      inputRange: [0, 1],
      outputRange: ["340deg", "-20deg"],
    }),
    scaleValue: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.5, 1.5],
    }),
  }), [animation]);

  return (
    <View style={styles.container}>
      {isAppReady && children}
      {!isSplashAnimationComplete && (
        <>
          <Animated.View style={[styles.background, { opacity: animation }]} />
          <View style={styles.imageContainer}>
            <Animated.Image
              source={image}
              style={[
                styles.image,
                {
                  opacity: animation,
                  transform: [
                    { scale: animatedValues.scaleValue },
                    { rotate: animatedValues.rotateValue },
                  ],
                },
              ]}
              onLoadEnd={onImageLoaded}
              fadeDuration={0}
            />
          </View>
        </>
      )}
    </View>
  );
}

// --- [수정된 RootLayout] ---
export default function RootLayout() {
  const [isNameModalVisible, setNameModalVisible] = useState(false);
  const [userName, setUserName] = useState("");

  // 앱 실행 시 이름 저장 여부 확인
  useEffect(() => {
    const checkUser = async () => {
      const storedName = await AsyncStorage.getItem('@username');
      if (!storedName) {
        // 이름이 없으면 팝업 노출 (스플래시 화면 뒤에서 미리 준비)
        setNameModalVisible(true);
      }
    };
    checkUser();
  }, []);

  const handleSaveName = async () => {
    if (userName.trim().length < 2) {
      Alert.alert("알림", "이름을 2자 이상 입력해주세요.");
      return;
    }
    await AsyncStorage.setItem('@username', userName.trim());
    setNameModalVisible(false);
  };

  return (
    <StarProvider>
      <ClearProvider>
        <AudioManagerProvider>
          <AnimatedSplashScreen image={require("../assets/images/splash.png")}>
            <StatusBar style="dark" animated hidden={false} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>

            {/* [추가] 사용자 이름 입력 팝업 */}
            <Modal
              visible={isNameModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={handleSaveName}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>환영합니다! 🎉</Text>
                  <Text style={styles.modalText}>
                    훈련 데이터를 관리하기 위해{"\n"}이름을 입력해주세요.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="이름을 입력하세요"
                    placeholderTextColor="#666"
                    value={userName}
                    onChangeText={setUserName}
                    maxLength={10}
                  />
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSaveName}
                    accessibilityRole="button"
                    accessibilityLabel="시작하기"
                    accessibilityHint="입력한 이름을 저장하고 앱을 시작합니다"
                  >
                    <Text style={styles.buttonText}>시작하기</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </AnimatedSplashScreen>
        </AudioManagerProvider>
      </ClearProvider>
    </StarProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  background: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff" },
  imageContainer: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: "100%", resizeMode: "contain" },
  
  // [추가] 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#000',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#8A8A8A',
  },
  button: {
    backgroundColor: '#0069D9',
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});