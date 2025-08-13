"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrompterNotebookProvider = void 0;
const vscode = require("vscode");
const crypto = require("crypto");
class PrompterNotebookProvider {
    generateCellId() {
        return crypto.randomBytes(4).toString('hex');
    }
    sourceToString(source) {
        if (Array.isArray(source)) {
            return source.join('');
        }
        return source;
    }
    stringToSource(content) {
        // 将字符串按行分割，保留换行符
        const lines = content.split('\n');
        return lines.map((line, index) => {
            // 除了最后一行，其他行都加上换行符
            return index < lines.length - 1 ? line + '\n' : line;
        });
    }
    async deserializeNotebook(content, _token) {
        const contents = new TextDecoder().decode(content);
        let notebook;
        try {
            notebook = contents ? JSON.parse(contents) : null;
        }
        catch {
            notebook = null;
        }
        let cells = [];
        if (notebook && notebook.cells) {
            cells = notebook.cells.map(cell => {
                let cellKind;
                let language;
                if (cell.cell_type === 'markdown') {
                    cellKind = vscode.NotebookCellKind.Markup;
                    language = 'markdown';
                }
                else if (cell.cell_type === 'prompt') {
                    cellKind = vscode.NotebookCellKind.Markup;
                    language = 'prompt';
                }
                else {
                    cellKind = vscode.NotebookCellKind.Code;
                    language = notebook?.metadata?.language_info?.name || 'javascript';
                }
                const cellData = new vscode.NotebookCellData(cellKind, this.sourceToString(cell.source), language);
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
            cells.push(new vscode.NotebookCellData(vscode.NotebookCellKind.Code, '// Welcome to Prompter!\n// Press Ctrl+Enter to run this cell\nconsole.log("Hello, World!");', 'javascript'));
        }
        const notebookData = new vscode.NotebookData(cells);
        notebookData.metadata = notebook?.metadata || {};
        return notebookData;
    }
    async serializeNotebook(data, _token) {
        const cells = data.cells.map(cell => {
            let cellType;
            if (cell.kind === vscode.NotebookCellKind.Code) {
                cellType = 'code';
            }
            else if (cell.metadata?.cellType === 'prompt') {
                cellType = 'prompt';
            }
            else {
                cellType = 'markdown';
            }
            const ppnbCell = {
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
        const notebook = {
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
exports.PrompterNotebookProvider = PrompterNotebookProvider;
//# sourceMappingURL=notebookProvider.js.map