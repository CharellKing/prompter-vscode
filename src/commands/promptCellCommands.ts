import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

// 定义自定义单元格类型
export const enum PrompterCellKind {
    Prompt = 'prompt',
    Markdown = 'markdown',
    Code = "code",
    Output = 'output',
    Error = 'error'
}

// 创建提示词单元格的通用函数
export function insertPromptCell(editor: vscode.NotebookEditor, insertIndex: number) {
    if (!editor) {
        return null;
    }
    
    const notebook = editor.notebook;
    
    // 创建新的提示词cell
    const newCell = new vscode.NotebookCellData(
        vscode.NotebookCellKind.Code,
        'Please enter your prompt content here...',
        'prompt'
    );
    
    newCell.metadata = {
        id: `prompt-cell-${uuidv4()}`,
    };
    
    // 在指定位置插入新cell
    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
    edit.set(notebook.uri, [nbEdit]);
    
    return { edit, insertIndex };
}


// 添加在cell上方创建提示词cell的命令
export function registerInsertPromptCellAboveCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertPromptCellAbove', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // 确定插入位置（当前cell上方）
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex;
            } else {
                insertIndex = editor.selection.start;
            }
            
            // 创建并插入提示词cell
            const result = insertPromptCell(editor, insertIndex);
            if (result) {
                await vscode.workspace.applyEdit(result.edit);
                
                // 选中新创建的cell
                const newSelection = new vscode.NotebookRange(result.insertIndex, result.insertIndex + 1);
                editor.selection = newSelection;
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 添加在cell下方创建提示词cell的命令
export function registerInsertPromptCellBelowCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertPromptCellBelow', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // 确定插入位置（当前cell下方）
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else {
                insertIndex = editor.selection.start + 1;
            }
            
            // 创建并插入提示词cell
            const result = insertPromptCell(editor, insertIndex);
            if (result) {
                await vscode.workspace.applyEdit(result.edit);
                
                // 选中新创建的cell
                const newSelection = new vscode.NotebookRange(result.insertIndex, result.insertIndex + 1);
                editor.selection = newSelection;
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}