import * as vscode from 'vscode';
import { BookmarkManager, Bookmark } from './bookmarkManager';

export class BookmarkWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'prompter.view.bookmarkView';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _bookmarkManager: BookmarkManager;

    constructor(private readonly _context: vscode.ExtensionContext) {
        this._extensionUri = _context.extensionUri;
        this._bookmarkManager = BookmarkManager.getInstance(_context);
        
        // Listen for bookmark changes to update the bookmark view
        this._bookmarkManager.onDidChangeBookmarks(() => {
            this._updateBookmarkView();
        });
        
        // Listen for notebook changes to update the bookmark view
        vscode.window.onDidChangeActiveNotebookEditor(() => {
            this._updateBookmarkView();
        });
        
        // Listen for notebook document changes
        vscode.workspace.onDidChangeNotebookDocument((e) => {
            if (e.notebook.notebookType === 'prompter-notebook') {
                this._updateBookmarkView();
            }
        });
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

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'jumpToBookmark':
                    await this._jumpToBookmark(message.bookmarkId);
                    break;
                case 'removeBookmark':
                    await this._removeBookmark(message.bookmarkId);
                    break;
                case 'updateBookmarkTitle':
                    await this._updateBookmarkTitle(message.bookmarkId, message.title);
                    break;
                case 'requestBookmarks':
                    // 当WebView请求书签数据时，立即更新书签视图
                    await this._updateBookmarkView();
                    break;
            }
        });
        
        // Listen for view visibility changes
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                // When the view becomes visible, update the bookmark list
                this._updateBookmarkView();
            }
        });

        // Update bookmark view
        this._updateBookmarkView();
    }

    /**
     * Refresh bookmark view
     */
    public async refreshBookmarkView(): Promise<void> {
        if (this._view) {
            await this._updateBookmarkView();
        }
    }

    /**
     * Update bookmark view
     */
    private async _updateBookmarkView(): Promise<void> {
        if (!this._view) {
            return;
        }

        try {
            // Get all bookmarks
            const bookmarks = this._bookmarkManager.getBookmarks();
            
            // Get current active notebook URI (if any)
            const activeNotebookUri = vscode.window.activeNotebookEditor?.notebook.uri.toString();
            
            // Send data to webview
            await this._view.webview.postMessage({
                command: 'updateBookmarks',
                bookmarks,
                activeNotebookUri
            });
            
            // Log information
            console.log(`Updated bookmark view, total ${bookmarks.length} bookmarks`);
        } catch (error) {
            console.error('Error updating bookmark view:', error);
        }
    }

    /**
     * Jump to the cell corresponding to the bookmark
     */
    private async _jumpToBookmark(bookmarkId: string): Promise<void> {
        // Get bookmark
        const bookmark = this._bookmarkManager.getBookmarks().find(b => b.id === bookmarkId);
        if (!bookmark) {
            vscode.window.showErrorMessage('Bookmark not found');
            return;
        }

        try {
            // Open notebook document
            const notebookUri = vscode.Uri.parse(bookmark.notebookUri);
            const document = await vscode.workspace.openNotebookDocument(notebookUri);
            await vscode.window.showNotebookDocument(document);

            // Find the corresponding cell
            const activeNotebook = vscode.window.activeNotebookEditor;
            if (!activeNotebook) {
                return;
            }

            // Find cell index
            let cellIndex = -1;
            for (let i = 0; i < activeNotebook.notebook.cellCount; i++) {
                const cell = activeNotebook.notebook.cellAt(i);
                const cellId = cell.metadata?.id || `cell-${i}`;
                if (cellId === bookmark.cellId) {
                    cellIndex = i;
                    break;
                }
            }

            if (cellIndex === -1) {
                vscode.window.showWarningMessage('Corresponding cell not found, it may have been deleted');
                return;
            }

            // Select and display cell
            activeNotebook.selection = new vscode.NotebookRange(cellIndex, cellIndex + 1);
            activeNotebook.revealRange(
                new vscode.NotebookRange(cellIndex, cellIndex + 1),
                vscode.NotebookEditorRevealType.InCenter
            );
            
            // Focus cell
            vscode.commands.executeCommand('notebook.cell.edit');
        } catch (error) {
            vscode.window.showErrorMessage(`Error jumping to bookmark: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Remove bookmark
     */
    private async _removeBookmark(bookmarkId: string): Promise<void> {
        const success = await this._bookmarkManager.removeBookmark(bookmarkId);
        if (success) {
            await this._updateBookmarkView();
        } else {
            vscode.window.showErrorMessage('Failed to remove bookmark');
        }
    }

    /**
     * Update bookmark title
     */
    private async _updateBookmarkTitle(bookmarkId: string, title: string): Promise<void> {
        const success = await this._bookmarkManager.updateBookmarkTitle(bookmarkId, title);
        if (success) {
            await this._updateBookmarkView();
        } else {
            vscode.window.showErrorMessage('Failed to update bookmark title');
        }
    }

    /**
     * Generate HTML content for webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bookmarks</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 0;
            margin: 0;
        }
        .container {
            padding: 10px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .header h3 {
            margin: 0;
        }
        .bookmark-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .bookmark-item {
            display: flex;
            flex-direction: column;
            padding: 8px;
            border-radius: 4px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .bookmark-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        .bookmark-title {
            font-weight: bold;
            cursor: pointer;
            flex-grow: 1;
            margin-right: 8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .bookmark-title:hover {
            text-decoration: underline;
        }
        .bookmark-actions {
            display: flex;
            gap: 4px;
        }
        .bookmark-action {
            cursor: pointer;
            opacity: 0.7;
        }
        .bookmark-action:hover {
            opacity: 1;
        }
        .bookmark-content {
            font-size: 0.9em;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .bookmark-output {
            font-size: 0.85em;
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-style: italic;
        }
        .bookmark-timestamp {
            font-size: 0.8em;
            opacity: 0.7;
            margin-top: 4px;
            text-align: right;
        }
        .empty-state {
            text-align: center;
            padding: 20px;
            opacity: 0.7;
        }
        .edit-title-form {
            display: flex;
            margin-top: 4px;
            gap: 4px;
        }
        .edit-title-input {
            flex-grow: 1;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px;
            border-radius: 2px;
        }
        .edit-title-buttons {
            display: flex;
            gap: 4px;
        }
        .edit-title-button {
            cursor: pointer;
            padding: 2px 6px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
        }
        .edit-title-button.cancel {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .active-notebook {
            border-left: 3px solid var(--vscode-activityBarBadge-background);
            padding-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h3>Bookmarks</h3>
        </div>
        <div id="bookmarkList" class="bookmark-list">
            <div class="empty-state">No bookmarks</div>
        </div>
    </div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            
            // 尝试恢复之前的状态
            let state = vscode.getState() || { bookmarks: [], activeNotebookUri: null, editingBookmarkId: null };
            let bookmarks = state.bookmarks || [];
            let activeNotebookUri = state.activeNotebookUri;
            let editingBookmarkId = state.editingBookmarkId;

            // 监听来自扩展的消息
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateBookmarks':
                        bookmarks = message.bookmarks;
                        activeNotebookUri = message.activeNotebookUri;
                        
                        // 保存状态
                        vscode.setState({ bookmarks, activeNotebookUri, editingBookmarkId });
                        
                        renderBookmarks();
                        break;
                }
            });

            // 渲染书签列表
            function renderBookmarks() {
                const bookmarkListElement = document.getElementById('bookmarkList');
                
                if (bookmarks.length === 0) {
                    bookmarkListElement.innerHTML = '<div class="empty-state">No bookmarks</div>';
                    return;
                }

                // 按时间戳降序排序
                bookmarks.sort((a, b) => b.timestamp - a.timestamp);

                let html = '';
                bookmarks.forEach(bookmark => {
                    const isActive = bookmark.notebookUri === activeNotebookUri;
                    const date = new Date(bookmark.timestamp);
                    const formattedDate = \`\${date.getFullYear()}-\${(date.getMonth() + 1).toString().padStart(2, '0')}-\${date.getDate().toString().padStart(2, '0')} \${date.getHours().toString().padStart(2, '0')}:\${date.getMinutes().toString().padStart(2, '0')}\`;
                    
                    html += \`
                        <div class="bookmark-item \${isActive ? 'active-notebook' : ''}" data-id="\${bookmark.id}">
                            <div class="bookmark-header">
                                \${editingBookmarkId === bookmark.id ? 
                                    \`<div class="edit-title-form">
                                        <input type="text" class="edit-title-input" value="\${bookmark.title}" />
                                        <div class="edit-title-buttons">
                                            <button class="edit-title-button save">Save</button>
                                            <button class="edit-title-button cancel">Cancel</button>
                                        </div>
                                    </div>\` : 
                                    \`<div class="bookmark-title" title="\${bookmark.title}">\${bookmark.title}</div>
                                    <div class="bookmark-actions">
                                        <span class="bookmark-action edit-title" title="Edit title">✏️</span>
                                        <span class="bookmark-action remove" title="Remove bookmark">🗑️</span>
                                    </div>\`
                                }
                            </div>
                            <div class="bookmark-content" title="\${bookmark.content}">\${bookmark.content}</div>
                            \${bookmark.output ? \`<div class="bookmark-output" title="\${bookmark.output}">Output: \${bookmark.output}</div>\` : ''}
                            <div class="bookmark-timestamp">\${formattedDate}</div>
                        </div>
                    \`;
                });

                bookmarkListElement.innerHTML = html;

                // 添加事件监听器
                document.querySelectorAll('.bookmark-title').forEach(el => {
                    el.addEventListener('click', function() {
                        const bookmarkId = this.closest('.bookmark-item').dataset.id;
                        vscode.postMessage({
                            command: 'jumpToBookmark',
                            bookmarkId
                        });
                    });
                });

                document.querySelectorAll('.bookmark-action.remove').forEach(el => {
                    el.addEventListener('click', function() {
                        const bookmarkId = this.closest('.bookmark-item').dataset.id;
                        vscode.postMessage({
                            command: 'removeBookmark',
                            bookmarkId
                        });
                    });
                });

                document.querySelectorAll('.bookmark-action.edit-title').forEach(el => {
                    el.addEventListener('click', function() {
                        const bookmarkItem = this.closest('.bookmark-item');
                        const bookmarkId = bookmarkItem.dataset.id;
                        editingBookmarkId = bookmarkId;
                        // 保存状态
                        vscode.setState({ bookmarks, activeNotebookUri, editingBookmarkId });
                        renderBookmarks();
                    });
                });

                document.querySelectorAll('.edit-title-button.save').forEach(el => {
                    el.addEventListener('click', function() {
                        const bookmarkItem = this.closest('.bookmark-item');
                        const bookmarkId = bookmarkItem.dataset.id;
                        const newTitle = bookmarkItem.querySelector('.edit-title-input').value.trim();
                        
                        if (newTitle) {
                            vscode.postMessage({
                                command: 'updateBookmarkTitle',
                                bookmarkId,
                                title: newTitle
                            });
                        }
                        
                        editingBookmarkId = null;
                        // 保存状态
                        vscode.setState({ bookmarks, activeNotebookUri, editingBookmarkId });
                        renderBookmarks();
                    });
                });

                document.querySelectorAll('.edit-title-button.cancel').forEach(el => {
                    el.addEventListener('click', function() {
                        editingBookmarkId = null;
                        // 保存状态
                        vscode.setState({ bookmarks, activeNotebookUri, editingBookmarkId });
                        renderBookmarks();
                    });
                });
            }

            // 初始请求书签数据
            vscode.postMessage({ command: 'requestBookmarks' });
        })();
    </script>
</body>
</html>`;
    }
}

/**
 * 注册切换书签面板命令
 */
export function registerToggleBookmarkPanelCommand(context: vscode.ExtensionContext, bookmarkProvider: BookmarkWebviewProvider) {
    const command = vscode.commands.registerCommand('prompter.notebook.toggleBookmarkPanel', async () => {
        // 显示书签视图
        await vscode.commands.executeCommand('workbench.view.extension.prompter-activitybar');
        
        // 聚焦书签视图
        await vscode.commands.executeCommand('prompter.view.bookmarkView.focus');
        
        // 刷新书签视图
        await bookmarkProvider.refreshBookmarkView();
    });
    
    context.subscriptions.push(command);
}