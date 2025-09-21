import { useRef } from 'react';

export const useNavigationLogger = () => {
  const routeNameRef = useRef<string | null>(null);
  
  return {
    onReady: () => {
      console.log('[Navigation] Container ready');
    },
    onStateChange: (state: any) => {
      const currentRouteName: string | undefined = state?.routes?.[state.index]?.name;
      const previousRoute = routeNameRef.current ?? 'initial';
      const nextRoute = currentRouteName ?? 'unknown';

      if (previousRoute !== nextRoute) {
        console.log(`[Navigation] Route changed: ${previousRoute} → ${nextRoute}`);
        routeNameRef.current = currentRouteName ?? null;
      }
    }
  };
};
