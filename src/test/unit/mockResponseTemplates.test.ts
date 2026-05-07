import { expect } from 'chai';
import {
    applyMockResponseTemplate,
    formatMockResponseTemplatePayload,
    getMockResponseTemplate,
    MOCK_RESPONSE_TEMPLATES,
} from '../../common/mockResponseTemplates';

describe('Mock response templates', () => {
    it('provides the expected built-in template library', () => {
        expect(MOCK_RESPONSE_TEMPLATES.map(template => template.id)).to.deep.equal([
            'success',
            'pagination',
            'empty',
            'error',
            'auth-expired',
        ]);
        expect(getMockResponseTemplate('success')?.payload).to.equal('{"code":0,"message":"success","data":{}}');
    });

    it('keeps pagination, error and auth-expired templates as valid minifiable JSON', () => {
        ['pagination', 'error', 'auth-expired'].forEach(id => {
            const template = getMockResponseTemplate(id);
            expect(template).to.exist;
            const parsed = JSON.parse(template!.payload);
            expect(JSON.stringify(parsed)).to.equal(template!.payload);
        });
    });

    it('keeps edit-time template insertion compatible with existing JSON save minification', () => {
        const pretty = formatMockResponseTemplatePayload('success') || '';

        expect(pretty).to.contain('\n');
        expect(JSON.stringify(JSON.parse(pretty))).to.equal('{"code":0,"message":"success","data":{}}');
    });

    it('applies a template by replacing only mockData on an existing draft', () => {
        const draft = {
            enabled: false,
            method: 'POST',
            path: '/existing',
            statusCode: 418,
            delay: 25,
            mockData: '{"custom":true}',
        };
        const next = applyMockResponseTemplate(draft, 'error');

        expect(next).to.include({
            enabled: false,
            method: 'POST',
            path: '/existing',
            statusCode: 418,
            delay: 25,
        });
        expect(next?.mockData).to.contain('"Internal Server Error"');
        expect(draft.mockData).to.equal('{"custom":true}');
    });
});
