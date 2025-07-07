import { useState, useEffect } from 'react';
import { ArrowLeftIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Report {
  filename: string;
  timestamp: string;
  type: 'html' | 'markdown';
  size: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports');
      const data = await response.json();
      setReports(data.reports);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
  };

  const loadReport = async (filename: string) => {
    try {
      const response = await fetch(`/api/reports/${filename}`);
      const content = await response.text();
      setReportContent(content);
      setSelectedReport(filename);
    } catch (error) {
      console.error('Error loading report:', error);
    }
  };

  const downloadReport = (filename: string) => {
    window.open(`/api/reports/${filename}?download=true`, '_blank');
  };

  if (selectedReport && reportContent) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setSelectedReport(null);
                  setReportContent('');
                }}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back to Reports</span>
              </button>
              <h1 className="text-xl font-semibold text-white">{selectedReport}</h1>
            </div>
            <button
              onClick={() => downloadReport(selectedReport)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span>Download</span>
            </button>
          </div>
        </div>
        
        {selectedReport.endsWith('.html') ? (
          <iframe
            srcDoc={reportContent}
            className="w-full h-[calc(100vh-73px)]"
            title="Security Audit Report"
          />
        ) : (
          <div className="max-w-7xl mx-auto p-8">
            <pre className="bg-gray-800 p-6 rounded-lg text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {reportContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            href="/"
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-3xl font-bold">Security Audit Reports</h1>
          <p className="text-gray-400 mt-2">View and download generated security audit reports</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <DocumentTextIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Reports Found</h2>
            <p className="text-gray-400 mb-4">Run a security audit to generate reports</p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>To generate reports:</p>
              <code className="block bg-gray-900 p-2 rounded">npm run audit</code>
              <p>or for a demo:</p>
              <code className="block bg-gray-900 p-2 rounded">npm run audit:demo</code>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <div
                key={report.filename}
                className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors cursor-pointer"
                onClick={() => loadReport(report.filename)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <DocumentTextIcon className="h-10 w-10 text-blue-500" />
                    <div>
                      <h3 className="font-semibold text-lg">{report.filename}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(report.timestamp).toLocaleString()} • {report.size}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      report.type === 'html' 
                        ? 'bg-blue-900 text-blue-300' 
                        : 'bg-green-900 text-green-300'
                    }`}>
                      {report.type.toUpperCase()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReport(report.filename);
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 