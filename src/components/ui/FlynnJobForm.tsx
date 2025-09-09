import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnInput } from './FlynnInput';

export interface JobFormData {
  // Common fields
  clientName: string;
  phone: string;
  date: string;
  time: string;
  notes: string;
  
  // Home & Property Services
  propertyAddress?: string;
  homeServiceType?: string;
  issueDescription?: string;
  estimatedDuration?: string;
  accessInstructions?: string;
  materialsNeeded?: string;
  urgencyLevel?: 'Low' | 'Medium' | 'High';
  
  // Beauty & Personal Services
  beautyServiceType?: string;
  appointmentDuration?: string;
  clientPreferences?: string;
  isRecurring?: boolean;
  nextAppointment?: string;
  specialRequirements?: string;
  
  // Moving & Delivery Services
  pickupAddress?: string;
  deliveryAddress?: string;
  itemDescription?: string;
  vehicleRequired?: string;
  crewSize?: string;
  pickupAccessRequirements?: string;
  deliveryAccessRequirements?: string;
  
  // Automotive Services
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  serviceLocation?: string;
  issueDescriptionAuto?: string;
  diagnosticCodes?: string;
  partsRequired?: string;
  mileage?: string;
  
  // Professional Services
  projectTitle?: string;
  meetingLocation?: string;
  meetingType?: 'In-Person' | 'Video' | 'Phone';
  projectScope?: string;
  deliverables?: string;
  estimatedHours?: string;
  followupRequired?: boolean;
  priorityLevel?: 'Low' | 'Medium' | 'High';
}

interface FlynnJobFormProps {
  businessType: string;
  initialData: Partial<JobFormData>;
  onDataChange: (data: JobFormData) => void;
  onValidationChange?: (isValid: boolean) => void;
}

// Dropdown options for different business types
const serviceOptions = {
  home_property: [
    'Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Roofing', 
    'Landscaping', 'Cleaning', 'Painting', 'Handyman', 'Other'
  ],
  personal_beauty: [
    'Cut & Style', 'Color', 'Treatment', 'Manicure', 'Pedicure',
    'Facial', 'Massage', 'Makeup', 'Other'
  ],
  automotive: [
    'Oil Change', 'Brake Service', 'Engine Repair', 'Transmission',
    'Electrical', 'Bodywork', 'Diagnostics', 'Maintenance', 'Other'
  ],
  business_professional: [
    'Consulting', 'Design', 'Marketing', 'Legal', 'Accounting',
    'IT Support', 'Training', 'Project Management', 'Other'
  ],
  moving_delivery: [
    'Residential Move', 'Commercial Move', 'Delivery', 'Storage',
    'Packing', 'Loading/Unloading', 'Other'
  ]
};

const urgencyOptions = ['Low', 'Medium', 'High'];
const priorityOptions = ['Low', 'Medium', 'High'];

