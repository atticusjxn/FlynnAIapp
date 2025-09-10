import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { ClientCard } from '../components/clients/ClientCard';
import { ClientDetailsModal } from '../components/clients/ClientDetailsModal';
import { CommunicationTemplates } from '../components/clients/CommunicationTemplates';
import { FlynnButton } from '../components/ui/FlynnButton';
import { Client, mockClients } from '../data/mockClients';

export const ClientsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [templatesVisible, setTemplatesVisible] = useState(false);
  const [communicationType, setCommunicationType] = useState<'text' | 'email'>('text');

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.address.toLowerCase().includes(query) ||
      client.lastJobType.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // Sort clients by last job date (most recent first)
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => 
      new Date(b.lastJobDate).getTime() - new Date(a.lastJobDate).getTime()
    );
  }, [filteredClients]);

  const handleClientPress = (client: Client) => {
    setSelectedClient(client);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedClient(null);
  };

  const handleAddClient = () => {
    Alert.alert('Add Client', 'Add new client feature coming soon!');
  };

  const handleScheduleJob = (client: Client) => {
    // Navigate to job form with client info pre-filled
    const prefilledData = {
      clientName: client.name,
      phone: client.phone,
      date: '',
      time: '',
      notes: client.notes || '',
      businessType: client.businessType,
      location: client.address,
    };

    navigation.navigate('JobFormDemo' as never, {
      prefilledData,
      isEditing: false,
    } as never);
    
    handleCloseModal();
  };

  const handleEditClient = (client: Client) => {
    Alert.alert('Edit Client', 'Edit client feature coming soon!');
  };

  const handleSendText = (client: Client) => {
    setSelectedClient(client);
    setCommunicationType('text');
    setTemplatesVisible(true);
  };

  const handleSendTemplate = (template: string) => {
    if (!selectedClient) return;

    // Add communication log entry
    const newCommEntry = {
      id: Date.now().toString(),
      type: communicationType,
      date: new Date().toISOString(),
      direction: 'outgoing' as const,
      content: template || 'Template message sent',
      success: true,
    };

    setClients(prevClients =>
      prevClients.map(c =>
        c.id === selectedClient.id
          ? { ...c, communicationLog: [newCommEntry, ...c.communicationLog] }
          : c
      )
    );

    Alert.alert('Success', `${communicationType === 'text' ? 'Text' : 'Email'} sent successfully!`);
  };

  const handleSendEmail = (client: Client) => {
    if (!client.email) {
      Alert.alert('No Email', 'This client does not have an email address on file.');
      return;
    }

    setSelectedClient(client);
    setCommunicationType('email');
    setTemplatesVisible(true);
  };

  const renderClientCard = ({ item }: { item: Client }) => (
    <ClientCard
      client={item}
      onPress={handleClientPress}
      onSendText={handleSendText}
      onSendEmail={handleSendEmail}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No Clients Found' : 'No Clients Yet'}
      </Text>
      <Text style={styles.emptyDescription}>
        {searchQuery 
          ? 'Try adjusting your search terms'
          : 'Add your first client to get started with managing your business relationships'
        }
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
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
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

        {/* Search Bar */}
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
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Client List */}
      <FlatList
        data={sortedClients}
        renderItem={renderClientCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          sortedClients.length === 0 && styles.emptyListContainer
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Client Details Modal */}
      <ClientDetailsModal
        client={selectedClient}
        visible={modalVisible}
        onClose={handleCloseModal}
        onScheduleJob={handleScheduleJob}
        onEditClient={handleEditClient}
        onSendText={handleSendText}
        onSendEmail={handleSendEmail}
      />

      {/* Communication Templates Modal */}
      {selectedClient && (
        <CommunicationTemplates
          visible={templatesVisible}
          onClose={() => setTemplatesVisible(false)}
          client={selectedClient}
          type={communicationType}
          onSendTemplate={handleSendTemplate}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },

  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xxxs,
  },

  clientCount: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  searchContainer: {
    marginBottom: spacing.xs,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
  },

  clearButton: {
    padding: spacing.xs,
  },

  listContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },

  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  emptyDescription: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  emptyActionButton: {
    paddingHorizontal: spacing.xl,
  },
});