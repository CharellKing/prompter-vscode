import * as vscode from 'vscode';
import * as crypto from 'crypto';

interface PPNBCell {
    cell_type: 'code' | 'markdown' | 'prompt';
    id: string;
    metadata: {
        [key: string]: any;
    };
    source: string[];
    outputs?: any[];
    execution_count?: number | null;
}

interface PPNBNotebook {
    cells: PPNBCell[];
    metadata: {
        kernelspec?: {
            display_name: string;
            language: string;
            name: string;
        };
        language_info?: {
            name: string;
            version?: string;
        };
        [key: string]: any;
    };
    nbformat: number;
    nbformat_minor: number;
}

export class PrompterNotebookProvider implements vscode.NotebookSerializer {
    private generateCellId(): string {
        return crypto.randomBytes(4).toString('hex');
    }

    private sourceToString(source: string | string[]): string {
        if (Array.isArray(source)) {
            return source.join('');
        }
        return source;
    }

    private stringToSource(content: string): string[] {
        // 将字符串按行分割，保留换行符
        const lines = content.split('\n');
        return lines.map((line, index) => {
            // 除了最后一行，其他行都加上换行符
            return index < lines.length - 1 ? line + '\n' : line;
        });
    }

    async deserializeNotebook(
        content: Uint8Array,
        _token: vscode.CancellationToken
    ): Promise<vscode.NotebookData> {
        const contents = new TextDecoder().decode(content);
        
        let notebook: PPNBNotebook | null;
        try {
            notebook = contents ? JSON.parse(contents) : null;
        } catch {
            notebook = null;
        }

        let cells: vscode.NotebookCellData[] = [];

        if (notebook && notebook.cells) {
            cells = notebook.cells.map(cell => {
                let cellKind: vscode.NotebookCellKind;
                let language: string;
                
                if (cell.cell_type === 'markdown') {
                    cellKind = vscode.NotebookCellKind.Markup;
                    language = 'markdown';
                } else if (cell.cell_type === 'prompt') {
                    cellKind = vscode.NotebookCellKind.Code;
                    language = 'prompt';
                } else {
                    cellKind = vscode.NotebookCellKind.Code;
                    language = notebook?.metadata?.language_info?.name || 'javascript';
                }

                const cellData = new vscode.NotebookCellData(
                    cellKind,
                    this.sourceToString(cell.source),
                    language
                );

                cellData.metadata = {
                    id: cell.id,
                    cellType: cell.cell_type === 'prompt' ? 'prompt' : undefined,
                    ...cell.metadata
                };

                if (cell.outputs) {
                    cellData.outputs = cell.outputs;
                }

                return cellData;
            });
        }

        // 如果没有cells，创建一个默认的代码cell
        if (cells.length === 0) {
            cells.push(new vscode.NotebookCellData(
                vscode.NotebookCellKind.Code,
                '// Welcome to Prompter!\n// Press Ctrl+Enter to run this cell\nconsole.log("Hello, World!");',
                'javascript'
            ));
        }

        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = notebook?.metadata || {};

        return notebookData;
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const cells: PPNBCell[] = data.cells.map(cell => {
            let cellType: 'code' | 'markdown' | 'prompt';
            
            if (cell.kind === vscode.NotebookCellKind.Code) {
                cellType = 'code';
            } else if (cell.metadata?.cellType === 'prompt') {
                cellType = 'prompt';
            } else {
                cellType = 'markdown';
            }
            
            const ppnbCell: PPNBCell = {
                cell_type: cellType,
                id: cell.metadata?.id || this.generateCellId(),
                metadata: { ...cell.metadata },
                source: this.stringToSource(cell.value)
            };

            if (cellType === 'code') {
                ppnbCell.execution_count = null;
                ppnbCell.outputs = cell.outputs || [];
            }

            // 移除id从metadata中，因为它已经是顶级属性
            delete ppnbCell.metadata.id;

            return ppnbCell;
        });

        const notebook: PPNBNotebook = {
            cells,
            metadata: {
                kernelspec: {
                    display_name: "Multi-Language",
                    language: "multi",
                    name: "prompter"
                },
                language_info: {
                    name: "multi",
                    version: "1.0.0"
                },
                ...data.metadata
            },
            nbformat: 4,
            nbformat_minor: 5
        };

        return new TextEncoder().encode(JSON.stringify(notebook, null, 2));
    }
}