/**
 * Google Business Profile Data Normalization Utilities
 * 
 * Helper functions to transform API responses into consistent application data models
 */

// Types for normalized business data
export interface NormalizedGoogleAccount {
  id: string;
  name: string;
  type: string;
  role: string;
  status: string;
}

export interface NormalizedGoogleLocation {
  id: string;
  name: string;
  placeId?: string;
  address?: NormalizedAddress;
  phoneNumber?: string;
  websiteUrl?: string;
  primaryCategory?: string;
  categories?: string[];
  regularHours?: BusinessHours[];
  specialHours?: SpecialHours[];
  isPrimary: boolean;
  isVerified?: boolean;
  isPublished?: boolean;
  mapsUrl?: string;
  reviewUrl?: string;
}

export interface NormalizedAddress {
  lines: string[];
  locality: string;
  administrativeArea: string;
  postalCode: string;
  countryCode: string;
  formattedAddress: string;
}

export interface BusinessHours {
  openDay: string;
  closeDay: string;
  openTime: string;
  closeTime: string;
}

export interface SpecialHours {
  startDate: {
    year: number;
    month: number;
    day: number;
  };
  openTime: string;
  closeTime: string;
}

/**
 * Normalizes Google account data
 * @param account Raw account data from API
 * @returns Normalized account data
 */
export function normalizeGoogleAccount(account: any): NormalizedGoogleAccount {
  return {
    id: account.name || '',
    name: account.accountName || '',
    type: account.type || '',
    role: account.role || '',
    status: account.state?.status || 'unknown'
  };
}

/**
 * Normalizes Google location data
 * @param location Raw location data from API
 * @param locationDetails Optional detailed location info
 * @param isPrimary Whether this is the primary location
 * @returns Normalized location data
 */
export function normalizeGoogleLocation(
  location: any, 
  locationDetails?: any,
  isPrimary: boolean = false
): NormalizedGoogleLocation {
  // Combine basic location info with details if available
  const combined = {
    ...location,
    ...locationDetails
  };
  
  // Format address if available
  let formattedAddress: NormalizedAddress | undefined;
  
  if (combined.address) {
    formattedAddress = {
      lines: combined.address.addressLines || [],
      locality: combined.address.locality || '',
      administrativeArea: combined.address.administrativeArea || '',
      postalCode: combined.address.postalCode || '',
      countryCode: combined.address.countryCode || '',
      formattedAddress: (combined.address.addressLines || []).join(', ')
    };
  }
  
  // Extract categories
  const categories: string[] = [];
  if (combined.categories?.primaryCategory?.displayName) {
    categories.push(combined.categories.primaryCategory.displayName);
  }
  
  if (combined.categories?.additionalCategories) {
    combined.categories.additionalCategories.forEach((category: any) => {
      if (category.displayName && !categories.includes(category.displayName)) {
        categories.push(category.displayName);
      }
    });
  }
  
  return {
    id: combined.name || '',
    name: combined.title || combined.locationName || '',
    placeId: combined.locationKey?.placeId,
    address: formattedAddress,
    phoneNumber: combined.primaryPhone || combined.phone,
    websiteUrl: combined.websiteUrl || combined.website,
    primaryCategory: combined.categories?.primaryCategory?.displayName || '',
    categories: categories.length > 0 ? categories : undefined,
    regularHours: combined.regularHours?.periods,
    specialHours: combined.specialHours?.specialHourPeriods,
    isPrimary,
    isVerified: combined.locationState?.isVerified,
    isPublished: combined.locationState?.isPublished,
    mapsUrl: combined.metadata?.mapsUrl,
    reviewUrl: combined.metadata?.newReviewUrl
  };
}

/**
 * Formats business hours for display
 * @param hours Business hours from API
 * @returns Formatted business hours for display
 */
export function formatBusinessHours(hours: BusinessHours[]): Record<string, string> {
  const dayMap: Record<string, string> = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday'
  };
  
  const result: Record<string, string> = {};
  
  hours.forEach(period => {
    const openDay = dayMap[period.openDay] || period.openDay;
    const closeDay = dayMap[period.closeDay] || period.closeDay;
    
    // Format time (convert 24h to 12h format)
    const formatTime = (time: string) => {
      if (!time || time === '0000') return 'Closed';
      
      const hours = parseInt(time.substring(0, 2), 10);
      const minutes = time.substring(2, 4);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      
      return `${displayHours}:${minutes} ${period}`;
    };
    
    const openTime = formatTime(period.openTime);
    const closeTime = formatTime(period.closeTime);
    
    // If the open and close days are the same
    if (openDay === closeDay) {
      result[openDay] = `${openTime} - ${closeTime}`;
    } else {
      // For overnight hours
      result[openDay] = `${openTime} - ${closeTime} (next day)`;
    }
  });
  
  // Fill in closed days
  Object.values(dayMap).forEach(day => {
    if (!result[day]) {
      result[day] = 'Closed';
    }
  });
  
  return result;
}

/**
 * Formats special hours for display
 * @param specialHours Special hours from API
 * @returns Formatted special hours for display
 */
