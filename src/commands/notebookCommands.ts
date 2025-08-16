import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { PrompterCellKind } from './promptCellCommands';

// 创建新的notebook命令
export function registerCreateNotebookCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.createNotebook', async () => {
        const uri = vscode.Uri.parse(`untitled:Untitled-${Date.now()}.ppnb`);
        
        // 获取默认代码语言
        const config = vscode.workspace.getConfiguration('prompter');
        const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
        
        // 创建符合新格式的notebook数据
        const cells = [
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '# Welcome to Prompter!\n\nThis is a new Prompter notebook. You can create code and markdown cells to build interactive documents.',
                'prompt'
            ),
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '',
                defaultLanguage
            )
        ];
        
        // 为每个cell添加ID
        cells.forEach((cell, index) => {
            cell.metadata = {
                id: `cell-${uuidv4()}`
            };
        });
        
        const notebookData = new vscode.NotebookData(cells);
        
        const doc = await vscode.workspace.openNotebookDocument('prompter-notebook', notebookData);
        await vscode.window.showNotebookDocument(doc);
    });
    
    context.subscriptions.push(command);
    return command;
}

// 运行单元格命令
export function registerRunCellCommand(context: vscode.ExtensionContext, cellExecutor: any) {
    const command = vscode.commands.registerCommand('prompter.notebook.runCell', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const cell = editor.notebook.cellAt(editor.selection.start);
            if (cell) {
                await cellExecutor.executeCell(cell);
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 运行所有单元格命令
export function registerRunAllCellsCommand(context: vscode.ExtensionContext, cellExecutor: any) {
    const command = vscode.commands.registerCommand('prompter.notebook.runAllCells', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            for (const cell of editor.notebook.getCells()) {
                if (cell.kind === vscode.NotebookCellKind.Code) {
                    await cellExecutor.executeCell(cell);
                }
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 保存notebook命令
export function registerSaveNotebookCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.saveNotebook', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor || editor.notebook.notebookType !== 'prompter-notebook') {
            vscode.window.showInformationMessage('No active Prompter notebook to save.');
            return;
        }
        try {
            if (editor.notebook.uri.scheme === 'file') {
                await vscode.commands.executeCommand('workbench.action.files.save');
            } else {
                await vscode.commands.executeCommand('workbench.action.files.saveAs');
            }
        } catch (err) {
            console.error('Manual save failed:', err);
            vscode.window.showErrorMessage(`Manual save failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 设置单元格类型命令
export function registerSetCellTypeCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.setCellType', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor) {
            return;
        }

        let targetCell: vscode.NotebookCell;
        
        if (typeof cellIndex === 'number') {
            targetCell = editor.notebook.cellAt(cellIndex);
        } else {
            targetCell = editor.notebook.cellAt(editor.selection.start);
        }

        if (!targetCell) {
            return;
        }

        // 定义可用的cell类型
        const cellTypes = [
            { label: '$(code) Code Cell', value: 'code', description: 'Execute code in various languages' },
            { label: '$(sparkle) Prompt Cell', value: 'prompt', description: 'Send prompts to LLM' },
            { label: '$(markdown) Markdown Cell', value: 'markdown', description: 'Rich text and documentation' }
        ];

        const selectedType = await vscode.window.showQuickPick(cellTypes, {
            placeHolder: 'Select cell type',
            ignoreFocusOut: true
        });

        if (!selectedType) {
            return;
        }

        // 根据选择的类型设置cell
        let newCellKind: vscode.NotebookCellKind;
        let newLanguage: string;
        let newMetadata: any = { ...targetCell.metadata };

        switch (selectedType.value) {
            case 'code':
                newCellKind = vscode.NotebookCellKind.Code;
                const config = vscode.workspace.getConfiguration('prompter');
                newLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
                delete newMetadata.customCellKind;
                break;
            case 'prompt':
                newCellKind = vscode.NotebookCellKind.Code;
                newLanguage = 'prompt';
                newMetadata.customCellKind = PrompterCellKind.Prompt;
                break;
            case 'markdown':
                newCellKind = vscode.NotebookCellKind.Markup;
                newLanguage = 'markdown';
                delete newMetadata.customCellKind;
                break;
            default:
                return;
        }

        // 创建新的cell数据
        const newCellData = new vscode.NotebookCellData(
            newCellKind,
            targetCell.document.getText(),
            newLanguage
        );
        newCellData.metadata = newMetadata;

        // 替换cell
        const edit = new vscode.WorkspaceEdit();
        const nbEdit = vscode.NotebookEdit.replaceCells(
            new vscode.NotebookRange(targetCell.index, targetCell.index + 1),
            [newCellData]
        );
        edit.set(editor.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage(`Cell type changed to ${selectedType.label.replace(/\$\([^)]+\)\s*/, '')}`);
    });
    
    // 注册语言模式变更事件处理
    context.subscriptions.push(
        vscode.workspace.onDidChangeNotebookDocument(event => {
            if (event.notebook.notebookType !== 'prompter-notebook') {
                return;
            }
            
            // 检查每个变更的单元格
            for (const cellChange of event.cellChanges) {
                // 确保document属性存在
                if (!cellChange.document) {
                    continue;
                }
                
                // 如果语言发生了变化
                if (cellChange.cell.document.languageId !== cellChange.document.languageId) {
                    const cell = cellChange.cell;
                    const newLanguageId = cellChange.document.languageId;
                    
                    // 如果新语言是markdown，则将cellType设置为markdown
                    if (newLanguageId === 'markdown') {
                        const newCellData = new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Markup,
                            cell.document.getText(),
                            'markdown'
                        );
                        
                        // 保留原有metadata，但移除customCellKind
                        const newMetadata = { ...cell.metadata };
                        delete newMetadata.customCellKind;
                        newCellData.metadata = newMetadata;
                        
                        // 替换cell
                        const edit = new vscode.WorkspaceEdit();
                        const nbEdit = vscode.NotebookEdit.replaceCells(
                            new vscode.NotebookRange(cell.index, cell.index + 1),
                            [newCellData]
                        );
                        edit.set(event.notebook.uri, [nbEdit]);
                        vscode.workspace.applyEdit(edit);
                    } 
                    // 如果从markdown切换到其他语言，则将cellType设置为code
                    else if (cell.kind === vscode.NotebookCellKind.Markup) {
                        const newCellData = new vscode.NotebookCellData(
                            vscode.NotebookCellKind.Code,
                            cell.document.getText(),
                            newLanguageId
                        );
                        
                        // 保留原有metadata
                        newCellData.metadata = { ...cell.metadata };
                        
                        // 替换cell
                        const edit = new vscode.WorkspaceEdit();
                        const nbEdit = vscode.NotebookEdit.replaceCells(
                            new vscode.NotebookRange(cell.index, cell.index + 1),
                            [newCellData]
                        );
                        edit.set(event.notebook.uri, [nbEdit]);
                        vscode.workspace.applyEdit(edit);
                    }
                }
            }
        })
    );
    
    context.subscriptions.push(command);
    return command;
}
