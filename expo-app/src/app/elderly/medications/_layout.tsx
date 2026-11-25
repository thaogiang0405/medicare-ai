import { Stack } from 'expo-router';

/** Screen stack for Medication Management within the elderly-protected route. */
export default function MedicationLayout() {
  return <Stack screenOptions={{ animation: 'slide_from_right', headerShown: false }} />;
}
