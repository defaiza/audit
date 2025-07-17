import { NextApiRequest, NextApiResponse } from 'next';
import { reportManager } from '@/utils/report-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const {
        page = '1',
        pageSize = '10',
        sortBy = 'date',
        sortOrder = 'desc',
        format = 'all',
        startDate,
        endDate
      } = req.query;

      const result = await reportManager.listReports({
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        format: format as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 