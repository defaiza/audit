import fs from 'fs';
import path from 'path';
import { ComprehensiveTestReport } from './comprehensive-tests';
import { TestResult } from './unified-test-utils';

export interface ReportMetadata {
  filename: string;
  timestamp: string;
  isoDate: string;
  size: number;
  format: 'json' | 'pdf' | 'html';
  testCount: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ReportListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'size' | 'severity';
  sortOrder?: 'asc' | 'desc';
  format?: 'json' | 'pdf' | 'html' | 'all';
  startDate?: Date;
  endDate?: Date;
}

export class ReportManager {
  private reportsDir: string;
  
  constructor(reportsDir: string = 'reports') {
    this.reportsDir = reportsDir;
    this.ensureReportsDirExists();
  }

  private ensureReportsDirExists(): void {
    if (typeof window === 'undefined' && !fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate ISO 8601 compliant filename
   * Format: YYYY-MM-DDTHH-mm-ss-sssZ (colons replaced with dashes for filesystem compatibility)
   */
  generateFilename(format: 'json' | 'pdf' | 'html' = 'json'): string {
    const now = new Date();
    const isoString = now.toISOString();
    // Replace colons with dashes for filesystem compatibility, but keep the ISO structure visible
    const fileTimestamp = isoString.replace(/:/g, '-');
    return `security-audit_${fileTimestamp}.${format}`;
  }

  /**
   * Parse filename to extract metadata
   */
  parseFilename(filename: string): ReportMetadata | null {
    const match = filename.match(/security-audit_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.(\w+)$/);
    if (!match) return null;

    const [, timestamp, format] = match;
    // Convert back to proper ISO string
    const isoDate = timestamp.replace(/-(\d{2})-(\d{2})-(\d{3}Z)$/, ':$1:$2.$3');
    
    return {
      filename,
      timestamp,
      isoDate,
      size: 0, // Will be populated later
      format: format as 'json' | 'pdf' | 'html',
      testCount: 0, // Will be populated from report content
      severityCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };
  }

  /**
   * Infer severity from test result
   */
  private inferSeverity(result: TestResult): 'critical' | 'high' | 'medium' | 'low' | null {
    const testName = result.test.toLowerCase();
    
    // Critical severity patterns
    if (testName.includes('admin') || testName.includes('owner') || 
        testName.includes('unauthorized') || testName.includes('exploit')) {
      return 'critical';
    }
    
    // High severity patterns
    if (testName.includes('overflow') || testName.includes('underflow') || 
        testName.includes('reentrancy') || testName.includes('dos')) {
      return 'high';
    }
    
    // Medium severity patterns
    if (testName.includes('validation') || testName.includes('input') || 
        testName.includes('logic')) {
      return 'medium';
    }
    
    // Low severity patterns
    if (testName.includes('gas') || testName.includes('optimization') || 
        testName.includes('warning')) {
      return 'low';
    }
    
    return 'medium'; // Default to medium if unclear
  }

  /**
   * List all reports with pagination and filtering
   */
  async listReports(options: ReportListOptions = {}): Promise<{
    reports: ReportMetadata[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      pageSize = 10,
      sortBy = 'date',
      sortOrder = 'desc',
      format = 'all',
      startDate,
      endDate
    } = options;

    if (typeof window !== 'undefined') {
      // Browser environment - use API
      const response = await fetch('/api/reports?' + new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        format,
        ...(startDate && { startDate: startDate.toISOString() }),
        ...(endDate && { endDate: endDate.toISOString() })
      }));
      return response.json();
    }

    // Node.js environment
    const files = fs.readdirSync(this.reportsDir);
    let reports: ReportMetadata[] = [];

    for (const file of files) {
      const metadata = this.parseFilename(file);
      if (!metadata) continue;

      // Apply format filter
      if (format !== 'all' && metadata.format !== format) continue;

      // Apply date filters
      const fileDate = new Date(metadata.isoDate);
      if (startDate && fileDate < startDate) continue;
      if (endDate && fileDate > endDate) continue;

      // Get file stats
      const filePath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filePath);
      metadata.size = stats.size;

      // Try to read JSON reports to get test counts
      if (metadata.format === 'json') {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const report = JSON.parse(content) as ComprehensiveTestReport;
          metadata.testCount = report.totalTests;
          
          // Count severities based on test category
          report.results.forEach((result: TestResult) => {
            if (result.status === 'failed') {
              // Infer severity from test name or category
              const severity = this.inferSeverity(result);
              if (severity) {
                metadata.severityCounts[severity]++;
              }
            }
          });
        } catch (error) {
          console.error(`Error reading report ${file}:`, error);
        }
      }

