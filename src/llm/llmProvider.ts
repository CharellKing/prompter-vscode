// Basic LLM provider interfaces and types
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}

export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'azure' | 'deepseek' | 'qwen' | 'custom';
    apiKey: string;
    baseURL?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
}

// Base LLM Provider interface
export interface LLMProvider {
    complete(messages: Message[]): Promise<LLMResponse>;
    getConfig(): LLMConfig;
}

// Universal LLM Provider implementation
export class UniversalLLMProvider implements LLMProvider {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    async complete(messages: Message[]): Promise<LLMResponse> {
        const baseURL = this.getBaseURL();
        const headers = this.getHeaders();

        const body = {
            model: this.config.model,
            messages: messages,
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 1000
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
            
            return {
                content: data.choices[0]?.message?.content || '',
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens || 0,
                    completionTokens: data.usage.completion_tokens || 0,
                    totalTokens: data.usage.total_tokens || 0
                } : undefined,
                model: data.model,
                finishReason: data.choices[0]?.finish_reason
            };
        } catch (error) {
            throw new Error(`LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    getConfig(): LLMConfig {
        return { ...this.config };
    }

    private getBaseURL(): string {
        if (this.config.baseURL) {
            return this.config.baseURL;
        }

        switch (this.config.provider) {
            case 'openai':
                return 'https://api.openai.com/v1';
            case 'deepseek':
                return 'https://api.deepseek.com/v1';
            case 'qwen':
                return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
            case 'anthropic':
                return 'https://api.anthropic.com/v1';
            default:
                throw new Error(`Unsupported provider: ${this.config.provider}`);
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        // Provider-specific headers
        switch (this.config.provider) {
            case 'anthropic':
                headers['anthropic-version'] = '2023-06-01';
                break;
        }

        return headers;
    }
}