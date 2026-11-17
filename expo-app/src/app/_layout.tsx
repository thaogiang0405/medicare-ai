import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * Migration 1 keeps navigation intentionally shallow. Routes are grouped by
 * feature in the filesystem, while the Stack keeps the first-use flow simple.
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FAFDFC' },
        }}
      />
    </>
  );
}
