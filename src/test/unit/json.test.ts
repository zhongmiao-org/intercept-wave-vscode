import { expect } from 'chai';
import {
    convertSingleQuotedStrings,
    parseJsonTolerant,
    quoteUnquotedKeys,
    removeTrailingCommas,
    stripComments,
    stringifyCompact,
    stringifyPretty,
    tryParseStrict,
} from '../../common';

describe('JSON utils', () => {
    it('does not strip comment-like content inside strings and templates', () => {
        const input = `{"url":"http://example.com//keep","tpl":"\`/* keep */\`"} // drop`;
        const result = stripComments(input);

        expect(result).to.include('http://example.com//keep');
        expect(result).to.include('`/* keep */`');
        expect(result).to.not.include('// drop');
    });

    it('converts single quoted strings with escapes to valid JSON strings', () => {
        const converted = convertSingleQuotedStrings(`{'msg':'it\\'s "ok"','path':'c:\\\\tmp'}`);
        expect(converted).to.equal(`{"msg":"it's \\"ok\\"","path":"c:\\\\\\\\tmp"}`);
    });

    it('quotes unquoted keys and removes trailing commas', () => {
        const result = removeTrailingCommas(quoteUnquotedKeys('{foo:1, bar_baz:2, "keep":3,}'));
        expect(result).to.equal('{"foo":1, "bar_baz":2, "keep":3}');
    });

    it('tryParseStrict returns parsed object for valid JSON and undefined otherwise', () => {
        expect(tryParseStrict('{"ok":true}')).to.deep.equal({ ok: true });
        expect(tryParseStrict('{bad json}')).to.equal(undefined);
    });

    it('parseJsonTolerant parses comments, single quotes, keys and trailing commas', () => {
        const parsed = parseJsonTolerant(`
            {
                foo: 'bar',
                list: [1, 2,],
                nested: {
                    ok: true,
                },
            }
        `);

        expect(parsed).to.deep.equal({
            foo: 'bar',
            list: [1, 2],
            nested: { ok: true },
        });
    });

    it('parseJsonTolerant throws on empty input', () => {
        expect(() => parseJsonTolerant('   ')).to.throw('Empty JSON');
    });

    it('stringify helpers produce compact and pretty output', () => {
        const value = { hello: 'world' };
        expect(stringifyCompact(value)).to.equal('{"hello":"world"}');
        expect(stringifyPretty(value, 4)).to.equal('{\n    "hello": "world"\n}');
    });
});
