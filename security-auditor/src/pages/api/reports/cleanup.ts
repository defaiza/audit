import { NextApiRequest, NextApiResponse } from 'next';
import { reportManager } from '@/utils/report-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { maxAge, maxCount, dryRun } = req.body;
      
      const result = await reportManager.cleanupReports({
        maxAge: maxAge || 30,
        maxCount: maxCount || 100,
        dryRun: dryRun || false
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 