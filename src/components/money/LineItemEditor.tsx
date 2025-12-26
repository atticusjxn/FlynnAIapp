// Line Item Editor Component
// Editable line items for quotes and invoices

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineItem } from '../../types/quote';

interface LineItemEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  editable?: boolean;
}

const LineItemEditor: React.FC<LineItemEditorProps> = ({ items, onChange, editable = true }) => {
  const addItem = () => {
    const newItem: LineItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    };
    onChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Recalculate total for this line item
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const unit_price = field === 'unit_price' ? Number(value) : newItems[index].unit_price;
      newItems[index].total = quantity * unit_price;
    }

    onChange(newItems);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Line Items</Text>
        {editable && (
          <TouchableOpacity onPress={addItem} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color="#ff4500" />
            <Text style={styles.addButtonText}>Add Item</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, !editable && styles.inputDisabled]}
              value={item.description}
              onChangeText={(text) => updateItem(index, 'description', text)}
              placeholder="Service or product description"
              placeholderTextColor="#94A3B8"
              editable={editable}
              multiline
            />
          </View>

          {/* Quantity and Unit Price */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Qty</Text>
              <TextInput
                style={[styles.input, !editable && styles.inputDisabled]}
                value={String(item.quantity)}
                onChangeText={(text) => updateItem(index, 'quantity', Number(text) || 0)}
                placeholder="1"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                editable={editable}
              />
            </View>

            <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Unit Price</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.priceInput, !editable && styles.inputDisabled]}
                  value={String(item.unit_price.toFixed(2))}
                  onChangeText={(text) => updateItem(index, 'unit_price', parseFloat(text) || 0)}
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  editable={editable}
                />
              </View>
            </View>

            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Total</Text>
              <View style={styles.totalContainer}>
                <Text style={styles.totalText}>${item.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Remove button */}
          {editable && items.length > 1 && (
            <TouchableOpacity
              onPress={() => removeItem(index)}
              style={styles.removeButton}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {items.length === 0 && editable && (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No line items yet</Text>
          <Text style={styles.emptySubtext}>Add items to build your quote or invoice</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4500',
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
  },
  currencySymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  totalContainer: {
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    textAlign: 'right',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default LineItemEditor;
