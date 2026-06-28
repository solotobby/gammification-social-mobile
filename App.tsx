import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Root() {
  const { isDark } = useTheme();
  const [onboarded, setOnboarded] = useState(false);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {onboarded ? (
        <HomeScreen onReplay={() => setOnboarded(false)} />
      ) : (
        <WelcomeScreen onDone={() => setOnboarded(true)} />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
