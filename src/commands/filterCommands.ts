import * as vscode from 'vscode';
import { FilterWebviewProvider } from '../filterWebview';

// Register the command to toggle the filter panel
export function registerToggleFilterPanelCommand(context: vscode.ExtensionContext, filterProvider: FilterWebviewProvider) {
    const command = vscode.commands.registerCommand('prompter.notebook.toggleFilterPanel', async () => {
        // Show the filter view in the activity bar
        await vscode.commands.executeCommand('workbench.view.extension.prompter-filter');
        
        // Focus on the filter view
        await vscode.commands.executeCommand('prompter.filterView.focus');
        
        // Refresh the filter view with current notebook data
        await filterProvider.refreshFilterView();
    });
    
    context.subscriptions.push(command);
}
