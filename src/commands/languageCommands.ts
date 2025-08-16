import * as vscode from 'vscode';

// 设置默认代码语言命令
export function registerSetDefaultCodeLanguageCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.language.setDefaultCodeLanguage', async () => {
        const languages = [
            'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c', 'go', 'rust',
            'php', 'ruby', 'swift', 'kotlin', 'scala', 'html', 'css', 'json', 'xml', 'yaml',
            'markdown', 'bash', 'powershell', 'sql'
        ];
        
        const config = vscode.workspace.getConfiguration('prompter');
        const currentLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
        
        const selectedLanguage = await vscode.window.showQuickPick(languages, {
            placeHolder: `Select default code language (current: ${currentLanguage})`,
            ignoreFocusOut: true
        });
        
        if (selectedLanguage) {
            await config.update('defaultCodeLanguage', selectedLanguage, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Default code language set to ${selectedLanguage}`);
        }
    });
    
    context.subscriptions.push(command);
    return command;
}