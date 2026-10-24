import type { Metadata } from 'next';
import { OperationsStageTab } from '../../../_components/operations-stage-tab';

export const metadata: Metadata = { title: 'Delivery — Contract Management — RECAFCO FMP' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** FMP-OPS-02 — Delivery tab: stage figures from the Operations system (old local workflow figures are not shown here). */
export default async function ContractDeliveryTab({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OperationsStageTab contractId={id} stageKey="delivery" />;
}
