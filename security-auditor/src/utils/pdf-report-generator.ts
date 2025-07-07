// import { TestSuiteReport } from './comprehensive-test-suite';

// Define TestSuiteReport interface locally
interface TestSuiteReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    executionTime: number;
    testDate: Date;
  };
  results: any[];
  recommendations?: any[];
  categoryBreakdown?: any;
  programBreakdown?: any;
  securityScore?: number;
}
import * as fs from 'fs';
import * as path from 'path';

// We'll use a simple HTML to PDF approach
export class PDFReportGenerator {
  /**
   * Generate PDF report from test suite results
   */
  static async generatePDF(
    report: TestSuiteReport,
    outputPath: string
  ): Promise<string> {
    const html = this.generateHTML(report);
    const htmlPath = outputPath.replace('.pdf', '.html');
    
    // Save HTML file
    fs.writeFileSync(htmlPath, html);
    
    // Note: In a real implementation, you would use a library like puppeteer or wkhtmltopdf
    // For now, we'll create a detailed HTML report that can be easily converted to PDF
    
    console.log(`📄 HTML report generated at: ${htmlPath}`);
    console.log(`💡 To convert to PDF:`);
    console.log(`   - Open the HTML file in a browser and print to PDF`);
    console.log(`   - Or install wkhtmltopdf and run: wkhtmltopdf ${htmlPath} ${outputPath}`);
    console.log(`   - Or use an online HTML to PDF converter`);
    
    return htmlPath;
  }

  /**
   * Generate HTML report
   */
  private static generateHTML(report: TestSuiteReport): string {
    const { summary, results, categoryBreakdown, programBreakdown, recommendations, securityScore } = report;
    
    const statusColor = (passed: boolean) => passed ? '#4CAF50' : '#F44336';
    const scoreColor = (securityScore ?? 0) >= 80 ? '#4CAF50' : (securityScore ?? 0) >= 60 ? '#FF9800' : '#F44336';
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeFAI Security Audit Report</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2196F3;
        }
        
