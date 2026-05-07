export interface MockResponseTemplate {
    id: string;
    labelKey: string;
    payload: string;
}

export const MOCK_RESPONSE_TEMPLATES: MockResponseTemplate[] = [
    {
        id: 'success',
        labelKey: 'ui.mockTemplate.success',
        payload: '{"code":0,"message":"success","data":{}}',
    },
    {
        id: 'pagination',
        labelKey: 'ui.mockTemplate.pagination',
        payload: '{"code":0,"message":"success","data":{"list":[],"total":0,"pageNum":1,"pageSize":10}}',
    },
    {
        id: 'empty',
        labelKey: 'ui.mockTemplate.empty',
        payload: '{"code":0,"message":"success","data":null}',
    },
    {
        id: 'error',
        labelKey: 'ui.mockTemplate.error',
        payload: '{"code":500,"message":"Internal Server Error","data":null}',
    },
    {
        id: 'auth-expired',
        labelKey: 'ui.mockTemplate.authExpired',
        payload: '{"code":401,"message":"Unauthorized","data":null}',
    },
];

export function getMockResponseTemplate(id: string): MockResponseTemplate | undefined {
    return MOCK_RESPONSE_TEMPLATES.find(template => template.id === id);
}

export function formatMockResponseTemplatePayload(templateId: string): string | undefined {
    const template = getMockResponseTemplate(templateId);
    if (!template) return undefined;
    return JSON.stringify(JSON.parse(template.payload), null, 2);
}

export function applyMockResponseTemplate<T extends { mockData: string }>(
    draft: T,
    templateId: string
): T | undefined {
    const mockData = formatMockResponseTemplatePayload(templateId);
    if (!mockData) return undefined;
    return {
        ...draft,
        mockData,
    };
}
