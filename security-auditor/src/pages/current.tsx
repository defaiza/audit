import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function CurrentReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportContent, setReportContent] = useState<string>('');

  useEffect(() => {
    fetchLatestReport();
  }, []);

  const fetchLatestReport = async () => {
    try {
      // Get list of reports
      const response = await fetch('/api/reports');
      const data = await response.json();
      
      if (data.reports && data.reports.length > 0) {
        // Get the most recent HTML report
        const htmlReports = data.reports.filter((r: any) => r.type === 'html');
        if (htmlReports.length > 0) {
          // Load the first (most recent) report
          const reportResponse = await fetch(`/api/reports/${htmlReports[0].filename}`);
          const content = await reportResponse.text();
          setReportContent(content);
          setLoading(false);
        } else {
          // No HTML reports, redirect to reports page
          router.push('/reports');
        }
      } else {
        // No reports found, redirect to reports page
        router.push('/reports');
      }
    } catch (error) {
      console.error('Error loading report:', error);
      router.push('/reports');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading latest security report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <iframe
        srcDoc={reportContent}
        className="w-full h-screen"
        title="Latest Security Audit Report"
      />
    </div>
  );
} 