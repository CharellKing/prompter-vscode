import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class CellExecutor {
    private outputChannel: vscode.OutputChannel;
    private tempDir: string;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Prompter Output');
        this.tempDir = path.join(context.globalStorageUri?.fsPath || '', 'temp');
        
        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async executeCell(cell: vscode.NotebookCell): Promise<void> {
        if (cell.kind !== vscode.NotebookCellKind.Code) {
            return;
        }

        const code = cell.document.getText();
        const language = cell.document.languageId;

        // 清除之前的输出
        const edit = new vscode.WorkspaceEdit();
        const nbEdit = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [
            new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId)
        ]);
        edit.set(cell.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);

        try {
            const result = await this.runCode(code, language);
            await this.updateCellOutput(cell, result.stdout, result.stderr, result.exitCode);
        } catch (error) {
            await this.updateCellOutput(cell, '', error instanceof Error ? error.message : String(error), 1);
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

        const edit = new vscode.WorkspaceEdit();
        const cellData = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
        cellData.outputs = outputs;
        const nbEdit = vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [cellData]);
        edit.set(cell.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);

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