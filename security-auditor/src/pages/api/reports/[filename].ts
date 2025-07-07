import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const filename = req.query.filename as string;
    const download = req.query.download === 'true';
    
    // Try to find the file in both directories
    let filePath = path.join(process.cwd(), 'reports', filename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'demo-reports', filename);
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentType = filename.endsWith('.html') ? 'text/html' : 'text/plain';
    
    res.setHeader('Content-Type', contentType);
    
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    
    res.status(200).send(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
} 