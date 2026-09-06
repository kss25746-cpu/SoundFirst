import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



export default function Layout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* index 화면 */}
        <Stack.Screen
          name="index"
          options={{
            headerShown: true,
            header: () => (
              <View style={{ paddingTop: insets.top, backgroundColor: 'transparent' }}>
           
              </View>
            ),
            title: '',
          }}
        />
      </Stack>

    
    </>
  );
}
