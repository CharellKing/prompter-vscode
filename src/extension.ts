import * as vscode from 'vscode';
import { PrompterNotebookProvider } from './notebookProvider';
import { CellExecutor } from './cellExecutor';
import { LLMConfigWebviewProvider } from './configWebview';
import { 
    PrompterCellKind,
    getCurrentLLMDisplayName,
    registerInsertCodeCellAboveCommand,
    registerInsertCodeCellBelowCommand,
    registerInsertPromptCellAboveCommand,
    registerInsertPromptCellBelowCommand,
    registerCreateNotebookCommand,
    registerRunCellCommand,
    registerRunAllCellsCommand,
    registerSaveNotebookCommand,
    registerSetCellTypeCommand,
    registerSetProviderCommand,
    registerSetApiKeyCommand,
    registerSetModelCommand,
    registerConfigureLLMCommand,
    registerOpenLLMConfigCommand,
    registerFocusLLMConfigCommand,
    registerSetDefaultCodeLanguageCommand
} from './commands';
import {
    registerCodeCellInterceptor,
} from './interceptors';
import {
    createNotebookController,
    updateControllerLabel
} from './controllers';

export function activate(context: vscode.ExtensionContext) {
    console.log('Prompter extension is now active!');

    // context.subscriptions.push(
    //     vscode.notebooks.registerNotebookCellStatusBarItemProvider('prompter-notebook', {
    //     provideCellStatusBarItems(cell: vscode.NotebookCell, token: vscode.CancellationToken): vscode.NotebookCellStatusBarItem[] {
    //         return [
    //         {
    //             text: 'Prompt',
    //             command: 'prompter.cell.insertPromptCellBelow',
    //             tooltip: 'Insert a new Prompt cell below',
    //             alignment: vscode.NotebookCellStatusBarAlignment.Left
    //         }
    //         ];
    //     }
    //     })
    // );

    // 注册拦截器 - 只在 prompter-notebook 类型的文档中生效
    registerCodeCellInterceptor(context);

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

    // 创建cell执行器
    const cellExecutor = new CellExecutor(context);

    // 创建并配置notebook controller
    const controller = createNotebookController(context, cellExecutor);

    // 创建LLM配置Web视图提供者
    const llmConfigProvider = new LLMConfigWebviewProvider(context);
    
    // 注册webview view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            LLMConfigWebviewProvider.viewType,
            llmConfigProvider
        )
    );

    // Auto-save .ppnb notebooks (debounced)
    const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
    const AUTO_SAVE_DELAY = 1500;

    function scheduleNotebookSave(doc: vscode.NotebookDocument) {
        // 只对已保存的文件（有文件路径）进行自动保存，跳过未命名文件
        if (doc.uri.scheme !== 'file') {
            console.log('Skipping auto-save for untitled notebook:', doc.uri.toString());
            return;
        }
        
        const key = doc.uri.toString();
        const existing = pendingSaves.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        const handle = setTimeout(async () => {
            pendingSaves.delete(key);
            try {
                // 只保存已有文件路径的文件
                await vscode.workspace.saveAll(false);
                console.log('Auto-saved notebook:', doc.uri.fsPath);
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

    // 注册所有命令
    registerInsertPromptCellAboveCommand(context);
    registerInsertPromptCellBelowCommand(context);
    registerInsertCodeCellAboveCommand(context);
    registerInsertCodeCellBelowCommand(context);
    registerCreateNotebookCommand(context);
    registerRunCellCommand(context, cellExecutor);
    registerRunAllCellsCommand(context, cellExecutor);
    registerSaveNotebookCommand(context);
    registerSetProviderCommand(context);
    registerSetApiKeyCommand(context);
    registerSetModelCommand(context);
    registerConfigureLLMCommand(context);
    registerOpenLLMConfigCommand(context, llmConfigProvider);
    registerFocusLLMConfigCommand(context, llmConfigProvider);
    registerSetDefaultCodeLanguageCommand(context);
    registerSetCellTypeCommand(context);

    // 注册状态栏项显示当前LLM模型
    const llmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    
    function updateLLMStatusBar() {
        llmStatusBarItem.text = `$(sparkle) ${getCurrentLLMDisplayName()}`;
        llmStatusBarItem.command = 'prompter.openLLMConfig';
        llmStatusBarItem.tooltip = 'Click to configure LLM settings';
        llmStatusBarItem.show();
    }
    
    // 注册状态栏项显示默认代码语言
    const codeLanguageStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    function updateCodeLanguageStatusBar() {
        const config = vscode.workspace.getConfiguration('prompter');
        const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
        codeLanguageStatusBarItem.text = `$(code) ${defaultLanguage}`;
        codeLanguageStatusBarItem.command = 'prompter.language.setDefaultCodeLanguage';
        codeLanguageStatusBarItem.tooltip = 'Click to set default code language';
        codeLanguageStatusBarItem.show();
    }
    
    // 初始化状态栏
    updateLLMStatusBar();
    updateCodeLanguageStatusBar();
    
    // 监听配置变化更新状态栏
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('prompter.llmProvider') || 
                e.affectsConfiguration('prompter.llmModel')) {
                updateLLMStatusBar();
                updateControllerLabel(controller);
            }
            if (e.affectsConfiguration('prompter.defaultCodeLanguage')) {
                updateCodeLanguageStatusBar();
            }
        })
    );
    
    context.subscriptions.push(llmStatusBarItem, codeLanguageStatusBarItem);

    // 注册状态栏项
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(play) Prompter";
    statusBarItem.command = 'prompter.notebook.createNotebook';
    statusBarItem.tooltip = 'Create new Prompter notebook';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('Prompter extension is now deactivated!');
}