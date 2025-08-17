import * as vscode from 'vscode';

interface PromptHistoryItem {
    content: string;
    timestamp: string;
}

class PromptHistoryManager {
    private static instance: PromptHistoryManager;
    private panel: vscode.WebviewPanel | undefined;

    static getInstance(): PromptHistoryManager {
        if (!PromptHistoryManager.instance) {
            PromptHistoryManager.instance = new PromptHistoryManager();
        }
        return PromptHistoryManager.instance;
    }

    getHistoryFromCell(cell: vscode.NotebookCell): PromptHistoryItem[] {
        const metadata = cell.metadata || {};
        const history = metadata.history || [];
        
        return history.map((item: any) => ({
            content: item.content || '',
            timestamp: item.timestamp || new Date().toISOString()
        }));
    }

    showHistoryPanel(cell: vscode.NotebookCell) {
        const historyItems = this.getHistoryFromCell(cell);
        
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            'promptHistory',
            'Prompt History',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent(historyItems);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'selectPrompt':
                        this.insertPromptToCell(cell, message.prompt);
                        break;
                }
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async insertPromptToCell(cell: vscode.NotebookCell, prompt: string) {
        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(0, 0, cell.document.lineCount, 0);
            edit.replace(cell.document.uri, fullRange, prompt);
            await vscode.workspace.applyEdit(edit);
            
            // Focus the cell after inserting the prompt
            const activeEditor = vscode.window.activeNotebookEditor;
            if (activeEditor) {
                const cellIndex = cell.index;
                if (cellIndex >= 0) {
                    const selection = new vscode.NotebookRange(cellIndex, cellIndex + 1);
                    activeEditor.selection = selection;
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to insert prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getWebviewContent(historyItems: PromptHistoryItem[]): string {
        const historyHtml = historyItems
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(item => {
                const truncatedPrompt = item.content.length > 100 
                    ? item.content.substring(0, 100) + '...' 
                    : item.content;
                
                const formattedTime = new Date(item.timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                return `
                    <div class="history-item" onclick="selectPrompt(\`${this.escapeForJs(item.content)}\`)">
                        <div class="timestamp">${this.escapeHtml(formattedTime)}</div>
                        <div class="prompt-preview">${this.escapeHtml(truncatedPrompt)}</div>
                    </div>
                `;
            })
            .join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Prompt History</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 16px;
                    }
                    
                    .header {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 16px;
                        color: var(--vscode-titleBar-activeForeground);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .header::before {
                        content: "📜";
                        font-size: 20px;
                    }
                    
                    .history-item {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 12px;
                        margin-bottom: 8px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background-color: var(--vscode-editor-background);
                    }
                    
                    .history-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    
                    .timestamp {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 6px;
                        font-weight: 500;
                    }
                    
                    .prompt-preview {
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        word-break: break-word;
                        line-height: 1.4;
                        color: var(--vscode-editor-foreground);
                    }
                    
                    .empty-state {
                        text-align: center;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                        margin-top: 32px;
                        padding: 32px;
                        border: 2px dashed var(--vscode-panel-border);
                        border-radius: 8px;
                    }
                    
                    .empty-state::before {
                        content: "📝";
                        display: block;
                        font-size: 48px;
                        margin-bottom: 16px;
                    }
                    
                    .history-count {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                <div class="header">Prompt History</div>
                ${historyItems.length > 0 ? `<div class="history-count">${historyItems.length} prompt${historyItems.length === 1 ? '' : 's'} in history</div>` : ''}
                ${historyItems.length > 0 ? historyHtml : '<div class="empty-state">No history available for this cell<br><small>Execute this prompt cell to start building history</small></div>'}
                
                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function selectPrompt(prompt) {
                        vscode.postMessage({
                            command: 'selectPrompt',
                            prompt: prompt
                        });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private escapeForJs(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }
}

export function registerPromptHistoryCommands(context: vscode.ExtensionContext) {
    const historyManager = PromptHistoryManager.getInstance();

    // Command to show history for a specific cell
    const showHistoryCommand = vscode.commands.registerCommand(
        'prompter.cell.showPromptHistory',
        async () => {
            const activeEditor = vscode.window.activeNotebookEditor;
            if (!activeEditor) {
                vscode.window.showErrorMessage('No active notebook editor');
                return;
            }

            // Get the currently selected cell
            const selection = activeEditor.selection;
            if (!selection) {
                vscode.window.showErrorMessage('No cell selected');
                return;
            }

            const cell = activeEditor.notebook.cellAt(selection.start);
            if (cell.kind !== vscode.NotebookCellKind.Code || cell.document.languageId !== 'prompt') {
                vscode.window.showErrorMessage('This command is only available for prompt cells');
                return;
            }

            historyManager.showHistoryPanel(cell);
        }
    );

    context.subscriptions.push(showHistoryCommand);

    // Export the history manager so other parts of the extension can use it
    return historyManager;
}

export { PromptHistoryManager };