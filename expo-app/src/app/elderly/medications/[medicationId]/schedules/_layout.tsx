import { Stack } from 'expo-router';

/** Nested schedule management stays inside the elderly-protected medication stack. */
export default function MedicationScheduleLayout() {
  return <Stack screenOptions={{ animation: 'slide_from_right', headerShown: false }} />;
}
