import * as vscode from 'vscode';

interface Messages {
    [key: string]: string;
}

const messages: { [locale: string]: Messages } = {
    'en': {
        'server.started': 'Mock server started successfully! Access URL: {0}',
        'server.stopped': 'Mock server stopped successfully',
        'server.alreadyRunning': 'Mock server is already running',
        'server.startFailed': 'Failed to start mock server: {0}',
        'server.stopFailed': 'Failed to stop mock server: {0}',
        'config.saved': 'Configuration saved successfully',
        'config.title': 'Intercept Wave Configuration'
    },
    'zh-cn': {
        'server.started': 'Mock 服务器启动成功！访问地址: {0}',
        'server.stopped': 'Mock 服务器已停止',
        'server.alreadyRunning': 'Mock 服务器已经在运行',
        'server.startFailed': '启动 Mock 服务器失败: {0}',
        'server.stopFailed': '停止 Mock 服务器失败: {0}',
        'config.saved': '配置保存成功',
        'config.title': 'Intercept Wave 配置'
    }
};

function getLocale(): string {
    const locale = vscode.env.language.toLowerCase();
    // 支持 zh-cn, zh-tw 等变体
    if (locale.startsWith('zh')) {
        return 'zh-cn';
    }
    return 'en';
}

export function t(key: string, ...args: string[]): string {
    const locale = getLocale();
    const localeMessages = messages[locale] || messages['en'];
    let message = localeMessages[key] || messages['en'][key] || key;

    // 替换占位符 {0}, {1}, etc.
    args.forEach((arg, index) => {
        message = message.replace(`{${index}}`, arg);
    });

    return message;
}