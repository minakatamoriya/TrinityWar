import type { AdminListResponse } from '@trinitywar/shared';

export type ModuleKey = 'dashboard' | 'player' | 'order' | 'notifications' | 'season' | 'shareAssist' | 'robotTest' | 'spiritConfig' | 'seedConfig' | 'taskConfig' | 'castleLevels' | 'system';
export type AdminRecord = Record<string, unknown>;
export type PlayerModal = { type: 'info' | 'raid'; playerId: string } | null;

export interface PlayerResourceAdjustFormState {
  reason: string;
  goldDelta: string;
  tianjiTalismanDelta: string;
  spiritSoulDelta: string;
  ordinarySoulDelta: string;
  rareSoulDelta: string;
  legendarySoulDelta: string;
  contributionDelta: string;
}

export interface NavItem {
  key: ModuleKey;
  label: string;
  description: string;
}

export interface FieldRow {
  label: string;
  field: string;
  value: unknown;
}

export interface ConfigField {
  key: string;
  label: string;
  inputType?: 'text' | 'number' | 'textarea' | 'select';
  options?: string[];
  nullable?: boolean;
}

export interface ConfigViewProps {
  busy: string;
  definitions: AdminListResponse<AdminRecord> | null;
  editingId: string;
  form: Record<string, string>;
  isEditorOpen?: boolean;
  onAdd?: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEdit: (row: AdminRecord) => void;
  onFieldChange: (field: string, value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
}
