// Simple TypeChat-like interfaces for compatibility
interface TypeChatLanguageModel {
    complete(prompt: string): Promise<string>;
}

interface TypeChatTranslator<T> {
    translate(prompt: string): Promise<{ success: boolean; data?: T; message?: string }>;
}

function createJsonTranslator<T>(
    model: TypeChatLanguageModel,
    schema: string,
    typeName: string
): TypeChatTranslator<T> {
    return {
        async translate(prompt: string): Promise<{ success: boolean; data?: T; message?: string }> {
            try {
                const response = await model.complete(prompt);
                // Simple JSON parsing - in a real implementation, this would use the schema
                const data = JSON.parse(response) as T;
                return { success: true, data };
            } catch (error) {
                return { 
                    success: false, 
                    message: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        }
    };
}

// TypeChat compatible ChatResponse interface
export interface ChatResponse {
    format: "plaintext" | "markdown";
    tags?: string[]; // max tags elements: 3, every tag length: 15
    content: string;
    success: boolean;
    error?: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    model?: string;
    provider?: string;
}

// Extended LLM configuration for third-party providers
export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'azure' | 'deepseek' | 'qwen' | 'custom';
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    headers?: Record<string, string>;
    topP?: number;
}

// Provider-specific configurations
export const PROVIDER_CONFIGS = {
    deepseek: {
        baseURL: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    qwen: {
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        defaultModel: 'qwen-turbo',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    openai: {
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo'
    }
};

// TypeChat language model adapter for third-party LLMs
export class ThirdPartyLanguageModel implements TypeChatLanguageModel {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    async complete(prompt: string): Promise<string> {
        const providerConfig = PROVIDER_CONFIGS[this.config.provider as keyof typeof PROVIDER_CONFIGS];
        const baseURL = this.config.baseURL || providerConfig?.baseURL;
        
        if (!baseURL) {
            throw new Error(`Unsupported provider: ${this.config.provider}`);
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        // Add provider-specific headers if they exist
        if (providerConfig && 'headers' in providerConfig && providerConfig.headers) {
            Object.assign(headers, providerConfig.headers);
        }

        // Add custom headers from config
        if (this.config.headers) {
            Object.assign(headers, this.config.headers);
        }

        const body = {
            model: this.config.model || providerConfig?.defaultModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 2000
        };

        try {
            const response = await fetch(`${baseURL}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        } catch (error) {
            throw new Error(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// ChatResponse formatter using TypeChat
export class ChatResponseFormatter {
    private translator: any;
    private languageModel: TypeChatLanguageModel;

    constructor(config: LLMConfig) {
        this.languageModel = new ThirdPartyLanguageModel(config);
        this.translator = createJsonTranslator<ChatResponse>(
            this.languageModel,
            `
            interface ChatResponse {
                format: "plaintext" | "markdown";
                content: string;
                success: boolean;
                error?: string;
                usage?: {
                    promptTokens?: number;
                    completionTokens?: number;
                    totalTokens?: number;
                };
                model?: string;
                provider?: string;
            }
            `,
            "ChatResponse"
        );
    }

    // Compatibility method for cellExecutor.ts
    async complete(prompt: string): Promise<ChatResponse> {
        return this.formatResponse(prompt);
    }

    async formatResponse(prompt: string, rawResponse?: string): Promise<ChatResponse> {
        try {
            if (rawResponse) {
                // Format existing response
                return {
                    format: this.detectFormat(rawResponse),
                    content: rawResponse,
                    success: true,
                    model: this.languageModel instanceof ThirdPartyLanguageModel ? 
                           (this.languageModel as any).config.model : undefined,
                    provider: this.languageModel instanceof ThirdPartyLanguageModel ? 
                             (this.languageModel as any).config.provider : undefined
                };
            }

            // Get response from language model
            const response = await this.languageModel.complete(prompt);
            
            return {
                format: this.detectFormat(response),
                content: response,
                success: true,
                model: this.languageModel instanceof ThirdPartyLanguageModel ? 
                       (this.languageModel as any).config.model : undefined,
                provider: this.languageModel instanceof ThirdPartyLanguageModel ? 
                         (this.languageModel as any).config.provider : undefined
            };
        } catch (error) {
            return {
                format: "plaintext",
                content: "",
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private detectFormat(content: string): "plaintext" | "markdown" {
        // Simple markdown detection
        const markdownPatterns = [
            /^#{1,6}\s/m,  // Headers
            /\*\*.*\*\*/,  // Bold
            /\*.*\*/,      // Italic
            /```[\s\S]*```/, // Code blocks
            /`.*`/,        // Inline code
            /^\s*[-*+]\s/m, // Lists
            /\[.*\]\(.*\)/ // Links
        ];
        
        return markdownPatterns.some(pattern => pattern.test(content)) ? "markdown" : "plaintext";
    }
}

// Factory function to create formatter for different providers
export function createChatResponseFormatter(config: LLMConfig): ChatResponseFormatter {
    return new ChatResponseFormatter(config);
}

// Utility function to validate provider configuration
export function validateProviderConfig(config: LLMConfig): boolean {
    if (!config.apiKey) {
        return false;
    }

    const providerConfig = PROVIDER_CONFIGS[config.provider as keyof typeof PROVIDER_CONFIGS];
    if (!providerConfig && !config.baseURL) {
        return false;
    }

    return true;
}
