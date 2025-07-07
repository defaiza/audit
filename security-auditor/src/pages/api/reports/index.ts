import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    const demoReportsDir = path.join(process.cwd(), 'demo-reports');
    
    const reports: any[] = [];
    
    // Check main reports directory
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      files.forEach(file => {
        if (file.endsWith('.html') || file.endsWith('.md')) {
          const stats = fs.statSync(path.join(reportsDir, file));
          reports.push({
            filename: file,
            timestamp: stats.mtime,
            type: file.endsWith('.html') ? 'html' : 'markdown',
            size: formatFileSize(stats.size),
            directory: 'reports'
          });
        }
      });
    }
    
    // Check demo reports directory
    if (fs.existsSync(demoReportsDir)) {
      const files = fs.readdirSync(demoReportsDir);
      files.forEach(file => {
        if (file.endsWith('.html') || file.endsWith('.md')) {
          const stats = fs.statSync(path.join(demoReportsDir, file));
          reports.push({
            filename: file,
            timestamp: stats.mtime,
            type: file.endsWith('.html') ? 'html' : 'markdown',
            size: formatFileSize(stats.size),
            directory: 'demo-reports'
          });
        }
      });
    }
    
    // Sort by timestamp, newest first
    reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    res.status(200).json({ reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
} 