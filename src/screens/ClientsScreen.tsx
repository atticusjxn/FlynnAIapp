import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { spacing, typography, borderRadius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ClientCard } from '../components/clients/ClientCard';
import { ClientDetailsModal } from '../components/clients/ClientDetailsModal';
import { CommunicationTemplates } from '../components/clients/CommunicationTemplates';
import { FlynnButton } from '../components/ui/FlynnButton';
import { Client, ClientDetails } from '../types/client';
import { clientsService } from '../services/clientsService';
import { useAuth } from '../context/AuthContext';
import { ClientFormModal } from '../components/clients/ClientFormModal';

export const ClientsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user } = useAuth();
  const styles = createStyles(colors);

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedClient, setSelectedClient] = useState<ClientDetails | null>(null);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [communicationType, setCommunicationType] = useState<'text' | 'email'>('text');

  const [formVisible, setFormVisible] = useState(false);
  const [formInitialClient, setFormInitialClient] = useState<Client | null>(null);

  const loadClients = useCallback(async () => {
    if (!user?.id) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await clientsService.listClients();
      setClients(data);
    } catch (err) {
      console.error('[ClientsScreen] Failed to load clients', err);
      setError('Unable to load clients. Pull to refresh or try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const refreshClients = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      const data = await clientsService.listClients();
      setClients(data);
    } catch (err) {
      console.error('[ClientsScreen] Failed to refresh clients', err);
      setError('Unable to refresh clients.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();
    return clients.filter((client) =>
      client.name.toLowerCase().includes(query) ||
      (client.phone ?? '').toLowerCase().includes(query) ||
      (client.email ?? '').toLowerCase().includes(query) ||
      (client.address ?? '').toLowerCase().includes(query) ||
      (client.lastJobType ?? '').toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      const dateA = a.lastJobDate ? new Date(a.lastJobDate).getTime() : 0;
      const dateB = b.lastJobDate ? new Date(b.lastJobDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredClients]);

  const handleClientPress = useCallback(async (client: Client) => {
    setSelectedClient({ ...client, jobHistory: [], communicationLog: [] });

    try {
      const details = await clientsService.getClientDetails({ clientId: client.id });
      if (details) {
        setSelectedClient(details);
      }
    } catch (err) {
      console.error('[ClientsScreen] Failed to load client details', err);
      Alert.alert('Error', 'Unable to load client details right now.');
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedClient(null);
  }, []);

  const handleAddClient = useCallback(() => {
    setFormInitialClient(null);
    setFormVisible(true);
  }, []);

  const handleScheduleJob = useCallback(
    (clientDetails: ClientDetails) => {
      const prefilledData = {
        clientName: clientDetails.name,
        phone: clientDetails.phone ?? '',
        date: '',
        time: '',
        notes: clientDetails.notes ?? '',
        businessType: clientDetails.businessType ?? 'other',
        location: clientDetails.address ?? '',
      };

      navigation.navigate('JobFormDemo', {
        prefilledData,
        isEditing: false,
      });

      handleCloseModal();
    },
    [handleCloseModal, navigation]
  );

  const handleEditClient = useCallback((clientDetails: ClientDetails) => {
    setFormInitialClient(clientDetails);
    setFormVisible(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (payload: { client: Partial<Client> & { name: string; id?: string } }) => {
      if (!user?.id) {
        Alert.alert('Not signed in', 'You need to be signed in to manage clients.');
        return;
      }

      try {
        const saved = await clientsService.upsertClient({ client: payload.client, userId: user.id });
        setClients((prev) => {
          const exists = prev.find((c) => c.id === saved.id);
          if (exists) {
            return prev.map((c) => (c.id === saved.id ? saved : c));
          }
          return [saved, ...prev];
        });
        setFormVisible(false);
        setFormInitialClient(null);
        if (selectedClient && selectedClient.id === saved.id) {
          setSelectedClient((prev) =>
            prev ? { ...prev, ...saved } : null
          );
        }
      } catch (err) {
        console.error('[ClientsScreen] Failed to save client', err);
        Alert.alert('Error', 'Could not save client. Please try again.');
      }
    },
    [selectedClient, user?.id]
  );

  const handleDeleteClient = useCallback(
    (clientDetails: Client | ClientDetails) => {
      if (!user?.id) return;

      Alert.alert(
        'Delete client',
        `Are you sure you want to remove ${clientDetails.name}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await clientsService.deleteClient({ clientId: clientDetails.id, userId: user.id });
                setClients((prev) => prev.filter((c) => c.id !== clientDetails.id));
                handleCloseModal();
              } catch (err) {
                console.error('[ClientsScreen] Failed to delete client', err);
                Alert.alert('Error', 'Unable to delete this client.');
              }
            },
          },
        ]
      );
    },
    [handleCloseModal, user?.id]
  );

  const handleSendTemplate = useCallback(
    async (template: string) => {
      if (!selectedClient || !user?.id) return;

      const message = template.trim();
      if (!message) {
        return;
      }

      try {
        const entry = await clientsService.logCommunication({
          clientId: selectedClient.id,
          userId: user.id,
          type: communicationType,
          content: message,
          recipient:
            communicationType === 'text'
              ? selectedClient.phone ?? undefined
              : selectedClient.email ?? undefined,
        });

        setSelectedClient((prev) =>
          prev
            ? {
                ...prev,
                communicationLog: [entry, ...prev.communicationLog],
              }
            : prev
        );

        Alert.alert('Success', `${communicationType === 'text' ? 'Text' : 'Email'} queued for sending.`);
      } catch (err) {
        console.error('[ClientsScreen] Failed to log communication', err);
        Alert.alert('Error', 'Unable to send this message right now.');
      }
    },
    [communicationType, selectedClient, user?.id]
  );

  const handleSendText = useCallback((clientDetails: ClientDetails) => {
    setSelectedClient(clientDetails);
    setCommunicationType('text');
    setTemplatesVisible(true);
  }, []);

  const handleSendEmail = useCallback((clientDetails: ClientDetails) => {
    if (!clientDetails.email) {
      Alert.alert('No Email', 'This client does not have an email address on file.');
      return;
    }
    setSelectedClient(clientDetails);
    setCommunicationType('email');
    setTemplatesVisible(true);
  }, []);

  const renderClientCard = useCallback(
    ({ item }: { item: Client }) => (
      <ClientCard
        client={item}
        onPress={() => handleClientPress(item)}
        onSendText={() => {
          setSelectedClient({ ...item, jobHistory: [], communicationLog: [] });
          setCommunicationType('text');
          setTemplatesVisible(true);
        }}
        onSendEmail={() => {
          if (!item.email) {
            Alert.alert('No Email', 'This client does not have an email address on file.');
            return;
          }
          setSelectedClient({ ...item, jobHistory: [], communicationLog: [] });
          setCommunicationType('email');
          setTemplatesVisible(true);
        }}
      />
    ),
    [handleClientPress]
  );

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No Clients Found' : 'No Clients Yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery
          ? 'Try adjusting your search terms'
          : 'Add your first client to start tracking conversations and bookings.'}
      </Text>
      {!searchQuery && (
        <FlynnButton
          title="Add First Client"
          onPress={handleAddClient}
          variant="primary"
          size="medium"
          icon={<Ionicons name="person-add-outline" size={18} color={colors.white} />}
          style={styles.emptyActionButton}
        />
      )}
    </View>
  ), [colors.gray400, colors.white, handleAddClient, searchQuery, styles.emptyActionButton, styles.emptyDescription, styles.emptyState, styles.emptyTitle]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading clients…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Clients</Text>
            <Text style={styles.clientCount}>
              {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
            </Text>
          </View>
          <FlynnButton
            title="Add Client"
            onPress={handleAddClient}
            variant="primary"
            size="medium"
            icon={<Ionicons name="person-add-outline" size={18} color={colors.white} />}
          />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.gray400}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={sortedClients}
        keyExtractor={(item) => item.id}
        renderItem={renderClientCard}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshClients} tintColor={colors.primary} />
        }
        contentContainerStyle={sortedClients.length === 0 ? styles.listEmptyContent : undefined}
      />

      <ClientDetailsModal
        client={selectedClient}
        visible={!!selectedClient}
        onClose={handleCloseModal}
        onScheduleJob={handleScheduleJob}
        onEditClient={handleEditClient}
        onSendText={() => {
          if (!selectedClient) return;
          handleSendText(selectedClient);
        }}
        onSendEmail={() => {
          if (!selectedClient) return;
          handleSendEmail(selectedClient);
        }}
      />

      {selectedClient ? (
        <CommunicationTemplates
          visible={templatesVisible}
          onClose={() => setTemplatesVisible(false)}
          client={selectedClient}
          type={communicationType}
          onSendTemplate={handleSendTemplate}
        />
      ) : null}

      <ClientFormModal
        visible={formVisible}
        onDismiss={() => {
          setFormVisible(false);
          setFormInitialClient(null);
        }}
        initialClient={formInitialClient}
        onSubmit={handleFormSubmit}
        onDelete={formInitialClient ? handleDeleteClient : undefined}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing.md,
      ...typography.bodyMedium,
      color: colors.textSecondary,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    titleContainer: {
      gap: spacing.xs,
    },
    title: {
      ...typography.h1,
      color: colors.textPrimary,
    },
    clientCount: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    searchContainer: {
      marginTop: spacing.sm,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      ...typography.bodyMedium,
      color: colors.textPrimary,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: `${colors.error}10`,
    },
    errorText: {
      ...typography.bodySmall,
      color: colors.error,
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    emptyDescription: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyActionButton: {
      marginTop: spacing.md,
    },
    listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
  });
