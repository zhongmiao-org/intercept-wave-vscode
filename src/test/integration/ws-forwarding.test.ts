import { afterEach, before, describe, it } from 'mocha';
import { expect } from 'chai';
import WebSocket from 'ws';
import { MockServerManager } from '../../common';
import {
    UPSTREAM_TOKEN,
    createInterceptRule,
    createMockServerManager,
    createOutputChannel,
    createWsGroup,
    ensureWsUpstreamAvailable,
    getFreePort,
    getUpstreamWsBase,
    openWebSocket,
} from './helpers/upstream';

describe('WS Forwarding Integration', function () {
    this.timeout(20000);

    let manager: MockServerManager | undefined;

    before(async () => {
        await ensureWsUpstreamAvailable();
    });

    afterEach(async () => {
        if (manager) {
            await manager.stop();
            manager = undefined;
        }
    });

    it('bridges client traffic to upstream echo service', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createWsGroup({
                    id: 'ws-echo-bridge',
                    port,
                    wsBaseUrl: getUpstreamWsBase(0),
                    wsInterceptPrefix: null,
                    wsPushRules: [],
                }),
            ],
            output
        );

        await manager.start();

        const { ws, waitForMessage } = await openWebSocket(
            `ws://localhost:${port}/ws/echo?token=${UPSTREAM_TOKEN}`
        );

        try {
            ws.send('hello upstream ws');
            const response = await waitForMessage();
            expect(response).to.equal('hello upstream ws');
            expect(output.logs.some(line => line.includes('Upstream connected'))).to.equal(true);
            expect(
                output.logs.some(
                    line =>
                        line.includes('FORWARD → upstream') ||
                        line.includes('FORWARD(queue) → upstream')
                )
            ).to.equal(true);
            expect(output.logs.some(line => line.includes('FORWARD ← upstream'))).to.equal(true);
        } finally {
            ws.close();
        }
    });

    it('connects successfully when upstream token is present', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createWsGroup({
                    id: 'ws-auth-bridge',
                    port,
                    wsBaseUrl: getUpstreamWsBase(0),
                    wsInterceptPrefix: null,
                }),
            ],
            output
        );

        await manager.start();

        const ws = await new Promise<WebSocket>((resolve, reject) => {
            const client = new WebSocket(
                `ws://localhost:${port}/ws/echo?token=${UPSTREAM_TOKEN}`
            );
            const timer = setTimeout(() => {
                client.terminate();
                reject(new Error('Timed out waiting for local bridge connection'));
            }, 5000);

            client.once('open', () => {
                clearTimeout(timer);
                resolve(client);
            });
            client.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });
        });

        ws.close();
        expect(output.logs.some(line => line.includes('CONNECT id='))).to.equal(true);
    });

    it('intercepts outbound messages using wsInterceptPrefix + stripPrefix matching', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createWsGroup({
                    id: 'ws-intercept-bridge',
                    port,
                    wsBaseUrl: getUpstreamWsBase(0),
                    wsInterceptPrefix: '/bridge',
                    stripPrefix: true,
                    wsPushRules: [createInterceptRule()],
                }),
            ],
            output
        );

        await manager.start();

        const { ws, waitForMessage } = await openWebSocket(
            `ws://localhost:${port}/bridge/ws/echo?token=${UPSTREAM_TOKEN}`
        );

        try {
            ws.send(JSON.stringify({ type: 'ping', payload: 'blocked' }));
            const response = await waitForMessage();
            expect(JSON.parse(response)).to.deep.equal({
                type: 'intercepted',
                source: 'local-rule',
            });
            expect(output.logs.some(line => line.includes('INTERCEPT('))).to.equal(true);
        } finally {
            ws.close();
        }
    });

    it('queues early messages until upstream becomes open and then flushes them', async () => {
        const output = createOutputChannel();
        const port = await getFreePort();
        manager = createMockServerManager(
            [
                createWsGroup({
                    id: 'ws-queue-bridge',
                    port,
                    wsBaseUrl: getUpstreamWsBase(0),
                    wsInterceptPrefix: null,
                    wsPushRules: [],
                }),
            ],
            output
        );

        await manager.start();

        const { ws, waitForMessage } = await openWebSocket(
            `ws://localhost:${port}/ws/echo?token=${UPSTREAM_TOKEN}`
        );

        try {
            ws.send('queued message');
            const response = await waitForMessage();
            expect(response).to.equal('queued message');
            expect(output.logs.some(line => line.includes('QUEUE → upstream'))).to.equal(true);
            expect(output.logs.some(line => line.includes('FORWARD(queue) → upstream'))).to.equal(
                true
            );
        } finally {
            ws.close();
        }
    });
});
