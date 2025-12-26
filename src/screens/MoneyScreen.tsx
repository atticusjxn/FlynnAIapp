// Money Screen
// Main screen for Quotes and Invoices management

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Quote } from '../types/quote';
import { Invoice } from '../types/invoice';
import QuoteCard from '../components/money/QuoteCard';
import InvoiceCard from '../components/money/InvoiceCard';
import QuoteBuilder from '../components/money/QuoteBuilder';
import InvoiceBuilder from '../components/money/InvoiceBuilder';
import QuoteService from '../services/QuoteService';
import InvoiceService from '../services/InvoiceService';
import { supabase } from '../services/supabase';

type TabType = 'quotes' | 'invoices';

const MoneyScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteBuilderVisible, setQuoteBuilderVisible] = useState(false);
  const [invoiceBuilderVisible, setInvoiceBuilderVisible] = useState(false);
  const [orgId, setOrgId] = useState<string>('');

  // Get org_id from user
  useEffect(() => {
    loadOrgId();
  }, []);

  const loadOrgId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get user's default org
      const { data: userData } = await supabase
        .from('users')
        .select('default_org_id')
        .eq('id', user.id)
        .single();

      if (userData?.default_org_id) {
        setOrgId(userData.default_org_id);
      }
    }
  };

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (orgId) {
        loadData();
      }
    }, [orgId])
  );

  const loadData = async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const [quotesData, invoicesData] = await Promise.all([
        QuoteService.getQuotes(orgId),
        InvoiceService.getInvoices(orgId),
      ]);
      setQuotes(quotesData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error('Failed to load money data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleQuotePress = (quote: Quote) => {
    // TODO: Navigate to quote details screen
    console.log('Quote pressed:', quote.quote_number);
  };

  const handleInvoicePress = (invoice: Invoice) => {
    // TODO: Navigate to invoice details screen
    console.log('Invoice pressed:', invoice.invoice_number);
  };

  const handleQuoteCreated = (quote: Quote) => {
    setQuotes([quote, ...quotes]);
  };

  const handleInvoiceCreated = (invoice: Invoice) => {
    setInvoices([invoice, ...invoices]);
  };

  const renderQuoteItem = ({ item }: { item: Quote }) => (
    <QuoteCard quote={item} onPress={() => handleQuotePress(item)} />
  );

  const renderInvoiceItem = ({ item }: { item: Invoice }) => (
    <InvoiceCard invoice={item} onPress={() => handleInvoicePress(item)} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={activeTab === 'quotes' ? 'document-text-outline' : 'receipt-outline'}
        size={64}
        color="#CBD5E1"
      />
      <Text style={styles.emptyTitle}>
        No {activeTab === 'quotes' ? 'quotes' : 'invoices'} yet
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'quotes'
          ? 'Create a quote to send to your customers'
          : 'Create an invoice to request payment'}
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => {
          if (activeTab === 'quotes') {
            setQuoteBuilderVisible(true);
          } else {
            setInvoiceBuilderVisible(true);
          }
        }}
      >
        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
        <Text style={styles.emptyButtonText}>
          Create {activeTab === 'quotes' ? 'Quote' : 'Invoice'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4500" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Money</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (activeTab === 'quotes') {
              setQuoteBuilderVisible(true);
            } else {
              setInvoiceBuilderVisible(true);
            }
          }}
        >
          <Ionicons name="add-circle" size={28} color="#ff4500" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'quotes' && styles.tabActive]}
          onPress={() => setActiveTab('quotes')}
        >
          <Text style={[styles.tabText, activeTab === 'quotes' && styles.tabTextActive]}>
            Quotes
          </Text>
          {quotes.length > 0 && (
            <View style={[styles.badge, activeTab === 'quotes' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'quotes' && styles.badgeTextActive]}>
                {quotes.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
            Invoices
          </Text>
          {invoices.length > 0 && (
            <View style={[styles.badge, activeTab === 'invoices' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'invoices' && styles.badgeTextActive]}>
                {invoices.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={activeTab === 'quotes' ? quotes : invoices}
        renderItem={activeTab === 'quotes' ? renderQuoteItem : renderInvoiceItem}
        keyExtractor={(item: Quote | Invoice) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ff4500"
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Modals */}
      <QuoteBuilder
        visible={quoteBuilderVisible}
        onClose={() => setQuoteBuilderVisible(false)}
        onSuccess={handleQuoteCreated}
        orgId={orgId}
      />

      <InvoiceBuilder
        visible={invoiceBuilderVisible}
        onClose={() => setInvoiceBuilderVisible(false)}
        onSuccess={handleInvoiceCreated}
        orgId={orgId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ff4500',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#ff4500',
  },
  badge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#ff4500',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 24,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4500',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default MoneyScreen;
