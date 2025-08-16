import * as vscode from 'vscode';

// 获取当前LLM显示名称
export function getCurrentLLMDisplayName(): string {
    const config = vscode.workspace.getConfiguration('prompter');
    const model = config.get<string>('llmModel') || 'gpt-3.5-turbo';
    return model;
}

// 设置LLM Provider命令
export function registerSetProviderCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.llm.setProvider', async () => {
        const providers = ['openai', 'deepseek', 'qwen', 'anthropic', 'gemini', 'mistral'];
        const provider = await vscode.window.showQuickPick(providers, {
            placeHolder: 'Select LLM Provider',
            ignoreFocusOut: true
        });
        
        if (provider) {
            const config = vscode.workspace.getConfiguration('prompter');
            await config.update('llmProvider', provider, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`LLM Provider has been set to ${provider}.`);
            
            // 提示用户设置对应的API Key
            const setApiKey = await vscode.window.showInformationMessage(
                `Would you like to set the API Key for ${provider}?`,
                'Yes', 'No'
            );
            
            if (setApiKey === 'Yes') {
                vscode.commands.executeCommand('prompter.setApiKey', provider);
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 设置API Key命令
export function registerSetApiKeyCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.llm.setApiKey', async (provider?: string) => {
        if (!provider) {
            const config = vscode.workspace.getConfiguration('prompter');
            provider = config.get<string>('llmProvider') || 'openai';
        }
        
        const apiKey = await vscode.window.showInputBox({
            prompt: `Enter your ${provider} API Key`,
            password: true,
            placeHolder: 'sk-...',
            ignoreFocusOut: true
        });
        
        if (apiKey) {
            const config = vscode.workspace.getConfiguration('prompter');
            await config.update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`${provider} API Key has been set successfully.`);
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 设置模型命令
export function registerSetModelCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.llm.setModel', async () => {
        const config = vscode.workspace.getConfiguration('prompter');
        const provider = config.get<string>('llmProvider') || 'openai';
        
        // 根据提供商获取可用模型
        let models: string[] = [];
        switch (provider) {
            case 'openai':
                models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
                break;
            case 'deepseek':
                models = ['deepseek-chat', 'deepseek-coder'];
                break;
            case 'qwen':
                models = ['qwen-turbo', 'qwen-plus', 'qwen-max'];
                break;
            case 'anthropic':
                models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
                break;
            case 'gemini':
                models = ['gemini-pro', 'gemini-pro-vision'];
                break;
            case 'mistral':
                models = ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'];
                break;
        }
        
        const model = await vscode.window.showQuickPick(models, {
            placeHolder: `Select ${provider} model`,
            ignoreFocusOut: true
        });
        
        if (model) {
            await config.update('llmModel', model, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`LLM Model has been set to ${model}.`);
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 综合LLM配置命令
export function registerConfigureLLMCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.llm.configureLLM', async () => {
        const config = vscode.workspace.getConfiguration('prompter');
        const currentProvider = config.get<string>('llmProvider') || 'openai';
        const currentModel = config.get<string>('llmModel') || 'gpt-3.5-turbo';
        const currentTemperature = config.get<number>('temperature') || 0.7;
        const currentMaxTokens = config.get<number>('maxTokens') || 1000;

        // 显示当前配置和选项菜单
        const options = [
            `Current Provider: ${currentProvider} - Change Provider`,
            `Current Model: ${currentModel} - Change Model`,
            `Current API Key: ${config.get<string>(`${currentProvider}ApiKey`) ? '***Set***' : 'Not Set'} - Set API Key`,
            `Current Temperature: ${currentTemperature} - Change Temperature`,
            `Current Max Tokens: ${currentMaxTokens} - Change Max Tokens`,
            'View All Settings',
            'Reset to Defaults'
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select LLM configuration option',
            ignoreFocusOut: true
        });

        if (!selection) return;

        if (selection.includes('Change Provider')) {
            await vscode.commands.executeCommand('prompter.setProvider');
        } else if (selection.includes('Change Model')) {
            await vscode.commands.executeCommand('prompter.setModel');
        } else if (selection.includes('Set API Key')) {
            await vscode.commands.executeCommand('prompter.setApiKey');
        } else if (selection.includes('Change Temperature')) {
            const temperature = await vscode.window.showInputBox({
                prompt: 'Enter temperature (0.0 - 2.0)',
                value: currentTemperature.toString(),
                validateInput: (value) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num < 0 || num > 2) {
                        return 'Temperature must be a number between 0.0 and 2.0';
                    }
                    return null;
                }
            });
            if (temperature) {
                await config.update('temperature', parseFloat(temperature), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Temperature set to ${temperature}`);
            }
        } else if (selection.includes('Change Max Tokens')) {
            const maxTokens = await vscode.window.showInputBox({
                prompt: 'Enter maximum tokens (1 - 8000)',
                value: currentMaxTokens.toString(),
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num < 1 || num > 8000) {
                        return 'Max tokens must be a number between 1 and 8000';
                    }
                    return null;
                }
            });
            if (maxTokens) {
                await config.update('maxTokens', parseInt(maxTokens), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`Max tokens set to ${maxTokens}`);
            }
        } else if (selection.includes('View All Settings')) {
            const settingsInfo = [
                `Provider: ${currentProvider}`,
                `Model: ${currentModel}`,
                `API Key: ${config.get<string>(`${currentProvider}ApiKey`) ? 'Set' : 'Not Set'}`,
                `Temperature: ${currentTemperature}`,
                `Max Tokens: ${currentMaxTokens}`
            ].join('\n');
            vscode.window.showInformationMessage(`Current LLM Settings:\n${settingsInfo}`);
        } else if (selection.includes('Reset to Defaults')) {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to reset all LLM settings to defaults?',
                'Yes', 'No'
            );
            if (confirm === 'Yes') {
                await config.update('llmProvider', 'openai', vscode.ConfigurationTarget.Global);
                await config.update('llmModel', 'gpt-3.5-turbo', vscode.ConfigurationTarget.Global);
                await config.update('temperature', 0.7, vscode.ConfigurationTarget.Global);
                await config.update('maxTokens', 1000, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('LLM settings reset to defaults');
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 打开LLM配置页面命令
export function registerOpenLLMConfigCommand(context: vscode.ExtensionContext, llmConfigProvider: any) {
    const command = vscode.commands.registerCommand('prompter.llm.openLLMConfig', async () => {
        try {
            // 先显示面板区域
            await vscode.commands.executeCommand('workbench.action.togglePanel');
            // 等待一下确保面板打开
            await new Promise(resolve => setTimeout(resolve, 100));
            // 聚焦到Prompter面板
            await vscode.commands.executeCommand('workbench.view.extension.prompter-panel');
            // 显示LLM配置视图
            llmConfigProvider.show();
        } catch (error) {
            console.error('Failed to show LLM config panel:', error);
            // 如果面板命令失败，回退到显示webview提供者
            llmConfigProvider.show();
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// 聚焦LLM配置面板命令
export function registerFocusLLMConfigCommand(context: vscode.ExtensionContext, llmConfigProvider: any) {
    const command = vscode.commands.registerCommand('prompter.llm.llmConfigFocus', async () => {
        try {
            // 先显示面板区域
            await vscode.commands.executeCommand('workbench.action.togglePanel');
            // 等待一下确保面板打开
            await new Promise(resolve => setTimeout(resolve, 100));
            // 聚焦到Prompter面板
            await vscode.commands.executeCommand('workbench.view.extension.prompter-panel');
            // 显示LLM配置视图
            llmConfigProvider.show();
        } catch (error) {
            console.error('Failed to focus LLM config panel:', error);
            llmConfigProvider.show();
        }
    });
    
    context.subscriptions.push(command);
    return command;
}
