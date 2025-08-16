import * as vscode from 'vscode';

/**
 * Intercepts the built-in insertCodeCellBelow command
 * @param context The extension context
 */
export function registerCodeCellInterceptor(context: vscode.ExtensionContext) {
    const commandBelow = vscode.commands.registerCommand('notebook.cell.insertCodeCellBelow', async (...args) => {
        // 检查当前活动的文档是否是 Prompter Notebook
        if (isPrompterNotebook()) {
            // 重定向到我们自己的命令
            await vscode.commands.executeCommand('prompter.cell.insertCodeCellBelow', ...args);
        } else {
            // 对于非 Prompter Notebook，执行原始命令
            await vscode.commands.executeCommand('_notebook.cell.insertCodeCellBelow', ...args);
        }
    });
    
    const commandAbove = vscode.commands.registerCommand('notebook.cell.insertCodeCellAbove', async (...args) => {
        // 检查当前活动的文档是否是 Prompter Notebook
        if (isPrompterNotebook()) {
            // 重定向到我们自己的命令
            await vscode.commands.executeCommand('prompter.cell.insertCodeCellAbove', ...args);
        } else {
            // 对于非 Prompter Notebook，执行原始命令
            await vscode.commands.executeCommand('_notebook.cell.insertCodeCellAbove', ...args);
        }
    });

    /**
     * 检查当前活动的文档是否是 Prompter Notebook
     * @returns 如果是 Prompter Notebook 则返回 true，否则返回 false
     */
    function isPrompterNotebook(): boolean {
        const activeNotebookEditor = vscode.window.activeNotebookEditor;
        if (!activeNotebookEditor) {
            return false;
        }
        
        // 检查 notebook 类型是否为 'prompter-notebook'
        return activeNotebookEditor.notebook.notebookType === 'prompter-notebook';
    }
    
    context.subscriptions.push(commandBelow, commandAbove);
    return [commandBelow, commandAbove];
}
