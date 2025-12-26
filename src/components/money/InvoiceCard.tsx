// Invoice Card Component
// Display invoice in list view

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Invoice } from '../../types/invoice';
import PaymentStatusBadge from './PaymentStatusBadge';

interface InvoiceCardProps {
  invoice: Invoice;
  onPress: () => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onPress }) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getIconForStatus = () => {
    switch (invoice.status) {
      case 'paid':
        return <Ionicons name="checkmark-circle" size={20} color="#10B981" />;
      case 'overdue':
        return <Ionicons name="alert-circle" size={20} color="#EF4444" />;
      case 'partial':
        return <Ionicons name="time" size={20} color="#F59E0B" />;
      case 'viewed':
        return <Ionicons name="eye" size={20} color="#8B5CF6" />;
      case 'sent':
        return <Ionicons name="paper-plane" size={20} color="#2563EB" />;
      default:
        return <Ionicons name="document-text-outline" size={20} color="#64748B" />;
    }
  };

  const isOverdue = invoice.status === 'overdue';
  const isPartiallyPaid = invoice.amount_paid > 0 && invoice.amount_due > 0;

  const getDaysUntilDue = () => {
    if (!invoice.due_date) return null;
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue;
  };

  const daysUntilDue = getDaysUntilDue();
  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue > 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isOverdue && styles.cardOverdue,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {getIconForStatus()}
          <View style={styles.headerTextContainer}>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            {invoice.title && (
              <Text style={styles.title} numberOfLines={1}>{invoice.title}</Text>
            )}
          </View>
        </View>
        <PaymentStatusBadge status={invoice.status} type="invoice" />
      </View>

      {/* Amount section */}
      <View style={styles.amounts}>
        {/* Total */}
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Total</Text>
          <Text style={styles.amountValue}>${invoice.total.toFixed(2)}</Text>
        </View>

        {/* Amount Paid (if any) */}
        {isPartiallyPaid && (
          <View style={styles.amountItem}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={[styles.amountValue, styles.amountPaid]}>
              -${invoice.amount_paid.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Amount Due */}
        {invoice.amount_due > 0 && (
          <View style={[
            styles.amountItem,
            styles.amountDueContainer,
            isOverdue && styles.overdueContainer,
          ]}>
            <Text style={[styles.amountLabel, isOverdue && styles.overdueText]}>
              {isOverdue ? 'OVERDUE' : 'Amount Due'}
            </Text>
            <Text style={[
              styles.amountValue,
              styles.amountDue,
              isOverdue && styles.overdueAmount,
            ]}>
              ${invoice.amount_due.toFixed(2)}
            </Text>
          </View>
        )}

        {/* Paid in full indicator */}
        {invoice.status === 'paid' && (
          <View style={styles.paidContainer}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.paidText}>Paid in Full</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color="#64748B" />
          <Text style={styles.footerText}>Issued {formatDate(invoice.issued_date)}</Text>
        </View>

        {invoice.due_date && invoice.status !== 'paid' && (
          <View style={[
            styles.footerItem,
            (isDueSoon || isOverdue) && styles.dueWarning
          ]}>
            <Ionicons
              name="timer-outline"
              size={14}
              color={(isDueSoon || isOverdue) ? '#EF4444' : '#64748B'}
            />
            <Text style={[
              styles.footerText,
              (isDueSoon || isOverdue) && styles.dueWarningText
            ]}>
              Due {formatDate(invoice.due_date)}
              {daysUntilDue !== null && daysUntilDue > 0 && ` (${daysUntilDue}d)`}
              {isOverdue && ` (${Math.abs(daysUntilDue!)}d overdue)`}
            </Text>
          </View>
        )}
      </View>

      {/* Sent indicator */}
      {invoice.sent_at && (
        <View style={styles.sentIndicator}>
          <Ionicons name="send" size={12} color="#10B981" />
          <Text style={styles.sentText}>Sent {formatDate(invoice.sent_at)}</Text>
        </View>
      )}

      {/* Paid indicator */}
      {invoice.paid_at && (
        <View style={styles.paidIndicator}>
          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
          <Text style={styles.sentText}>Paid {formatDate(invoice.paid_at)}</Text>
          {invoice.payment_method && (
            <Text style={styles.paymentMethod}>via {invoice.payment_method}</Text>
          )}
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
  cardOverdue: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
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
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  title: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  amounts: {
    marginBottom: 12,
  },
  amountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  amountPaid: {
    color: '#10B981',
  },
  amountDueContainer: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  overdueContainer: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  amountDue: {
    fontSize: 20,
    color: '#F59E0B',
  },
  overdueAmount: {
    color: '#EF4444',
  },
  overdueText: {
    color: '#991B1B',
  },
  paidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    gap: 8,
  },
  paidText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
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
  dueWarning: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dueWarningText: {
    color: '#991B1B',
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
  paidIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  paymentMethod: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
});

export default InvoiceCard;
