import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import type { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { FlynnIcon } from '../ui/FlynnIcon';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { FlynnButton } from '../ui/FlynnButton';
import { FlynnKeyboardAvoidingView } from '../ui/FlynnKeyboardAvoidingView';
import { FlynnKeyboardAwareScrollView } from '../ui/FlynnKeyboardAwareScrollView';
import { Job } from './JobCard';

type CommunicationType = 'text' | 'email';

interface CommunicationModalProps {
  job: Job | null;
  visible: boolean;
  type: CommunicationType;
  onClose: () => void;
  onSend: (job: Job, message: string, type: CommunicationType) => Promise<void>;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (timeString: string) => {
  try {
    const time = new Date(`1970-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return timeString;
  }
};

const generateDefaultMessage = (job: Job, type: CommunicationType): string => {
  const date = formatDate(job.date);
  const time = formatTime(job.time);
  
  if (type === 'text') {
    if (job.followUpDraft) {
      return job.followUpDraft;
    }
    return `Hi ${job.clientName}! This is a confirmation for your ${job.serviceType.toLowerCase()} service appointment.\n\n📅 Date: ${date}\n⏰ Time: ${time}\n📍 Location: ${job.location}\n\nWe'll see you then! Reply STOP to opt out.`;
  } else {
    return `Dear ${job.clientName},

This email confirms your upcoming service appointment:

Service: ${job.serviceType}
Date: ${date}
Time: ${time}
Location: ${job.location}

${job.description ? `Details: ${job.description}` : ''}

We look forward to serving you. If you need to make any changes, please contact us as soon as possible.

Best regards,
Your Service Team`;
  }
};

export const CommunicationModal: React.FC<CommunicationModalProps> = ({
  job,
  visible,
  type,
  onClose,
  onSend,
}) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageSectionOffset, setMessageSectionOffset] = useState(0);
  const scrollViewRef = React.useRef<KeyboardAwareScrollView | null>(null);

  React.useEffect(() => {
    if (job && visible) {
      setMessage(generateDefaultMessage(job, type));
    }
  }, [job, type, visible]);

  if (!job) return null;

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message before sending.');
      return;
    }

    setIsLoading(true);
    try {
      await onSend(job, message, type);
      onClose();
      Alert.alert(
        'Success',
        `${type === 'text' ? 'Text message' : 'Email'} sent successfully to ${job.clientName}!`
      );
    } catch (error) {
      Alert.alert('Error', `Failed to send ${type}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    return type === 'text' ? 'Send Text Confirmation' : 'Send Email Confirmation';
  };

  const getIcon = () => {
    return type === 'text' ? 'chatbubble-outline' : 'mail-outline';
  };

  const getRecipientLabel = () => {
    return type === 'text' ? job.clientPhone : job.clientEmail || 'No email address';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <FlynnKeyboardAvoidingView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <FlynnIcon 
              name={getIcon() as any} 
              size={24} 
              color={colors.primary} 
            />
            <Text style={styles.modalTitle}>{getTitle()}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <FlynnIcon name="close" size={24} color={colors.gray600} />
          </TouchableOpacity>
        </View>

        <FlynnKeyboardAwareScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Recipient Info */}
          <View style={styles.recipientSection}>
            <Text style={styles.sectionTitle}>Sending to:</Text>
            <View style={styles.recipientInfo}>
              <Text style={styles.clientName}>{job.clientName}</Text>
              <Text style={styles.recipientContact}>{getRecipientLabel()}</Text>
            </View>
          </View>

          {/* Event Summary */}
          <View style={styles.jobSummary}>
            <Text style={styles.sectionTitle}>Event Summary:</Text>
            <Text style={styles.jobDetails}>
              {job.serviceType} • {formatDate(job.date)} at {formatTime(job.time)}
            </Text>
            <Text style={styles.jobLocation}>{job.location}</Text>
          </View>

          {/* Message Editor */}
          <View
            style={styles.messageSection}
            onLayout={(event) => {
              setMessageSectionOffset(event.nativeEvent.layout.y);
            }}
          >
            <Text style={styles.sectionTitle}>Message:</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={type === 'text' ? 8 : 12}
              placeholder={`Enter your ${type} message...`}
              placeholderTextColor={colors.textPlaceholder}
              textAlignVertical="top"
              onFocus={() => {
                const targetOffset = Math.max(messageSectionOffset - spacing.lg, 0);
                scrollViewRef.current?.scrollTo({ y: targetOffset, animated: true });
              }}
            />
            <Text style={styles.characterCount}>
              {message.length} characters
              {type === 'text' && message.length > 160 && 
                ` (${Math.ceil(message.length / 160)} messages)`
              }
            </Text>
          </View>
        </FlynnKeyboardAwareScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <FlynnButton
            title="Cancel"
            onPress={onClose}
            variant="secondary"
            size="large"
            style={styles.cancelButton}
          />

          <FlynnButton
            title={isLoading ? "Sending..." : `Send ${type === 'text' ? 'Text' : 'Email'}`}
            onPress={handleSend}
            variant="primary"
            size="large"
            icon={
              isLoading ? 
                undefined : 
                <FlynnIcon 
                  name="send-outline" 
                  size={18} 
                  color={colors.white} 
                />
            }
            loading={isLoading}
            disabled={isLoading || !message.trim()}
            style={styles.sendButton}
          />
        </View>
      </FlynnKeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  
  closeButton: {
    padding: spacing.xs,
  },
  
  content: {
    flex: 1,
  },

  contentContainer: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  
  recipientSection: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  
  jobSummary: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  
  messageSection: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    flex: 1,
  },
  
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  
  recipientInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  clientName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  
  recipientContact: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '500',
  },
  
  jobDetails: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  
  jobLocation: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  
  messageInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    marginBottom: spacing.sm,
  },
  
  characterCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  
  actionContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: spacing.sm,
  },
  
  cancelButton: {
    flex: 1,
  },
  
  sendButton: {
    flex: 2,
  },
});
