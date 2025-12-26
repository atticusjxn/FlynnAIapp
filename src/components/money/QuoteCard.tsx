// Quote Card Component
// Display quote in list view

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Quote } from '../../types/quote';
import PaymentStatusBadge from './PaymentStatusBadge';

interface QuoteCardProps {
  quote: Quote;
  onPress: () => void;
}

const QuoteCard: React.FC<QuoteCardProps> = ({ quote, onPress }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getIconForStatus = () => {
    switch (quote.status) {
      case 'accepted':
        return <Ionicons name="checkmark-circle" size={20} color="#10B981" />;
      case 'declined':
        return <Ionicons name="close-circle" size={20} color="#EF4444" />;
      case 'viewed':
        return <Ionicons name="eye" size={20} color="#8B5CF6" />;
      case 'sent':
        return <Ionicons name="paper-plane" size={20} color="#2563EB" />;
      case 'expired':
        return <Ionicons name="time-outline" size={20} color="#F59E0B" />;
      default:
        return <Ionicons name="document-text-outline" size={20} color="#64748B" />;
    }
  };

  const isExpiringSoon = () => {
    if (!quote.valid_until) return false;
    const validUntil = new Date(quote.valid_until);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {getIconForStatus()}
          <View style={styles.headerTextContainer}>
            <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
            {quote.title && (
              <Text style={styles.title} numberOfLines={1}>{quote.title}</Text>
            )}
          </View>
        </View>
        <PaymentStatusBadge status={quote.status} type="quote" />
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>Quote Amount</Text>
        <Text style={styles.amount}>${quote.total.toFixed(2)}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.footerText}>Created {formatDate(quote.created_at)}</Text>
        </View>

        {quote.valid_until && (
          <View style={[
            styles.footerItem,
            isExpiringSoon() && styles.expiringWarning
          ]}>
            <Ionicons
              name="hourglass-outline"
              size={14}
              color={isExpiringSoon() ? '#F59E0B' : '#64748B'}
            />
            <Text style={[
              styles.footerText,
              isExpiringSoon() && styles.expiringText
            ]}>
              Valid until {formatDate(quote.valid_until)}
            </Text>
          </View>
        )}
      </View>

      {/* Sent indicator */}
      {quote.sent_at && (
        <View style={styles.sentIndicator}>
          <Ionicons name="send" size={12} color="#10B981" />
          <Text style={styles.sentText}>Sent {formatDate(quote.sent_at)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerTextContainer: {
    flex: 1,
  },
  quoteNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  title: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  amountContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff4500',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
  },
  expiringWarning: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expiringText: {
    color: '#92400E',
    fontWeight: '600',
  },
  sentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sentText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
});

export default QuoteCard;
