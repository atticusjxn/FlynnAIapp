import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { FlynnIcon } from '../ui/FlynnIcon';
import { FlynnInput } from '../ui/FlynnInput';
import { FlynnButton } from '../ui/FlynnButton';
import { spacing, typography, borderRadius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import ReceptionistService, { BusinessSearchResult, BusinessContext } from '../../services/ReceptionistService';

interface BusinessContextCardProps {
  onContextUpdated?: (context: BusinessContext) => void;
}

export const BusinessContextCard: React.FC<BusinessContextCardProps> = ({ onContextUpdated }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BusinessSearchResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSearchResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  // Load existing business context and request location on mount
  useEffect(() => {
    loadBusinessContext();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        console.log('[BusinessContext] Location obtained:', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('[BusinessContext] Failed to get location:', error);
    }
  };

  const loadBusinessContext = async () => {
    try {
      setIsLoadingContext(true);
      const context = await ReceptionistService.getBusinessContext();
      if (context && context.business_context) {
        setBusinessContext(context.business_context);
      }
    } catch (error) {
      console.error('[BusinessContext] Failed to load context:', error);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleSearch = async () => {
    if (!businessName.trim()) {
      Alert.alert('Required', 'Please enter your business name');
      return;
    }

    try {
      setIsSearching(true);
      setSearchResults([]);
      setSelectedBusiness(null);

      // Use current location if available, otherwise use manual location input
      const searchLocation = userLocation || undefined;

      console.log('[BusinessSearch] Searching with:', {
        businessName,
        location,
        userLocation: searchLocation,
      });

      const results = await ReceptionistService.searchBusinesses(
        businessName,
        location,
        searchLocation?.latitude,
        searchLocation?.longitude
      );

      if (results.length === 0) {
        Alert.alert(
          'No Results',
          'No businesses found. Try adjusting your search terms or enter a more specific location.'
        );
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      console.error('[BusinessSearch] Search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search for businesses. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBusiness = async (business: BusinessSearchResult) => {
    setSelectedBusiness(business);

    // If business has a URL, extract context automatically
    if (business.url) {
      try {
        setIsExtracting(true);
        const context = await ReceptionistService.extractBusinessContext(business.url);
        setBusinessContext(context);
        setSearchResults([]); // Clear search results
        onContextUpdated?.(context);

        Alert.alert(
          'Success!',
          `Business information extracted for ${context.businessName}. Your AI receptionist now knows about your services!`
        );
      } catch (error) {
        console.error('[BusinessContext] Extraction failed:', error);
        Alert.alert('Error', 'Failed to extract business information. Please try again.');
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleClearContext = () => {
    Alert.alert(
      'Clear Business Info',
      'Are you sure you want to clear your business information? This will affect how your AI receptionist answers questions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setBusinessContext(null);
            setBusinessName('');
            setLocation('');
            setSearchResults([]);
            setSelectedBusiness(null);
          },
        },
      ]
    );
  };

  if (isLoadingContext) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Business Information</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>Business Information</Text>
          <Text style={styles.cardHint}>
            Help your AI receptionist answer questions about your services
          </Text>
        </View>
        {businessContext && (
          <TouchableOpacity onPress={handleClearContext} style={styles.clearButton}>
            <FlynnIcon name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {businessContext ? (
        // Display existing business context
        <View style={styles.contextDisplay}>
          <View style={styles.contextHeader}>
            <FlynnIcon name="checkmark-circle" size={24} color={colors.success} />
            <Text style={styles.contextTitle}>{businessContext.businessName}</Text>
          </View>

          {businessContext.businessType && (
            <View style={styles.contextRow}>
              <FlynnIcon name="business-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.contextLabel}>Type:</Text>
              <Text style={styles.contextValue}>{businessContext.businessType}</Text>
            </View>
          )}

          {businessContext.services && businessContext.services.length > 0 && (
            <View style={styles.contextRow}>
              <FlynnIcon name="construct-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.contextLabel}>Services:</Text>
              <Text style={styles.contextValue}>
                {businessContext.services.slice(0, 3).join(', ')}
                {businessContext.services.length > 3 && ` +${businessContext.services.length - 3} more`}
              </Text>
            </View>
          )}

          <View style={styles.contextInfo}>
            <FlynnIcon name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.contextInfoText}>
              Your AI receptionist can now answer questions about your services intelligently
            </Text>
          </View>
        </View>
      ) : (
        // Search interface
        <>
          <FlynnInput
            label="Business Name"
            placeholder="e.g., ABC Construction"
            value={businessName}
            onChangeText={setBusinessName}
            containerStyle={styles.input}
          />

          <FlynnInput
            label="Location (Optional)"
            placeholder="e.g., Sydney, Melbourne"
            value={location}
            onChangeText={setLocation}
            containerStyle={styles.input}
          />

          <FlynnButton
            title={isSearching ? 'Searching...' : 'Search for My Business'}
            onPress={handleSearch}
            disabled={isSearching || !businessName.trim()}
            loading={isSearching}
            style={styles.searchButton}
          />

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Select your business:</Text>
              {searchResults.map((business, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => handleSelectBusiness(business)}
                  disabled={isExtracting}
                >
                  <View style={styles.resultContent}>
                    <Text style={styles.resultName}>{business.name}</Text>
                    {business.address && (
                      <Text style={styles.resultAddress}>{business.address}</Text>
                    )}
                    <View style={styles.resultMeta}>
                      {business.rating && (
                        <View style={styles.resultRating}>
                          <FlynnIcon name="star" size={14} color={colors.warning} />
                          <Text style={styles.resultRatingText}>
                            {business.rating.toFixed(1)}
                          </Text>
                        </View>
                      )}
                      {business.businessType && (
                        <Text style={styles.resultType}>• {business.businessType}</Text>
                      )}
                    </View>
                  </View>
                  <FlynnIcon
                    name="chevron-forward"
                    size={20}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isExtracting && (
            <View style={styles.extractingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.extractingText}>
                Extracting business information...
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.white,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    cardHeaderText: {
      flex: 1,
    },
    cardTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      marginBottom: spacing.xxs,
    },
    cardHint: {
      ...typography.bodySmall,
      color: colors.textSecondary,
    },
    clearButton: {
      padding: spacing.xs,
    },
    input: {
      marginBottom: spacing.md,
    },
    searchButton: {
      marginTop: spacing.sm,
    },
    resultsContainer: {
      marginTop: spacing.lg,
    },
    resultsTitle: {
      ...typography.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.gray50,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultContent: {
      flex: 1,
    },
    resultName: {
      ...typography.bodyMedium,
      color: colors.textPrimary,
      fontWeight: '600',
      marginBottom: spacing.xxxs,
    },
    resultAddress: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      marginBottom: spacing.xxs,
    },
    resultMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    resultRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxxs,
    },
    resultRatingText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    resultType: {
      ...typography.caption,
      color: colors.textTertiary,
    },
    extractingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    extractingText: {
      ...typography.bodyMedium,
      color: colors.textSecondary,
    },
    contextDisplay: {
      marginTop: spacing.sm,
    },
    contextHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contextTitle: {
      ...typography.h4,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    contextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    contextLabel: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      fontWeight: '500',
      minWidth: 60,
    },
    contextValue: {
      ...typography.bodySmall,
      color: colors.textPrimary,
      flex: 1,
    },
    contextInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.primaryLight,
      borderRadius: borderRadius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    contextInfoText: {
      ...typography.bodySmall,
      color: colors.textSecondary,
      flex: 1,
    },
    loadingContainer: {
      padding: spacing.xl,
      alignItems: 'center',
    },
  });
