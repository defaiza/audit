import jsPDF from 'jspdf';
import { ComprehensiveTestReport } from './comprehensive-tests';

export class PDFReportGenerator {
  private doc: jsPDF;
  private yPosition: number = 20;
  private pageNumber: number = 1;
  
  constructor() {
    this.doc = new jsPDF();
  }

  generateReport(report: ComprehensiveTestReport): Blob {
    // Reset for new report
    this.doc = new jsPDF();
    this.yPosition = 20;
    this.pageNumber = 1;
    
    // Generate report sections
    this.addHeader(report);
    this.addExecutiveSummary(report);
    this.addSecurityScore(report);
    this.addTestResults(report);
    this.addVulnerabilities(report);
    this.addRecommendations(report);
    this.addFooter();
    
    // Return as blob
    return this.doc.output('blob');
  }

  generateHTML(report: ComprehensiveTestReport): string {
    const timestamp = new Date(report.timestamp).toLocaleString();
    const score = report.securityScore;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DeFAI Security Audit Report - ${timestamp}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px;
      font-size: 2.5em;
    }
    .summary-card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .score-circle {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      border: 15px solid ${scoreColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3em;
      font-weight: bold;
      color: ${scoreColor};
      margin: 20px auto;
      position: relative;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .stat-card {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 10px;
      color: #6b7280;
      font-size: 0.9em;
      text-transform: uppercase;
    }
    .stat-card .value {
      font-size: 2em;
      font-weight: bold;
      margin: 0;
    }
    .test-results {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .test-category {
      margin-bottom: 25px;
      padding-bottom: 25px;
      border-bottom: 1px solid #e5e7eb;
    }
    .test-category:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .test-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
    }
    .test-item.success { color: #10b981; }
    .test-item.failed { color: #ef4444; }
    .test-item.warning { color: #f59e0b; }
    .vulnerability-card {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .vulnerability-card.critical {
      background: #fef2f2;
      border-color: #ef4444;
    }
    .vulnerability-card.high {
      background: #fffbeb;
      border-color: #f59e0b;
    }
    .vulnerability-card.medium {
      background: #fefce8;
      border-color: #fbbf24;
    }
    .recommendation {
      background: #f0fdf4;
      border: 1px solid #86efac;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
    }
    .chart-container {
      margin: 30px 0;
      text-align: center;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #e5e7eb;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      padding: 30px;
      color: #6b7280;
      font-size: 0.9em;
    }
    @media print {
      body { background: white; }
      .header { break-inside: avoid; }
      .summary-card { break-inside: avoid; }
      .test-category { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 DeFAI Security Audit Report</h1>
    <p>Generated on ${timestamp}</p>
  </div>
  
  <div class="summary-card">
    <h2>Executive Summary</h2>
    <div class="score-circle">${score}/100</div>
    <p style="text-align: center; font-size: 1.2em; color: ${scoreColor};">
      Security Score: ${this.getScoreLabel(score)}
    </p>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Tests</h3>
        <p class="value">${report.totalTests}</p>
      </div>
      <div class="stat-card">
        <h3>Passed</h3>
        <p class="value" style="color: #10b981;">${report.passed}</p>
      </div>
      <div class="stat-card">
        <h3>Failed</h3>
        <p class="value" style="color: #ef4444;">${report.failed}</p>
      </div>
      <div class="stat-card">
        <h3>Success Rate</h3>
        <p class="value">${Math.round((report.passed / report.totalTests) * 100)}%</p>
      </div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-bar-fill" style="width: ${(report.passed / report.totalTests) * 100}%">
        ${Math.round((report.passed / report.totalTests) * 100)}%
      </div>
    </div>
  </div>
  
  <div class="test-results">
    <h2>Test Results by Category</h2>
    ${this.generateCategoryResults(report)}
  </div>
  
  <div class="test-results">
    <h2>Vulnerability Findings</h2>
    ${this.generateVulnerabilities(report)}
  </div>
  
  <div class="test-results">
    <h2>Recommendations</h2>
    ${this.generateRecommendations(report)}
  </div>
  
  <div class="footer">
    <p>DeFAI Security Auditor v1.0 | This report is for informational purposes only</p>
    <p>Always conduct manual code review and formal audits before mainnet deployment</p>
  </div>
</body>
</html>`;
    
    return html;
  }

  private addHeader(report: ComprehensiveTestReport) {
    this.doc.setFontSize(24);
    this.doc.setTextColor(102, 126, 234);
    this.doc.text('DeFAI Security Audit Report', 105, this.yPosition, { align: 'center' });
    
    this.yPosition += 15;
    this.doc.setFontSize(12);
    this.doc.setTextColor(100);
    this.doc.text(`Generated: ${new Date(report.timestamp).toLocaleString()}`, 105, this.yPosition, { align: 'center' });
    
    this.yPosition += 20;
  }

  private addExecutiveSummary(report: ComprehensiveTestReport) {
    this.addSection('Executive Summary');
    
    const summaryData = [
      ['Total Tests', report.totalTests.toString()],
      ['Passed', report.passed.toString()],
      ['Failed', report.failed.toString()],
      ['Success Rate', `${Math.round((report.passed / report.totalTests) * 100)}%`],
      ['Security Score', `${report.securityScore}/100`]
    ];
    
    summaryData.forEach(([label, value]) => {
      this.doc.setFontSize(10);
      this.doc.setTextColor(100);
      this.doc.text(`${label}:`, 20, this.yPosition);
      
      this.doc.setFontSize(10);
      this.doc.setTextColor(0);
      this.doc.text(value, 60, this.yPosition);
      
      this.yPosition += 8;
    });
    
    this.yPosition += 10;
  }

  private addSecurityScore(report: ComprehensiveTestReport) {
    this.addSection('Security Score Analysis');
    
    // Draw score circle
    const centerX = 105;
    const centerY = this.yPosition + 20;
    const radius = 20;
    
    // Background circle
    this.doc.setDrawColor(200, 200, 200);
    this.doc.setLineWidth(5);
    this.doc.circle(centerX, centerY, radius);
    
    // Score arc
    const score = report.securityScore;
    const color = this.getScoreColor(score);
    this.doc.setDrawColor(color.r, color.g, color.b);
    this.doc.setLineWidth(5);
    
    // Draw arc based on score (simplified - just draws full circle with color)
    this.doc.circle(centerX, centerY, radius);
    
    // Score text
    this.doc.setFontSize(20);
    this.doc.setTextColor(color.r, color.g, color.b);
    this.doc.text(`${score}`, centerX, centerY + 5, { align: 'center' });
    
    this.yPosition = centerY + radius + 20;
    
    // Score interpretation
    this.doc.setFontSize(10);
    this.doc.setTextColor(100);
    this.doc.text(`Score Interpretation: ${this.getScoreLabel(score)}`, 20, this.yPosition);
    
    this.yPosition += 15;
  }

  private addTestResults(report: ComprehensiveTestReport) {
    this.checkNewPage();
    this.addSection('Detailed Test Results');
    
    report.categoryBreakdown.forEach((stats, category) => {
      this.doc.setFontSize(11);
      this.doc.setTextColor(0);
      this.doc.text(`${category}: ${stats.passed}/${stats.total} passed`, 20, this.yPosition);
      this.yPosition += 8;
    });
    
    this.yPosition += 10;
  }

  private addVulnerabilities(report: ComprehensiveTestReport) {
    this.checkNewPage();
    this.addSection('Vulnerability Summary');
    
    const vulnerabilities = report.results.filter(r => r.status === 'failed');
    
    if (vulnerabilities.length === 0) {
      this.doc.setFontSize(10);
      this.doc.setTextColor(34, 197, 94);
      this.doc.text('No vulnerabilities detected', 20, this.yPosition);
      this.yPosition += 10;
    } else {
      vulnerabilities.forEach(vuln => {
        this.doc.setFontSize(10);
        this.doc.setTextColor(239, 68, 68);
        this.doc.text(`• ${vuln.program}: ${vuln.test}`, 20, this.yPosition);
        this.yPosition += 6;
        
        if (vuln.error) {
          this.doc.setFontSize(9);
          this.doc.setTextColor(100);
          const lines = this.doc.splitTextToSize(`  ${vuln.error}`, 170);
          lines.forEach((line: string) => {
            this.doc.text(line, 25, this.yPosition);
            this.yPosition += 5;
          });
        }
        
        this.yPosition += 5;
        this.checkNewPage();
      });
    }
    
    this.yPosition += 10;
  }

  private addRecommendations(report: ComprehensiveTestReport) {
    this.checkNewPage();
    this.addSection('Recommendations');
    
    report.recommendations.forEach((rec, index) => {
      this.doc.setFontSize(10);
      this.doc.setTextColor(0);
      const lines = this.doc.splitTextToSize(`${index + 1}. ${rec}`, 170);
      lines.forEach((line: string) => {
        this.doc.text(line, 20, this.yPosition);
        this.yPosition += 6;
      });
      this.yPosition += 4;
      this.checkNewPage();
    });
  }

  private addSection(title: string) {
    this.doc.setFontSize(14);
    this.doc.setTextColor(102, 126, 234);
    this.doc.text(title, 20, this.yPosition);
    this.yPosition += 10;
    
    // Underline
    this.doc.setDrawColor(102, 126, 234);
    this.doc.setLineWidth(0.5);
    this.doc.line(20, this.yPosition - 5, 190, this.yPosition - 5);
    
    this.yPosition += 5;
  }

  private addFooter() {
    this.doc.setFontSize(8);
    this.doc.setTextColor(150);
    this.doc.text(`Page ${this.pageNumber}`, 105, 285, { align: 'center' });
    this.doc.text('DeFAI Security Auditor v1.0', 20, 285);
    this.doc.text(new Date().toLocaleDateString(), 190, 285, { align: 'right' });
  }

  private checkNewPage() {
    if (this.yPosition > 250) {
      this.addFooter();
      this.doc.addPage();
      this.pageNumber++;
      this.yPosition = 20;
    }
  }

  private getScoreColor(score: number): { r: number; g: number; b: number } {
    if (score >= 80) return { r: 34, g: 197, b: 94 };  // Green
    if (score >= 60) return { r: 245, g: 158, b: 11 }; // Orange
    return { r: 239, g: 68, b: 68 };                    // Red
  }

  private getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent Security';
    if (score >= 80) return 'Good Security';
    if (score >= 70) return 'Moderate Security';
    if (score >= 60) return 'Needs Improvement';
    return 'Critical Issues Found';
  }

  private generateCategoryResults(report: ComprehensiveTestReport): string {
    let html = '';
    
    report.categoryBreakdown.forEach((stats, category) => {
      html += `
        <div class="test-category">
          <h3>${category}</h3>
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${(stats.passed / stats.total) * 100}%; background: ${stats.passed === stats.total ? '#10b981' : '#f59e0b'};">
              ${stats.passed}/${stats.total}
            </div>
          </div>
          ${this.generateTestItems(report.results.filter(r => r.test.includes(category)))}
        </div>
      `;
    });
    
    return html;
  }

  private generateTestItems(results: any[]): string {
    return results.map(result => `
      <div class="test-item ${result.status}">
        <span>${result.test} (${result.program})</span>
        <span>${result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️'}</span>
      </div>
    `).join('');
  }

  private generateVulnerabilities(report: ComprehensiveTestReport): string {
    const vulnerabilities = report.results.filter(r => r.status === 'failed');
    
    if (vulnerabilities.length === 0) {
      return '<p style="color: #10b981;">✅ No vulnerabilities detected</p>';
    }
    
    return vulnerabilities.map(vuln => {
      const severity = this.getVulnerabilitySeverity(vuln);
      return `
        <div class="vulnerability-card ${severity}">
          <h4>${vuln.program}: ${vuln.test}</h4>
          <p>${vuln.error || vuln.message}</p>
        </div>
      `;
    }).join('');
  }

  private generateRecommendations(report: ComprehensiveTestReport): string {
    return report.recommendations.map(rec => `
      <div class="recommendation">
        ✅ ${rec}
      </div>
    `).join('');
  }

  private getVulnerabilitySeverity(result: any): string {
    if (result.test.toLowerCase().includes('access') || result.test.toLowerCase().includes('admin')) {
      return 'critical';
    }
    if (result.test.toLowerCase().includes('validation') || result.test.toLowerCase().includes('overflow')) {
      return 'high';
    }
    return 'medium';
  }

  // Save report to file system
  async saveReportToFile(report: ComprehensiveTestReport, format: 'pdf' | 'html' = 'pdf'): Promise<string> {
    // Use report manager for consistent filename generation
    const { reportManager } = await import('./report-manager');
    const filename = reportManager.generateFilename(format);
    
    if (typeof window !== 'undefined') {
      // Browser environment
      if (format === 'pdf') {
        const blob = this.generateReport(report);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const html = this.generateHTML(report);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      // Node.js environment
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const filepath = path.join(reportsDir, filename);
      
      if (format === 'pdf') {
        const buffer = Buffer.from(this.doc.output('arraybuffer'));
        await fs.writeFile(filepath, buffer);
      } else {
        const html = this.generateHTML(report);
        await fs.writeFile(filepath, html);
      }
      
      return filepath;
    }
    
    return filename;
  }
} 