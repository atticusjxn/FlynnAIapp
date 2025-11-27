import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JobberService } from '../../services/integrations/JobberService';
import { OrganizationService } from '../../services/organizationService';
import type { IntegrationConnection } from '../../types/integrations';

interface IntegrationCardProps {
  provider: 'jobber' | 'fergus' | 'servicetitan' | 'google_calendar' | 'calendly';
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  connection: IntegrationConnection | null;
  onConnect: () => void;
  onDisconnect: () => void;
  loading?: boolean;
  comingSoon?: boolean;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  provider,
  name,
  description,
  icon,
  iconColor,
  connection,
  onConnect,
  onDisconnect,
  loading = false,
  comingSoon = false,
}) => {
  const isConnected = connection?.status === 'connected';
  const isError = connection?.status === 'error';
  const isExpired = connection?.status === 'expired';

  const getStatusInfo = () => {
    if (comingSoon) {
      return { text: 'Coming Soon', color: '#94a3b8', icon: 'time-outline' as const };
    }
    if (isConnected) {
      return { text: 'Connected', color: '#10b981', icon: 'checkmark-circle' as const };
    }
    if (isError) {
      return { text: 'Error', color: '#ef4444', icon: 'alert-circle' as const };
    }
    if (isExpired) {
      return { text: 'Reconnect Required', color: '#f59e0b', icon: 'warning' as const };
    }
    return { text: 'Not Connected', color: '#64748b', icon: 'radio-button-off' as const };
  };

  const status = getStatusInfo();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={32} color={iconColor} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          <Ionicons name={status.icon} size={16} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.text}
          </Text>
        </View>
      </View>

      {isConnected && connection?.account_name && (
        <View style={styles.accountInfo}>
          <Ionicons name="business-outline" size={14} color="#64748b" />
          <Text style={styles.accountText}>{connection.account_name}</Text>
        </View>
      )}

      {isConnected && connection?.last_sync_at && (
        <View style={styles.accountInfo}>
          <Ionicons name="sync-outline" size={14} color="#64748b" />
          <Text style={styles.accountText}>
            Last synced: {new Date(connection.last_sync_at).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View style={styles.cardActions}>
        {comingSoon ? (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        ) : isConnected || isExpired ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.disconnectButton]}
              onPress={onDisconnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="unlink-outline" size={18} color="#ef4444" />
                  <Text style={styles.disconnectButtonText}>
                    {isExpired ? 'Reconnect' : 'Disconnect'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            {isExpired && (
              <TouchableOpacity
                style={[styles.button, styles.connectButton]}
                onPress={onConnect}
                disabled={loading}
              >
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={styles.connectButtonText}>Reconnect</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.connectButton]}
            onPress={onConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.connectButtonText}>Connect {name}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function IntegrationsScreen() {
  const [connections, setConnections] = useState<Record<string, IntegrationConnection | null>>({
    jobber: null,
    fergus: null,
    servicetitan: null,
    google_calendar: null,
    calendly: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConnections = useCallback(async () => {
    try {
      // Load Jobber connection
      const jobberConnection = await JobberService.getConnection();
      setConnections((prev) => ({ ...prev, jobber: jobberConnection }));

      // TODO: Load other connections when implemented
      // const fergusConnection = await FergusService.getConnection();
      // const serviceTitanConnection = await ServiceTitanService.getConnection();
      // etc.
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConnections();
  }, [loadConnections]);

  const handleConnect = async (provider: string) => {
    setLoading((prev) => ({ ...prev, [provider]: true }));

    try {
      const { orgId } = await OrganizationService.fetchOnboardingData();

      if (!orgId) {
        Alert.alert('Error', 'Organization not found. Please try again.');
        return;
      }

      let authUrl: string;

      switch (provider) {
        case 'jobber':
          authUrl = JobberService.getAuthorizationUrl(orgId);
          break;
        // TODO: Add other providers
        // case 'fergus':
        //   authUrl = FergusService.getAuthorizationUrl(orgId);
        //   break;
        default:
          Alert.alert('Coming Soon', `${provider} integration is not yet available.`);
          return;
      }

      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);

        // Show instructions
        Alert.alert(
          'Authorize Connection',
          'You will be redirected to authorize Flynn AI. After authorization, return to the app and refresh this page.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reload connections after a delay (user needs to authorize first)
                setTimeout(() => {
                  loadConnections();
                }, 2000);
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Unable to open authorization URL.');
      }
    } catch (error) {
      console.error(`Error connecting to ${provider}:`, error);
      Alert.alert('Connection Error', `Failed to connect to ${provider}. Please try again.`);
    } finally {
      setLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleDisconnect = async (provider: string, name: string) => {
    Alert.alert(
      `Disconnect ${name}`,
      `Are you sure you want to disconnect your ${name} account? Jobs will no longer sync automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoading((prev) => ({ ...prev, [provider]: true }));

            try {
              switch (provider) {
                case 'jobber':
                  await JobberService.disconnect();
                  break;
                // TODO: Add other providers
                default:
                  break;
              }

              setConnections((prev) => ({ ...prev, [provider]: null }));
              Alert.alert('Success', `${name} disconnected successfully.`);
            } catch (error) {
              console.error(`Error disconnecting ${provider}:`, error);
              Alert.alert('Error', `Failed to disconnect ${name}. Please try again.`);
            } finally {
              setLoading((prev) => ({ ...prev, [provider]: false }));
            }
          },
        },
      ]
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading integrations...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Integrations</Text>
        <Text style={styles.subtitle}>
          Connect your field service and calendar apps to automatically sync jobs from missed calls
        </Text>
      </View>

      {/* Field Service Integrations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="briefcase-outline" size={20} color="#1e293b" />
          <Text style={styles.sectionTitle}>Field Service Management</Text>
        </View>

        <IntegrationCard
          provider="jobber"
          name="Jobber"
          description="Auto-sync jobs to your Jobber account"
          icon="hammer-outline"
          iconColor="#0066cc"
          connection={connections.jobber}
          onConnect={() => handleConnect('jobber')}
          onDisconnect={() => handleDisconnect('jobber', 'Jobber')}
          loading={loading.jobber}
        />

        <IntegrationCard
          provider="fergus"
          name="Fergus"
          description="Sync jobs with Fergus field service platform"
          icon="construct-outline"
          iconColor="#e84c3d"
          connection={connections.fergus}
          onConnect={() => handleConnect('fergus')}
          onDisconnect={() => handleDisconnect('fergus', 'Fergus')}
          loading={loading.fergus}
          comingSoon
        />

        <IntegrationCard
          provider="servicetitan"
          name="ServiceTitan"
          description="Connect with ServiceTitan for commercial services"
          icon="business-outline"
          iconColor="#ff6b35"
          connection={connections.servicetitan}
          onConnect={() => handleConnect('servicetitan')}
          onDisconnect={() => handleDisconnect('servicetitan', 'ServiceTitan')}
          loading={loading.servicetitan}
          comingSoon
        />
      </View>

      {/* Calendar Integrations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={20} color="#1e293b" />
          <Text style={styles.sectionTitle}>Calendar & Scheduling</Text>
        </View>

        <IntegrationCard
          provider="google_calendar"
          name="Google Calendar"
          description="Sync appointments to your Google Calendar"
          icon="logo-google"
          iconColor="#4285f4"
          connection={connections.google_calendar}
          onConnect={() => handleConnect('google_calendar')}
          onDisconnect={() => handleDisconnect('google_calendar', 'Google Calendar')}
          loading={loading.google_calendar}
          comingSoon
        />

        <IntegrationCard
          provider="calendly"
          name="Calendly"
          description="Check availability and book through Calendly"
          icon="time-outline"
          iconColor="#0069ff"
          connection={connections.calendly}
          onConnect={() => handleConnect('calendly')}
          onDisconnect={() => handleDisconnect('calendly', 'Calendly')}
          loading={loading.calendly}
          comingSoon
        />
      </View>

      {/* Help Section */}
      <View style={styles.helpSection}>
        <Ionicons name="information-circle-outline" size={20} color="#64748b" />
        <Text style={styles.helpText}>
          Need help setting up integrations?{' '}
          <Text
            style={styles.helpLink}
            onPress={() => Linking.openURL('https://docs.flynn.ai/integrations')}
          >
            View documentation
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  statusRow: {
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accountText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  connectButton: {
    backgroundColor: '#2563eb',
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  disconnectButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonBadge: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  comingSoonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    marginTop: 8,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    marginLeft: 12,
    lineHeight: 20,
  },
  helpLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
