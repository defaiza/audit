import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function CurrentReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportContent, setReportContent] = useState<string>('');

  useEffect(() => {
    const fetchLatestReport = async () => {
      try {
        // Get list of reports
        const response = await fetch('/api/reports');
        const data = await response.json();
        
        if (data.reports && data.reports.length > 0) {
          // Get the most recent HTML report
          const htmlReports = data.reports.filter((r: string) => r.endsWith('.html'));
          
          if (htmlReports.length > 0) {
            // Sort by filename (which includes timestamp) to get the latest
            const latestReport = htmlReports.sort().reverse()[0];
            
            // Fetch the report content
            const reportResponse = await fetch(`/api/reports/${encodeURIComponent(latestReport)}`);
            const reportData = await reportResponse.json();
            
            setReportContent(reportData.content);
          } else {
            setReportContent('<div style="padding: 20px; color: #666;">No HTML reports found. Run an audit to generate a report.</div>');
          }
        } else {
          setReportContent('<div style="padding: 20px; color: #666;">No reports available. Run an audit to generate a report.</div>');
        }
      } catch (error) {
        console.error('Error fetching report:', error);
        setReportContent('<div style="padding: 20px; color: #f00;">Error loading report. Please try again.</div>');
      } finally {
        setLoading(false);
      }
    };

    fetchLatestReport();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading latest report...</div>
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