import * as vscode from 'vscode';
import { PrompterNotebookProvider } from './notebookProvider';
import { CellExecutor } from './cellExecutor';
import { LLMConfigWebviewProvider } from './configWebview';

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

    // Function to get current LLM display name (only model name)
    function getCurrentLLMDisplayName(): string {
        const config = vscode.workspace.getConfiguration('prompter');
        const model = config.get<string>('llmModel') || 'gpt-3.5-turbo';
        return model;
    }

    // 注册notebook controller来处理prompt cell的语言显示
    const controller = vscode.notebooks.createNotebookController(
        'prompter-controller',
        'prompter-notebook',
        getCurrentLLMDisplayName()
    );
    controller.supportedLanguages = ['prompt'];
    controller.supportsExecutionOrder = true;
    controller.description = 'Click to open LLM settings';
    
    // Function to update controller label when LLM settings change
    function updateControllerLabel() {
        controller.label = getCurrentLLMDisplayName();
        controller.description = 'Current LLM model for prompt execution';
    }

    // 创建cell执行器
    const cellExecutor = new CellExecutor(context);

    // 设置执行处理器
    controller.executeHandler = async (cells, _notebook, _controller) => {
        for (const cell of cells) {
            // Check for custom cell kinds first
            if (cell.metadata?.customCellKind === PrompterCellKind.Prompt) {
                // Execute prompt cells
                await cellExecutor.executeCell(cell);
            } else if (cell.metadata?.customCellKind === PrompterCellKind.Output || 
                       cell.metadata?.customCellKind === PrompterCellKind.Error) {
                // Skip execution for output and error cells
                console.log(`Skipping execution of ${cell.metadata.customCellKind} cell`);
            } else if (cell.kind === vscode.NotebookCellKind.Code) {
                // Execute regular code cells
                await cellExecutor.executeCell(cell);
            } else if (cell.kind === vscode.NotebookCellKind.Markup && cell.document.languageId === 'prompt') {
                // For backward compatibility with old prompt cells
                console.log('Processing legacy prompt cell:', cell.document.getText());
                await cellExecutor.executeCell(cell);
            }
        }
    };
    
    context.subscriptions.push(controller);

    // 创建LLM配置Web视图提供者
    const llmConfigProvider = new LLMConfigWebviewProvider(context);

    // Auto-save .ppnb notebooks (debounced)
    const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
    const AUTO_SAVE_DELAY = 1500;

    function scheduleNotebookSave(doc: vscode.NotebookDocument) {
        const key = doc.uri.toString();
        const existing = pendingSaves.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const handle = setTimeout(async () => {
            pendingSaves.delete(key);
            try {
                if (doc.uri.scheme === 'file') {
                    // Save all dirty editors; notebooks included
                    await vscode.workspace.saveAll(false);
                } else {
                    // For Untitled, trigger Save As once
                    const isActive = vscode.window.activeNotebookEditor?.notebook === doc;
                    if (!isActive) {
                        await vscode.window.showNotebookDocument(doc, { preserveFocus: false });
                    }
                    await vscode.commands.executeCommand('workbench.action.files.saveAs');
                }
            } catch (err) {
                console.error('Auto-save failed:', err);
            }
        }, AUTO_SAVE_DELAY);
        pendingSaves.set(key, handle);
    }

    // Listen to notebook changes and schedule auto-save
    context.subscriptions.push(
        vscode.workspace.onDidChangeNotebookDocument((e) => {
            if (e.notebook.notebookType === 'prompter-notebook') {
                scheduleNotebookSave(e.notebook);
            }
        })
    );

    // 注册命令
    const createNotebookCommand = vscode.commands.registerCommand('prompter.createNotebook', async () => {
        const uri = vscode.Uri.parse(`untitled:Untitled-${Date.now()}.ppnb`);
        
        // 创建符合新格式的notebook数据
        const cells = [
            new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '# Welcome to Prompter!\n\nThis is a new Prompter notebook. You can create code and markdown cells to build interactive documents.',
                'prompt'
            )
        ];
        
        // 为每个cell添加ID
        cells.forEach((cell, index) => {
            cell.metadata = {
                id: `cell-${Date.now()}-${index}`
            };
        });
        
        const notebookData = new vscode.NotebookData(cells);
        // notebookData.metadata = {
        //     kernelspec: {
        //         display_name: "Multi-Language",
        //         language: "multi",
        //         name: "prompter"
        //     },
        //     language_info: {
        //         name: "multi",
        //         version: "1.0.0"
        //     }
        // };
        
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

    // 手动保存命令：支持已保存文件直接保存，未命名文件触发另存为
    const saveNotebookCommand = vscode.commands.registerCommand('prompter.saveNotebook', async () => {
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

    // 定义自定义单元格类型
const enum PrompterCellKind {
    Prompt = 'prompt',
    Output = 'output',
    Error = 'error'
}

// 添加创建提示词cell的命令
    const createPromptCellCommand = vscode.commands.registerCommand('prompter.createPromptCell', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const notebook = editor.notebook;
            let insertIndex: number;
            
            // 如果提供了cellIndex参数，使用它；否则使用当前选中的cell
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else {
                insertIndex = editor.selection.start + 1;
            }
            
            // 创建新的提示词cell
            const newCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,  // 使用内置的Code类型
                '请在此输入您的提示词内容...',
                'prompt'
            );
            
            // 使用元数据标记为自定义的Prompt类型
            newCell.metadata = {
                id: `prompt-cell-${Date.now()}`,
                customCellKind: PrompterCellKind.Prompt  // 使用自定义单元格类型
            };
            
            // 在指定位置插入新cell
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
            edit.set(notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
            
            // 选中新创建的cell
            const newSelection = new vscode.NotebookRange(insertIndex, insertIndex + 1);
            editor.selection = newSelection;
        }
    });

    // 添加在cell上方创建提示词cell的命令
    const createPromptCellAboveCommand = vscode.commands.registerCommand('prompter.createPromptCellAbove', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const notebook = editor.notebook;
            let insertIndex: number;
            
            // 如果提供了cellIndex参数，使用它；否则使用当前选中的cell
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex;
            } else {
                insertIndex = editor.selection.start;
            }
            
            // 创建新的提示词cell
            const newCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '请在此输入您的提示词内容...',
                'prompt'
            );
            newCell.metadata = {
                id: `prompt-cell-${Date.now()}`,
                customCellKind: PrompterCellKind.Prompt  // 使用自定义单元格类型
            };
            
            // 在指定位置插入新cell
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
            edit.set(notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
            
            // 选中新创建的cell
            const newSelection = new vscode.NotebookRange(insertIndex, insertIndex + 1);
            editor.selection = newSelection;
        }
    });

    // 添加在cell下方创建提示词cell的命令
    const createPromptCellBelowCommand = vscode.commands.registerCommand('prompter.createPromptCellBelow', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const notebook = editor.notebook;
            let insertIndex: number;
            
            // 如果提供了cellIndex参数，使用它；否则使用当前选中的cell
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else {
                insertIndex = editor.selection.start + 1;
            }
            
            // 创建新的提示词cell
            const newCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '请在此输入您的提示词内容...',
                'prompt'
            );
            newCell.metadata = {
                id: `prompt-cell-${Date.now()}`,
                customCellKind: PrompterCellKind.Prompt  // 使用自定义单元格类型
            };
            
            // 在指定位置插入新cell
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
            edit.set(notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
            
            // 选中新创建的cell
            const newSelection = new vscode.NotebookRange(insertIndex, insertIndex + 1);
            editor.selection = newSelection;
        }
    });

    // 添加设置LLM Provider的命令
    const setProviderCommand = vscode.commands.registerCommand('prompter.setProvider', async () => {
        const providers = ['openai', 'deepseek', 'qwen', 'anthropic', 'gemini', 'mistral'];
        const provider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select LLM Provider',
            ignoreFocusOut: true
        });
        
        if (provider) {
            const config = vscode.workspace.getConfiguration('prompter');
            await config.update('llmProvider', provider, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`LLM Provider has been set to ${provider}.`);
            
            // 提示用户设置对应的API Key
            const setApiKey = await vscode.window.showInformationMessage(
                `Would you like to set the API Key for ${provider}?`,
                'Yes', 'No'
            );
            
            if (setApiKey === 'Yes') {
                vscode.commands.executeCommand('prompter.setApiKey', provider);
            }
        }
    });
    
    // 添加设置API Key的命令
    const setApiKeyCommand = vscode.commands.registerCommand('prompter.setApiKey', async (provider?: string) => {
        if (!provider) {
            const config = vscode.workspace.getConfiguration('prompter');
            provider = config.get<string>('llmProvider') || 'openai';
        }
        
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter your ${provider} API Key`,
            password: true,
            placeHolder: 'sk-...',
            ignoreFocusOut: true
        });
        
        if (apiKey) {
            const config = vscode.workspace.getConfiguration('prompter');
            await config.update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`${provider} API Key has been set successfully.`);
        }
    });
    
    // 添加设置模型的命令
    const setModelCommand = vscode.commands.registerCommand('prompter.setModel', async () => {
        const config = vscode.workspace.getConfiguration('prompter');
        const provider = config.get<string>('llmProvider') || 'openai';
        
        // 根据提供商获取可用模型
        let models: string[] = [];
        switch (provider) {
            case 'openai':
                models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
                break;
            case 'deepseek':
                models = ['deepseek-chat', 'deepseek-coder'];
                break;
            case 'qwen':
                models = ['qwen-turbo', 'qwen-plus', 'qwen-max'];
                break;
            case 'anthropic':
                models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
                break;
            case 'gemini':
                models = ['gemini-pro', 'gemini-pro-vision'];
                break;
            case 'mistral':
                models = ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'];
                break;
        }
        
        const model = await vscode.window.showQuickPick(models, {
            placeHolder: `Select ${provider} model`,
            ignoreFocusOut: true
        });
        
        if (model) {
            await config.update('llmModel', model, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`LLM Model has been set to ${model}.`);
        }
    });

    // 添加综合LLM配置命令
    const configureLLMCommand = vscode.commands.registerCommand('prompter.configureLLM', async () => {
        const config = vscode.workspace.getConfiguration('prompter');
        const currentProvider = config.get<string>('llmProvider') || 'openai';
        const currentModel = config.get<string>('llmModel') || 'gpt-3.5-turbo';
        const currentTemperature = config.get<number>('temperature') || 0.7;
        const currentMaxTokens = config.get<number>('maxTokens') || 1000;

        // 显示当前配置和选项菜单
        const options = [
            `Current Provider: ${currentProvider} - Change Provider`,
            `Current Model: ${currentModel} - Change Model`,
            `Current API Key: ${config.get<string>(`${currentProvider}ApiKey`) ? '***Set***' : 'Not Set'} - Set API Key`,
            `Current Temperature: ${currentTemperature} - Change Temperature`,
            `Current Max Tokens: ${currentMaxTokens} - Change Max Tokens`,
            'View All Settings',
            'Reset to Defaults'
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select LLM configuration option',
            ignoreFocusOut: true
        });

        if (!selection) return;

        if (selection.includes('Change Provider')) {
            await vscode.commands.executeCommand('prompter.setProvider');
        } else if (selection.includes('Change Model')) {
            await vscode.commands.executeCommand('prompter.setModel');
        } else if (selection.includes('Set API Key')) {
            await vscode.commands.executeCommand('prompter.setApiKey');
        } else if (selection.includes('Change Temperature')) {
            const temperature = await vscode.window.showInputBox({
                prompt: 'Enter temperature (0.0 - 2.0)',
                value: currentTemperature.toString(),
                validateInput: (value) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num < 0 || num > 2) {
                        return 'Temperature must be a number between 0.0 and 2.0';
                    }
                    return null;
                }
            });
            if (temperature) {
                await config.update('temperature', parseFloat(temperature), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Temperature set to ${temperature}`);
            }
        } else if (selection.includes('Change Max Tokens')) {
            const maxTokens = await vscode.window.showInputBox({
                prompt: 'Enter maximum tokens (1 - 8000)',
                value: currentMaxTokens.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 8000) {
                        return 'Max tokens must be a number between 1 and 8000';
                    }
                    return null;
                }
            });
            if (maxTokens) {
                await config.update('maxTokens', parseInt(maxTokens), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Max tokens set to ${maxTokens}`);
            }
        } else if (selection.includes('View All Settings')) {
            const settingsInfo = [
                `Provider: ${currentProvider}`,
                `Model: ${currentModel}`,
                `API Key: ${config.get<string>(`${currentProvider}ApiKey`) ? 'Set' : 'Not Set'}`,
                `Temperature: ${currentTemperature}`,
                `Max Tokens: ${currentMaxTokens}`
            ].join('\n');
            vscode.window.showInformationMessage(`Current LLM Settings:\n${settingsInfo}`);
        } else if (selection.includes('Reset to Defaults')) {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to reset all LLM settings to defaults?',
                'Yes', 'No'
            );
            if (confirm === 'Yes') {
                await config.update('llmProvider', 'openai', vscode.ConfigurationTarget.Global);
                await config.update('llmModel', 'gpt-3.5-turbo', vscode.ConfigurationTarget.Global);
                await config.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
                await config.update('maxTokens', 1000, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('LLM settings reset to defaults');
            }
        }
    });

    // 添加打开LLM配置页面的命令
    const openLLMConfigCommand = vscode.commands.registerCommand('prompter.openLLMConfig', () => {
        llmConfigProvider.show();
    });

    context.subscriptions.push(
        createPromptCellCommand,
        createPromptCellAboveCommand,
        createPromptCellBelowCommand,
        createNotebookCommand,
        runCellCommand,
        runAllCellsCommand,
        saveNotebookCommand,
        setProviderCommand,
        setApiKeyCommand,
        setModelCommand,
        configureLLMCommand,
        openLLMConfigCommand
    );

    // 注册状态栏项显示当前LLM模型
    const llmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    
    function updateLLMStatusBar() {
        llmStatusBarItem.text = `$(gear) ${getCurrentLLMDisplayName()}`;
        llmStatusBarItem.command = 'prompter.openLLMConfig';
        llmStatusBarItem.tooltip = 'Click to configure LLM settings';
        llmStatusBarItem.show();
    }
    
    // 初始化状态栏
    updateLLMStatusBar();
    
    // 监听配置变化更新状态栏
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('prompter.llmProvider') || 
                e.affectsConfiguration('prompter.llmModel')) {
                updateLLMStatusBar();
                updateControllerLabel();
            }
        })
    );
    
    context.subscriptions.push(llmStatusBarItem);

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