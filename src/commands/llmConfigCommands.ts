import * as vscode from 'vscode';

// Get current LLM display name
export function getCurrentLLMDisplayName(): string {
    const config = vscode.workspace.getConfiguration('prompter');
    const model = config.get<string>('llmModel') || 'gpt-3.5-turbo';
    return model;
}



// Register command to open LLM configuration page
export function registerOpenLLMConfigCommand(context: vscode.ExtensionContext, llmConfigProvider: any) {
    const command = vscode.commands.registerCommand('prompter.llm.openLLMConfig', async () => {
        try {
            // First show panel area
            await vscode.commands.executeCommand('workbench.action.togglePanel');
            // Wait a moment to ensure panel is open
            await new Promise(resolve => setTimeout(resolve, 100));
            // Focus on Prompter panel
            await vscode.commands.executeCommand('workbench.view.extension.prompter-panel');
            // Show LLM configuration view
            llmConfigProvider.show();
        } catch (error) {
            console.error('Failed to show LLM config panel:', error);
            // If panel command fails, fallback to showing webview provider
            llmConfigProvider.show();
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

