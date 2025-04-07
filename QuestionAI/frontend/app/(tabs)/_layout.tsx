import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { ColorSchemeName } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground.ios';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type TabBarIconProps = {
  color: string;
  focused: boolean;
  size: number;
};

type TabBarButtonProps = {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityState: { selected: boolean };
};

type TabBarBackgroundProps = {
  colorScheme: ColorSchemeName;
};

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerShown: false,
        tabBarButton: (props: TabBarButtonProps) => <HapticTab {...props} />,
        tabBarBackground: () => <TabBarBackground colorScheme={colorScheme} />,
        tabBarStyle: {
          height: Platform.select({ ios: 80, android: 60 }),
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: Colors[colorScheme ?? 'light'].background,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }: TabBarIconProps) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }: TabBarIconProps) => (
            <IconSymbol size={28} name="magnifyingglass" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }: TabBarIconProps) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
