import { ChatResponse, ChatResponseFormatter, createChatResponseFormatter, LLMConfig } from './llmSchema';

// Integration helper for existing LLM implementations
export class LLMTypeChatIntegration {
    private formatters: Map<string, ChatResponseFormatter> = new Map();

    // Register a formatter for a specific provider
    registerProvider(providerId: string, config: LLMConfig): void {
        const formatter = createChatResponseFormatter(config);
        this.formatters.set(providerId, formatter);
    }

    // Get formatter for a provider
    getFormatter(providerId: string): ChatResponseFormatter | undefined {
        return this.formatters.get(providerId);
    }

    // Format response using registered provider
    async formatWithProvider(providerId: string, prompt: string, rawResponse?: string): Promise<ChatResponse> {
        const formatter = this.formatters.get(providerId);
        if (!formatter) {
            return {
                format: "plaintext",
                content: rawResponse || "",
                success: false,
                error: `Provider ${providerId} not registered`
            };
        }

        return await formatter.formatResponse(prompt, rawResponse);
    }

    // Batch format responses from multiple providers
    async batchFormat(requests: Array<{
        providerId: string;
        prompt: string;
        rawResponse?: string;
    }>): Promise<ChatResponse[]> {
        const promises = requests.map(req => 
            this.formatWithProvider(req.providerId, req.prompt, req.rawResponse)
        );
        
        return await Promise.all(promises);
    }

    // Get all registered provider IDs
    getRegisteredProviders(): string[] {
        return Array.from(this.formatters.keys());
    }

    // Remove a provider
    unregisterProvider(providerId: string): boolean {
        return this.formatters.delete(providerId);
    }

    // Clear all providers
    clearProviders(): void {
        this.formatters.clear();
    }
}

// Singleton instance for global use
export const llmTypeChatIntegration = new LLMTypeChatIntegration();

// Helper function to setup common providers
export function setupCommonProviders(apiKeys: {
    deepseek?: string;
    qwen?: string;
    openai?: string;
}): void {
    if (apiKeys.deepseek) {
        llmTypeChatIntegration.registerProvider('deepseek', {
            provider: 'deepseek',
            apiKey: apiKeys.deepseek,
            model: 'deepseek-chat'
        });
    }

    if (apiKeys.qwen) {
        llmTypeChatIntegration.registerProvider('qwen', {
            provider: 'qwen',
            apiKey: apiKeys.qwen,
            model: 'qwen-turbo'
        });
    }

    if (apiKeys.openai) {
        llmTypeChatIntegration.registerProvider('openai', {
            provider: 'openai',
            apiKey: apiKeys.openai,
            model: 'gpt-3.5-turbo'
        });
    }
}

// Response validation helper
export function validateChatResponse(response: ChatResponse): boolean {
    return (
        typeof response.format === 'string' &&
        ['plaintext', 'markdown'].includes(response.format) &&
        typeof response.content === 'string' &&
        typeof response.success === 'boolean'
    );
}

// Response transformation utilities
export function transformToPlaintext(response: ChatResponse): ChatResponse {
    return {
        ...response,
        format: 'plaintext',
        content: response.content.replace(/[*_`#\[\]()]/g, '')
    };
}

export function transformToMarkdown(response: ChatResponse): ChatResponse {
    if (response.format === 'markdown') {
        return response;
    }

    // Simple plaintext to markdown conversion
    const markdownContent = response.content
        .split('\n\n')
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0)
        .join('\n\n');

    return {
        ...response,
        format: 'markdown',
        content: markdownContent
    };
}