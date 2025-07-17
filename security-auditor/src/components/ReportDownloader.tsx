import { useState } from 'react';
import { PDFReportGenerator } from '@/utils/pdf-report-generator';
import { ComprehensiveTestReport } from '@/utils/comprehensive-tests';

interface ReportDownloaderProps {
  report: ComprehensiveTestReport | null;
  isGenerating?: boolean;
}

export function ReportDownloader({ report, isGenerating = false }: ReportDownloaderProps) {
  const [downloading, setDownloading] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'html'>('pdf');

  const handleDownload = async () => {
    if (!report) return;
    
    setDownloading(true);
    try {
      const generator = new PDFReportGenerator();
      
      if (format === 'pdf') {
        const blob = generator.generateReport(report);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-audit-${new Date(report.timestamp).toISOString().replace(/[:.]/g, '-')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const html = generator.generateHTML(report);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-audit-${new Date(report.timestamp).toISOString().replace(/[:.]/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      // Show success message
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = `${format.toUpperCase()} report downloaded successfully!`;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
      
    } catch (error) {
      console.error('Failed to download report:', error);
      
      // Show error message
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = 'Failed to download report. Please try again.';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    } finally {
      setDownloading(false);
    }
  };

  if (!report && !isGenerating) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">📄 Download Report</h3>
      
      {isGenerating ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Generating report...</span>
        </div>
      ) : report ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm text-gray-400">Format:</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setFormat('pdf')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  format === 'pdf'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => setFormat('html')}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  format === 'html'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                HTML
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded p-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Generated:</span>
                <span className="text-gray-300">{new Date(report.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Security Score:</span>
                <span className={`font-semibold ${
                  report.securityScore >= 80 ? 'text-green-400' : 
                  report.securityScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {report.securityScore}/100
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Tests:</span>
                <span className="text-gray-300">{report.totalTests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Success Rate:</span>
                <span className="text-gray-300">
                  {Math.round((report.passed / report.totalTests) * 100)}%
                </span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all transform ${
              downloading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white hover:scale-105'
            }`}
          >
            {downloading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Downloading...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download {format.toUpperCase()} Report
              </span>
            )}
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            Reports include detailed test results, vulnerability analysis, and recommendations
          </p>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">No report available</p>
      )}
    </div>
  );
} 