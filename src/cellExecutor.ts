import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { UniversalLLMProvider, LLMProvider, Message } from './llm/llmProvider';

// Define custom cell kinds (must match the enum in extension.ts)
export const enum PrompterCellKind {
    Prompt = 'prompt',
    Output = 'output',
    Error = 'error'
}

// Define types for axios error handling
interface AxiosError {
    response?: {
        status: number;
        data: any;
    };
}

// Define types for ChatGPT API response
interface ChatGPTResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

// Type guard for axios errors
function isAxiosError(error: unknown): error is AxiosError {
    return typeof error === 'object' && error !== null && 'response' in error;
}

export class CellExecutor {
    private outputChannel: vscode.OutputChannel;
    private tempDir: string;

    /**
     * Updates cell properties based on language mode
     * @param cell The notebook cell to update
     * @param languageMode The language mode to set
     */
    public updateCellLanguageMode(cell: vscode.NotebookCell): vscode.NotebookCellData {
        const cellData = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
        
        // Copy existing metadata
        cellData.metadata = { ...cell.metadata };
        
        // Update cell properties based on language mode
        if (cell.document.languageId === 'prompt') {
            // For prompt language mode
            cellData.kind = vscode.NotebookCellKind.Code;
            cellData.languageId = 'prompt';
        } else if (cell.document.languageId === 'markdown') {
            // For markdown language mode
            cellData.kind = vscode.NotebookCellKind.Markup;
            cellData.languageId = 'markdown';
        } else {
            // For all other language modes
            cellData.kind = vscode.NotebookCellKind.Code;
            cellData.languageId = cell.document.languageId;
        }
        
        return cellData;
    }

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Prompter Output');
        this.tempDir = path.join(context.globalStorageUri?.fsPath || '', 'temp');
        
        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async executeCell(cell: vscode.NotebookCell): Promise<void> {
        console.log(`Executing cell ${cell.index} with language: ${cell.document.languageId}`);
        
        if (cell.kind !== vscode.NotebookCellKind.Code) {
            console.log('Skipping non-code cell');
            return;
        }

        const code = cell.document.getText().trim();
        const language = cell.document.languageId;

        if (!code) {
            console.log('Skipping empty cell');
            return;
        }

        console.log(`Cell content: ${code.substring(0, 100)}...`);

        try {
            // 如果是prompt语言，调用LLM API
            if (language === 'prompt') {
                console.log('Calling LLM API for prompt cell');
                const response = await this.callLLM(code);
                await this.updateCellOutput(cell, response, '', 0);
            } else {
                // 其他语言执行代码
                console.log(`Running code for language: ${language}`);
                const result = await this.runCode(code, language);
                await this.updateCellOutput(cell, result.stdout, result.stderr, result.exitCode);
            }
        } catch (error) {
            console.error('Cell execution error:', error);
            // 创建错误输出单元格，类似于VS Code Jupyter
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // 1. 更新当前单元格，显示执行状态
            await this.updateCellOutput(cell, '', errorMessage, 1);
            
            // 记录到输出通道
            this.outputChannel.appendLine(`Error executing cell ${cell.index + 1}: ${errorMessage}`);
            
            // 抛出错误让controller处理
            throw error;
        }
    }
    
    /**
     * 创建一个错误输出单元格
     */
    private async createErrorOutputCell(sourceCell: vscode.NotebookCell, errorMessage: string): Promise<void> {
        try {
            const notebook = sourceCell.notebook;
            
            // 获取当前单元格的索引
            const currentIndex = sourceCell.index;
            
            // 确保索引有效
            if (currentIndex < 0) {
                this.outputChannel.appendLine(`Warning: Invalid cell index ${currentIndex}, cannot create error output cell`);
                return;
            }
            
            // 创建一个新的错误输出单元格
            const errorCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup, // 使用Markup类型以便更好地显示错误
                `## ❌ Error\n\n\`\`\`\n${errorMessage}\n\`\`\``,
                'markdown'
            );
            
            // 设置元数据，标记为自定义错误单元格类型并设置为不可编辑
            errorCell.metadata = {
                ...errorCell.metadata,
                hasError: true,
                sourceCell: currentIndex,
                editable: false,  // 设置为不可编辑
                runnable: false   // 设置为不可运行
            };
            
            // 确保在源单元格后面插入错误单元格（索引 + 1 的位置）
            const insertIndex = currentIndex + 1;
            
            // 创建编辑操作
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [errorCell]);
            edit.set(notebook.uri, [nbEdit]);
            
