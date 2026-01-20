import { IconSymbol } from '@/components/ui/icon-symbol';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="meds"
        options={{
          title: 'Medications',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="pill" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
