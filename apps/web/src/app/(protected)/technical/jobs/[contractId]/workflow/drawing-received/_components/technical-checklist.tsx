import { Check, Circle } from 'lucide-react';
import type { TechnicalDrawing, TechnicalAttachment } from '@/lib/technical-api';
import { isDrawingReceivedReady } from '../../../../../_lib/attachment-helpers';

interface Props {
  drawing: TechnicalDrawing | null;
  attachments: TechnicalAttachment[];
}

// FMP-TECH-01, simplified FMP-TECH-05C — every checkmark below is computed
// from the real saved TechnicalDrawing/attachments — never hardcoded as
// already-complete. No longer renders its own outer card/heading (dropped
// in FMP-TECH-05C so it can nest as the "Checklist" sub-section of Drawing
// Received's combined Workflow Panel) — this component has exactly one
// consumer (this page), so there's no other call site to keep compatible.
export function TechnicalChecklist({ drawing, attachments }: Props): React.JSX.Element {
  const items = [
    { label: 'Received date recorded', done: Boolean(drawing?.receivedDate) },
    { label: 'Drawing files uploaded', done: attachments.length > 0 },
    { label: 'Reference and revision captured', done: Boolean(drawing?.drawingReferenceNo && drawing?.revisionNo) },
    { label: 'Ready for next stage', done: isDrawingReceivedReady(drawing as unknown as Record<string, unknown> | null) },
  ];

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-sm">
          {item.done ? (
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <Circle className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          )}
          <span className={item.done ? 'text-text-primary' : 'text-text-muted'}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
