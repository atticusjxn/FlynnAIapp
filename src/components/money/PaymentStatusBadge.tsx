// Payment Status Badge Component
// Visual status indicators for quotes and invoices

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { QuoteStatus } from '../../types/quote';
import { InvoiceStatus } from '../../types/invoice';

interface PaymentStatusBadgeProps {
  status: QuoteStatus | InvoiceStatus;
  type: 'quote' | 'invoice';
}

const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ status, type }) => {
  const getStatusConfig = () => {
    if (type === 'quote') {
      switch (status as QuoteStatus) {
        case 'draft':
          return { label: 'Draft', color: '#64748B', bgColor: '#F1F5F9' };
        case 'sent':
          return { label: 'Sent', color: '#2563EB', bgColor: '#DBEAFE' };
        case 'viewed':
          return { label: 'Viewed', color: '#8B5CF6', bgColor: '#EDE9FE' };
        case 'accepted':
          return { label: 'Accepted', color: '#10B981', bgColor: '#D1FAE5' };
        case 'declined':
          return { label: 'Declined', color: '#EF4444', bgColor: '#FEE2E2' };
        case 'expired':
          return { label: 'Expired', color: '#F59E0B', bgColor: '#FEF3C7' };
        default:
          return { label: 'Unknown', color: '#64748B', bgColor: '#F1F5F9' };
      }
    } else {
      switch (status as InvoiceStatus) {
        case 'draft':
          return { label: 'Draft', color: '#64748B', bgColor: '#F1F5F9' };
        case 'sent':
          return { label: 'Sent', color: '#2563EB', bgColor: '#DBEAFE' };
        case 'viewed':
          return { label: 'Viewed', color: '#8B5CF6', bgColor: '#EDE9FE' };
        case 'partial':
          return { label: 'Partial', color: '#F59E0B', bgColor: '#FEF3C7' };
        case 'paid':
          return { label: 'Paid', color: '#10B981', bgColor: '#D1FAE5' };
        case 'overdue':
          return { label: 'Overdue', color: '#EF4444', bgColor: '#FEE2E2' };
        case 'cancelled':
          return { label: 'Cancelled', color: '#64748B', bgColor: '#F1F5F9' };
        case 'refunded':
          return { label: 'Refunded', color: '#F59E0B', bgColor: '#FEF3C7' };
        default:
          return { label: 'Unknown', color: '#64748B', bgColor: '#F1F5F9' };
      }
    }
  };

  const { label, color, bgColor } = getStatusConfig();

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default PaymentStatusBadge;
