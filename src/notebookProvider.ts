import * as vscode from 'vscode';
import * as crypto from 'crypto';

interface PPNBCell {
    cell_type: 'code' | 'markdown' | 'prompt';
    id: string;
    metadata: {
        [key: string]: any;
    };
    source: string[];
    language?: string; // Add language field
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
        // Split string by lines, preserving line breaks
        const lines = content.split('\n');
        return lines.map((line, index) => {
            // Add line break to all lines except the last one
            return index < lines.length - 1 ? line + '\n' : line;
        });
    }

    // Convert outputs from saved file to VS Code Notebook output objects
    private toNotebookOutputs(outputs: any[]): vscode.NotebookCellOutput[] {
        try {
            return outputs.map((out: any) => {
                const data = out?.data || {};
                const items: vscode.NotebookCellOutputItem[] = [];
                for (const mime of Object.keys(data)) {
                    const value = data[mime];
                    let text: string;
                    if (typeof value === 'string') {
                        text = value;
                    } else {
                        try {
                            text = JSON.stringify(value);
                        } catch {
                            text = String(value);
                        }
                    }
                    if (mime === 'application/vnd.code.notebook.error') {
                        items.push(vscode.NotebookCellOutputItem.error(new Error(text)));
                    } else {
                        items.push(vscode.NotebookCellOutputItem.text(text, mime));
                    }
                }
                if (items.length === 0) {
                    items.push(vscode.NotebookCellOutputItem.text('', 'text/plain'));
                }
                return new vscode.NotebookCellOutput(items);
            });
        } catch {
            return [];
        }
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
                    // Prioritize saved language information, otherwise use default value
                    language = cell.language || notebook?.metadata?.language_info?.name || 'javascript';
                }

                const cellData = new vscode.NotebookCellData(
                    cellKind,
                    this.sourceToString(cell.source),
                    language
                );

                cellData.metadata = {
                    id: cell.id,
                    ...cell.metadata
                };

                // Set execution count for prompt cells in metadata
                if (cell.cell_type === 'code' && cell.language === 'prompt') {
                    cellData.metadata.execution_count = cell.execution_count || null;
                }

                if (cell.outputs && Array.isArray(cell.outputs) && cell.outputs.length > 0) {
                    try {
                        cellData.outputs = this.toNotebookOutputs(cell.outputs);
                    } catch {
                        cellData.outputs = [];
                    }
                }

                return cellData;
            });
        }

        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = notebook?.metadata || {};

        return notebookData;
    }

    async serializeNotebook(
        data: vscode.NotebookData,
        _token: vscode.CancellationToken
    ): Promise<Uint8Array> {
        const cellArray = Array.isArray(data.cells) ? data.cells : [];
        const cells: PPNBCell[] = cellArray.map(cell => {
            let cellType: 'code' | 'markdown' | 'prompt';
            
            if (cell.languageId === 'prompt') {
                cellType = 'code';
            } else if (cell.languageId === 'markdown') {
                cellType = 'markdown'; // Output cells are stored as code cells
            } else {
                cellType = 'code';
            }
            
            const ppnbCell: PPNBCell = {
                cell_type: cellType,
                id: cell.metadata?.id || this.generateCellId(),
                metadata: { ...cell.metadata },
                source: this.stringToSource(cell.value)
            };

            // Save language information for code cells
            if (cellType === 'code') {
                ppnbCell.language = cell.languageId;
            }

            if (cellType === 'code') {                
                // Properly handle outputs with prompt execution metadata
                if (cell.outputs && cell.outputs.length > 0) {
                    ppnbCell.outputs = cell.outputs.map(output => {
                        // Convert each output item to the expected format
                        const outputData = {
                            output_type: 'execute_result',
                            data: (output.items ?? []).reduce((data: any, item) => {
                                // Safely decode the output data
                                try {
                                    data[item.mime] = new TextDecoder().decode(item.data);
                                } catch (e) {
                                    // If decoding fails, use an empty string
                                    data[item.mime] = '';
                                }
                                return data;
                            }, {}),
                            metadata: output.metadata || {},
                            execution_count: null
                        };
                        
                        // For prompt cells, ensure execution metadata is preserved
                        if (cell.languageId === 'prompt' && output.metadata?.promptExecution) {
                            outputData.metadata = {
                                ...outputData.metadata,
                                promptExecution: output.metadata.promptExecution
                            };
                        }
                        
                        return outputData;
                    });
                } else {
                    ppnbCell.outputs = [];
                }
            }

            // Remove id from metadata since it's already a top-level property
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
                ...(data.metadata || {})
            },
            nbformat: 4,
            nbformat_minor: 5
        };

        return new TextEncoder().encode(JSON.stringify(notebook, null, 2));
    }
}