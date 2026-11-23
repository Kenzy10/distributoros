import { ReportsView } from '@/components/reports/reports-view';
import { getReportsData } from '@/lib/queries/analytics';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const resolvedParams = await searchParams;
  const reportData = await getReportsData(resolvedParams.period);

  return (
    <ReportsView
      period={reportData.period}
      salesSummary={reportData.salesSummary}
      topProducts={reportData.topProducts}
      agingSummary={reportData.agingSummary}
      customerAgingRows={reportData.customerAgingRows}
    />
  );
}