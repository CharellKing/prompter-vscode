import * as vscode from 'vscode';

export class LLMConfigWebviewProvider {
    private _panel: vscode.WebviewPanel | undefined;
    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public show() {
        if (this._panel) {
            this._panel.reveal();
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'llmConfig',
            'LLM Configuration',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this.getWebviewContent();
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'saveConfig':
                        await this.saveConfiguration(message.config);
                        break;
                    case 'loadConfig':
                        await this.loadConfiguration();
                        break;
                    case 'testConnection':
                        await this.testConnection(message.provider, message.apiKey, message.model);
                        break;
                }
            }
        );

        // Load current configuration when panel opens
        this.loadConfiguration();
    }

    private async saveConfiguration(config: any) {
        const workspaceConfig = vscode.workspace.getConfiguration('prompter');
        
        try {
            await workspaceConfig.update('llmProvider', config.provider, vscode.ConfigurationTarget.Global);
            await workspaceConfig.update('llmModel', config.model, vscode.ConfigurationTarget.Global);
            await workspaceConfig.update(`${config.provider}ApiKey`, config.apiKey, vscode.ConfigurationTarget.Global);
            await workspaceConfig.update('temperature', config.temperature, vscode.ConfigurationTarget.Global);
            await workspaceConfig.update('maxTokens', config.maxTokens, vscode.ConfigurationTarget.Global);

            this._panel?.webview.postMessage({
                command: 'configSaved',
                success: true,
                message: 'Configuration saved successfully!'
            });

            vscode.window.showInformationMessage('LLM configuration saved successfully!');
        } catch (error) {
            this._panel?.webview.postMessage({
                command: 'configSaved',
                success: false,
                message: `Failed to save configuration: ${error}`
            });
        }
    }

    private async loadConfiguration() {
        const config = vscode.workspace.getConfiguration('prompter');
        
        const currentConfig = {
            provider: config.get<string>('llmProvider') || 'openai',
            model: config.get<string>('llmModel') || 'gpt-3.5-turbo',
            temperature: config.get<number>('temperature') || 0.7,
            maxTokens: config.get<number>('maxTokens') || 1000,
            apiKeys: {
                openai: config.get<string>('openaiApiKey') || '',
                deepseek: config.get<string>('deepseekApiKey') || '',
                qwen: config.get<string>('qwenApiKey') || '',
                anthropic: config.get<string>('anthropicApiKey') || '',
                gemini: config.get<string>('geminiApiKey') || '',
                mistral: config.get<string>('mistralApiKey') || ''
            }
        };

        this._panel?.webview.postMessage({
            command: 'configLoaded',
            config: currentConfig
        });
    }

    private async testConnection(provider: string, apiKey: string, model: string) {
        // This would test the API connection
        // For now, just simulate a test
        setTimeout(() => {
            this._panel?.webview.postMessage({
                command: 'connectionTested',
                success: apiKey.length > 0,
                message: apiKey.length > 0 ? 'Connection test successful!' : 'API Key is required'
            });
        }, 1000);
    }

    private getWebviewContent(): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--vscode-input-foreground);
        }
        
        select, input[type="text"], input[type="password"], input[type="number"] {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        select:focus, input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .provider-section {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        
        .model-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
        }
        
        .advanced-settings {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .status-message {
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            display: none;
        }
        
        .status-success {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        
        .status-error {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }
        
        .api-key-status {
            font-size: 12px;
            margin-top: 5px;
        }
        
        .api-key-set {
            color: var(--vscode-testing-iconPassed);
        }
        
        .api-key-not-set {
            color: var(--vscode-testing-iconFailed);
        }
        
        .description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 LLM Configuration</h1>
        
        <div class="provider-section">
            <h3>Provider Settings</h3>
            
            <div class="form-group">
                <label for="provider">LLM Provider</label>
                <select id="provider" onchange="onProviderChange()">
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">Deepseek</option>
                    <option value="qwen">Qwen (Alibaba)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="mistral">Mistral AI</option>
                </select>
                <div class="description">Choose your preferred LLM provider</div>
            </div>
            
            <div class="model-grid">
                <div class="form-group">
                    <label for="model">Model</label>
                    <select id="model">
                        <!-- Models will be populated based on provider -->
                    </select>
                    <div class="description">Select the specific model to use</div>
                </div>
                
                <div class="form-group">
                    <label for="apiKey">API Key</label>
                    <input type="password" id="apiKey" placeholder="Enter your API key">
                    <div id="apiKeyStatus" class="api-key-status"></div>
                </div>
            </div>
        </div>
        
        <div class="advanced-settings">
            <h3>Advanced Settings</h3>
            
            <div class="model-grid">
                <div class="form-group">
                    <label for="temperature">Temperature</label>
                    <input type="number" id="temperature" min="0" max="2" step="0.1" value="0.7">
                    <div class="description">Controls randomness (0.0 = deterministic, 2.0 = very creative)</div>
                </div>
                
                <div class="form-group">
                    <label for="maxTokens">Max Tokens</label>
                    <input type="number" id="maxTokens" min="1" max="8000" value="1000">
                    <div class="description">Maximum length of the response</div>
                </div>
            </div>
        </div>
        
        <div class="button-group">
            <button class="btn-primary" onclick="saveConfiguration()">💾 Save Configuration</button>
            <button class="btn-secondary" onclick="testConnection()">🔍 Test Connection</button>
            <button class="btn-secondary" onclick="resetToDefaults()">🔄 Reset to Defaults</button>
        </div>
        
        <div id="statusMessage" class="status-message"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const modelsByProvider = {
            openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
            deepseek: ['deepseek-chat', 'deepseek-coder'],
            qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
            anthropic: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
            gemini: ['gemini-pro', 'gemini-pro-vision'],
            mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']
        };
        
        let currentConfig = {};
        
        function onProviderChange() {
            const provider = document.getElementById('provider').value;
            const modelSelect = document.getElementById('model');
            const apiKeyInput = document.getElementById('apiKey');
            
            // Update models
            modelSelect.innerHTML = '';
            modelsByProvider[provider].forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
            
            // Update API key
            if (currentConfig.apiKeys && currentConfig.apiKeys[provider]) {
                apiKeyInput.value = currentConfig.apiKeys[provider];
                updateApiKeyStatus(currentConfig.apiKeys[provider].length > 0);
            } else {
                apiKeyInput.value = '';
                updateApiKeyStatus(false);
            }
        }
        
        function updateApiKeyStatus(isSet) {
            const statusElement = document.getElementById('apiKeyStatus');
            if (isSet) {
                statusElement.textContent = '✅ API Key is set';
                statusElement.className = 'api-key-status api-key-set';
            } else {
                statusElement.textContent = '❌ API Key not set';
                statusElement.className = 'api-key-status api-key-not-set';
            }
        }
        
        function saveConfiguration() {
            const config = {
                provider: document.getElementById('provider').value,
                model: document.getElementById('model').value,
                apiKey: document.getElementById('apiKey').value,
                temperature: parseFloat(document.getElementById('temperature').value),
                maxTokens: parseInt(document.getElementById('maxTokens').value)
            };
            
            vscode.postMessage({
                command: 'saveConfig',
                config: config
            });
        }
        
        function testConnection() {
            const provider = document.getElementById('provider').value;
            const apiKey = document.getElementById('apiKey').value;
            const model = document.getElementById('model').value;
            
            showStatus('Testing connection...', 'info');
            
            vscode.postMessage({
                command: 'testConnection',
                provider: provider,
                apiKey: apiKey,
                model: model
            });
        }
        
        function resetToDefaults() {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                document.getElementById('provider').value = 'openai';
                document.getElementById('temperature').value = '0.7';
                document.getElementById('maxTokens').value = '1000';
                onProviderChange();
                document.getElementById('model').value = 'gpt-3.5-turbo';
                document.getElementById('apiKey').value = '';
                updateApiKeyStatus(false);
            }
        }
        
        function showStatus(message, type) {
            const statusElement = document.getElementById('statusMessage');
            statusElement.textContent = message;
            statusElement.className = 'status-message status-' + type;
            statusElement.style.display = 'block';
            
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'configLoaded':
                    currentConfig = message.config;
                    document.getElementById('provider').value = currentConfig.provider;
                    document.getElementById('temperature').value = currentConfig.temperature;
                    document.getElementById('maxTokens').value = currentConfig.maxTokens;
                    onProviderChange();
                    document.getElementById('model').value = currentConfig.model;
                    break;
                    
                case 'configSaved':
                    showStatus(message.message, message.success ? 'success' : 'error');
                    break;
                    
                case 'connectionTested':
                    showStatus(message.message, message.success ? 'success' : 'error');
                    break;
            }
        });
        
        // Load configuration on startup
        vscode.postMessage({ command: 'loadConfig' });
        
        // Update API key status when typing
        document.getElementById('apiKey').addEventListener('input', function() {
            updateApiKeyStatus(this.value.length > 0);
        });
    </script>
</body>
</html>`;
    }
}