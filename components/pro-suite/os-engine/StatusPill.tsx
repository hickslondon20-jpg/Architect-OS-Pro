import React from 'react';
import { Badge } from '../../ui';
import type { DocStatus } from '../../../lib/osEngineApi';

const STATUS_CONFIG: Record<DocStatus, { label: string; color: 'gray' | 'blue' | 'green' | 'red' | 'yellow' }> = {
  uploaded: { label: 'Uploaded', color: 'gray' },
  processing: { label: 'Processing', color: 'yellow' },
  ingested: { label: 'Complete', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  deleted: { label: 'Deleted', color: 'gray' },
  duplicate: { label: 'Already added', color: 'blue' },
};

export const StatusPill: React.FC<{ status: DocStatus }> = ({ status }) => {
  const { label, color } = STATUS_CONFIG[status];
  return <Badge color={color}>{label}</Badge>;
};


