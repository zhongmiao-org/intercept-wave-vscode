import type { GroupDraft, MockApiConfig, MockApiDraft, ProxyGroup } from './business';
import type { GroupSummary } from './ui';

export interface GroupListProps {
  groups: GroupSummary[];
  activeGroupId?: string;
  onSelect: (groupId: string) => void;
  onAddGroup: () => void;
  noGroupsText: string;
}

export interface GroupHeaderProps {
  group: ProxyGroup;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  labels: {
    start: string;
    stop: string;
    edit: string;
    delete: string;
  };
}

export interface MockListProps {
  mocks: MockApiConfig[];
  onToggle: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  labels: {
    mockApis: string;
    addMock: string;
    enable: string;
    disable: string;
    edit: string;
    delete: string;
    emptyText: string;
  };
}

export interface GroupModalProps {
  open: boolean;
  draft: GroupDraft;
  onChange: (next: GroupDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  labels: {
    titleAdd: string;
    titleEdit: string;
    name: string;
    port: string;
    interceptPrefix: string;
    baseUrl: string;
    stripPrefix: string;
    globalCookie: string;
    save: string;
    cancel: string;
  };
  isEdit: boolean;
}

export interface MockModalProps {
  open: boolean;
  draft: MockApiDraft;
  onChange: (next: MockApiDraft) => void;
  onSave: () => void;
  onFormat: () => void;
  onCancel: () => void;
  labels: {
    titleAdd: string;
    titleEdit: string;
    enabled: string;
    method: string;
    path: string;
    statusCode: string;
    delay: string;
    responseBody: string;
    format: string;
    save: string;
  };
  isEdit: boolean;
}

