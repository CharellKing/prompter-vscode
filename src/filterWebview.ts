import * as vscode from 'vscode';

export class FilterWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prompter.filterView';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _allTags: Set<string> = new Set();
    private _allPrompts: any[] = [];

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._extensionUri = _context.extensionUri;
        
        // Initialize by reading from active editor
        this._initializeFromActiveEditor();
        
        // Listen for notebook changes to update the filter view
        vscode.window.onDidChangeActiveNotebookEditor(() => {
            this._initializeFromActiveEditor();
        });
        
        // Listen for notebook document changes
        vscode.workspace.onDidChangeNotebookDocument((e) => {
            if (e.notebook.notebookType === 'prompter-notebook') {
                this._initializeFromActiveEditor();
            }
        });
    }
    
    private async _initializeFromActiveEditor() {
        const activeNotebook = vscode.window.activeNotebookEditor?.notebook;
        if (!activeNotebook || activeNotebook.notebookType !== 'prompter-notebook') {
            return;
        }
        
        // Collect all tags and prompts
        this._allTags.clear();
        this._allPrompts = [];
        
        for (let i = 0; i < activeNotebook.cellCount; i++) {
            const cell = activeNotebook.cellAt(i);
            
            // Only process prompt cells
            if (cell.kind === vscode.NotebookCellKind.Code && cell.document.languageId === 'prompt') {
                const tags = this._getTagsFromCell(cell);
                const promptId = cell.metadata?.id || `cell-${i}`;
                const promptText = cell.document.getText().substring(0, 100) + (cell.document.getText().length > 100 ? '...' : '');
                
                // Add tags to the set
                tags.forEach(tag => this._allTags.add(tag));
                
                // Add prompt to the list
                this._allPrompts.push({
                    id: promptId,
                    index: i,
                    text: promptText,
                    tags: tags
                });
            }
        }
        
        // If view is already initialized, update it
        if (this._view) {
            this._view.webview.postMessage({
                command: 'updateData',
                tags: Array.from(this._allTags),
                prompts: this._allPrompts
            });
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'filterByTags':
                    await this._filterByTags(message.tags);
                    break;
                case 'jumpToPrompt':
                    await this._jumpToPrompt(message.promptId);
                    break;
            }
        });

        // Update the filter view when the active notebook changes
        this._updateFilterView();
    }

    public async refreshFilterView() {
        await this._updateFilterView();
    }

    private async _updateFilterView() {
        // Use the initialization method to update the view
        await this._initializeFromActiveEditor();
    }

    private _getTagsFromCell(cell: vscode.NotebookCell): string[] {
        // Extract tags from cell metadata
        const tags = cell.metadata?.tags || [];
        return Array.isArray(tags) ? tags : [];
    }

    private async _filterByTags(selectedTags: string[]) {
        if (!this._view) {
            return;
        }

        let filteredPrompts = this._allPrompts;
        
        // If tags are selected, filter prompts
        if (selectedTags.length > 0) {
            filteredPrompts = this._allPrompts.filter(prompt => {
                return selectedTags.some(tag => prompt.tags.includes(tag));
            });
        } else {
            // When no tags are selected, show all prompts
            filteredPrompts = this._allPrompts;
        }

        // Send filtered prompts to the webview
        this._view.webview.postMessage({
            command: 'updateFilteredPrompts',
            prompts: filteredPrompts
        });
    }

    private async _jumpToPrompt(promptId: string) {
        const activeNotebook = vscode.window.activeNotebookEditor;
        if (!activeNotebook) {
            return;
        }

        // Find the prompt by ID
        const prompt = this._allPrompts.find(p => p.id === promptId);
        if (!prompt) {
            return;
        }

        // Get the cell index
        const cellIndex = prompt.index;
        
        // Reveal the cell in the center of the editor
        const cell = activeNotebook.notebook.cellAt(cellIndex);
        
        // First select the cell
        activeNotebook.selection = new vscode.NotebookRange(cellIndex, cellIndex + 1);
        
        // Then reveal it in the center of the editor
        activeNotebook.revealRange(
            new vscode.NotebookRange(cellIndex, cellIndex + 1),
            vscode.NotebookEditorRevealType.InCenter
        );
        
        // Focus on the cell
        vscode.commands.executeCommand('notebook.cell.edit');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script and stylesheet
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'filterWebview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'filterWebview.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <link href="${styleUri}" rel="stylesheet">
            <title>Prompt Filter</title>
            <style>
                body {
                    padding: 0;
                    margin: 0;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .container {
                    padding: 10px;
                }
                .tags-container {
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                .tag {
                    display: inline-block;
                    padding: 3px 8px;
                    margin: 3px;
                    border-radius: 3px;
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    cursor: pointer;
                }
                .tag.selected {
                    background-color: #4CAF50; /* Green color */
                    color: white;
                }
                .prompt-list {
                    margin-top: 10px;
                }
                .prompt-item {
                    padding: 8px;
                    margin-bottom: 5px;
                    border-radius: 3px;
                    background-color: var(--vscode-editor-background);
                    cursor: pointer;
                    border: 1px solid transparent;
                }
                .prompt-item:hover {
                    border-color: var(--vscode-focusBorder);
                }
                .prompt-tags {
                    margin-top: 5px;
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                }
                .prompt-text {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-weight: normal;
                    font-size: 1em;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="tags-container">
                    <h3>Tags</h3>
                    <div id="tags-list"></div>
                </div>
                <div class="prompts-container">
                    <h3>Prompts</h3>
                    <div id="prompt-list" class="prompt-list"></div>
                </div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const tagsListElement = document.getElementById('tags-list');
                const promptListElement = document.getElementById('prompt-list');
                let allTags = [];
                let allPrompts = [];
                let selectedTags = [];

                // Handle messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'updateData':
                            allTags = message.tags;
                            allPrompts = message.prompts;
                            renderTags();
                            renderPrompts(allPrompts);
                            break;
                        case 'updateFilteredPrompts':
                            renderPrompts(message.prompts);
                            break;
                    }
                });

                function renderTags() {
                    tagsListElement.innerHTML = '';
                    
                    allTags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.className = 'tag' + (selectedTags.includes(tag) ? ' selected' : '');
                        tagElement.textContent = tag;
                        tagElement.addEventListener('click', () => {
                            toggleTag(tag, tagElement);
                        });
                        tagsListElement.appendChild(tagElement);
                    });
                }

                function toggleTag(tag, element) {
                    const index = selectedTags.indexOf(tag);
                    if (index === -1) {
                        selectedTags.push(tag);
                        element.classList.add('selected');
                    } else {
                        selectedTags.splice(index, 1);
                        element.classList.remove('selected');
                    }
                    
                    // Send selected tags to extension
                    vscode.postMessage({
                        command: 'filterByTags',
                        tags: selectedTags
                    });
                }

                function renderPrompts(prompts) {
                    promptListElement.innerHTML = '';
                    
                    if (prompts.length === 0) {
                        const noPrompts = document.createElement('div');
                        noPrompts.textContent = 'No prompts found';
                        noPrompts.style.padding = '10px';
                        noPrompts.style.color = 'var(--vscode-descriptionForeground)';
                        promptListElement.appendChild(noPrompts);
                        return;
                    }
                    
                    prompts.forEach(prompt => {
                        const promptElement = document.createElement('div');
                        promptElement.className = 'prompt-item';
                        
                        const textElement = document.createElement('div');
                        textElement.className = 'prompt-text';
                        textElement.textContent = prompt.text;
                        promptElement.appendChild(textElement);
                        
                        if (prompt.tags.length > 0) {
                            const tagsElement = document.createElement('div');
                            tagsElement.className = 'prompt-tags';
                            tagsElement.textContent = prompt.tags.join(', ');
                            promptElement.appendChild(tagsElement);
                        }
                        
                        promptElement.addEventListener('click', () => {
                            vscode.postMessage({
                                command: 'jumpToPrompt',
                                promptId: prompt.id
                            });
                        });
                        
                        promptListElement.appendChild(promptElement);
                    });
                }
            </script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}