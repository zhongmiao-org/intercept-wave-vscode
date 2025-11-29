import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
    WsServerManager,
    ProxyGroup,
    WsRule,
    WsManualTarget,
} from '../../common';

describe('WsServerManager (unit)', () => {
    let outputChannel: vscode.OutputChannel;
    let appendLineStub: sinon.SinonStub;
    let wsManager: WsServerManager;

    function createBaseGroup(overrides: Partial<ProxyGroup> = {}): ProxyGroup {
        return {
            id: 'g1',
            name: 'G1',
            port: 12345,
            interceptPrefix: '/api',
            baseUrl: 'http://localhost:8080',
            stripPrefix: true,
            globalCookie: '',
            enabled: true,
            mockApis: [],
            protocol: 'WS',
            wsBaseUrl: null,
            wsInterceptPrefix: null,
            wsManualPush: true,
            wsPushRules: [],
            wssEnabled: false,
            wssKeystorePath: null,
            wssKeystorePassword: null,
            ...overrides,
        };
    }

    beforeEach(() => {
        appendLineStub = sinon.stub();
        outputChannel = {
            appendLine: appendLineStub,
            show: sinon.stub(),
        } as any;

        wsManager = new WsServerManager(outputChannel);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getEffectiveWsPath (private)', () => {
        it('returns raw path when no wsInterceptPrefix', () => {
            const group = createBaseGroup({ wsInterceptPrefix: null, stripPrefix: true });
            const fn = (wsManager as any).getEffectiveWsPath.bind(wsManager) as (
                rawPath: string,
                g: ProxyGroup
            ) => string;

            expect(fn('/ws/echo', group)).to.equal('/ws/echo');
            expect(fn('ws/echo', group)).to.equal('/ws/echo');
        });

        it('strips wsInterceptPrefix when stripPrefix=true', () => {
            const group = createBaseGroup({ wsInterceptPrefix: '/ws', stripPrefix: true });
            const fn = (wsManager as any).getEffectiveWsPath.bind(wsManager) as (
                rawPath: string,
                g: ProxyGroup
            ) => string;

            expect(fn('/ws/echo', group)).to.equal('/echo');
            expect(fn('/ws/echo/sub', group)).to.equal('/echo/sub');
        });

        it('does not strip prefix when stripPrefix=false', () => {
            const group = createBaseGroup({ wsInterceptPrefix: '/ws', stripPrefix: false });
            const fn = (wsManager as any).getEffectiveWsPath.bind(wsManager) as (
                rawPath: string,
                g: ProxyGroup
            ) => string;

            expect(fn('/ws/echo', group)).to.equal('/ws/echo');
        });
    });

    describe('startGroup / stopGroup (using fake ws server)', () => {
        class FakeWebSocketServer {
            public static instances: FakeWebSocketServer[] = [];
            public handlers: Record<string, Array<(...args: any[]) => void>> = {};
            public closed = false;

            constructor(public opts: any) {
                FakeWebSocketServer.instances.push(this);
            }

            on(event: string, handler: (...args: any[]) => void): void {
                if (!this.handlers[event]) this.handlers[event] = [];
                this.handlers[event].push(handler);
            }

            close(cb?: () => void): void {
                this.closed = true;
                if (cb) cb();
            }

            emit(event: string, ...args: any[]): void {
                const hs = this.handlers[event] || [];
                hs.forEach(h => h(...args));
            }
        }

        it('startGroup registers WS server and stopGroup removes it', async () => {
            const group = createBaseGroup({
                id: 'ws-group',
                name: 'WS Group',
                port: 18080,
                protocol: 'WS',
            });

            const wsManagerLocal = new WsServerManager(outputChannel, {
                WebSocketServer: FakeWebSocketServer,
            } as any);

            const startPromise = wsManagerLocal.startGroup(group);
            // There should be one fake server instance created
            const fakeServer = FakeWebSocketServer.instances[0];
            expect(fakeServer).to.exist;

            // Simulate underlying "listening" event to resolve startGroup promise
            fakeServer.emit('listening');
            await startPromise;

            expect(wsManagerLocal.getGroupStatus('ws-group')).to.be.true;

            // Now stop the group; fake close will toggle flag and resolve
            await wsManagerLocal.stopGroup('ws-group');
            expect(wsManagerLocal.getGroupStatus('ws-group')).to.be.false;
            expect(fakeServer.closed).to.be.true;

            FakeWebSocketServer.instances = [];
        });
    });

    describe('handleInboundOrOutboundMessage (private)', () => {
        function invoke(
            group: ProxyGroup,
            ctxOverrides: Partial<any>,
            direction: 'in' | 'out',
            text: string
        ) {
            const ctx: any = {
                id: 'c1',
                groupId: group.id,
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {} as any,
                timers: [],
                ...ctxOverrides,
            };

            const fn = (wsManager as any).handleInboundOrOutboundMessage.bind(
                wsManager
            ) as (
                g: ProxyGroup,
                c: any,
                dir: 'in' | 'out',
                t: string,
                bytes: number,
                source: 'client' | 'upstream'
            ) => { intercepted: boolean; matchedRules: WsRule[]; interceptRules: WsRule[] };

            const bytes = Buffer.byteLength(text, 'utf-8');
            const result = fn(group, ctx, direction, text, bytes, 'client');
            return { ctx, result };
        }

        it('returns non-intercept when there are no rules', () => {
            const group = createBaseGroup({ wsPushRules: [] });
            const { result } = invoke(group, {}, 'out', '{"action":"test"}');
            expect(result.intercepted).to.be.false;
            expect(result.matchedRules).to.have.length(0);
        });

        it('matches rule by path, direction and eventKey/value and intercepts', () => {
            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: 'action',
                eventValue: 'test',
                direction: 'out',
                intercept: true,
                mode: 'off',
                periodSec: 0,
                message: '{"reply":"ok"}',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };
            const group = createBaseGroup({ wsPushRules: [rule] });

            const { ctx, result } = invoke(group, {}, 'out', '{"action":"test"}');

            expect(result.intercepted).to.be.true;
            expect(result.matchedRules).to.have.length(1);
            expect(result.interceptRules).to.have.length(1);
            expect(result.interceptRules[0]).to.equal(rule);
            expect(ctx.lastOutEvent).to.deep.equal({ key: 'action', value: 'test' });
        });

        it('records lastInEvent when direction=in', () => {
            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                // no eventKey -> always match by path/direction
                eventKey: undefined,
                eventValue: undefined,
                direction: 'in',
                intercept: false,
                mode: 'off',
                periodSec: 0,
                message: '',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };
            const group = createBaseGroup({ wsPushRules: [rule] });

            const { ctx, result } = invoke(group, {}, 'in', '{"foo":"bar"}');
            expect(result.intercepted).to.be.false;
            expect(result.matchedRules).to.have.length(1);
            expect(ctx.lastInEvent).to.deep.equal({ key: 'foo', value: 'bar' });
        });

        it('respects direction filtering', () => {
            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: 'action',
                eventValue: 'test',
                direction: 'in',
                intercept: true,
                mode: 'off',
                periodSec: 0,
                message: '{"reply":"ok"}',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };
            const group = createBaseGroup({ wsPushRules: [rule] });

            const { result } = invoke(group, {}, 'out', '{"action":"test"}');
            expect(result.intercepted).to.be.false;
            expect(result.matchedRules).to.have.length(0);
        });
    });

    describe('manualPushByRule / manualPushCustom', () => {
        function createCtx(id: string, path: string, lastActivityAt: number) {
            return {
                id,
                groupId: 'g1',
                path,
                createdAt: Date.now(),
                lastActivityAt,
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [],
            };
        }

        it('manualPushByRule sends payload to selected connections', async () => {
            const entry: any = {
                server: {} as any,
                connections: new Map<string, any>([
                    ['c1', createCtx('c1', '/echo', 1)],
                    ['c2', createCtx('c2', '/other', 2)],
                ]),
            };
            // Inject entry into private servers map
            const servers: Map<string, any> = (wsManager as any).servers;
            servers.set('g1', entry);

            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'off',
                periodSec: 0,
                message: '{"ping":1}',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };

            const ok = await wsManager.manualPushByRule('g1', rule, 'match' as WsManualTarget, [
                rule,
            ]);
            expect(ok).to.be.true;

            const c1 = entry.connections.get('c1');
            const c2 = entry.connections.get('c2');
            expect(c1.socket.send.calledOnce).to.be.true;
            expect(c1.socket.send.firstCall.args[0]).to.equal('{"ping":1}');
            expect(c2.socket.send.called).to.be.false;
        });

        it('manualPushCustom sends to all connections when target=all', async () => {
            const entry: any = {
                server: {} as any,
                connections: new Map<string, any>([
                    ['c1', createCtx('c1', '/a', 1)],
                    ['c2', createCtx('c2', '/b', 2)],
                ]),
            };
            const servers: Map<string, any> = (wsManager as any).servers;
            servers.set('g2', entry);

            const payload = '{"custom":true}';
            const ok = await wsManager.manualPushCustom('g2', payload, 'all' as WsManualTarget, []);
            expect(ok).to.be.true;

            const c1 = entry.connections.get('c1');
            const c2 = entry.connections.get('c2');
            expect(c1.socket.send.calledOnce).to.be.true;
            expect(c2.socket.send.calledOnce).to.be.true;
        });

        it('manualPushCustom with target=recent picks most active connection', async () => {
            const entry: any = {
                server: {} as any,
                connections: new Map<string, any>([
                    ['old', createCtx('old', '/a', 1)],
                    ['new', createCtx('new', '/a', 10)],
                ]),
            };
            const servers: Map<string, any> = (wsManager as any).servers;
            servers.set('g3', entry);

            const payload = '{"recent":true}';
            const ok = await wsManager.manualPushCustom(
                'g3',
                payload,
                'recent' as WsManualTarget,
                []
            );
            expect(ok).to.be.true;

            const oldConn = entry.connections.get('old');
            const newConn = entry.connections.get('new');
            expect(newConn.socket.send.calledOnce).to.be.true;
            expect(oldConn.socket.send.called).to.be.false;
        });
    });

    describe('utility helpers', () => {
        it('safeBufferToString handles undefined and invalid buffer', () => {
            const fn = (wsManager as any).safeBufferToString.bind(wsManager) as (
                buf?: Buffer
            ) => string;
            expect(fn(undefined)).to.equal('');
            const buf = Buffer.from('abc', 'utf-8');
            expect(fn(buf)).to.equal('abc');
        });

        it('parseJson returns object on valid JSON and undefined on invalid', () => {
            const fn = (wsManager as any).parseJson.bind(wsManager) as (
                text: string
            ) => any;
            expect(fn('{"a":1}')).to.deep.equal({ a: 1 });
            expect(fn('invalid')).to.be.undefined;
        });

        it('clearConnectionTimers cancels all timers', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {} as any,
                timers: [] as NodeJS.Timeout[],
            };

            const timer1 = setTimeout(() => {
                // no-op
            }, 1000);
            const timer2 = setInterval(() => {
                // no-op
            }, 1000);
            ctx.timers.push(timer1, timer2);

            const fn = (wsManager as any).clearConnectionTimers.bind(wsManager) as (
                c: any
            ) => void;
            fn(ctx);

            expect(ctx.timers).to.deep.equal([]);
        });
    });

    describe('rule scheduling and matching', () => {
        let clock: sinon.SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
        });

        afterEach(() => {
            clock.restore();
        });

        it('scheduleRulesForConnection schedules periodic rule with onOpenFire', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [] as NodeJS.Timeout[],
            };

            const periodicRule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'periodic',
                periodSec: 1,
                message: '{"tick":1}',
                timeline: [],
                loop: false,
                onOpenFire: true,
            };

            const group = createBaseGroup({ wsPushRules: [periodicRule] });

            const scheduleFn = (wsManager as any).scheduleRulesForConnection.bind(
                wsManager
            ) as (c: any, g: ProxyGroup) => void;

            scheduleFn(ctx, group);

            // onOpenFire should trigger an immediate send
            expect(ctx.socket.send.callCount).to.equal(1);
            expect(ctx.timers.length).to.be.greaterThan(0);

            // Advance time to trigger the interval once
            clock.tick(1000);
            expect(ctx.socket.send.callCount).to.be.greaterThan(1);
        });

        it('schedulePeriodic logs and skips when periodSec <= 0', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [] as NodeJS.Timeout[],
            };

            const badRule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'periodic',
                periodSec: 0,
                message: '{"tick":1}',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };

            const group = createBaseGroup({ wsPushRules: [badRule] });
            const scheduleFn = (wsManager as any).scheduleRulesForConnection.bind(
                wsManager
            ) as (c: any, g: ProxyGroup) => void;

            scheduleFn(ctx, group);

            // No timers should be scheduled
            expect(ctx.timers.length).to.equal(0);
            // And a warning log should be emitted
            const logs = appendLineStub.args.map(a => String(a[0]));
            expect(
                logs.some(l => l.includes('periodic rule has invalid periodSec'))
            ).to.be.true;
        });

        it('scheduleTimeline schedules sends based on atMs', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [] as NodeJS.Timeout[],
            };

            const timelineRule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'timeline',
                periodSec: 0,
                message: '{"t":1}', // non-empty to satisfy scheduleRulesForConnection guard
                timeline: [{ atMs: 100, message: '{"t":1}' }],
                loop: false,
                onOpenFire: false,
            };

            const group = createBaseGroup({ wsPushRules: [timelineRule] });
            const scheduleFn = (wsManager as any).scheduleRulesForConnection.bind(
                wsManager
            ) as (c: any, g: ProxyGroup) => void;

            scheduleFn(ctx, group);
            expect(ctx.timers.length).to.be.greaterThan(0);

            clock.tick(100); // trigger first timeline item
            expect(ctx.socket.send.calledOnce).to.be.true;
            expect(ctx.socket.send.firstCall.args[0]).to.equal('{"t":1}');
        });

        it('scheduleTimeline supports legacy numeric timeline', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [] as NodeJS.Timeout[],
            };

            const legacyRule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'timeline',
                periodSec: 0,
                message: '{"legacy":1}',
                timeline: [1], // seconds
                loop: false,
                onOpenFire: false,
            } as any;

            const group = createBaseGroup({ wsPushRules: [legacyRule] });
            const scheduleFn = (wsManager as any).scheduleRulesForConnection.bind(
                wsManager
            ) as (c: any, g: ProxyGroup) => void;

            scheduleFn(ctx, group);
            expect(ctx.timers.length).to.be.greaterThan(0);

            // 1 second in legacy timeline means 1000ms
            clock.tick(1000);
            expect(ctx.socket.send.calledOnce).to.be.true;
            expect(ctx.socket.send.firstCall.args[0]).to.equal('{"legacy":1}');
        });

        it('matchesRuleForConnection checks path and eventKey/value', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {} as any,
                timers: [],
                lastInEvent: { key: 'action', value: 'test' },
                lastOutEvent: { key: 'other', value: 'x' },
            };

            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: 'action',
                eventValue: 'test',
                direction: 'both',
                intercept: false,
                mode: 'off',
                periodSec: 0,
                message: '',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };

            const fn = (wsManager as any).matchesRuleForConnection.bind(
                wsManager
            ) as (c: any, r: WsRule) => boolean;

            expect(fn(ctx, rule)).to.be.true;

            // Different value should not match
            const rule2 = { ...rule, eventValue: 'nope' };
            expect(fn(ctx, rule2)).to.be.false;

            // Different path should not match
            const rule3 = { ...rule, path: '/other' };
            expect(fn(ctx, rule3)).to.be.false;
        });

        it('resetAndRescheduleForConnection clears timers and applies allRules', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {
                    readyState: 1,
                    send: sinon.stub(),
                },
                timers: [] as NodeJS.Timeout[],
            };

            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: undefined,
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'periodic',
                periodSec: 1,
                message: '{"auto":1}',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };

            // Pre-populate timers to verify they are cleared
            ctx.timers.push(setInterval(() => {}, 1000));

            const resetFn = (wsManager as any).resetAndRescheduleForConnection.bind(
                wsManager
            ) as (c: any, rules?: WsRule[]) => void;

            resetFn(ctx, [rule]);

            expect(ctx.timers.length).to.be.greaterThan(0);

            // Advance time to trigger periodic send
            clock.tick(1000);
            expect(ctx.socket.send.calledOnce).to.be.true;
        });

        it('trackOutboundEvent and trackOutboundCustomEvent record lastOutEvent', () => {
            const ctx: any = {
                id: 'c1',
                groupId: 'g1',
                path: '/echo',
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                socket: {} as any,
                timers: [],
            };

            const rule: WsRule = {
                enabled: true,
                path: '/echo',
                eventKey: 'action',
                eventValue: undefined,
                direction: 'out',
                intercept: false,
                mode: 'off',
                periodSec: 0,
                message: '',
                timeline: [],
                loop: false,
                onOpenFire: false,
            };

            const trackFn = (wsManager as any).trackOutboundEvent.bind(
                wsManager
            ) as (c: any, r: WsRule, payload: string) => void;
            const trackCustomFn = (wsManager as any).trackOutboundCustomEvent.bind(
                wsManager
            ) as (c: any, payload: string) => void;

            trackFn(ctx, rule, '{"action":"test"}');
            expect(ctx.lastOutEvent).to.deep.equal({ key: 'action', value: 'test' });

            trackCustomFn(ctx, '{"foo":"bar"}');
            expect(ctx.lastOutEvent).to.deep.equal({ key: 'foo', value: 'bar' });
        });
    });
});