interface DropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const FlynnDropdown: React.FC<DropdownProps> = ({ 
  label, 
  value, 
  options, 
  onSelect, 
  placeholder = 'Select option',
  required = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.dropdownContainer}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.dropdownButton, isOpen && styles.dropdownButtonOpen]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={[styles.dropdownText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Ionicons 
          name={isOpen ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={colors.gray500} 
        />
      </TouchableOpacity>
      
      {isOpen && (
        <View style={styles.dropdownOptions}>
          <ScrollView 
            style={styles.dropdownScrollView}
            contentContainerStyle={styles.dropdownScrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            scrollEnabled={true}
            directionalLockEnabled={true}
          >
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownOption,
                  value === option && styles.selectedOption
                ]}
                onPress={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dropdownOptionText,
                  value === option && styles.selectedOptionText
                ]}>
                  {option}
                </Text>
                {value === option && (
                  <Ionicons name="checkmark" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export const FlynnJobForm: React.FC<FlynnJobFormProps> = ({
  businessType,
  initialData,
  onDataChange,
  onValidationChange,
}) => {
  const [formData, setFormData] = useState<JobFormData>({
    clientName: initialData.clientName || '',
    phone: initialData.phone || '',
    date: initialData.date || '',
    time: initialData.time || '',
    notes: initialData.notes || '',
    ...initialData,
  });

  useEffect(() => {
    onDataChange(formData);
    
    // Basic validation - check required fields
    const isValid = validateForm();
    onValidationChange?.(isValid);
  }, [formData, onDataChange, onValidationChange]);

  const validateForm = (): boolean => {
    return !!(formData.clientName && formData.phone && formData.date && formData.time);
  };

  const updateField = (field: keyof JobFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderCommonFields = () => (
    <>
      <FlynnInput
        label="Client Name"
        value={formData.clientName}
        onChangeText={(text) => updateField('clientName', text)}
        placeholder="Enter client name"
        leftIcon={<Ionicons name="person-outline" size={20} color={colors.gray500} />}
        required
      />

      <FlynnInput
        label="Phone Number"
        value={formData.phone}
        onChangeText={(text) => updateField('phone', text)}
        placeholder="+1 (555) 123-4567"
        leftIcon={<Ionicons name="call-outline" size={20} color={colors.gray500} />}
        keyboardType="phone-pad"
        required
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Date"
            value={formData.date}
            onChangeText={(text) => updateField('date', text)}
            placeholder="Select date"
            leftIcon={<Ionicons name="calendar-outline" size={20} color={colors.gray500} />}
            required
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Time"
            value={formData.time}
            onChangeText={(text) => updateField('time', text)}
            placeholder="Select time"
            leftIcon={<Ionicons name="time-outline" size={20} color={colors.gray500} />}
            required
          />
        </View>
      </View>
    </>
  );

  const renderHomePropertyFields = () => (
    <>
      <FlynnInput
        label="Property Address"
        value={formData.propertyAddress || ''}
        onChangeText={(text) => updateField('propertyAddress', text)}
        placeholder="Enter property address"
        leftIcon={<Ionicons name="home-outline" size={20} color={colors.gray500} />}
      />

      <FlynnDropdown
        label="Service Type"
        value={formData.homeServiceType || ''}
        options={serviceOptions.home_property}
        onSelect={(value) => updateField('homeServiceType', value)}
        placeholder="Select service type"
        required
      />

      <FlynnInput
        label="Issue Description"
        value={formData.issueDescription || ''}
        onChangeText={(text) => updateField('issueDescription', text)}
        placeholder="Describe the issue or work needed"
        leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Estimated Duration"
            value={formData.estimatedDuration || ''}
            onChangeText={(text) => updateField('estimatedDuration', text)}
            placeholder="e.g., 2 hours"
            leftIcon={<Ionicons name="timer-outline" size={20} color={colors.gray500} />}
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnDropdown
            label="Urgency Level"
            value={formData.urgencyLevel || ''}
            options={urgencyOptions}
            onSelect={(value) => updateField('urgencyLevel', value)}
            placeholder="Select urgency"
          />
        </View>
      </View>

      <FlynnInput
        label="Access Instructions"
        value={formData.accessInstructions || ''}
        onChangeText={(text) => updateField('accessInstructions', text)}
        placeholder="How to access the property"
        leftIcon={<Ionicons name="key-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />

      <FlynnInput
        label="Materials Needed"
        value={formData.materialsNeeded || ''}
        onChangeText={(text) => updateField('materialsNeeded', text)}
        placeholder="List any materials or parts needed"
        leftIcon={<Ionicons name="construct-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />
    </>
  );

  const renderBeautyPersonalFields = () => (
    <>
      <FlynnDropdown
        label="Service Type"
        value={formData.beautyServiceType || ''}
        options={serviceOptions.personal_beauty}
        onSelect={(value) => updateField('beautyServiceType', value)}
        placeholder="Select service type"
        required
      />

      <FlynnInput
        label="Appointment Duration"
        value={formData.appointmentDuration || ''}
        onChangeText={(text) => updateField('appointmentDuration', text)}
        placeholder="e.g., 90 minutes"
        leftIcon={<Ionicons name="timer-outline" size={20} color={colors.gray500} />}
      />

      <FlynnInput
        label="Client Preferences/Notes"
        value={formData.clientPreferences || ''}
        onChangeText={(text) => updateField('clientPreferences', text)}
        placeholder="Hair color, style preferences, allergies, etc."
        leftIcon={<Ionicons name="heart-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              formData.isRecurring && styles.toggleButtonActive
            ]}
            onPress={() => updateField('isRecurring', !formData.isRecurring)}
          >
            <Ionicons 
              name={formData.isRecurring ? "checkbox" : "checkbox-outline"} 
              size={20} 
              color={formData.isRecurring ? colors.primary : colors.gray500} 
            />
            <Text style={[
              styles.toggleText,
              formData.isRecurring && styles.toggleTextActive
            ]}>
              Recurring Appointment
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {formData.isRecurring && (
        <FlynnInput
          label="Next Appointment Suggestion"
          value={formData.nextAppointment || ''}
          onChangeText={(text) => updateField('nextAppointment', text)}
          placeholder="e.g., 6-8 weeks"
          leftIcon={<Ionicons name="calendar-outline" size={20} color={colors.gray500} />}
        />
      )}

      <FlynnInput
        label="Special Requirements"
        value={formData.specialRequirements || ''}
        onChangeText={(text) => updateField('specialRequirements', text)}
        placeholder="Any special accommodations needed"
        leftIcon={<Ionicons name="medical-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />
    </>
  );

  const renderAutomotiveFields = () => (
    <>
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Vehicle Make"
            value={formData.vehicleMake || ''}
            onChangeText={(text) => updateField('vehicleMake', text)}
            placeholder="e.g., Toyota"
            leftIcon={<Ionicons name="car-outline" size={20} color={colors.gray500} />}
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Model"
            value={formData.vehicleModel || ''}
            onChangeText={(text) => updateField('vehicleModel', text)}
            placeholder="e.g., Camry"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Year"
            value={formData.vehicleYear || ''}
            onChangeText={(text) => updateField('vehicleYear', text)}
            placeholder="e.g., 2020"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Mileage"
            value={formData.mileage || ''}
            onChangeText={(text) => updateField('mileage', text)}
            placeholder="e.g., 45,000"
            keyboardType="numeric"
          />
        </View>
      </View>

      <FlynnInput
        label="Service Location"
        value={formData.serviceLocation || ''}
        onChangeText={(text) => updateField('serviceLocation', text)}
        placeholder="Shop address or mobile service location"
        leftIcon={<Ionicons name="location-outline" size={20} color={colors.gray500} />}
      />

      <FlynnInput
        label="Issue Description"
        value={formData.issueDescriptionAuto || ''}
        onChangeText={(text) => updateField('issueDescriptionAuto', text)}
        placeholder="Describe the problem or service needed"
        leftIcon={<Ionicons name="build-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />

      <FlynnInput
        label="Diagnostic Codes (if any)"
        value={formData.diagnosticCodes || ''}
        onChangeText={(text) => updateField('diagnosticCodes', text)}
        placeholder="P0XXX codes if available"
        leftIcon={<Ionicons name="code-working-outline" size={20} color={colors.gray500} />}
      />

      <FlynnInput
        label="Parts Required"
        value={formData.partsRequired || ''}
        onChangeText={(text) => updateField('partsRequired', text)}
        placeholder="List any known parts needed"
        leftIcon={<Ionicons name="settings-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />
    </>
  );

  const renderProfessionalFields = () => (
    <>
      <FlynnInput
        label="Project/Meeting Title"
        value={formData.projectTitle || ''}
        onChangeText={(text) => updateField('projectTitle', text)}
        placeholder="Brief title for the project or meeting"
        leftIcon={<Ionicons name="briefcase-outline" size={20} color={colors.gray500} />}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Meeting Location/Type"
            value={formData.meetingLocation || ''}
            onChangeText={(text) => updateField('meetingLocation', text)}
            placeholder="Address or 'Video Call'"
            leftIcon={<Ionicons name="location-outline" size={20} color={colors.gray500} />}
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnDropdown
            label="Meeting Type"
            value={formData.meetingType || ''}
            options={['In-Person', 'Video', 'Phone']}
            onSelect={(value) => updateField('meetingType', value)}
            placeholder="Select type"
          />
        </View>
      </View>

      <FlynnInput
        label="Project Scope"
        value={formData.projectScope || ''}
        onChangeText={(text) => updateField('projectScope', text)}
        placeholder="Brief overview of the project scope"
        leftIcon={<Ionicons name="document-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />

      <FlynnInput
        label="Deliverables"
        value={formData.deliverables || ''}
        onChangeText={(text) => updateField('deliverables', text)}
        placeholder="What will be delivered to the client"
        leftIcon={<Ionicons name="checkmark-done-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Estimated Hours"
            value={formData.estimatedHours || ''}
            onChangeText={(text) => updateField('estimatedHours', text)}
            placeholder="e.g., 8 hours"
            leftIcon={<Ionicons name="timer-outline" size={20} color={colors.gray500} />}
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnDropdown
            label="Priority Level"
            value={formData.priorityLevel || ''}
            options={priorityOptions}
            onSelect={(value) => updateField('priorityLevel', value)}
            placeholder="Select priority"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              formData.followupRequired && styles.toggleButtonActive
            ]}
            onPress={() => updateField('followupRequired', !formData.followupRequired)}
          >
            <Ionicons 
              name={formData.followupRequired ? "checkbox" : "checkbox-outline"} 
              size={20} 
              color={formData.followupRequired ? colors.primary : colors.gray500} 
            />
            <Text style={[
              styles.toggleText,
              formData.followupRequired && styles.toggleTextActive
            ]}>
              Follow-up Required
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const renderMovingDeliveryFields = () => (
    <>
      <FlynnDropdown
        label="Service Type"
        value={formData.homeServiceType || ''}
        options={serviceOptions.moving_delivery}
        onSelect={(value) => updateField('homeServiceType', value)}
        placeholder="Select service type"
        required
      />

      <FlynnInput
        label="Pickup Address"
        value={formData.pickupAddress || ''}
        onChangeText={(text) => updateField('pickupAddress', text)}
        placeholder="Enter pickup address"
        leftIcon={<Ionicons name="location-outline" size={20} color={colors.gray500} />}
      />

      <FlynnInput
        label="Delivery Address"
        value={formData.deliveryAddress || ''}
        onChangeText={(text) => updateField('deliveryAddress', text)}
        placeholder="Enter delivery address"
        leftIcon={<Ionicons name="navigate-outline" size={20} color={colors.gray500} />}
      />

      <FlynnInput
        label="Item Description/Inventory"
        value={formData.itemDescription || ''}
        onChangeText={(text) => updateField('itemDescription', text)}
        placeholder="Describe items to be moved or delivered"
        leftIcon={<Ionicons name="list-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Vehicle Required"
            value={formData.vehicleRequired || ''}
            onChangeText={(text) => updateField('vehicleRequired', text)}
            placeholder="e.g., Moving Truck, Van"
            leftIcon={<Ionicons name="car-outline" size={20} color={colors.gray500} />}
          />
        </View>
        <View style={styles.halfInput}>
          <FlynnInput
            label="Crew Size Needed"
            value={formData.crewSize || ''}
            onChangeText={(text) => updateField('crewSize', text)}
            placeholder="e.g., 2-3 people"
            keyboardType="numeric"
          />
        </View>
      </View>

      <FlynnInput
        label="Pickup Access Requirements"
        value={formData.pickupAccessRequirements || ''}
        onChangeText={(text) => updateField('pickupAccessRequirements', text)}
        placeholder="Stairs, elevator, parking, etc."
        leftIcon={<Ionicons name="home-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />

      <FlynnInput
        label="Delivery Access Requirements"
        value={formData.deliveryAccessRequirements || ''}
        onChangeText={(text) => updateField('deliveryAccessRequirements', text)}
        placeholder="Stairs, elevator, parking, etc."
        leftIcon={<Ionicons name="business-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={2}
      />
    </>
  );

  const renderBusinessSpecificFields = () => {
    switch (businessType) {
      case 'home_property':
        return renderHomePropertyFields();
      case 'personal_beauty':
        return renderBeautyPersonalFields();
      case 'automotive':
        return renderAutomotiveFields();
      case 'business_professional':
        return renderProfessionalFields();
      case 'moving_delivery':
        return renderMovingDeliveryFields();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderCommonFields()}
      {renderBusinessSpecificFields()}
      
      <FlynnInput
        label="Additional Notes"
        value={formData.notes}
        onChangeText={(text) => updateField('notes', text)}
        placeholder="Any additional notes about the job"
        leftIcon={<Ionicons name="document-text-outline" size={20} color={colors.gray500} />}
        multiline
        numberOfLines={3}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  row: {
    flexDirection: 'row',
    marginHorizontal: -spacing.xs,
  },
  
  halfInput: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  
  // Dropdown styles
  dropdownContainer: {
    marginBottom: spacing.md,
    position: 'relative',
  },
  
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  
  required: {
    color: colors.error,
  },
  
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  
  dropdownButtonOpen: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
  },
  
  dropdownText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  
  placeholderText: {
    color: colors.textPlaceholder,
  },
  
  dropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
    marginTop: spacing.xxs,
    maxHeight: 180,
    zIndex: 1000,
  },
  
  dropdownScrollView: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  
  dropdownScrollContent: {
    flexGrow: 1,
  },
  
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    backgroundColor: colors.white,
  },
  
  selectedOption: {
    backgroundColor: colors.primaryLight,
  },
  
  dropdownOptionText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  
  selectedOptionText: {
    color: colors.primary,
    fontWeight: '600',
  },
  
  // Toggle button styles
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  
  toggleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  
  toggleText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  
  toggleTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});