import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Sites from './components/Sites';
import { DemoContainer } from './components/demo/DemoContainer';

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Simple routing logic
  if (path === '/sites') {
    return <Sites />;
  }

  if (path === '/demo') {
    return <DemoContainer />;
  }

  // Default to LandingPage for "/" and any other unknown routes
  return <LandingPage />;
}

export default App;