export function formatSpecialHours(specialHours: SpecialHours[]): Array<{
  date: string;
  hours: string;
}> {
  return specialHours.map(period => {
    const { year, month, day } = period.startDate;
    const date = new Date(year, month - 1, day);
    
    // Format date (e.g., "Dec 25, 2023")
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Format time
    const formatTime = (time: string) => {
      if (!time || time === '0000') return 'Closed';
      
      const hours = parseInt(time.substring(0, 2), 10);
      const minutes = time.substring(2, 4);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      
      return `${displayHours}:${minutes} ${period}`;
    };
    
    const openTime = formatTime(period.openTime);
    const closeTime = formatTime(period.closeTime);
    
    let hours = 'Closed';
    if (openTime !== 'Closed' && closeTime !== 'Closed') {
      hours = `${openTime} - ${closeTime}`;
    }
    
    return {
      date: formattedDate,
      hours
    };
  });
}

/**
 * Create update mask array from changed fields
 * @param original Original data
 * @param updated Updated data
 * @returns Array of field paths that changed
 */
export function createUpdateMask(original: any, updated: any): string[] {
  const updateMask: string[] = [];
  
  // Helper function to recursively find changed fields
  const findChanges = (origObj: any, newObj: any, path: string = ''): void => {
    // Skip null or undefined objects
    if (!origObj || !newObj) {
      // If one is defined and the other isn't, it's a change
      if ((origObj === null || origObj === undefined) !== (newObj === null || newObj === undefined)) {
        updateMask.push(path);
      }
      return;
    }
    
    // Handle different types
    if (typeof origObj !== typeof newObj) {
      updateMask.push(path);
      return;
    }
    
    // Handle primitives
    if (typeof origObj !== 'object') {
      if (origObj !== newObj) {
        updateMask.push(path);
      }
      return;
    }
    
    // Handle arrays
    if (Array.isArray(origObj) && Array.isArray(newObj)) {
      if (JSON.stringify(origObj) !== JSON.stringify(newObj)) {
        updateMask.push(path);
      }
      return;
    }
    
    // Handle objects recursively
    const allKeys = new Set([...Object.keys(origObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      
      // Skip internal properties or functions
      if (key.startsWith('_') || typeof origObj[key] === 'function' || typeof newObj[key] === 'function') {
        continue;
      }
      
      // Recursively check nested objects
      findChanges(origObj[key], newObj[key], newPath);
    }
  };
  
  findChanges(original, updated);
  return updateMask;
}

/**
 * Creates Google Business Profile API formatters
 * Common formatters for API requests
 */
export const googleFormatters = {
  /**
   * Formats address for API
   * @param address Address data
   * @returns Formatted address for API
   */
  formatAddress(address: {
    lines: string[];
    locality: string;
    region: string;
    postalCode: string;
    country: string;
  }) {
    return {
      addressLines: address.lines,
      locality: address.locality,
      administrativeArea: address.region,
      postalCode: address.postalCode,
      countryCode: address.country
    };
  },
  
  /**
   * Formats business hours for API
   * @param hours Hours data in app format
   * @returns Formatted hours for API
   */
  formatBusinessHours(hours: Record<string, { open: string; close: string }>) {
    const periods: any[] = [];
    const dayMapping: Record<string, string> = {
      'monday': 'MONDAY',
      'tuesday': 'TUESDAY',
      'wednesday': 'WEDNESDAY',
      'thursday': 'THURSDAY',
      'friday': 'FRIDAY',
      'saturday': 'SATURDAY',
      'sunday': 'SUNDAY'
    };
    
    // Helper to format time from "HH:MM AM/PM" to "HHMM"
    const formatTime = (timeStr: string) => {
      if (!timeStr || timeStr.toLowerCase() === 'closed') return '0000';
      
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':');
      
      let hour = parseInt(hours, 10);
      
      // Convert to 24-hour format
      if (period && period.toUpperCase() === 'PM' && hour < 12) {
        hour += 12;
      } else if (period && period.toUpperCase() === 'AM' && hour === 12) {
        hour = 0;
      }
      
      return `${hour.toString().padStart(2, '0')}${minutes}`;
    };
    
    // Create periods for each day
    Object.entries(hours).forEach(([day, times]) => {
      const normalizedDay = day.toLowerCase();
      
      if (!dayMapping[normalizedDay]) return;
      
      const apiDay = dayMapping[normalizedDay];
      
      // Skip closed days
      if (times.open.toLowerCase() === 'closed' || times.close.toLowerCase() === 'closed') {
        return;
      }
      
      periods.push({
        openDay: apiDay,
        openTime: formatTime(times.open),
        closeDay: apiDay,
        closeTime: formatTime(times.close)
      });
    });
    
    return {
      periods
    };
  },
  
  /**
   * Formats service area for API
   * @param businessType 'LOCATION' or 'SERVICE_AREA'
   * @param radius Service radius in kilometers (for SERVICE_AREA type)
   * @returns Formatted service area for API
   */
  formatServiceArea(businessType: 'LOCATION' | 'SERVICE_AREA', radius?: number) {
    return {
      businessType,
      ...(businessType === 'SERVICE_AREA' && radius ? {
        radius: {
          radiusKm: radius
        }
      } : {})
    };
  }
};