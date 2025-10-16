/**
 * Mock implementation of VS Code API for testing
 */

export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
}

export class Uri {
    constructor(public scheme: string, public authority: string, public path: string, public query: string, public fragment: string) {}

    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }

    static parse(value: string): Uri {
        return new Uri('file', '', value, '', '');
    }

    get fsPath(): string {
        return this.path;
    }

    toString(): string {
        return this.path;
    }
}

export interface WorkspaceFolder {
    uri: Uri;
    name: string;
    index: number;
}

export const workspace = {
    workspaceFolders: undefined as WorkspaceFolder[] | undefined,
    getConfiguration: () => ({
        get: () => undefined,
        update: () => Promise.resolve()
    })
};

export const env = {
    language: 'en'
};

export const window = {
    showInformationMessage: () => Promise.resolve(),
    showErrorMessage: () => Promise.resolve(),
    showWarningMessage: () => Promise.resolve()
};