import * as vscode from 'vscode';
import { PrompterNotebookProvider } from './notebookProvider';
import { CellExecutor } from './cellExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Prompter extension is now active!');

    // 注册语言配置
    context.subscriptions.push(
        vscode.languages.setLanguageConfiguration('prompt', {
            comments: {
                lineComment: '//'
            },
            brackets: [['[', ']'], ['(', ')'], ['{', '}']],
            autoClosingPairs: [
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '{', close: '}' },
                { open: "'", close: "'" },
                { open: '"', close: '"' }
            ]
        })
    );

    // 注册notebook provider
    const notebookProvider = new PrompterNotebookProvider();
    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer('prompter-notebook', notebookProvider)
    );

    // 注册notebook controller来处理prompt cell的语言显示
    const controller = vscode.notebooks.createNotebookController(
        'prompter-controller',
        'prompter-notebook',
        'Prompter Controller'
    );
    controller.supportedLanguages = ['javascript', 'python', 'typescript', 'bash', 'powershell', 'markdown', 'prompt'];
    controller.supportsExecutionOrder = true;
    controller.description = 'Prompter notebook controller with support for prompt cells';
    
    // 设置执行处理器
    controller.executeHandler = async (cells, _notebook, _controller) => {
        for (const cell of cells) {
            if (cell.kind === vscode.NotebookCellKind.Code) {
                await cellExecutor.executeCell(cell);
            } else if (cell.kind === vscode.NotebookCellKind.Markup && cell.document.languageId === 'prompt') {
                // 对于prompt类型的markup cell，我们可以添加特殊处理
                console.log('Processing prompt cell:', cell.document.getText());
            }
        }
    };
    
    context.subscriptions.push(controller);
    
    // 监听notebook选择变化
    context.subscriptions.push(
        controller.onDidChangeSelectedNotebooks((e) => {
            console.log('Notebook selection changed:', e);
        })
    );

    // 创建cell执行器
    const cellExecutor = new CellExecutor(context);

    // 注册命令
    const createNotebookCommand = vscode.commands.registerCommand('prompter.createNotebook', async () => {
        const uri = vscode.Uri.parse(`untitled:Untitled-${Date.now()}.ppnb`);
        
        // 创建符合新格式的notebook数据
        const cells = [
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                '# Welcome to Prompter!\n\nThis is a new Prompter notebook. You can create code and markdown cells to build interactive documents.',
                'markdown'
            ),
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '// Welcome to Prompter!\n// Press Ctrl+Enter to run this cell\nconsole.log("Hello, World!");',
                'javascript'
            )
        ];
        
        // 为每个cell添加ID
        cells.forEach((cell, index) => {
            cell.metadata = {
                id: `cell-${Date.now()}-${index}`
            };
        });
        
        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = {
            kernelspec: {
                display_name: "Multi-Language",
                language: "multi",
                name: "prompter"
            },
            language_info: {
                name: "multi",
                version: "1.0.0"
            }
        };
        
        const doc = await vscode.workspace.openNotebookDocument('prompter-notebook', notebookData);
        await vscode.window.showNotebookDocument(doc);
    });

    const runCellCommand = vscode.commands.registerCommand('prompter.runCell', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const cell = editor.notebook.cellAt(editor.selection.start);
            if (cell) {
                await cellExecutor.executeCell(cell);
            }
        }
    });

    const runAllCellsCommand = vscode.commands.registerCommand('prompter.runAllCells', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            for (const cell of editor.notebook.getCells()) {
                if (cell.kind === vscode.NotebookCellKind.Code) {
                    await cellExecutor.executeCell(cell);
                }
            }
        }
    });

    // 添加创建提示词cell的命令
    const createPromptCellCommand = vscode.commands.registerCommand('prompter.createPromptCell', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const notebook = editor.notebook;
            const activeCell = editor.selection.start;
            
            // 创建新的提示词cell
            const newCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup,
                '请在此输入您的提示词内容...',
                'prompt'
            );
            newCell.metadata = {
                id: `prompt-cell-${Date.now()}`,
                cellType: 'prompt'
            };
            
            // 在当前选中cell后插入新cell
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(activeCell + 1, [newCell]);
            edit.set(notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
        }
    });

    context.subscriptions.push(
        createNotebookCommand,
        runCellCommand,
        runAllCellsCommand,
        createPromptCellCommand
    );

    // 注册状态栏项
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(play) Prompter";
    statusBarItem.command = 'prompter.createNotebook';
    statusBarItem.tooltip = 'Create new Prompter notebook';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('Prompter extension is now deactivated!');
}