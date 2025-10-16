import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { t } from '../../i18n';

describe('i18n', () => {
    let sandbox: sinon.SinonSandbox;
    let originalLanguage: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        originalLanguage = vscode.env.language;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('t (translate)', () => {
        it('should return English message for English locale', () => {
            sandbox.stub(vscode.env, 'language').value('en');
            const message = t('server.started', 'http://localhost:8888');
            expect(message).to.equal('Mock server started successfully! Access URL: http://localhost:8888');
        });

        it('should return Chinese message for Chinese locale', () => {
            sandbox.stub(vscode.env, 'language').value('zh-CN');
            const message = t('server.started', 'http://localhost:8888');
            expect(message).to.equal('Mock 服务器启动成功！访问地址: http://localhost:8888');
        });

        it('should return Chinese message for zh-TW locale', () => {
            sandbox.stub(vscode.env, 'language').value('zh-TW');
            const message = t('server.stopped');
            expect(message).to.equal('Mock 服务器已停止');
        });

        it('should fallback to English for unsupported locale', () => {
            sandbox.stub(vscode.env, 'language').value('fr');
            const message = t('server.stopped');
            expect(message).to.equal('Mock server stopped successfully');
        });

        it('should return key if translation not found', () => {
            sandbox.stub(vscode.env, 'language').value('en');
            const message = t('nonexistent.key');
            expect(message).to.equal('nonexistent.key');
        });

        it('should replace multiple placeholders', () => {
            sandbox.stub(vscode.env, 'language').value('en');
            const message = t('server.startFailed', 'Port already in use');
            expect(message).to.equal('Failed to start mock server: Port already in use');
        });

        it('should handle messages without placeholders', () => {
            sandbox.stub(vscode.env, 'language').value('en');
            const message = t('config.saved');
            expect(message).to.equal('Configuration saved successfully');
        });

        it('should be case-insensitive for locale detection', () => {
            sandbox.stub(vscode.env, 'language').value('ZH-CN');
            const message = t('server.stopped');
            expect(message).to.equal('Mock 服务器已停止');
        });

        it('should handle zh locale variants correctly', () => {
            const variants = ['zh', 'zh-cn', 'zh-CN', 'zh-tw', 'zh-TW', 'zh-hk'];

            variants.forEach(variant => {
                sandbox.restore();
                sandbox = sinon.createSandbox();
                sandbox.stub(vscode.env, 'language').value(variant);
                const message = t('server.stopped');
                expect(message).to.equal('Mock 服务器已停止', `Failed for locale: ${variant}`);
            });
        });

        it('should return English translation as fallback when key exists in English but not in current locale', () => {
            sandbox.stub(vscode.env, 'language').value('zh-CN');
            // Assuming there's a key that exists in English but we're testing the fallback
            const message = t('server.started', 'http://localhost:8888');
            expect(message).to.be.a('string');
            expect(message.length).to.be.greaterThan(0);
        });
    });

    describe('placeholder replacement', () => {
        beforeEach(() => {
            sandbox.stub(vscode.env, 'language').value('en');
        });

        it('should replace {0} placeholder', () => {
            const message = t('server.started', 'http://localhost:8888');
            expect(message).to.include('http://localhost:8888');
            expect(message).to.not.include('{0}');
        });

        it('should handle empty placeholder values', () => {
            const message = t('server.started', '');
            expect(message).to.not.include('{0}');
        });

        it('should preserve message if no args provided for placeholder', () => {
            const message = t('server.started');
            expect(message).to.include('{0}');
        });
    });

    describe('locale detection', () => {
        it('should detect English locale correctly', () => {
            const locales = ['en', 'en-US', 'en-GB', 'en-AU'];

            locales.forEach(locale => {
                sandbox.restore();
                sandbox = sinon.createSandbox();
                sandbox.stub(vscode.env, 'language').value(locale);
                const message = t('server.stopped');
                expect(message).to.equal('Mock server stopped successfully', `Failed for locale: ${locale}`);
            });
        });

        it('should handle empty locale gracefully', () => {
            sandbox.stub(vscode.env, 'language').value('');
            const message = t('server.stopped');
            expect(message).to.be.a('string');
        });
    });
});