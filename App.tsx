import 'react-native-url-polyfill/auto';
import React, { useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OnboardingProvider, useOnboarding } from './src/context/OnboardingContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { JobsProvider } from './src/context/JobsContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { JobsScreen } from './src/screens/JobsScreen';
import { ReceptionistScreen } from './src/screens/ReceptionistScreen';
import { ClientsScreen } from './src/screens/ClientsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingNavigator } from './src/screens/onboarding/OnboardingNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppInitLogger } from './src/utils/AppInitLogger';
import { useNavigationLogger } from './src/utils/NavigationLogger';
import { FlynnIcon, FlynnIconName } from './src/components/ui/FlynnIcon';
import { JobFormDemo } from './src/components/ui/JobFormDemo';
import CallSetupScreen from './src/screens/calls/CallSetupScreen';
import CallHistoryScreen from './src/screens/calls/CallHistoryScreen';
import CallSettingsScreen from './src/screens/calls/CallSettingsScreen';
import IntegrationsScreen from './src/screens/settings/IntegrationsScreen';
// import { useFonts } from 'expo-font';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: FlynnIconName = 'home';

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Receptionist') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Clients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <FlynnIcon name={iconName} size={size} color={color} />;
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
      <Tab.Screen name="Events" component={JobsScreen} />
      <Tab.Screen name="Receptionist" component={ReceptionistScreen} />
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
        name="JobFormDemo" 
        component={JobFormDemo}
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
      <Stack.Screen
        name="Integrations"
        component={IntegrationsScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Integrations',
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
