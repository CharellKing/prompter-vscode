import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

// 创建代码单元格的通用函数
export function insertCodeCell(editor: vscode.NotebookEditor, insertIndex: number) {
    if (!editor) {
        return null;
    }
    
    const notebook = editor.notebook;
    
    // 获取默认代码语言
    const config = vscode.workspace.getConfiguration('prompter');
    const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
    
    // 创建新的代码cell
    const newCell = new vscode.NotebookCellData(
        vscode.NotebookCellKind.Code,
        '',
        defaultLanguage
    );
    
    newCell.metadata = {
        id: `code-cell-${uuidv4()}`
    };
    
    // 在指定位置插入新cell
    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
    edit.set(notebook.uri, [nbEdit]);
    
    return { edit, insertIndex };
}


// 添加在cell上方创建代码cell的命令
export function registerInsertCodeCellAboveCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertCodeCellAbove', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // 确定插入位置（当前cell上方）
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex;
            } else {
                insertIndex = editor.selection.start;
            }
            
            // 创建并插入代码cell
            const result = insertCodeCell(editor, insertIndex);
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

// 添加在cell下方创建代码cell的命令
export function registerInsertCodeCellBelowCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertCodeCellBelow', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // 确定插入位置（当前cell下方）
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else {
                insertIndex = editor.selection.start + 1;
            }
            
            // 创建并插入代码cell
            const result = insertCodeCell(editor, insertIndex);
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