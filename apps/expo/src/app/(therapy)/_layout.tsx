import { Stack } from "expo-router";

export default function TherapyLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Therapy",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="exercises"
        options={{
          title: "Exercises",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="exercise/[id]"
        options={{
          title: "Practice",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="progress"
        options={{
          title: "My Progress",
          headerShown: true,
        }}
      />
    </Stack>
  );
}
