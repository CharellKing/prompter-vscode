import * as vscode from 'vscode';
import { CellExecutor } from '../cellExecutor';
import { PrompterCellKind, getCurrentLLMDisplayName } from '../commands';

/**
 * Creates and configures the notebook controller for the Prompter extension
 * @param context The extension context
 * @param cellExecutor The cell executor instance
 * @returns The configured notebook controller
 */
export function createNotebookController(
    context: vscode.ExtensionContext,
    cellExecutor: CellExecutor
): vscode.NotebookController {
    // 创建notebook controller来处理prompt cell的语言显示
    const controller = vscode.notebooks.createNotebookController(
        'prompter-controller',
        'prompter-notebook',
        getCurrentLLMDisplayName()
    );
    
    // 配置支持的语言
    controller.supportedLanguages = [
        'prompt', 'javascript', 'typescript', 'python', 'java', 'csharp', 
        'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 
        'kotlin', 'scala', 'html', 'css', 'json', 'xml', 
        'yaml', 'markdown', 'bash', 'powershell', 'sql'
    ];
    
    controller.supportsExecutionOrder = true;
    controller.description = 'Click to open LLM settings';
    
    // 设置执行处理器
    controller.executeHandler = async (cells, notebook, controller) => {
        for (const cell of cells) {
            // 创建执行对象
            const execution = controller.createNotebookCellExecution(cell);
            execution.start(Date.now());
            
            try {
                // Check for custom cell kinds first
                if (cell.kind === vscode.NotebookCellKind.Code) {
                    // Execute prompt cells
                    console.log('Executing prompt cell:', cell.document.getText().substring(0, 50) + '...');
                    await cellExecutor.executeCell(cell);
                }
                
                execution.end(true, Date.now());
            } catch (error) {
                console.error('Cell execution failed:', error);
                execution.replaceOutput([
                    new vscode.NotebookCellOutput([
                        vscode.NotebookCellOutputItem.error(error instanceof Error ? error : new Error(String(error)))
                    ])
                ]);
                execution.end(false, Date.now());
            }
        }
    };
    
    context.subscriptions.push(controller);
    return controller;
}

/**
 * Updates the controller label with the current LLM model name
 * @param controller The notebook controller to update
 */
export function updateControllerLabel(controller: vscode.NotebookController): void {
    controller.label = getCurrentLLMDisplayName();
    controller.description = 'Current LLM model for prompt execution';
}