import { afterEach, before, describe, it } from 'mocha';
import { expect } from 'chai';
import { MockServerManager } from '../../common';
import {
    createHttpGroup,
    createMockServerManager,
    createOutputChannel,
    ensureHttpUpstreamAvailable,
    getFreePort,
    getUpstreamHttpBase,
    httpRequest,
} from './helpers/upstream';

describe('HTTP Forwarding Integration', function () {
    this.timeout(20000);

    let manager: MockServerManager | undefined;

    before(async () => {
        await ensureHttpUpstreamAvailable();
    });

    afterEach(async () => {
        if (manager) {
            await manager.stop();
            manager = undefined;
        }
    });

    it('forwards POST /rest/items to upstream and preserves status, body, headers, and CORS', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'rest-create',
                    port,
                    interceptPrefix: '/',
                    baseUrl: getUpstreamHttpBase(0),
                    stripPrefix: false,
                }),
            ],
            output
        );

        await manager.start();

        const payload = JSON.stringify({ name: 'Created in integration test' });
        const response = await httpRequest({
            method: 'POST',
            url: `http://localhost:${port}/rest/items`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: payload,
        });

        expect(response.statusCode).to.equal(201);
        expect(response.headers.location).to.match(/^\/rest\/items\/\d+$/);
        expect(response.headers['access-control-allow-origin']).to.equal('*');

        const body = JSON.parse(response.body);
        expect(body.name).to.equal('Created in integration test');
        expect(body.id).to.be.a('number');
        expect(output.logs.some(line => line.includes('Forwarding to:'))).to.equal(true);
    });

    it('forwards stripPrefix requests to user-service aliases', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'user-service',
                    port,
                    interceptPrefix: '/api',
                    baseUrl: getUpstreamHttpBase(0),
                    stripPrefix: true,
                }),
            ],
            output
        );

        await manager.start();

        const response = await httpRequest({
            url: `http://localhost:${port}/api/user/info`,
        });

        expect(response.statusCode).to.equal(200);
        const body = JSON.parse(response.body);
        expect(body.code).to.equal(0);
        expect(body.data.name).to.equal('张三');
        expect(output.logs.some(line => line.includes('Match path: /user/info'))).to.equal(true);
    });

    it('forwards PUT and PATCH-style requests through /echo', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'echo-service',
                    port,
                    interceptPrefix: '/',
                    baseUrl: getUpstreamHttpBase(0),
                    stripPrefix: false,
                }),
            ],
            output
        );

        await manager.start();

        const putResponse = await httpRequest({
            method: 'PUT',
            url: `http://localhost:${port}/echo`,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ via: 'put' }),
        });
        expect(putResponse.statusCode).to.equal(200);
        expect(JSON.parse(putResponse.body).method).to.equal('PUT');

        const patchResponse = await httpRequest({
            method: 'POST',
            url: `http://localhost:${port}/echo`,
            headers: {
                'Content-Type': 'application/json',
                'X-HTTP-Method-Override': 'PATCH',
            },
            body: JSON.stringify({ via: 'patch' }),
        });
        expect(patchResponse.statusCode).to.equal(200);
        const patchBody = JSON.parse(patchResponse.body);
        expect(patchBody.body).to.contain('patch');
    });

    it('forwards request headers and cookies to upstream echo endpoints', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'header-cookie-service',
                    port,
                    interceptPrefix: '/',
                    baseUrl: getUpstreamHttpBase(0),
                    stripPrefix: false,
                }),
            ],
            output
        );

        await manager.start();

        const headersResponse = await httpRequest({
            url: `http://localhost:${port}/headers`,
            headers: {
                Authorization: 'Bearer integration-token',
                'X-Request-Id': 'req-integration',
            },
        });
        expect(headersResponse.statusCode).to.equal(200);
        const headersBody = JSON.parse(headersResponse.body);
        expect(headersBody.headers.Authorization).to.equal('Bearer integration-token');
        expect(headersBody.headers['X-Request-Id']).to.equal('req-integration');

        const cookiesResponse = await httpRequest({
            url: `http://localhost:${port}/cookies`,
            headers: {
                Cookie: 'sid=abc; user=tom',
            },
        });
        expect(cookiesResponse.statusCode).to.equal(200);
        const cookiesBody = JSON.parse(cookiesResponse.body);
        expect(cookiesBody.cookies.sid).to.equal('abc');
        expect(cookiesBody.cookies.user).to.equal('tom');
    });

    it('routes different proxy groups to different upstream services', async () => {
        const output = createOutputChannel();
        const userPort = await getFreePort();
        const orderPort = await getFreePort();
        const paymentPort = await getFreePort();
        manager = createMockServerManager(
            [
                createHttpGroup({
                    id: 'user-group',
                    port: userPort,
                    interceptPrefix: '/api',
                    baseUrl: getUpstreamHttpBase(0),
                    stripPrefix: true,
                }),
                createHttpGroup({
                    id: 'order-group',
                    port: orderPort,
                    interceptPrefix: '/order-api',
                    baseUrl: getUpstreamHttpBase(1),
                    stripPrefix: true,
                }),
                createHttpGroup({
                    id: 'payment-group',
                    port: paymentPort,
                    interceptPrefix: '/pay-api',
                    baseUrl: getUpstreamHttpBase(2),
                    stripPrefix: true,
                }),
            ],
            output
        );

        await manager.start();

        const userResponse = await httpRequest({
            url: `http://localhost:${userPort}/api/users`,
        });
        const orderResponse = await httpRequest({
            url: `http://localhost:${orderPort}/order-api/orders/3009`,
        });
        const paymentResponse = await httpRequest({
            url: `http://localhost:${paymentPort}/pay-api/checkout/preview`,
        });

        expect(JSON.parse(userResponse.body).meta.total).to.equal(3);
        expect(JSON.parse(orderResponse.body).data.id).to.equal('3009');
        expect(JSON.parse(paymentResponse.body).message).to.equal('preview');
    });
});