        .header h1 {
            color: #1976D2;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        
        .header .subtitle {
            color: #666;
            font-size: 1.2em;
        }
        
        .summary-section {
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .summary-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #555;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            margin: 0;
        }
        
        .security-score {
            text-align: center;
            margin: 30px 0;
        }
        
        .score-circle {
            display: inline-block;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            border: 10px solid ${scoreColor};
            line-height: 130px;
            font-size: 3em;
            font-weight: bold;
            color: ${scoreColor};
        }
        
        .breakdown-section {
            margin-bottom: 30px;
        }
        
        .breakdown-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .breakdown-table th,
        .breakdown-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .breakdown-table th {
            background-color: #f5f5f5;
            font-weight: bold;
            color: #555;
        }
        
        .breakdown-table tr:hover {
            background-color: #f9f9f9;
        }
        
        .test-results {
            margin-bottom: 30px;
        }
        
        .test-result {
            background: white;
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #ddd;
        }
        
        .test-result.passed {
            border-left-color: #4CAF50;
        }
        
        .test-result.failed {
            border-left-color: #F44336;
        }
        
        .test-result h4 {
            margin: 0 0 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: normal;
            color: white;
        }
        
        .status-badge.passed {
            background-color: #4CAF50;
        }
        
        .status-badge.failed {
            background-color: #F44336;
        }
        
        .test-meta {
            display: flex;
            gap: 20px;
            color: #666;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        
        .recommendations {
            background-color: #FFF3E0;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #FF9800;
        }
        
        .recommendations h2 {
            color: #E65100;
            margin-top: 0;
        }
        
        .recommendations ul {
            margin: 10px 0;
            padding-left: 25px;
        }
        
        .recommendations li {
            margin-bottom: 8px;
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 0.9em;
        }
        
        @media print {
            .test-result {
                break-inside: avoid;
            }
            
            .breakdown-section {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>DeFAI Security Audit Report</h1>
        <div class="subtitle">Comprehensive Security Analysis</div>
        <div class="subtitle">${summary.testDate.toLocaleDateString()} ${summary.testDate.toLocaleTimeString()}</div>
    </div>
    
    <div class="summary-section">
        <h2>Executive Summary</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <p class="value">${summary.totalTests}</p>
            </div>
            <div class="summary-card">
                <h3>Passed</h3>
                <p class="value" style="color: #4CAF50">${summary.passed}</p>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <p class="value" style="color: #F44336">${summary.failed}</p>
            </div>
            <div class="summary-card">
                <h3>Execution Time</h3>
                <p class="value">${(summary.executionTime / 1000).toFixed(1)}s</p>
            </div>
        </div>
    </div>
    
    <div class="security-score">
        <h2>Security Score</h2>
        <div class="score-circle">${securityScore ?? 0}</div>
        <p style="color: ${scoreColor}; font-size: 1.2em; margin-top: 10px;">
            ${(securityScore ?? 0) >= 80 ? 'Excellent' : (securityScore ?? 0) >= 60 ? 'Good - Improvements Needed' : 'Critical - Major Issues Found'}
        </p>
    </div>
    
    <div class="breakdown-section">
        <h2>Test Results by Category</h2>
        <table class="breakdown-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Total Tests</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${categoryBreakdown ? Array.from(categoryBreakdown.entries()).map((entry) => {
                    const [category, stats] = entry as [any, any];
                    return `
                    <tr>
                        <td>${category}</td>
                        <td>${stats.total}</td>
                        <td style="color: #4CAF50">${stats.passed}</td>
                        <td style="color: #F44336">${stats.failed}</td>
                        <td>${((stats.passed / stats.total) * 100).toFixed(1)}%</td>
                    </tr>
                `;
                }).join('') : ''}
            </tbody>
        </table>
    </div>
    
    <div class="breakdown-section">
        <h2>Test Results by Program</h2>
        <table class="breakdown-table">
            <thead>
                <tr>
                    <th>Program</th>
                    <th>Total Tests</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${programBreakdown ? Array.from(programBreakdown.entries()).map((entry) => {
                    const [program, stats] = entry as [any, any];
                    return `
                    <tr>
                        <td>${program}</td>
                        <td>${stats.total}</td>
                        <td style="color: #4CAF50">${stats.passed}</td>
                        <td style="color: #F44336">${stats.failed}</td>
                        <td>${((stats.passed / stats.total) * 100).toFixed(1)}%</td>
                    </tr>
                `;
                }).join('') : ''}
            </tbody>
        </table>
    </div>
    
    <div class="test-results">
        <h2>Detailed Test Results</h2>
        ${results.map(result => `
            <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                <h4>
                    ${result.testName}
                    <span class="status-badge ${result.passed ? 'passed' : 'failed'}">
                        ${result.passed ? 'PASSED' : 'FAILED'}
                    </span>
                </h4>
                <div class="test-meta">
                    <span><strong>Category:</strong> ${result.category}</span>
                    <span><strong>Program:</strong> ${result.program}</span>
                    <span><strong>Time:</strong> ${result.executionTime}ms</span>
                </div>
                ${result.error ? `
                    <div style="background-color: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <strong style="color: #c62828;">Error:</strong> ${result.error}
                    </div>
                ` : ''}
                ${result.details && Object.keys(result.details).length > 0 ? `
                    <details style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: #1976D2;">View Details</summary>
                        <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; margin-top: 5px;">
${JSON.stringify(result.details, null, 2)}
                        </pre>
                    </details>
                ` : ''}
            </div>
        `).join('')}
    </div>
    
    ${recommendations && recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Security Recommendations</h2>
            <ul>
                ${recommendations?.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    ` : ''}
    
    <div class="footer">
        <p>Generated by DeFAI Security Auditor</p>
        <p>This report is confidential and should be treated as sensitive information</p>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate markdown report (alternative format)
   */
  static generateMarkdown(report: TestSuiteReport): string {
    const { summary, results, categoryBreakdown, programBreakdown, recommendations, securityScore } = report;
    
    let markdown = `# DeFAI Security Audit Report

## Executive Summary
- **Date**: ${summary.testDate.toISOString()}
- **Total Tests**: ${summary.totalTests}
- **Passed**: ${summary.passed}
- **Failed**: ${summary.failed}
- **Execution Time**: ${(summary.executionTime / 1000).toFixed(1)}s
- **Security Score**: ${securityScore ?? 0}/100

## Test Results by Category
| Category | Total | Passed | Failed | Success Rate |
|----------|-------|--------|--------|--------------|
${categoryBreakdown ? Array.from(categoryBreakdown.entries()).map((entry) => {
  const [category, stats] = entry as [any, any];
  return `| ${category} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${((stats.passed / stats.total) * 100).toFixed(1)}% |`;
}).join('\n') : ''}

## Test Results by Program
| Program | Total | Passed | Failed | Success Rate |
|---------|-------|--------|--------|--------------|
${programBreakdown ? Array.from(programBreakdown.entries()).map((entry) => {
  const [program, stats] = entry as [any, any];
  return `| ${program} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${((stats.passed / stats.total) * 100).toFixed(1)}% |`;
}).join('\n') : ''}

## Detailed Test Results
${results.map(result => `
### ${result.testName}
- **Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}
- **Category**: ${result.category}
- **Program**: ${result.program}
- **Execution Time**: ${result.executionTime}ms
${result.error ? `- **Error**: ${result.error}` : ''}
`).join('\n')}

## Security Recommendations
${recommendations?.map(rec => `- ${rec}`).join('\n') || ''}
`;
    
    return markdown;
  }
}

export const generatePDFReport = async (
  report: TestSuiteReport,
  outputDir: string = './reports'
): Promise<string> => {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `security-audit-${timestamp}.pdf`);
  
  // Generate PDF (HTML for now)
  const htmlPath = await PDFReportGenerator.generatePDF(report, outputPath);
  
  // Also generate markdown version
  const markdownPath = outputPath.replace('.pdf', '.md');
  const markdown = PDFReportGenerator.generateMarkdown(report);
  fs.writeFileSync(markdownPath, markdown);
  
  console.log(`\n📋 Reports generated:`);
  console.log(`   - HTML: ${htmlPath}`);
  console.log(`   - Markdown: ${markdownPath}`);
  
  return htmlPath;
}; 