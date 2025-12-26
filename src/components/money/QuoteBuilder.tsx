// Quote Builder Modal
// Create and edit quotes with line items

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Quote, CreateQuoteRequest, LineItem } from '../../types/quote';
import LineItemEditor from './LineItemEditor';
import QuoteService from '../../services/QuoteService';

interface QuoteBuilderProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (quote: Quote) => void;
  orgId: string;
  clientId?: string;
  jobId?: string;
  eventId?: string;
  existingQuote?: Quote; // For editing
}

const QuoteBuilder: React.FC<QuoteBuilderProps> = ({
  visible,
  onClose,
  onSuccess,
  orgId,
  clientId,
  jobId,
  eventId,
  existingQuote,
}) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 }
  ]);
  const [taxRate, setTaxRate] = useState('10.00'); // Australian GST
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [message, setMessage] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Calculate totals
  const { subtotal, tax_amount, total } = QuoteService.calculateTotals(
    lineItems,
    parseFloat(taxRate) || 0
  );

  // Load existing quote data if editing
  useEffect(() => {
    if (existingQuote && visible) {
      setTitle(existingQuote.title || '');
      setLineItems(existingQuote.line_items);
      setTaxRate(existingQuote.tax_rate.toString());
      setNotes(existingQuote.notes || '');
      setTerms(existingQuote.terms || '');
      setMessage(existingQuote.message || '');
      setValidUntil(existingQuote.valid_until || '');
    } else if (!existingQuote && visible) {
      // Reset form for new quote
      resetForm();
    }
  }, [existingQuote, visible]);

  const resetForm = () => {
    setTitle('');
    setLineItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
    setTaxRate('10.00');
    setNotes('');
    setTerms('');
    setMessage('');
    setValidUntil('');
  };

  const validateForm = (): boolean => {
    if (lineItems.length === 0) {
      Alert.alert('Error', 'Please add at least one line item');
      return false;
    }

    const hasEmptyDescription = lineItems.some(item => !item.description.trim());
    if (hasEmptyDescription) {
      Alert.alert('Error', 'All line items must have a description');
      return false;
    }

    const hasInvalidAmount = lineItems.some(item => item.quantity <= 0 || item.unit_price < 0);
    if (hasInvalidAmount) {
      Alert.alert('Error', 'All line items must have valid quantities and prices');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (existingQuote) {
        // Update existing quote
        const updated = await QuoteService.updateQuote(existingQuote.id, {
          title,
          line_items: lineItems,
          tax_rate: parseFloat(taxRate),
          notes,
          terms,
          message,
          valid_until: validUntil || undefined,
        });
        onSuccess(updated);
      } else {
        // Create new quote
        const request: CreateQuoteRequest = {
          org_id: orgId,
          client_id: clientId,
          job_id: jobId,
          event_id: eventId,
          title,
          line_items: lineItems,
          tax_rate: parseFloat(taxRate),
          notes,
          terms,
          message,
          valid_until: validUntil || undefined,
        };
        const newQuote = await QuoteService.createQuote(request);
        onSuccess(newQuote);
      }
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to save quote:', error);
      Alert.alert('Error', 'Failed to save quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!existingQuote) {
      resetForm();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {existingQuote ? 'Edit Quote' : 'Create Quote'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Form */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.label}>Quote Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Bathroom Renovation Quote"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Line Items */}
            <LineItemEditor
              items={lineItems}
              onChange={setLineItems}
              editable={true}
            />

            {/* Totals Display */}
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.taxRow}>
                <Text style={styles.totalLabel}>GST</Text>
                <View style={styles.taxInputContainer}>
                  <TextInput
                    style={styles.taxInput}
                    value={taxRate}
                    onChangeText={setTaxRate}
                    keyboardType="decimal-pad"
                    placeholder="10.00"
                  />
                  <Text style={styles.taxPercent}>%</Text>
                </View>
                <Text style={styles.totalValue}>${tax_amount.toFixed(2)}</Text>
              </View>

              <View style={styles.totalRowFinal}>
                <Text style={styles.totalLabelFinal}>Total</Text>
                <Text style={styles.totalValueFinal}>${total.toFixed(2)}</Text>
              </View>
            </View>

            {/* Valid Until */}
            <View style={styles.field}>
              <Text style={styles.label}>Valid Until (Optional)</Text>
              <TextInput
                style={styles.input}
                value={validUntil}
                onChangeText={setValidUntil}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.helperText}>
                Leave empty for no expiry date
              </Text>
            </View>

            {/* Customer Message */}
            <View style={styles.field}>
              <Text style={styles.label}>Customer Message (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a personal message to the customer..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Internal Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes for your records (not visible to customer)..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Terms */}
            <View style={styles.field}>
              <Text style={styles.label}>Terms & Conditions (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={terms}
                onChangeText={setTerms}
                placeholder="Add terms and conditions..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Padding at bottom for keyboard */}
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveButton: {
    backgroundColor: '#ff4500',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  totalsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  taxInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginLeft: 'auto',
    marginRight: 16,
  },
  taxInput: {
    width: 50,
    paddingVertical: 4,
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'right',
  },
  taxPercent: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 2,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#CBD5E1',
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  totalValueFinal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff4500',
  },
});

export default QuoteBuilder;
