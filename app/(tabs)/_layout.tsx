import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
// import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
        headerShown: false,
        // Keep screens mounted to avoid flicker and expensive remounts
        lazy: false,
        unmountOnBlur: false,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            backgroundColor: isDark ? '#000' : '#FFF',
          },
          default: {
            backgroundColor: isDark ? '#000' : '#FFF',
            borderTopColor: isDark ? '#111' : '#E5E7EB',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={26} name="history" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="person" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          // Hide from the tab bar
          href: null,
        }}
      />
      {/* Hide nested offer stack from appearing as a tab item */}
      <Tabs.Screen
        name="offer"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
