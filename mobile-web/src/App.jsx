import React, { useState, useEffect } from 'react';
import { MobileProvider } from './context/MobileContext';
import WorkScreen from './pages/WorkScreen';
import LoginScreen from './pages/LoginScreen';
import SetupScreen from './pages/SetupScreen';
import AppShell from './components/AppShell';
import { useMobile } from './context/MobileContext';

function AppContent() {
  const { isLoggedIn, scannerId } = useMobile();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Small delay for app initialization
    const timer = setTimeout(() => setIsInitialized(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log('🔄 AppContent re-rendering - scannerId:', scannerId, 'isLoggedIn:', isLoggedIn);
  }, [scannerId, isLoggedIn]);

  // If no scanner ID, show setup screen
  if (!scannerId) {
    console.log('📱 Showing SetupScreen - scannerId is null/empty');
    return (
      <div className="transition-opacity duration-300 opacity-100">
        <SetupScreen />
      </div>
    );
  }

  // Go directly to work screen after pairing
  console.log('✅ Showing WorkScreen - device paired');
  return (
    <div className="transition-opacity duration-300 opacity-100">
      <WorkScreen />
    </div>
  );
}

function App() {
  return (
    <MobileProvider>
      <AppShell>
        <AppContent />
      </AppShell>
    </MobileProvider>
  );
}

export default App;
