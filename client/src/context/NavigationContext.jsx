/**
 * client/src/context/NavigationContext.jsx
 * ==========================================
 * React Context provider and hook for VibeGrid global navigation
 */

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import navigationService from '../services/navigationService';

const NavigationContext = createContext(null);

export function NavigationProvider({ children, navigateToTab, currentTab, viewedUsername }) {
  const goBack = useCallback((fallback) => {
    navigationService.goBack(fallback);
  }, []);

  const registerBackInterceptor = useCallback((id, handler, priority = 10) => {
    return navigationService.registerBackInterceptor(id, handler, priority);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        goBack,
        navigateToTab,
        registerBackInterceptor,
        currentTab,
        viewedUsername,
        saveScroll: (k, y) => navigationService.saveScroll(k, y),
        getScroll: (k) => navigationService.getScroll(k)
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    // Return direct service methods as fallback if outside provider
    return {
      goBack: (fallback) => navigationService.goBack(fallback),
      registerBackInterceptor: (id, handler, priority) => navigationService.registerBackInterceptor(id, handler, priority),
      saveScroll: (k, y) => navigationService.saveScroll(k, y),
      getScroll: (k) => navigationService.getScroll(k)
    };
  }
  return ctx;
}

export default NavigationContext;
