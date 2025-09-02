import * as vscode from 'vscode';
import { Environment, EnvironmentDetector } from '../utils/environmentDetector';

export class KernelManager {
    private static instance: KernelManager;
    private currentKernel: Environment | null = null;
    private availableKernels: Environment[] = [];
    private onKernelChangedEmitter = new vscode.EventEmitter<Environment | null>();
    public readonly onKernelChanged = this.onKernelChangedEmitter.event;

    private constructor() {
        // 不创建自己的状态栏项目，而是使用extension.ts中的统一状态栏
    }

    public static getInstance(): KernelManager {
        if (!KernelManager.instance) {
            KernelManager.instance = new KernelManager();
        }
        return KernelManager.instance;
    }

    public async initialize(): Promise<void> {
        await this.detectKernels();
        this.autoSelectDefaultKernel();
    }

    private async detectKernels(): Promise<void> {
        const detector = EnvironmentDetector.getInstance();
        this.availableKernels = await detector.detectEnvironments();
    }

    private autoSelectDefaultKernel(): void {
        if (this.availableKernels.length > 0) {
            // 优先选择Python环境，如果没有则选择Node.js环境
            const pythonEnv = this.availableKernels.find(env => env.type === 'python');
            const nodeEnv = this.availableKernels.find(env => env.type === 'nodejs');
            
            this.currentKernel = pythonEnv || nodeEnv || this.availableKernels[0];
            this.onKernelChangedEmitter.fire(this.currentKernel);
        }
    }

    public async selectKernel(): Promise<void> {
        if (this.availableKernels.length === 0) {
            vscode.window.showWarningMessage('未检测到可用的执行环境');
            return;
        }

        interface KernelQuickPickItem extends vscode.QuickPickItem {
            env: Environment;
        }

        const items: KernelQuickPickItem[] = this.availableKernels.map(env => ({
            label: env.displayName,
            description: env.path,
            detail: `类型: ${env.type === 'python' ? 'Python' : 'Node.js'}`,
            env: env
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择执行环境',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            this.currentKernel = selected.env;
            this.onKernelChangedEmitter.fire(this.currentKernel);
            vscode.window.showInformationMessage(`已切换到: ${selected.env.displayName}`);
        }
    }

    public getCurrentKernel(): Environment | null {
        return this.currentKernel;
    }

    public getKernelForLanguage(language: string): Environment | null {
        if (!this.currentKernel) {
            return null;
        }

        // 如果当前kernel类型匹配语言，直接返回
        if ((language === 'python' && this.currentKernel.type === 'python') ||
            (language === 'javascript' && this.currentKernel.type === 'nodejs')) {
            return this.currentKernel;
        }

        // 否则查找匹配的环境
        const targetType = language === 'python' ? 'python' : 'nodejs';
        return this.availableKernels.find(env => env.type === targetType) || null;
    }

    public getStatusBarText(): string {
        if (this.currentKernel) {
            return `$(server-environment) ${this.currentKernel.type === 'python' ? 'Python' : 'Node.js'}: ${this.currentKernel.version}`;
        } else {
            return '$(server-environment) 未选择环境';
        }
    }

    public async refreshKernels(): Promise<void> {
        await this.detectKernels();
        
        // 如果当前kernel不在新的列表中，重新选择
        if (this.currentKernel && !this.availableKernels.some(env => env.path === this.currentKernel!.path)) {
            this.autoSelectDefaultKernel();
        }
        
        // 触发状态栏更新事件
        this.onKernelChangedEmitter.fire(this.currentKernel);
    }

    public dispose(): void {
        this.onKernelChangedEmitter.dispose();
    }
}