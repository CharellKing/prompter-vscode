import * as vscode from 'vscode';
import { KernelManager } from '../controllers/kernelManager';

export function registerSelectKernelCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.selectKernel', async () => {
        const kernelManager = KernelManager.getInstance();
        await kernelManager.selectKernel();
    });
    
    context.subscriptions.push(command);
}

export function registerRefreshKernelsCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.refreshKernels', async () => {
        const kernelManager = KernelManager.getInstance();
        await kernelManager.refreshKernels();
        vscode.window.showInformationMessage('Execution environment list refreshed');
    });
    
    context.subscriptions.push(command);
}