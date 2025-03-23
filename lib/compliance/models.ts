/**
 * Compliance Models
 * 
 * Type definitions for compliance-related data structures.
 */

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

export interface ComplianceReport {
  id: string;
  content: string;
  industry: string;
  compliant: boolean;
  score: number;
  warnings: ComplianceWarning[];
  suggestions: ComplianceSuggestion[];
  timestamp: string;
  userId?: string;
  businessId?: string;
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