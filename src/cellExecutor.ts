import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import crypto, { randomUUID } from 'crypto';
import {  executeCellPrompt, PromptCellChatResponse, promptCellChatResponseSchema } from './llm';
import { WrapChatResponse } from './llm/run';



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
        
        // Ensure temporary directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Updates prompt cell history and execution count
     */
    private async updatePromptCellHistory(cell: vscode.NotebookCell, content: string): Promise<vscode.NotebookCell> {
        const currentTime = new Date().toISOString();
        const currentMetadata = cell.metadata || {};
        const cellIndex = cell.index;
        const notebookUri = cell.notebook.uri.toString();

        const cellId = currentMetadata.id ?? '';
        // Initialize or update history array
        const history = currentMetadata.history || [];
        const currentContentMd5 = crypto.createHash('md5').update(content).digest('hex');

        let hasSameHistory = false;
        for (const historyItem of history) {
            // Check if the same history already exists
            if (historyItem.md5 === currentContentMd5) {
                hasSameHistory = true;
                break;
            }
        }
        
        if (!hasSameHistory) {
            // If there's new history, update the history records
            history.push({
                content: content,
                timestamp: currentTime,
                md5: currentContentMd5,
            });
        }
        
        // Update execution count
        const executionCount = (currentMetadata.execution_count || 0) + 1;

        // Apply the metadata changes to the cell
        const edit = new vscode.WorkspaceEdit();
        const cellData = new vscode.NotebookCellData(
            cell.kind,
            cell.document.getText(),
            cell.document.languageId
        );
        
        // Set the updated metadata
        cellData.metadata = {
            ...currentMetadata,
            execution_count: executionCount,
            history: history,
        }
        
        // Create notebook edit to replace the cell with updated metadata
        const nbEdit = vscode.NotebookEdit.replaceCells(
            new vscode.NotebookRange(cell.index, cell.index + 1),
            [cellData]
        );
        
        // Apply the edit
        edit.set(cell.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);
        const notebook = vscode.workspace.notebookDocuments.find(nb => nb.uri.toString() === notebookUri.toString());
        return notebook?.cellAt(cellIndex) || cell;
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
            // If it's prompt language, call LLM API and update history
            if (language === 'prompt') {
                console.log('Calling LLM API for prompt cell');
                // Update execution history and count
                const chatResponse = await executeCellPrompt({
                    Prompt: code, 
                    Schema: promptCellChatResponseSchema,
                    TypeName: "PromptCellChatResponse",
                });
                // 类型断言确保 chatResponse 符合 WrapChatResponse<PromptCellChatResponse> 类型
                await this.updateCellOutputWithTypeChat(cell, code, chatResponse as WrapChatResponse<PromptCellChatResponse>);
            } else {
                // Execute code for other languages
                console.log(`Running code for language: ${language}`);
                const result = await this.runCode(code, language);
                await this.updateCellOutput(cell, code, result.stdout, result.stderr, result.exitCode);
            }
        } catch (error) {
            console.error('Cell execution error:', error);
            // Create error output cell, similar to VS Code Jupyter
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // 1. Update current cell, display execution status
            await this.updateCellOutput(cell, code, '', errorMessage, 1);
            
            // Log to output channel
            this.outputChannel.appendLine(`Error executing cell ${cell.index + 1}: ${errorMessage}`);
            
            // Throw error for controller to handle
            throw error;
        }
    }
    
    /**
     * Create an error output cell
     */
    private async createErrorOutputCell(sourceCell: vscode.NotebookCell, errorMessage: string): Promise<void> {
        try {
            const notebook = sourceCell.notebook;
            
            // Get the current cell index
            const currentIndex = sourceCell.index;
            
            // Ensure index is valid
            if (currentIndex < 0) {
                this.outputChannel.appendLine(`Warning: Invalid cell index ${currentIndex}, cannot create error output cell`);
                return;
            }
            
            // Create a new error output cell
            const errorCell = new vscode.NotebookCellData(
                vscode.NotebookCellKind.Markup, // 使用Markup类型以便更好地显示错误
                `## ❌ Error\n\n\`\`\`\n${errorMessage}\n\`\`\``,
                'markdown'
            );
            
            // Set metadata, mark as custom error cell type and set as non-editable
            errorCell.metadata = {
                ...errorCell.metadata,
                hasError: true,
                sourceCell: currentIndex,
                editable: false,  // 设置为不可编辑
                runnable: false   // 设置为不可运行
            };
            
            // Ensure error cell is inserted after the source cell (at index + 1)
            const insertIndex = currentIndex + 1;
            
            // Create edit operation
            const edit = new vscode.WorkspaceEdit();
            const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [errorCell]);
            edit.set(notebook.uri, [nbEdit]);
            
            // Apply edit
            await vscode.workspace.applyEdit(edit);
            
            // Set cell to non-editable state
            setTimeout(() => {
                if (vscode.window.activeNotebookEditor) {
                    // Get all cells
                    const cells = vscode.window.activeNotebookEditor.notebook.getCells();
                    
                    // Find the recently inserted error cell
                    // Note: Cell index may have changed, so we need to find the cell at the insertion position
                    if (insertIndex < cells.length) {
                        const errorCell = cells[insertIndex];
                        // Use VS Code API to set cell to read-only mode
                        vscode.commands.executeCommand('notebook.cell.toggleOutputs', errorCell);
                    }
                }
            }, 100);
            
            this.outputChannel.appendLine(`Created error output cell at index ${insertIndex}`);
        } catch (error) {
            this.outputChannel.appendLine(`Error creating error output cell: ${error instanceof Error ? error.message : String(error)}`);
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

            // Write to temporary file
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
                // Clean up temporary file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                // Ignore cleanup errors
                }

                resolve({
                    stdout,
                    stderr,
                    exitCode: code || 0
                });
            });

            process.on('error', (error) => {
                // Clean up temporary file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                // Ignore cleanup errors
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

    private async updateCellOutputWithTypeChat(cell: vscode.NotebookCell, prompt: string, chatResponse: WrapChatResponse<PromptCellChatResponse>) {
        const outputs: vscode.NotebookCellOutput[] = [];

        if (chatResponse.data.response) {
            // Create output metadata with execution details for serialization
            const outputMetadata = {
                promptExecution: {
                    org: chatResponse.org,
                    model: chatResponse.model,
                    startTime: chatResponse.startTime,
                    endTime: chatResponse.endTime,
                    duration: chatResponse.duration,
                    temperature: chatResponse.temperature,
                    maxTokens: chatResponse.maxTokens,
                    // Additional properties for serialization/deserialization
                    cellType: 'prompt',
                    executionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    format: chatResponse.data.format || 'plaintext',
                }
            };

            // Check if content appears to be markdown            
            if (chatResponse.data.format.toLowerCase() === 'markdown'){
                // Create markdown output for better rendering
                outputs.push(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(chatResponse.data.response, 'text/markdown')
                ], outputMetadata));
            } else {
                // Create plain text output
                outputs.push(new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.text(chatResponse.data.response, 'text/plain')
                ], outputMetadata));
            }
        }

        // Use a more direct approach to set outputs
        await this.applyCell(cell, prompt, outputs, chatResponse.data.tags || []);
    }

    private detectMarkdown(content: string): boolean {
        const markdownPatterns = [
            /^#{1,6}\s/m,           // Headers
            /\*\*.*\*\*/,           // Bold
            /\*.*\*/,               // Italic
            /```[\s\S]*```/,        // Code blocks
            /`.*`/,                 // Inline code
            /^\s*[-*+]\s/m,         // Lists
            /^\s*\d+\.\s/m,         // Numbered lists
            /\[.*\]\(.*\)/,         // Links
            /!\[.*\]\(.*\)/         // Images
        ];

        return markdownPatterns.some(pattern => pattern.test(content));
    }

    private async applyCell(cell: vscode.NotebookCell, code: string, outputs: vscode.NotebookCellOutput[], tags: string[] = []) {
        // Ensure cell index is valid (non-negative)
        const cellIndex = cell.index;
        const notebookUri = cell.notebook.uri;
        const currentTime = new Date().toISOString();
        const currentMetadata = cell.metadata || {};
        const history = currentMetadata.history || [];
        const currentContentMd5 = crypto.createHash('md5').update(code).digest('hex');

        if (cell.index < 0) {
            this.outputChannel.appendLine(`Warning: Invalid cell index ${cell.index}, cannot update output`);
            return cell;
        }

        let hasSameHistory = false;
        for (const historyItem of history) {
            // Check if the same history already exists
            if (historyItem.md5 === currentContentMd5) {
                hasSameHistory = true;
                break;
            }
        }

        if (!hasSameHistory) {
            // If there's new history, update the history records
            history.push({
                id: uuidv4(),
                content: code,
                timestamp: currentTime,
                md5: currentContentMd5,
            });
        }

        const executionCount = (currentMetadata.execution_count || 0) + 1;

        
        
        const edit = new vscode.WorkspaceEdit();
        const cellData = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
        
        // Set outputs
        cellData.outputs = outputs;
        
        // Maintain existing metadata, ensure history is not lost
        cellData.metadata = {
            ...currentMetadata,
            execution_count: executionCount,
            history: history,
            hasError: false,
            outputsReadonly: true,  // Set output as read-only
            tags: tags,
        };
        
        const nbEdit = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [cellData]);
        edit.set(cell.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);
    }

    private async updateCellOutput(cell: vscode.NotebookCell, code: string, stdout: string, stderr: string, exitCode: number){
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

        return await this.applyCell(cell, code, outputs, []);
    }
}