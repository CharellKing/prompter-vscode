import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents a bookmark item
 */
export interface Bookmark {
    id: string;           // Unique bookmark ID
    cellId: string;       // Cell ID
    notebookUri: string;  // Notebook URI
    content: string;      // Cell content preview
    output?: string;      // Output content preview
    timestamp: number;    // Creation timestamp
    title: string;        // Bookmark title
}

/**
 * Bookmark manager class, responsible for adding, removing and retrieving bookmarks
 */
export class BookmarkManager {
    private static instance: BookmarkManager;
    private bookmarks: Bookmark[] = [];
    private storageUri: vscode.Uri | undefined;
    private readonly STORAGE_FILE = 'bookmarks.json';
    private outputChannel: vscode.OutputChannel;
    private _onDidChangeBookmarks = new vscode.EventEmitter<void>();
    public readonly onDidChangeBookmarks = this._onDidChangeBookmarks.event;

    private constructor(context: vscode.ExtensionContext) {
        this.storageUri = context.globalStorageUri;
        this.outputChannel = vscode.window.createOutputChannel('Prompter Bookmarks');
        this.loadBookmarks();
    }

    /**
     * Get the singleton instance of BookmarkManager
     */
    public static getInstance(context?: vscode.ExtensionContext): BookmarkManager {
        if (!BookmarkManager.instance && context) {
            BookmarkManager.instance = new BookmarkManager(context);
        }
        return BookmarkManager.instance;
    }

