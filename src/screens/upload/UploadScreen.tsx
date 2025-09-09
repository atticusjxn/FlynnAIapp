import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows } from '../../theme';
import { FlynnCard } from '../../components/ui/FlynnCard';
import { useNavigation } from '@react-navigation/native';

export const UploadScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need camera roll permissions to upload screenshots.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      navigation.navigate('Processing', { imageUri: result.assets[0].uri });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need camera permissions to take photos.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
      navigation.navigate('Processing', { imageUri: result.assets[0].uri });
    }
  };

  const recentScreenshots = [
    { id: '1', uri: null, time: '2 min ago' },
    { id: '2', uri: null, time: '15 min ago' },
    { id: '3', uri: null, time: '1 hour ago' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray700} />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Screenshot</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.instruction}>
        Upload a screenshot of your client conversation and we'll extract the job details automatically
      </Text>

      <TouchableOpacity style={styles.uploadArea} onPress={pickImage} activeOpacity={0.8}>
        <View style={styles.uploadContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
          </View>
          <Text style={styles.uploadTitle}>Choose Image</Text>
          <Text style={styles.uploadSubtitle}>
            Select a screenshot from your gallery
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cameraButton} onPress={takePhoto} activeOpacity={0.7}>
        <Ionicons name="camera-outline" size={24} color={colors.primary} />
        <Text style={styles.cameraButtonText}>Take Photo</Text>
      </TouchableOpacity>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Screenshots</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentScreenshots.map((screenshot) => (
            <TouchableOpacity
              key={screenshot.id}
              style={styles.recentCard}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <View style={styles.recentImagePlaceholder}>
                <Ionicons name="image-outline" size={32} color={colors.gray400} />
              </View>
              <Text style={styles.recentTime}>{screenshot.time}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.tipsSection}>
        <Text style={styles.sectionTitle}>Tips for Best Results</Text>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.tipText}>Include the entire conversation</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.tipText}>Make sure text is clear and readable</Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.tipText}>Include date, time, and location details</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.gray800,
  },
  instruction: {
    ...typography.bodyMedium,
    color: colors.gray600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  uploadArea: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    paddingVertical: spacing.xxl,
    ...shadows.md,
  },
  uploadContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  uploadTitle: {
    ...typography.h3,
    color: colors.gray800,
    marginBottom: spacing.xs,
  },
  uploadSubtitle: {
    ...typography.bodyMedium,
    color: colors.gray500,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    ...shadows.sm,
  },
  cameraButtonText: {
    ...typography.button,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  recentSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.gray700,
    marginBottom: spacing.sm,
  },
  recentCard: {
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  recentImagePlaceholder: {
    width: 80,
    height: 100,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  recentTime: {
    ...typography.caption,
    color: colors.gray500,
  },
  tipsSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: 8,
  },
  tipText: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginLeft: spacing.sm,
    flex: 1,
  },
});