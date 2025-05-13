/**
 * Google Business Profile Service
 * 
 * Handles interaction with the Google Business Profile API
 */

import axios from 'axios';
import { GoogleOAuthService } from './oauth-service';

// Base URLs for different Google Business Profile APIs
const API_URLS = {
  accountManagement: 'https://mybusinessaccountmanagement.googleapis.com/v1',
  businessInformation: 'https://mybusinessinformation.googleapis.com/v1',
  mybusiness: 'https://mybusiness.googleapis.com/v4', // Legacy API still used for some endpoints
};

// Types for API responses
interface GoogleAccount {
  name: string;
  accountName: string;
  type: string;
  role: string;
  state: {
    status: string;
  };
}

interface GoogleAccountsResponse {
  accounts: GoogleAccount[];
}

interface GoogleLocation {
  name: string;
  title: string;
  storeCode?: string;
  locationKey?: {
    placeId: string;
  };
  locationState?: {
    isVerified: boolean;
    isPublished: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
  metadata?: {
    mapsUrl: string;
    newReviewUrl: string;
  };
  categories?: {
    primaryCategory: {
      displayName: string;
      categoryId: string;
    };
  };
}

interface GoogleLocationsResponse {
  locations: GoogleLocation[];
  nextPageToken?: string;
  totalSize?: number;
}

interface GoogleLocationDetails {
  name: string;
  title: string;
  primaryPhone?: string;
  websiteUrl?: string;
  regularHours?: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
  address?: {
    addressLines: string[];
    locality: string;
    administrativeArea: string;
    postalCode: string;
    countryCode: string;
  };
  specialHours?: {
    specialHourPeriods: Array<{
      startDate: {
        year: number;
        month: number;
        day: number;
      };
      openTime: string;
      closeTime: string;
    }>;
  };
  serviceArea?: {
    businessType: string;
    radius?: {
      radiusKm: number;
    };
    places?: {
      placeInfos: Array<{
        name: string;
      }>;
    };
  };
  attributes?: Array<{
    attributeId: string;
    valueType: string;
    values: string[];
  }>;
}

interface ApiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      type: string;
      detail: string;
    }>;
  };
}

export class GoogleBusinessProfileService {
  private oauthService: GoogleOAuthService;
  private accessToken?: string;
  
  /**
   * Creates a new instance of the GoogleBusinessProfileService
   * @param accessToken Optional access token to use for requests
   */
  constructor(accessToken?: string) {
    this.oauthService = new GoogleOAuthService();
    this.accessToken = accessToken;
  }
  
  /**
   * Gets a valid access token for API requests
   * @param userId User ID
   * @param businessId Business ID
   * @returns Access token
   */
  private async getToken(userId?: string, businessId?: string): Promise<string> {
    // If an access token was provided in the constructor, use it
    if (this.accessToken) {
      return this.accessToken;
    }
    
    // Otherwise, get a token from the OAuth service
    if (!userId || !businessId) {
      throw new Error('userId and businessId are required when no access token is provided');
    }
    
    return await this.oauthService.getAccessToken(userId, businessId);
  }
  
  /**
   * Makes an authenticated request to the Google Business Profile API
   * @param method HTTP method
   * @param url API endpoint URL
   * @param userId User ID (optional if access token was provided in constructor)
   * @param businessId Business ID (optional if access token was provided in constructor)
   * @param data Request body for POST/PATCH/PUT requests
   * @param params URL query parameters
   * @returns API response data
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    userId?: string,
    businessId?: string,
    data?: any,
    params?: Record<string, string>
  ): Promise<T> {
    try {
      // Get a valid access token
      const accessToken = await this.getToken(userId, businessId);
      
      // Make the request
      const response = await axios({
        method,
        url,
        data,
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Goog-Api-Client': 'Social-Genius/1.0.0', // Identify our application to Google
        },
        validateStatus: (status) => {
          // Consider only 5xx status codes as errors
          // For 4xx errors, we want to handle them gracefully
          return status < 500;
        },
      });
      
      // Handle non-success responses
      if (response.status >= 400) {
        const errorResponse = response.data as ApiErrorResponse;
        
        // Format error message with details if available
        let errorMessage = `API error: ${errorResponse.error?.message || 'Unknown error'}`;
        if (errorResponse.error?.details?.length) {
          errorMessage += ` - ${errorResponse.error.details[0].detail}`;
        }
        
        throw new Error(errorMessage);
      }
      
      return response.data as T;
    } catch (error) {
      // Format axios errors for better debugging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('API error response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
        
        // Try to extract error details
        const errorResponse = error.response.data as ApiErrorResponse;
        let errorMessage = `API error (${error.response.status}): ${
          errorResponse.error?.message || 'Unknown error'
        }`;
        
        if (errorResponse.error?.details?.length) {
          errorMessage += ` - ${errorResponse.error.details[0].detail}`;
        }
        
        throw new Error(errorMessage);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('API request error (no response):', error.request);
        throw new Error('No response received from API');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('API request setup error:', error.message);
        throw error;
      }
    }
  }
  
  /**
   * Gets Google Business Profile accounts associated with the authenticated user
   * @param userId User ID
   * @param businessId Business ID
   * @returns Google accounts data
   */
  async getAccounts(
    userId?: string,
    businessId?: string
  ): Promise<GoogleAccountsResponse> {
    const url = `${API_URLS.accountManagement}/accounts`;
    return this.request<GoogleAccountsResponse>('GET', url, userId, businessId);
  }
  
