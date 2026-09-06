import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import * as ScreenOrientation from 'expo-screen-orientation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Animated,
  Pressable,
  StyleSheet,
} from "react-native";
import { COLORS } from "../../constants/colors";

// 탭 버튼 애니메이션 컴포넌트
const AnimatedTabBarButton = ({
  children,
  onPress,
  style,
  ...restProps
}: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  // 언마운트 뒤에 튐이 남지 않게 끊는다.
  useEffect(() => () => scaleValue.stopAnimation(), [scaleValue]);

  /**
   * 탭이 **실제로 눌렸을 때**만 튄다.
   *
   * 예전에는 `onPressOut`에 걸려 있었다. `onPressOut`은 눌렀다가 버튼 밖으로 끌어
   * **취소한 누름**에도 불리므로, 탭이 바뀌지 않는데 아이콘만 튀었다.
   *
   * 그리고 이전 시퀀스를 끊지 않아 연타하면 배율이 겹쳤다. 끊고 1로 되돌린 뒤 다시 튄다.
   */
  const handlePress = (event: any) => {
    scaleValue.stopAnimation();
    scaleValue.setValue(1);

    Animated.sequence([
      Animated.spring(scaleValue, {
        toValue: 1.2,
        useNativeDriver: true,
        speed: 200,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        speed: 200,
      }),
    ]).start();

    onPress?.(event);
  };

  const { ref, pressColor, pressOpacity, hoverEffect, href, ...filteredRestProps } = restProps as any;

  return (
    <Pressable
      {...filteredRestProps}
      onPress={handlePress}
      style={[
        { flex: 1, justifyContent: "center", alignItems: "center" },
        style,
      ]}
      android_ripple={{ borderless: false, radius: 0 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/** 가로로 보여줄 탭. 나머지는 전부 세로다. */
const LANDSCAPE_ROUTES = ['/activity', '/guitar'];

/**
 * 화면 방향의 **유일한 소유자.**
 *
 * 예전에는 피아노(`screens/MusicTrainingScreen.tsx`)와 기타(`app/(tabs)/guitar/_layout.tsx`)가
 * 각자 "포커스 O → 가로 / 포커스 X → 세로"를 걸었다. 탭은 언마운트되지 않아 둘 다 살아 있으므로
 * 탭을 바꾸면 두 effect가 **같이** 실행됐고, 방향은 전역 설정이라 나중에 실행된 쪽이 이겼다.
 *
 * effect는 트리 순서(`activity` → `guitar`)로 돌기 때문에 **기타 → 피아노** 이동에서
 * 피아노가 건 가로를 기타의 "나가니까 세로" 가 덮어썼다. 반대 방향은 우연히 멀쩡했다.
 *
 * 나가는 화면은 다음 화면이 무엇인지 모른다. 그래서 **떠나는 쪽이 방향을 되돌리면 안 된다.**
 * 지금 어느 탭에 있는지 아는 여기서만 건다.
 */
function useOrientationForRoute() {
  const pathname = usePathname();

  /**
   * 몇 번째 잠금인지 세는 표.
   *
   * `lockAsync`는 **취소되지 않는다.** 탭을 빠르게 옮기면 지난 경로의 프라미스가
   * 나중에 끝나서, 지금 화면과 상관없는 실패를 지금 것처럼 다룰 수 있다.
   * 끝날 때마다 이 표와 대조해 **마지막 잠금이 아니면 아무것도 하지 않는다.**
   */
  const lockRunIdRef = useRef(0);

  useEffect(() => {
    const runId = ++lockRunIdRef.current;

    const wantsLandscape = LANDSCAPE_ROUTES.some(
      route => pathname === route || pathname.startsWith(route + '/')
    );

    ScreenOrientation.lockAsync(
      wantsLandscape
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch(error => {
      // 지난 경로의 잠금이 늦게 실패한 것이면 지금 화면과 무관하다.
      if (runId !== lockRunIdRef.current) return;

      // 삼키면 가로 화면이 세로로 남아도 아무 데도 안 남는다.
      console.warn(
        `[화면 방향] ${wantsLandscape ? '가로' : '세로'} 잠금 실패 (${pathname})`,
        error
      );
    });
  }, [pathname]);
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  useOrientationForRoute();

  return (

    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { paddingBottom: 4 + insets.bottom, height: 64 + insets.bottom }],
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
      }}
    >
      {/*
        탭 라벨은 일곱 다 `() => null`이라 화면에 글자가 없고, 아이콘은 글리프 `<Text>`뿐이다.
        `bottom-tabs`가 라벨로 접근성 이름을 만드는 길은 `Platform.OS === 'ios'` 조건이라
        (`BottomTabBar.js:292`) 안드로이드에서는 **읽을 것이 하나도 없다.**
        그래서 `tabBarAccessibilityLabel`을 탭마다 직접 준다.
      */}
      <Tabs.Screen
        name="drum"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "드럼",
          tabBarIcon: ({ color }) => (
            <Ionicons name="musical-notes" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="learn"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "소리 구별 퀴즈",
          tabBarIcon: ({ color }) => (
            <Ionicons name="headset" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="flashcards"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "단어 카드",
          tabBarIcon: ({ color }) => (
            <Ionicons name="book" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "피아노",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="piano" size={24} color={color} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="guitar"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "기타",
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="guitar-acoustic" size={24} color={color} />
          ),
          tabBarStyle: { display: 'none' },
        }}
      />


      <Tabs.Screen
        name="new"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "청능 훈련 게임",
          tabBarIcon: ({ color }) => (
            <Ionicons name="paw" size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="refri-test"
        options={{
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: "냉장고",
          tabBarIcon: ({ color }) => (
            <Ionicons name="snow-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>

  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,

    elevation: 8,

  },
});
