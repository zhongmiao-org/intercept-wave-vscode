import { describe, it } from 'mocha';
import { expect } from 'chai';
import { getConfigurationHtml } from '../../extension';

describe('Extension Helper Functions', () => {
    describe('getConfigurationHtml', () => {
        it('should generate HTML with default values', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);

            expect(html).to.be.a('string');
            expect(html).to.include('8888');
            expect(html).to.include('/api');
            expect(html).to.include('http://localhost:8080');
            expect(html).to.include('checked');
        });

        it('should handle custom port', () => {
            const config = {
                port: 9999,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: false,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('9999');
        });

        it('should handle custom intercept prefix', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/custom',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('/custom');
        });

        it('should handle custom base URL', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'https://api.example.com',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('https://api.example.com');
        });

        it('should handle stripPrefix false', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: false,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            // When stripPrefix is false, the checkbox should not have "checked" attribute
            // Look for the stripPrefix checkbox specifically
            expect(html).to.include('id="stripPrefix"');
            const stripPrefixSection = html.substring(html.indexOf('id="stripPrefix"') - 50, html.indexOf('id="stripPrefix"') + 50);
            expect(stripPrefixSection).to.not.include('checked');
        });

        it('should handle global cookie', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: 'session=abc123',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('session=abc123');
        });

        it('should serialize mock APIs to JSON', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: [
                    { path: '/test', method: 'GET', enabled: true }
                ]
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('/test');
            expect(html).to.include('GET');
        });

        it('should use default values when properties are missing', () => {
            const config = {};

            const html = getConfigurationHtml(config);
            expect(html).to.include('8888');
            expect(html).to.include('/api');
            expect(html).to.include('http://localhost:8080');
        });

        it('should return valid HTML structure', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('<!DOCTYPE html>');
            expect(html).to.include('<html');
            expect(html).to.include('</html>');
            expect(html).to.include('Intercept Wave Configuration');
        });

        it('should include save button', () => {
            const config = {
                port: 8888,
                interceptPrefix: '/api',
                baseUrl: 'http://localhost:8080',
                stripPrefix: true,
                globalCookie: '',
                mockApis: []
            };

            const html = getConfigurationHtml(config);
            expect(html).to.include('Save Configuration');
            expect(html).to.include('save()');
        });
    });
});