  /**
   * Gets locations for a Google Business Profile account
   * @param accountId Account ID (in format "accounts/{accountId}")
   * @param userId User ID
   * @param businessId Business ID
   * @param pageSize Number of locations to fetch (default: 100)
   * @param pageToken Token for pagination
   * @returns Google locations data
   */
  async getLocations(
    accountId: string,
    userId?: string,
    businessId?: string,
    pageSize: number = 100,
    pageToken?: string
  ): Promise<GoogleLocationsResponse> {
    const url = `${API_URLS.accountManagement}/${accountId}/locations`;
    const params: Record<string, string> = {
      pageSize: pageSize.toString(),
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    return this.request<GoogleLocationsResponse>('GET', url, userId, businessId, undefined, params);
  }
  
  /**
   * Gets detailed information about a specific location
   * @param locationName Location name (in format "accounts/{accountId}/locations/{locationId}")
   * @param userId User ID
   * @param businessId Business ID
   * @returns Location details
   */
  async getLocationDetails(
    locationName: string,
    userId?: string,
    businessId?: string
  ): Promise<GoogleLocationDetails> {
    const url = `${API_URLS.businessInformation}/${locationName}`;
    return this.request<GoogleLocationDetails>('GET', url, userId, businessId);
  }
  
  /**
   * Updates information for a specific location
   * @param locationName Location name (in format "accounts/{accountId}/locations/{locationId}")
   * @param updateData Data to update
   * @param updateMask Fields to update (comma-separated)
   * @param userId User ID
   * @param businessId Business ID
   * @returns Updated location details
   */
  async updateLocationDetails(
    locationName: string,
    updateData: Partial<GoogleLocationDetails>,
    updateMask: string[],
    userId?: string,
    businessId?: string
  ): Promise<GoogleLocationDetails> {
    const url = `${API_URLS.businessInformation}/${locationName}`;
    const params = {
      updateMask: updateMask.join(','),
    };
    
    return this.request<GoogleLocationDetails>(
      'PATCH',
      url,
      userId,
      businessId,
      updateData,
      params
    );
  }
  
  /**
   * Gets all locations for a business ID by querying the database
   * @param userId User ID
   * @param businessId Business ID
   * @returns All Google Business Profile locations for this business
   */
  async getAllBusinessLocations(
    userId: string,
    businessId: string
  ): Promise<GoogleLocation[]> {
    try {
      // First get account ID from database
      const db = DatabaseService.getInstance();
      
      const accountResult = await db.query(
        'SELECT google_account_id FROM google_business_accounts WHERE business_id = $1',
        [businessId]
      );
      
      if (!accountResult || !accountResult.rows || accountResult.rows.length === 0) {
        throw new Error('No Google Business account found for this business');
      }
      
      const accountId = accountResult.rows[0].google_account_id;
      
      // Now get all locations from the API with pagination
      let allLocations: GoogleLocation[] = [];
      let nextPageToken: string | undefined;
      
      do {
        const locationsResponse = await this.getLocations(
          accountId,
          userId,
          businessId,
          100,
          nextPageToken
        );
        
        if (locationsResponse.locations) {
          allLocations = [...allLocations, ...locationsResponse.locations];
        }
        
        nextPageToken = locationsResponse.nextPageToken;
      } while (nextPageToken);
      
      return allLocations;
    } catch (error) {
      console.error('Error getting all business locations:', error);
      throw new Error(`Failed to get business locations: ${error.message}`);
    }
  }
}