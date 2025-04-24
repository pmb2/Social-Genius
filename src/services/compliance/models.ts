/**
 * Compliance Models
 * 
 * Type definitions for compliance-related data structures.
 */

// Authentication Status interface
export interface AuthStatus {
  isValid: boolean;
  expiresAt?: string;
  email?: string;
  lastVerified?: string;
}

// Authentication Request interface
export interface AuthRequest {
  businessId: string;
  token?: string;
}

// Authentication Response interface
export interface AuthResponse {
  success: boolean;
  valid: boolean;
  expiresAt?: string;
  email?: string;
  lastVerified?: string;
  error?: string;
}

// Task Status interface
export interface TaskStatus {
  taskId: string;
  status: 'success' | 'failed' | 'in_progress';
  progress?: number;
  error?: string;
  errorCode?: string;
  result?: any;
  screenshot?: string;
  timestamp: string;
}

// Business Authentication Status
export interface BusinessAuthStatus {
  businessId: string;
  status: 'connected' | 'not_connected' | 'error' | 'pending';
  email?: string;
  lastAuthenticated?: string;
  expiresAt?: string;
  errorMessage?: string;
  browserInstanceId?: string; // Unique ID for this business's browser instance
  sessionData?: string; // Serialized browser session data
}

// Browser instance tracking
export interface BrowserInstance {
  instanceId: string;
  businessId: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'expired' | 'error';
  email?: string;
  sessionData?: any; // Session cookies and state
}

// Google authentication request
export interface GoogleAuthRequest {
  businessId: string;
  email: string;
  encryptedPassword: string;
  nonce: string;
  version: string;
  browserInstanceId?: string;
  persistBrowser?: boolean;
}

export interface ComplianceWarning {
  type: 'error' | 'warning' | 'info';
  message: string;
  section?: string;
  priority: number;
  code: string;
}

export interface ComplianceSuggestion {
  message: string;
  original?: string;
  suggested?: string;
  section?: string;
  confidence: number;
}

export interface ComplianceIssue {
  id: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedAction?: string;
}

export interface ComplianceReport {
  businessId: number;
  status: string;
  score: number;
  date: string;
  issues: ComplianceIssue[];
}

export interface ContentModerationResult {
  appropriate: boolean;
  contentFlags: {
    type: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
  }[];
  sensitiveTopics: string[];
  timestamp: string;
}

export interface ComplianceCheckRequest {
  content: string;
  industry: string;
  businessId?: string;
  userId?: string;
}

export interface ComplianceCheckResponse {
  report: ComplianceReport;
  status: 'success' | 'error';
  message?: string;
}