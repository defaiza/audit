import { useState, useEffect } from 'react';
import { ArrowLeftIcon, DocumentTextIcon, ArrowDownTrayIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, FunnelIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ReportMetadata } from '@/utils/report-manager';
import { Layout } from '@/components/Layout';

interface ReportsResponse {
  reports: ReportMetadata[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ReportsPage() {
  const [reportsData, setReportsData] = useState<ReportsResponse | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'severity'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [formatFilter, setFormatFilter] = useState<'all' | 'json' | 'pdf' | 'html'>('all');
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchReports();
  }, [page, sortBy, sortOrder, formatFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
        format: formatFilter
      });
      const response = await fetch(`/api/reports?${params}`);
      const data = await response.json();
      setReportsData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/reports/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  const deleteReport = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      const response = await fetch(`/api/reports/${filename}`, { method: 'DELETE' });
      if (response.ok) {
        fetchReports();
        fetchStats();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const cleanupReports = async (dryRun: boolean = true) => {
    try {
      const response = await fetch('/api/reports/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAge: 30, maxCount: 100, dryRun })
      });
      const result = await response.json();
      
      if (dryRun) {
        alert(`Cleanup preview:\n- ${result.deleted.length} reports would be deleted\n- ${result.kept.length} reports would be kept\n- ${formatBytes(result.freedSpace)} would be freed`);
        
        if (result.deleted.length > 0 && confirm('Proceed with cleanup?')) {
          cleanupReports(false);
        }
      } else {
        alert(`Cleanup complete:\n- ${result.deleted.length} reports deleted\n- ${formatBytes(result.freedSpace)} freed`);
        fetchReports();
        fetchStats();
      }
    } catch (error) {
      console.error('Error cleaning up reports:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (isoDate: string): string => {
    return new Date(isoDate).toLocaleString();
  };

  const getSeverityBadge = (counts: ReportMetadata['severityCounts']) => {
    if (counts.critical > 0) return { color: 'bg-red-600 text-red-100', text: `${counts.critical} Critical` };
    if (counts.high > 0) return { color: 'bg-orange-600 text-orange-100', text: `${counts.high} High` };
    if (counts.medium > 0) return { color: 'bg-yellow-600 text-yellow-100', text: `${counts.medium} Medium` };
    if (counts.low > 0) return { color: 'bg-blue-600 text-blue-100', text: `${counts.low} Low` };
    return { color: 'bg-green-600 text-green-100', text: 'Clean' };
  };

  if (selectedReport && reportContent) {
    return (
      <Layout>
        <div className="min-h-screen bg-black">
          <div className="bg-gray-900 p-4 flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedReport(null);
                setReportContent('');
              }}
              className="flex items-center space-x-2 text-gray-300 hover:text-white"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back to Reports</span>
            </button>
            <button
              onClick={() => downloadReport(selectedReport)}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span>Download</span>
            </button>
          </div>
          <div className="p-4">
            <iframe
              srcDoc={reportContent}
              className="w-full h-screen rounded-lg"
              style={{ minHeight: 'calc(100vh - 120px)' }}
              title="Security Audit Report"
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Security Audit Reports</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {showStats ? 'Hide' : 'Show'} Stats
            </button>
            <button
              onClick={() => cleanupReports(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Cleanup Old Reports
            </button>
            <Link 
              href="/" 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && stats && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Storage Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Reports</p>
                <p className="text-2xl font-bold text-white">{stats.totalReports}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Size</p>
                <p className="text-2xl font-bold text-white">{formatBytes(stats.totalSize)}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Oldest Report</p>
                <p className="text-sm text-white truncate">{stats.oldestReport || 'N/A'}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Format Distribution</p>
                <div className="text-sm text-white">
                  {Object.entries(stats.byFormat || {}).map(([format, data]: [string, any]) => (
                    <div key={format} className="flex justify-between">
                      <span>{format.toUpperCase()}:</span>
                      <span>{data.count} ({formatBytes(data.size)})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <span className="text-gray-400 text-sm">Filters:</span>
            </div>
            
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as any)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              <option value="all">All Formats</option>
              <option value="json">JSON</option>
              <option value="pdf">PDF</option>
              <option value="html">HTML</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              <option value="date">Sort by Date</option>
              <option value="size">Sort by Size</option>
              <option value="severity">Sort by Severity</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          </div>
        ) : reportsData?.reports.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-10 text-center">
            <DocumentTextIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No reports found</p>
          </div>
        ) : (
          <>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Report
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Format
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Tests
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {reportsData?.reports.map((report) => {
                    const severityBadge = getSeverityBadge(report.severityCounts);
                    return (
                      <tr key={report.filename} className="hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-white">{report.filename}</p>
                            <p className="text-xs text-gray-400">{formatDate(report.isoDate)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300">
                            {report.format.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {report.testCount > 0 ? report.testCount : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${severityBadge.color}`}>
                            {severityBadge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatBytes(report.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => loadReport(report.filename)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View
                            </button>
                            <button
                              onClick={() => downloadReport(report.filename)}
                              className="text-green-400 hover:text-green-300"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteReport(report.filename)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {reportsData && reportsData.totalPages > 1 && (
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className={`flex items-center px-3 py-1 rounded ${
                    page === 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Previous
                </button>
                
                <span className="text-gray-400">
                  Page {page} of {reportsData.totalPages}
                </span>
                
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === reportsData.totalPages}
                  className={`flex items-center px-3 py-1 rounded ${
                    page === reportsData.totalPages
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
} 