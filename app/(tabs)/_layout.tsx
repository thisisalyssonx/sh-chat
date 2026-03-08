import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false, // Esconde o cabeçalho superior
        tabBarStyle: { 
          display: 'none'   // Esconde a barra preta inferior completamente
        } 
      }}
    >
      <Tabs.Screen name="index" />
    </Tabs>
  );
}