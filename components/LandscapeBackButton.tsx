import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

type LandscapeBackButtonProps = {
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** 탭바가 숨겨진 가로 화면용 나가기. 시스템 뒤로가기와 같은 히스토리를 따른다. */
export function LandscapeBackButton({ color = '#fff', style }: LandscapeBackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/drum');
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="나가기"
      style={[styles.button, style]}
    >
      <Ionicons name="arrow-back" size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
  },
});
