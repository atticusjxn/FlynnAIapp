import { useRef } from 'react';

export const useNavigationLogger = () => {
  const routeNameRef = useRef<string>();
  
  return {
    onReady: () => {
      console.log('[Navigation] Container ready');
    },
    onStateChange: (state: any) => {
      const currentRouteName = state?.routes?.[state.index]?.name;
      
      if (routeNameRef.current !== currentRouteName) {
        console.log(`[Navigation] Route changed: ${routeNameRef.current || 'initial'} → ${currentRouteName}`);
        routeNameRef.current = currentRouteName;
      }
    }
  };
};