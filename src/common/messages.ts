import type { MockApiConfig, MockConfig } from './interfaces';

export type RequestMessage =
    | { type: 'startServer' }
    | { type: 'stopServer' }
    | { type: 'startGroup'; groupId: string }
    | { type: 'stopGroup'; groupId: string }
    | { type: 'importConfig'; payload: string } // JSON string or file content
    | { type: 'exportConfig' }
    | { type: 'addMock'; groupId: string; data: MockApiConfig }
    | { type: 'updateMock'; groupId: string; index: number; data: MockApiConfig }
    | { type: 'deleteMock'; groupId: string; index: number };

export type ResponseMessage =
    | {
          type: 'configUpdated';
          config: MockConfig;
          groupStatuses: Record<string, boolean>;
          activeGroupId?: string;
      }
    | { type: 'exportResult'; payload: string }
    | { type: 'error'; message: string };
