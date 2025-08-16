import * as vscode from 'vscode';

/**
 * Intercepts the built-in insertCodeCellBelow command
 * @param context The extension context
 */
export function registerCodeCellInterceptor(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('notebook.cell.insertCodeCellBelow', async (...args) => {
        // 重定向到我们自己的命令
        await vscode.commands.executeCommand('prompter.cell.insertCodeCellBelow', ...args);
    });
    
    context.subscriptions.push(command);
    return command;
}
