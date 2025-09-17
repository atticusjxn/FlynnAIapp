import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { JobsProvider } from './src/context/JobsContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { JobsScreen } from './src/screens/JobsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { ClientsScreen } from './src/screens/ClientsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingNavigator } from './src/screens/onboarding/OnboardingNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppInitLogger } from './src/utils/AppInitLogger';
import { useNavigationLogger } from './src/utils/NavigationLogger';
import { Ionicons } from '@expo/vector-icons';
import { UploadScreen } from './src/screens/upload/UploadScreen';
import { ProcessingScreen } from './src/screens/upload/ProcessingScreen';
import { ResultsScreen } from './src/screens/upload/ResultsScreen';
import { JobFormDemo } from './src/components/ui/JobFormDemo';
import { ShortcutSetupScreen } from './src/screens/shortcuts/ShortcutSetupScreen';
import shortcutHandler from './src/services/ShortcutHandler';
import SiriShortcutService from './src/services/SiriShortcutService';
import CallSetupScreen from './src/screens/calls/CallSetupScreen';
import CallHistoryScreen from './src/screens/calls/CallHistoryScreen';
import CallSettingsScreen from './src/screens/calls/CallSettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const UploadStack = createStackNavigator();

function UploadFlow() {
  return (
    <UploadStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
      }}
    >
      <UploadStack.Screen name="Upload" component={UploadScreen} />
      <UploadStack.Screen name="Processing" component={ProcessingScreen} />
      <UploadStack.Screen name="Results" component={ResultsScreen} />
    </UploadStack.Navigator>
  );
}

function MainTabs() {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Clients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          color: colors.textPrimary,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen 
        name="UploadFlow" 
        component={UploadFlow}
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="JobFormDemo" 
        component={JobFormDemo}
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="ShortcutSetup" 
        component={ShortcutSetupScreen}
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="CallSetup" 
        component={CallSetupScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Call Recording Setup',
        }}
      />
      <Stack.Screen 
        name="CallHistory" 
        component={CallHistoryScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CallSettings" 
        component={CallSettingsScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  const { isOnboardingComplete, loading: onboardingLoading } = useOnboarding();
  const { isDark, colors } = useTheme();
  const navigationLogger = useNavigationLogger();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Set up deep linking for iOS Shortcuts
  useEffect(() => {
    if (navigationRef.current) {
      shortcutHandler.setNavigationRef(navigationRef.current);
    }
    
    // Donate shortcuts to iOS on app launch for better Siri integration
    SiriShortcutService.donateShortcut();
  }, []);

  // Configure linking for deep linking
  const linking = {
    prefixes: ['flynn-ai://', 'com.flynnai.app://'],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Dashboard: 'dashboard',
            Jobs: 'jobs',
            Calendar: 'calendar',
            Clients: 'clients',
            Settings: 'settings',
          },
        },
        UploadFlow: {
          screens: {
            Upload: 'upload',
            Processing: 'processing',
            Results: 'results',
          },
        },
      },
    },
    async getInitialURL() {
      // Check if app was opened from a deep link
      const url = await Linking.getInitialURL();
      
      if (url && url.startsWith('flynn-ai://')) {
        console.log('[AppNavigator] Initial URL from shortcut:', url);
        // Handle shortcut URL
        setTimeout(() => shortcutHandler.handleShortcutURL(url), 1000);
      }
      
      return url;
    },
    subscribe(listener: (url: string) => void) {
      const onReceiveURL = ({ url }: { url: string }) => {
        console.log('[AppNavigator] Received URL:', url);
        
        if (url.startsWith('flynn-ai://')) {
          // Handle shortcut URL
          shortcutHandler.handleShortcutURL(url);
        } else {
          // Handle normal deep link
          listener(url);
        }
      };

      // Listen to incoming links from deep linking
      const eventListenerSubscription = Linking.addEventListener('url', onReceiveURL);

      return () => {
        eventListenerSubscription.remove();
      };
    },
  };

  console.log('[AppNavigator] Render - user:', !!user, 'loading:', loading, 'onboardingLoading:', onboardingLoading);

  if (loading || onboardingLoading) {
    console.log('[AppNavigator] Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={navigationLogger.onReady}
      onStateChange={navigationLogger.onStateChange}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      {user ? (
        isOnboardingComplete ? (
          <RootNavigator />
        ) : (
          <OnboardingNavigator />
        )
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  console.log('[App] Root component rendering - React 19 compatible');
  
  return (
    <ErrorBoundary>
      <AppInitLogger>
        <ThemeProvider>
          <AuthProvider>
            <OnboardingProvider>
              <JobsProvider>
                <AppNavigator />
              </JobsProvider>
            </OnboardingProvider>
          </AuthProvider>
        </ThemeProvider>
      </AppInitLogger>
    </ErrorBoundary>
  );
}
