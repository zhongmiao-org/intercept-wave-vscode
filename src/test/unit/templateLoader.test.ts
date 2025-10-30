import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateLoader } from '../../common';

describe('TemplateLoader', () => {
    it('replacePlaceholders should replace all tokens', () => {
        const tpl = 'Hello, {{NAME}}! Today is {{DAY}}.';
        const out = TemplateLoader.replacePlaceholders(tpl, {
            NAME: 'World',
            DAY: 'Friday',
        });
        expect(out).to.equal('Hello, World! Today is Friday.');
    });

    it('loadTemplate should read template file via fs', () => {
        // Ensure file exists at out/common/utils/templates/[name].html
        const templatesDir = path.join(__dirname, '..', '..', 'common', 'utils', 'templates');
        if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });
        const file = path.join(templatesDir, 'unit-tpl.html');
        fs.writeFileSync(file, 'UNIT-OK', 'utf-8');
        const content = TemplateLoader.loadTemplate('unit-tpl');
        expect(content).to.equal('UNIT-OK');
    });
});
