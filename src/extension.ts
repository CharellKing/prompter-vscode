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
    registerPromptHistoryCommands,
    registerCreateNotebookCommand,
    registerRunCellCommand,
    registerRunAllCellsCommand,
    registerSaveNotebookCommand,
    registerSetCellTypeCommand,
    registerOpenLLMConfigCommand,
    registerSetDefaultCodeLanguageCommand
} from './commands';
import {
    createNotebookController,
    updateControllerLabel
} from './controllers';

// Export the cellExecutor for use in other parts of the extension
export let cellExecutor: CellExecutor;

export function activate(context: vscode.ExtensionContext) {
    console.log('Prompter extension is now active!');

    // Register language configuration
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

    // Register notebook provider
    const notebookProvider = new PrompterNotebookProvider();
    context.subscriptions.push(
        vscode.workspace.registerNotebookSerializer('prompter-notebook', notebookProvider)
    );

    // Create cell executor and export it
    cellExecutor = new CellExecutor(context);

    // Create and configure notebook controller
    const controller = createNotebookController(context, cellExecutor);

    // Create LLM configuration webview provider
    const llmConfigProvider = new LLMConfigWebviewProvider(context);
    
    // Register webview view provider
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
        // Only auto-save files that have been saved (have a file path), skip untitled files
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
                // Only save files that already have a file path
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

    // Register all commands
    registerInsertPromptCellAboveCommand(context);
    registerInsertPromptCellBelowCommand(context);
    registerInsertCodeCellAboveCommand(context);
    registerInsertCodeCellBelowCommand(context);
    registerCreateNotebookCommand(context);
    registerRunCellCommand(context, cellExecutor);
    registerRunAllCellsCommand(context, cellExecutor);
    registerSaveNotebookCommand(context);
    registerOpenLLMConfigCommand(context, llmConfigProvider);
    registerSetDefaultCodeLanguageCommand(context);
    registerSetCellTypeCommand(context);
    registerPromptHistoryCommands(context);

    // Register status bar item to display current LLM model
    const llmStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    
    function updateLLMStatusBar() {
        const activeEditor = vscode.window.activeTextEditor;
        const shouldShow = activeEditor && activeEditor.document.uri.fsPath.endsWith('.ppnb');
        
        if (shouldShow) {
            llmStatusBarItem.text = `$(sparkle) ${getCurrentLLMDisplayName()}`;
            llmStatusBarItem.command = 'prompter.llm.openLLMConfig';
            llmStatusBarItem.tooltip = 'Click to configure LLM settings';
            llmStatusBarItem.show();
        } else {
            llmStatusBarItem.hide();
        }
    }
    
    // Register status bar item to display default code language
    const codeLanguageStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    function updateCodeLanguageStatusBar() {
        const activeEditor = vscode.window.activeTextEditor;
        const shouldShow = activeEditor && activeEditor.document.uri.fsPath.endsWith('.ppnb');
        
        if (shouldShow) {
            const config = vscode.workspace.getConfiguration('prompter');
            const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
            codeLanguageStatusBarItem.text = `$(code) ${defaultLanguage}`;
            codeLanguageStatusBarItem.command = 'prompter.language.setDefaultCodeLanguage';
            codeLanguageStatusBarItem.tooltip = 'Click to set default code language';
            codeLanguageStatusBarItem.show();
        } else {
            codeLanguageStatusBarItem.hide();
        }
    }
    
    // Initialize status bar
    updateLLMStatusBar();
    updateCodeLanguageStatusBar();
    
    // Listen for editor changes to update status bar display
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            updateLLMStatusBar();
            updateCodeLanguageStatusBar();
            updateStatusBar();
        })
    );
    
    // Listen for configuration changes to update status bar
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

    // Register status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    
    function updateStatusBar() {
        const activeEditor = vscode.window.activeTextEditor;
        const shouldShow = activeEditor && activeEditor.document.uri.fsPath.endsWith('.ppnb');
        
        if (shouldShow) {
            statusBarItem.text = "$(play) Prompter";
            statusBarItem.command = 'prompter.notebook.createNotebook';
            statusBarItem.tooltip = 'Create new Prompter notebook';
            statusBarItem.show();
        } else {
            statusBarItem.hide();
        }
    }
    
    // Initialize status bar
    updateStatusBar();
    
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('Prompter extension is now deactivated!');
}