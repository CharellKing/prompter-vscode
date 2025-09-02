import * as vscode from 'vscode';
import { CellExecutor } from '../cellExecutor';
import { PrompterCellKind } from '../commands';
import { KernelManager } from './kernelManager';

/**
 * Gets the current kernel label for display
 * @returns The kernel display label
 */
function getKernelLabel(): string {
    const kernelManager = KernelManager.getInstance();
    const currentKernel = kernelManager.getCurrentKernel();
    
    if (currentKernel) {
        return currentKernel.version;
    }
    
    return 'Multi-Language Kernel';
}

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
    const controller = vscode.notebooks.createNotebookController(
        'prompter-controller',
        'prompter-notebook',
        getKernelLabel()
    );
    
    // 配置支持的语言
    controller.supportedLanguages = [
        'prompt', 'javascript', 'typescript', 'python', 'java', 'csharp', 
        'cpp', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 
        'kotlin', 'scala', 'html', 'css', 'json', 'xml', 
        'yaml', 'markdown', 'bash', 'powershell', 'sql'
    ];
    
    controller.supportsExecutionOrder = true;
    controller.description = 'Click to select kernel';
    
    // 添加kernel选择处理器
    const kernelManager = KernelManager.getInstance();
    
    // 当点击右上角的kernel按钮时触发kernel选择
    controller.interruptHandler = async (notebook) => {
        await kernelManager.selectKernel();
    };
    
    // 监听kernel变化并更新controller标签
    kernelManager.onKernelChanged(() => {
        updateControllerLabel(controller);
    });
    
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
 * Updates the controller label with the current kernel information
 * @param controller The notebook controller to update
 */
export function updateControllerLabel(controller: vscode.NotebookController): void {
    controller.label = getKernelLabel();
    controller.description = 'Current execution kernel';
}