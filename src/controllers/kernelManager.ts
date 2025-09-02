import * as vscode from 'vscode';
import { Environment, EnvironmentDetector } from '../utils/environmentDetector';

export class KernelManager {
    private static instance: KernelManager;
    private currentKernel: Environment | null = null;
    private availableKernels: Environment[] = [];
    private onKernelChangedEmitter = new vscode.EventEmitter<Environment | null>();
    public readonly onKernelChanged = this.onKernelChangedEmitter.event;

    private constructor() {
        // Don't create own status bar item, use the unified status bar in extension.ts
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
            // Prefer Python environment, if not available then select Node.js environment
            const pythonEnv = this.availableKernels.find(env => env.type === 'python');
            const nodeEnv = this.availableKernels.find(env => env.type === 'nodejs');
            
            this.currentKernel = pythonEnv || nodeEnv || this.availableKernels[0];
            this.onKernelChangedEmitter.fire(this.currentKernel);
        }
    }

    public async selectKernel(): Promise<void> {
        if (this.availableKernels.length === 0) {
            vscode.window.showWarningMessage('No available execution environments detected');
            return;
        }

        interface KernelQuickPickItem extends vscode.QuickPickItem {
            env: Environment;
        }

        const items: KernelQuickPickItem[] = this.availableKernels.map(env => ({
            label: env.displayName,
            description: env.path,
            detail: `Type: ${env.type === 'python' ? 'Python' : 'Node.js'}`,
            env: env
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select execution environment',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            this.currentKernel = selected.env;
            this.onKernelChangedEmitter.fire(this.currentKernel);
            vscode.window.showInformationMessage(`Switched to: ${selected.env.displayName}`);
        }
    }

    public getCurrentKernel(): Environment | null {
        return this.currentKernel;
    }

    public getKernelForLanguage(language: string): Environment | null {
        if (!this.currentKernel) {
            return null;
        }

        // If current kernel type matches language, return directly
        if ((language === 'python' && this.currentKernel.type === 'python') ||
            (language === 'javascript' && this.currentKernel.type === 'nodejs')) {
            return this.currentKernel;
        }

        // Otherwise find matching environment
        const targetType = language === 'python' ? 'python' : 'nodejs';
        return this.availableKernels.find(env => env.type === targetType) || null;
    }

    public getStatusBarText(): string {
        if (this.currentKernel) {
            return `$(server-environment) ${this.currentKernel.type === 'python' ? 'Python' : 'Node.js'}: ${this.currentKernel.version}`;
        } else {
            return '$(server-environment) No environment selected';
        }
    }

    public async refreshKernels(): Promise<void> {
        await this.detectKernels();
        
        // If current kernel is not in the new list, reselect
        if (this.currentKernel && !this.availableKernels.some(env => env.path === this.currentKernel!.path)) {
            this.autoSelectDefaultKernel();
        }
        
        // Trigger status bar update event
        this.onKernelChangedEmitter.fire(this.currentKernel);
    }

    public dispose(): void {
        this.onKernelChangedEmitter.dispose();
    }
}