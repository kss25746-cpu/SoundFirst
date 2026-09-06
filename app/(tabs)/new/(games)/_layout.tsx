import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameExitButton } from '../../../../components/GameExitButton';

export default function GamesLayout() {
  const insets = useSafeAreaInsets();

  const GameHeader = () => (
    <View style={{ paddingTop: insets.top, backgroundColor: 'transparent' }}>

    </View>
  );

  return (
    /**
     * 「나가기」는 **여기 하나뿐이다.** 네 화면에 각각 넣으면 스타일·인셋·zIndex가 갈라진다.
     * `Stack` 뒤에 두어 화면 위에 뜨게 하고, 위치·배색은 `GameExitButton`이 갖는다.
     */
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: true,
          header: GameHeader,
        }}
      >
        <Stack.Screen
          name="matchGame"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="orderGame"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="matchGameAI"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="matchGamePG"
          options={{
            title: '',
          }}
        />

      </Stack>

      <GameExitButton />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
