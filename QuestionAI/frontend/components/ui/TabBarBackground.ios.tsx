import React from 'react';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorSchemeName } from 'react-native';

function useBottomTabBarHeight(): number {
  const contextValue = React.useContext(BottomTabBarHeightCallbackContext);
  if (typeof contextValue === 'function') {
    return 0;
  }
  return contextValue ?? 0;
}

interface TabBarBackgroundProps {
  colorScheme?: ColorSchemeName;
}

export default function TabBarBackground({ colorScheme = 'light' }: TabBarBackgroundProps) {
  return (
    <BlurView
      tint={colorScheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemChromeMaterial'}
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}
