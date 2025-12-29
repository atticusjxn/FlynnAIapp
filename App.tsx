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
import { CallsScreen } from './src/screens/CallsScreen';
import { ClientsScreen } from './src/screens/ClientsScreen';
import MoneyScreen from './src/screens/MoneyScreen';
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
import { CallAnalyticsScreen } from './src/screens/calls/CallAnalyticsScreen';
import IntegrationsScreen from './src/screens/settings/IntegrationsScreen';
import { BusinessProfileScreen } from './src/screens/settings/BusinessProfileScreen';
import BookingPageSetupScreen from './src/screens/settings/BookingPageSetupScreen';
import QuoteFormsListScreen from './src/screens/quotes/QuoteFormsListScreen';
import QuoteFormTemplateSelectorScreen from './src/screens/quotes/QuoteFormTemplateSelectorScreen';
import QuoteFormAnalyticsScreen from './src/screens/quotes/QuoteFormAnalyticsScreen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from '@expo-google-fonts/space-grotesk';

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
          } else if (route.name === 'Calls') {
            iconName = focused ? 'call' : 'call-outline';
          } else if (route.name === 'Clients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Money') {
            iconName = focused ? 'cash' : 'cash-outline';
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
      <Tab.Screen name="Calls" component={CallsScreen} />
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Money" component={MoneyScreen} />
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
        name="CallAnalytics"
        component={CallAnalyticsScreen}
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
      <Stack.Screen
        name="BusinessProfile"
        component={BusinessProfileScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BookingPageSetup"
        component={BookingPageSetupScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QuoteFormsList"
        component={QuoteFormsListScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Quote Forms',
        }}
      />
      <Stack.Screen
        name="QuoteFormTemplateSelector"
        component={QuoteFormTemplateSelectorScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Choose Template',
        }}
      />
      <Stack.Screen
        name="QuoteFormAnalytics"
        component={QuoteFormAnalyticsScreen}
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Quote Form Analytics',
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  console.log('[App] Root component rendering - React 19 compatible');

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff4500" />
      </View>
    );
  }

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