      reports.push(metadata);
    }

    // Sort reports
    reports.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.isoDate).getTime() - new Date(b.isoDate).getTime();
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'severity':
          const aSeverity = a.severityCounts.critical * 1000 + a.severityCounts.high * 100 + 
                           a.severityCounts.medium * 10 + a.severityCounts.low;
          const bSeverity = b.severityCounts.critical * 1000 + b.severityCounts.high * 100 + 
                           b.severityCounts.medium * 10 + b.severityCounts.low;
          comparison = aSeverity - bSeverity;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const total = reports.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedReports = reports.slice(startIndex, startIndex + pageSize);

    return {
      reports: paginatedReports,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  /**
   * Delete old reports based on age or count
   */
  async cleanupReports(options: {
    maxAge?: number; // Days
    maxCount?: number;
    dryRun?: boolean;
  } = {}): Promise<{
    deleted: string[];
    kept: string[];
    freedSpace: number;
  }> {
    const { maxAge = 30, maxCount = 100, dryRun = false } = options;

    if (typeof window !== 'undefined') {
      // Browser environment - use API
      const response = await fetch('/api/reports/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAge, maxCount, dryRun })
      });
      return response.json();
    }

    // Node.js environment
    const files = fs.readdirSync(this.reportsDir);
    const reports: Array<{ filename: string; date: Date; size: number }> = [];

    // Parse all report files
    for (const file of files) {
      const metadata = this.parseFilename(file);
      if (!metadata) continue;

      const filePath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filePath);
      
      reports.push({
        filename: file,
        date: new Date(metadata.isoDate),
        size: stats.size
      });
    }

    // Sort by date (newest first)
    reports.sort((a, b) => b.date.getTime() - a.date.getTime());

    const deleted: string[] = [];
    const kept: string[] = [];
    let freedSpace = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    reports.forEach((report, index) => {
      const shouldDelete = 
        report.date < cutoffDate || // Too old
        index >= maxCount; // Too many

      if (shouldDelete) {
        deleted.push(report.filename);
        freedSpace += report.size;
        
        if (!dryRun) {
          const filePath = path.join(this.reportsDir, report.filename);
          fs.unlinkSync(filePath);
        }
      } else {
        kept.push(report.filename);
      }
    });

    return { deleted, kept, freedSpace };
  }

  /**
   * Get a specific report
   */
  async getReport(filename: string): Promise<Buffer | null> {
    if (typeof window !== 'undefined') {
      // Browser environment - use API
      const response = await fetch(`/api/reports/${encodeURIComponent(filename)}`);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }

    // Node.js environment
    const filePath = path.join(this.reportsDir, filename);
    if (!fs.existsSync(filePath)) return null;
    
    return fs.readFileSync(filePath);
  }

  /**
   * Delete a specific report
   */
  async deleteReport(filename: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      // Browser environment - use API
      const response = await fetch(`/api/reports/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      return response.ok;
    }

    // Node.js environment
    const filePath = path.join(this.reportsDir, filename);
    if (!fs.existsSync(filePath)) return false;
    
    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalReports: number;
    totalSize: number;
    oldestReport: string | null;
    newestReport: string | null;
    byFormat: Record<string, { count: number; size: number }>;
  }> {
    if (typeof window !== 'undefined') {
      // Browser environment - use API
      const response = await fetch('/api/reports/stats');
      return response.json();
    }

    // Node.js environment
    const files = fs.readdirSync(this.reportsDir);
    let totalSize = 0;
    let oldestDate = new Date();
    let newestDate = new Date(0);
    let oldestReport: string | null = null;
    let newestReport: string | null = null;
    const byFormat: Record<string, { count: number; size: number }> = {};

    for (const file of files) {
      const metadata = this.parseFilename(file);
      if (!metadata) continue;

      const filePath = path.join(this.reportsDir, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(metadata.isoDate);

      totalSize += stats.size;

      // Track oldest/newest
      if (fileDate < oldestDate) {
        oldestDate = fileDate;
        oldestReport = file;
      }
      if (fileDate > newestDate) {
        newestDate = fileDate;
        newestReport = file;
      }

      // Track by format
      if (!byFormat[metadata.format]) {
        byFormat[metadata.format] = { count: 0, size: 0 };
      }
      byFormat[metadata.format].count++;
      byFormat[metadata.format].size += stats.size;
    }

    return {
      totalReports: files.length,
      totalSize,
      oldestReport,
      newestReport,
      byFormat
    };
  }
}

// Singleton instance for easy access
export const reportManager = new ReportManager(); 