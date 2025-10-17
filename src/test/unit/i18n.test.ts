import { expect } from 'chai';
import { t } from '../../i18n';

describe('i18n', () => {
    describe('t (translate)', () => {
        it('should return message for current locale', () => {
            const message = t('server.started', 'http://localhost:8888');
            expect(message).to.be.a('string');
            expect(message).to.include('http://localhost:8888');
        });

        it('should return key if translation not found', () => {
            const message = t('nonexistent.key');
            expect(message).to.equal('nonexistent.key');
        });

        it('should replace multiple placeholders', () => {
            const message = t('server.startFailed', 'Port already in use');
            expect(message).to.be.a('string');
            expect(message).to.include('Port already in use');
        });

        it('should handle messages without placeholders', () => {
            const message = t('config.saved');
            expect(message).to.be.a('string');
            expect(message.length).to.be.greaterThan(0);
        });

        it('should return a valid message', () => {
            const message = t('server.stopped');
            expect(message).to.be.a('string');
            expect(message.length).to.be.greaterThan(0);
        });
    });

    describe('placeholder replacement', () => {
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

    describe('message retrieval', () => {
        it('should return non-empty messages for known keys', () => {
            const keys = [
                'server.started',
                'server.stopped',
                'server.alreadyRunning',
                'server.startFailed',
                'server.stopFailed',
                'config.saved',
                'config.title'
            ];

            keys.forEach(key => {
                const message = t(key);
                expect(message).to.be.a('string');
                expect(message.length).to.be.greaterThan(0);
                expect(message).to.not.equal('');
            });
        });
    });
});