    /**
     * Load bookmarks from storage
     */
    private async loadBookmarks(): Promise<void> {
        try {
            if (!this.storageUri) {
                return;
            }

            // Ensure storage directory exists
            if (!fs.existsSync(this.storageUri.fsPath)) {
                fs.mkdirSync(this.storageUri.fsPath, { recursive: true });
            }

            const filePath = path.join(this.storageUri.fsPath, this.STORAGE_FILE);
            
            // If file doesn't exist, create an empty bookmark file
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
                return;
            }

            // Read and parse bookmark file
            const data = fs.readFileSync(filePath, 'utf8');
            this.bookmarks = JSON.parse(data);
            this.outputChannel.appendLine(`Loaded ${this.bookmarks.length} bookmarks`);
        } catch (error) {
            this.outputChannel.appendLine(`Error loading bookmarks: ${error instanceof Error ? error.message : String(error)}`);
            // If loading fails, use empty array
            this.bookmarks = [];
        }
    }

    /**
     * Save bookmarks to storage
     */
    private async saveBookmarks(): Promise<void> {
        try {
            if (!this.storageUri) {
                return;
            }

            // Ensure storage directory exists
            if (!fs.existsSync(this.storageUri.fsPath)) {
                fs.mkdirSync(this.storageUri.fsPath, { recursive: true });
            }

            const filePath = path.join(this.storageUri.fsPath, this.STORAGE_FILE);
            fs.writeFileSync(filePath, JSON.stringify(this.bookmarks, null, 2), 'utf8');
            this.outputChannel.appendLine(`Saved ${this.bookmarks.length} bookmarks`);
        } catch (error) {
            this.outputChannel.appendLine(`Error saving bookmarks: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Add bookmark
     * @param cell The cell to bookmark
     * @returns The added bookmark object
     */
    public async addBookmark(cell: vscode.NotebookCell): Promise<Bookmark | undefined> {
        try {
            // Check if cell is valid
            if (!cell || !cell.notebook) {
                return undefined;
            }

            // Get cell ID, generate one if it doesn't exist
            const cellId = cell.metadata?.id || `cell-${cell.index}`;
            
            // Check if the same bookmark already exists
            const existingIndex = this.bookmarks.findIndex(b => b.cellId === cellId && b.notebookUri === cell.notebook.uri.toString());
            
            // Get cell content preview
            const content = cell.document.getText().substring(0, 100) + (cell.document.getText().length > 100 ? '...' : '');
            
            // Get output content preview (if any)
            let output = '';
            if (cell.outputs && cell.outputs.length > 0) {
                for (const cellOutput of cell.outputs) {
                    for (const item of cellOutput.items) {
                        if (item.mime === 'text/plain' || item.mime === 'text/markdown') {
                            const text = new TextDecoder().decode(item.data);
                            output += text.substring(0, 100);
                            if (text.length > 100) {
                                output += '...';
                            }
                            break;
                        }
                    }
                    if (output) {
                        break;
                    }
                }
            }

            // Create bookmark object
            const bookmark: Bookmark = {
                id: existingIndex >= 0 ? this.bookmarks[existingIndex].id : `bookmark-${Date.now()}`,
                cellId,
                notebookUri: cell.notebook.uri.toString(),
                content,
                output,
                timestamp: Date.now(),
                title: `Bookmark ${this.bookmarks.length + 1}`
            };

            // If already exists, update; otherwise add new bookmark
            if (existingIndex >= 0) {
                this.bookmarks[existingIndex] = bookmark;
                this.outputChannel.appendLine(`Updated bookmark: ${bookmark.title}`);
            } else {
                this.bookmarks.push(bookmark);
                this.outputChannel.appendLine(`Added bookmark: ${bookmark.title}`);
            }

            // Save bookmarks
            await this.saveBookmarks();
            // Trigger bookmark change event
            this._onDidChangeBookmarks.fire();
            return bookmark;
        } catch (error) {
            this.outputChannel.appendLine(`Error adding bookmark: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    /**
     * Remove bookmark
     * @param bookmarkId The ID of the bookmark to remove
     * @returns Whether the removal was successful
     */
    public async removeBookmark(bookmarkId: string): Promise<boolean> {
        try {
            const initialLength = this.bookmarks.length;
            this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
            
            if (this.bookmarks.length < initialLength) {
                await this.saveBookmarks();
                this.outputChannel.appendLine(`Removed bookmark: ${bookmarkId}`);
                // Trigger bookmark change event
                this._onDidChangeBookmarks.fire();
                return true;
            }
            
            return false;
        } catch (error) {
            this.outputChannel.appendLine(`Error removing bookmark: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Get all bookmarks
     * @returns Array of all bookmarks
     */
    public getBookmarks(): Bookmark[] {
        return [...this.bookmarks];
    }

    /**
     * Get bookmarks by notebook URI
     * @param notebookUri Notebook URI
     * @returns Array of bookmarks belonging to the notebook
     */
    public getBookmarksByNotebook(notebookUri: string): Bookmark[] {
        return this.bookmarks.filter(b => b.notebookUri === notebookUri);
    }

    /**
     * Get bookmark by cell ID
     * @param cellId Cell ID
     * @returns The corresponding bookmark, or undefined if it doesn't exist
     */
    public getBookmarkByCell(cellId: string, notebookUri: string): Bookmark | undefined {
        return this.bookmarks.find(b => b.cellId === cellId && b.notebookUri === notebookUri);
    }

    /**
     * Check if a cell is bookmarked
     * @param cell The cell to check
     * @returns Whether the cell is bookmarked
     */
    public isBookmarked(cell: vscode.NotebookCell): boolean {
        if (!cell || !cell.notebook) {
            return false;
        }
        
        const cellId = cell.metadata?.id || `cell-${cell.index}`;
        return this.bookmarks.some(b => b.cellId === cellId && b.notebookUri === cell.notebook.uri.toString());
    }

    /**
     * Update bookmark title
     * @param bookmarkId Bookmark ID
     * @param newTitle New title
     * @returns Whether the update was successful
     */
    public async updateBookmarkTitle(bookmarkId: string, newTitle: string): Promise<boolean> {
        try {
            const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
            if (bookmark) {
                bookmark.title = newTitle;
                await this.saveBookmarks();
                this.outputChannel.appendLine(`Updated bookmark title: ${bookmarkId} -> ${newTitle}`);
                return true;
            }
            return false;
        } catch (error) {
            this.outputChannel.appendLine(`Error updating bookmark title: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}