            // 应用编辑
            await vscode.workspace.applyEdit(edit);
            
            // 设置单元格为不可编辑状态
            setTimeout(() => {
                if (vscode.window.activeNotebookEditor) {
                    // 获取所有单元格
                    const cells = vscode.window.activeNotebookEditor.notebook.getCells();
                    
                    // 查找刚刚插入的错误单元格
                    // 注意：单元格索引可能已经改变，所以我们需要查找插入位置的单元格
                    if (insertIndex < cells.length) {
                        const errorCell = cells[insertIndex];
                        // 使用VS Code API设置单元格为只读模式
                        vscode.commands.executeCommand('notebook.cell.toggleOutputs', errorCell);
                    }
                }
            }, 100);
            
            this.outputChannel.appendLine(`Created error output cell at index ${insertIndex}`);
        } catch (error) {
            this.outputChannel.appendLine(`Error creating error output cell: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async callLLM(prompt: string): Promise<string> {
        try {
            // 获取配置
            const config = vscode.workspace.getConfiguration('prompter');
            const provider = config.get<string>('llmProvider') || 'openai';
            const model = config.get<string>('llmModel') || 'gpt-3.5-turbo';
            const apiKey = config.get<string>(`${provider}ApiKey`);
            
            if (!apiKey) {
                throw new Error(`${provider} API key not configured. Please set it in the extension settings.`);
            }
            
            // 创建LLM提供者实例
            const llmProvider = UniversalLLMProvider.fromConfig(provider, model, {
                apiKey,
                temperature: config.get<number>('temperature') || 0.7,
                maxTokens: config.get<number>('maxTokens') || 1000
            });
            
            // 准备消息
            const messages: Message[] = [
                { role: 'user', content: prompt }
            ];
            
            // 调用LLM API
            const response = await llmProvider.complete(messages);
            
            // 返回LLM的回复
            return response.content;
        } catch (error) {
            if (isAxiosError(error) && error.response) {
                throw new Error(`LLM API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Error calling LLM API: ${String(error)}`);
        }
    }

    private async runCode(code: string, language: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
            let command: string;
            let args: string[];
            let tempFile: string;

            switch (language.toLowerCase()) {
                case 'javascript':
                case 'js':
                    command = 'node';
                    tempFile = path.join(this.tempDir, `temp_${Date.now()}.js`);
                    args = [tempFile];
                    break;
                case 'python':
                case 'py':
                    command = 'python';
                    tempFile = path.join(this.tempDir, `temp_${Date.now()}.py`);
                    args = [tempFile];
                    break;
                case 'typescript':
                case 'ts':
                    command = 'ts-node';
                    tempFile = path.join(this.tempDir, `temp_${Date.now()}.ts`);
                    args = [tempFile];
                    break;
                case 'bash':
                case 'sh':
                    command = 'bash';
                    tempFile = path.join(this.tempDir, `temp_${Date.now()}.sh`);
                    args = [tempFile];
                    break;
                case 'powershell':
                case 'ps1':
                    command = 'powershell';
                    tempFile = path.join(this.tempDir, `temp_${Date.now()}.ps1`);
                    args = ['-ExecutionPolicy', 'Bypass', '-File', tempFile];
                    break;
                default:
                    reject(new Error(`Unsupported language: ${language}`));
                    return;
            }

            // 写入临时文件
            fs.writeFileSync(tempFile, code);

            const process = cp.spawn(command, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || this.tempDir
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                // 清理临时文件
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                    // 忽略清理错误
                }

                resolve({
                    stdout,
                    stderr,
                    exitCode: code || 0
                });
            });

            process.on('error', (error) => {
                // 清理临时文件
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                    // 忽略清理错误
                }
                reject(error);
            });
        });
    }

    /**
     * Applies language mode change to a cell
     * @param cell The notebook cell to update
     * @param languageMode The language mode to set
     */
    public async applyLanguageModeChange(cell: vscode.NotebookCell): Promise<void> {
        try {
            // Ensure cell index is valid
            if (cell.index < 0) {
                this.outputChannel.appendLine(`Warning: Invalid cell index ${cell.index}, cannot update language mode`);
                return;
            }
            
            // Get updated cell data with new language mode
            const cellData = this.updateCellLanguageMode(cell);
            
            // Create and apply the edit
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [cellData]);
            edit.set(cell.notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
            
            this.outputChannel.appendLine(`Updated cell ${cell.index + 1} language mode to ${cell.document.languageId}`);
        } catch (error) {
            this.outputChannel.appendLine(`Error updating cell language mode: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async updateCellOutput(cell: vscode.NotebookCell, stdout: string, stderr: string, exitCode: number): Promise<void> {
        const outputs: vscode.NotebookCellOutput[] = [];

        if (stdout) {
            outputs.push(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.text(stdout, 'text/plain')
            ]));
        }

        if (stderr) {
            outputs.push(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(new Error(stderr))
            ]));
        }

        if (exitCode !== 0 && !stderr) {
            outputs.push(new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(new Error(`Process exited with code ${exitCode}`))
            ]));
        }

        try {
            // Ensure cell index is valid (non-negative)
            if (cell.index < 0) {
                this.outputChannel.appendLine(`Warning: Invalid cell index ${cell.index}, cannot update output`);
                return;
            }
            
            const edit = new vscode.WorkspaceEdit();
            const cellData = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
            
            // 设置输出
            cellData.outputs = outputs;
            
            // 设置元数据，标记为自定义输出单元格类型并设置为不可编辑
            cellData.metadata = {
                ...cell.metadata,
                hasError: false,
                outputsReadonly: true  // 设置输出为只读
            };
            
            const nbEdit = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [cellData]);
            edit.set(cell.notebook.uri, [nbEdit]);
            await vscode.workspace.applyEdit(edit);
            
            // 如果有输出，确保输出是展开的且不可编辑
            if (outputs.length > 0) {
                setTimeout(() => {
                    if (vscode.window.activeNotebookEditor) {
                        const cells = vscode.window.activeNotebookEditor.notebook.getCells();
                        const cellIndex = cells.findIndex(c => c.document.uri.toString() === cell.document.uri.toString());
                        
                        if (cellIndex >= 0) {
                            // 确保输出是展开的
                            vscode.commands.executeCommand('notebook.cell.expandOutputs', cells[cellIndex]);
                            // 设置输出为只读模式
                            vscode.commands.executeCommand('notebook.cell.toggleOutputs', cells[cellIndex]);
                        }
                    }
                }, 100);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error updating cell output: ${error instanceof Error ? error.message : String(error)}`);
            
            // Try an alternative approach if the standard approach fails
            try {
                // Just set the outputs directly if possible
                if (outputs.length > 0 && vscode.window.activeNotebookEditor) {
                    const activeEditor = vscode.window.activeNotebookEditor;
                    activeEditor.notebook.getCells()
                        .filter((c: vscode.NotebookCell) => c.document.uri.toString() === cell.document.uri.toString())
                        .forEach(async (c: vscode.NotebookCell) => {
                            // Create a notebook controller execution
                            const controller = vscode.notebooks.createNotebookController('prompter-notebook-controller', 'prompter-notebook', 'Prompter');
                            const execution = controller.createNotebookCellExecution(c);
                            execution.replaceOutput(outputs);
                            execution.end(true);
                            
                            // 设置输出为只读模式
                            setTimeout(() => {
                                vscode.commands.executeCommand('notebook.cell.toggleOutputs', c);
                            }, 100);
                        });
                }
            } catch (fallbackError) {
                this.outputChannel.appendLine(`Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            }
        }

        // 同时输出到输出通道
        this.outputChannel.appendLine(`=== Cell ${cell.index + 1} (${cell.document.languageId}) ===`);
        if (stdout) {
            this.outputChannel.appendLine('STDOUT:');
            this.outputChannel.appendLine(stdout);
        }
        if (stderr) {
            this.outputChannel.appendLine('STDERR:');
            this.outputChannel.appendLine(stderr);
        }
        this.outputChannel.appendLine(`Exit code: ${exitCode}`);
        this.outputChannel.appendLine('');
    }
}