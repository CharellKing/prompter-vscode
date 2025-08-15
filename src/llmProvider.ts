import axios from 'axios';
import * as vscode from 'vscode';

/**
 * Supported LLM providers
 */
export enum LLMProvider {
    OpenAI = 'openai',
    Deepseek = 'deepseek',
    Qwen = 'qwen',
    Anthropic = 'anthropic',
    Gemini = 'gemini',
    Mistral = 'mistral'
}

/**
 * Message role types
 */
export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Configuration for LLM API calls
 */
export interface LLMConfig {
    apiKey: string;
    apiEndpoint?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
}

/**
 * Response from LLM API
 */
export interface LLMResponse {
    content: string;
    model: string;
    provider: LLMProvider;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

/**
 * Universal LLM Provider class that supports multiple LLM providers
 */
export class UniversalLLMProvider {
    private config: LLMConfig;
    private provider: LLMProvider;
    private model: string;

    /**
     * Create a new UniversalLLMProvider instance
     * 
     * @param provider The LLM provider to use
     * @param model The model name to use
     * @param config Configuration for the LLM API
     */
    constructor(provider: LLMProvider, model: string, config: LLMConfig) {
        this.provider = provider;
        this.model = model;
        this.config = {
            temperature: 0.7,
            maxTokens: 1000,
            topP: 1,
            ...config
        };
    }

    /**
     * Get the API endpoint for the selected provider
     */
    private getApiEndpoint(): string {
        if (this.config.apiEndpoint) {
            return this.config.apiEndpoint;
        }

        switch (this.provider) {
            case LLMProvider.OpenAI:
                return 'https://api.openai.com/v1/chat/completions';
            case LLMProvider.Deepseek:
                return 'https://api.deepseek.com/v1/chat/completions';
            case LLMProvider.Qwen:
                return 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
            case LLMProvider.Anthropic:
                return 'https://api.anthropic.com/v1/messages';
            case LLMProvider.Gemini:
                return 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
            case LLMProvider.Mistral:
                return 'https://api.mistral.ai/v1/chat/completions';
            default:
                throw new Error(`Unsupported provider: ${this.provider}`);
        }
    }

    /**
     * Get the authorization header for the selected provider
     */
    private getAuthHeader(): Record<string, string> {
        switch (this.provider) {
            case LLMProvider.OpenAI:
            case LLMProvider.Deepseek:
            case LLMProvider.Mistral:
                return { 'Authorization': `Bearer ${this.config.apiKey}` };
            case LLMProvider.Qwen:
                return { 'Authorization': `Bearer ${this.config.apiKey}` };
            case LLMProvider.Anthropic:
                return { 'x-api-key': this.config.apiKey };
            case LLMProvider.Gemini:
                return {}; // API key is passed as a query parameter
            default:
                throw new Error(`Unsupported provider: ${this.provider}`);
        }
    }

    /**
     * Format the request payload for the selected provider
     */
    private formatRequestPayload(messages: Message[]): any {
        switch (this.provider) {
            case LLMProvider.OpenAI:
            case LLMProvider.Deepseek:
            case LLMProvider.Mistral:
                return {
                    model: this.model,
                    messages,
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                    top_p: this.config.topP
                };
            case LLMProvider.Qwen:
                return {
                    model: this.model,
                    input: {
                        messages
                    },
                    parameters: {
                        temperature: this.config.temperature,
                        max_tokens: this.config.maxTokens,
                        top_p: this.config.topP
                    }
                };
            case LLMProvider.Anthropic:
                return {
                    model: this.model,
                    messages,
                    max_tokens: this.config.maxTokens,
                    temperature: this.config.temperature,
                    top_p: this.config.topP
                };
            case LLMProvider.Gemini:
                return {
                    contents: messages.map(msg => ({
                        role: msg.role === 'assistant' ? 'model' : msg.role,
                        parts: [{ text: msg.content }]
                    })),
                    generationConfig: {
                        temperature: this.config.temperature,
                        topP: this.config.topP,
                        maxOutputTokens: this.config.maxTokens
                    }
                };
            default:
                throw new Error(`Unsupported provider: ${this.provider}`);
        }
    }

    /**
     * Extract the response content from the API response
     */
    private extractResponseContent(data: any): LLMResponse {
        switch (this.provider) {
            case LLMProvider.OpenAI:
                return {
                    content: data.choices[0].message.content,
                    model: this.model,
                    provider: this.provider,
                    usage: {
                        promptTokens: data.usage?.prompt_tokens,
                        completionTokens: data.usage?.completion_tokens,
                        totalTokens: data.usage?.total_tokens
                    }
                };
            case LLMProvider.Deepseek:
                return {
                    content: data.choices[0].message.content,
                    model: this.model,
                    provider: this.provider,
                    usage: {
                        promptTokens: data.usage?.prompt_tokens,
                        completionTokens: data.usage?.completion_tokens,
                        totalTokens: data.usage?.total_tokens
                    }
                };
            case LLMProvider.Qwen:
                return {
                    content: data.output.text,
                    model: this.model,
                    provider: this.provider,
                    usage: {
                        totalTokens: data.usage?.total_tokens
                    }
                };
            case LLMProvider.Anthropic:
                return {
                    content: data.content[0].text,
                    model: this.model,
                    provider: this.provider,
                    usage: {
                        promptTokens: data.usage?.input_tokens,
                        completionTokens: data.usage?.output_tokens
                    }
                };
            case LLMProvider.Gemini:
                return {
                    content: data.candidates[0].content.parts[0].text,
                    model: this.model,
                    provider: this.provider
                };
            case LLMProvider.Mistral:
                return {
                    content: data.choices[0].message.content,
                    model: this.model,
                    provider: this.provider,
                    usage: {
                        promptTokens: data.usage?.prompt_tokens,
                        completionTokens: data.usage?.completion_tokens,
                        totalTokens: data.usage?.total_tokens
                    }
                };
            default:
                throw new Error(`Unsupported provider: ${this.provider}`);
        }
    }

    /**
     * Call the LLM API with the given messages
     * 
     * @param messages Array of messages to send to the LLM
     * @returns The LLM response
     */
    public async complete(messages: Message[]): Promise<LLMResponse> {
        try {
            const endpoint = this.getApiEndpoint();
            const headers = {
                'Content-Type': 'application/json',
                ...this.getAuthHeader()
            };
            
            const payload = this.formatRequestPayload(messages);
            
            // Add API key as query parameter for Gemini
            const url = this.provider === LLMProvider.Gemini 
                ? `${endpoint}?key=${this.config.apiKey}` 
                : endpoint;
            
            const response = await axios.post(url, payload, { headers });
            
            return this.extractResponseContent(response.data);
        } catch (error: unknown) {
            // Handle axios error
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as { response: { status: number; data: any } };
                throw new Error(`${this.provider} API error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
            }
            throw new Error(`Error calling ${this.provider} API: ${String(error)}`);
        }
    }

    /**
     * Create a provider instance from configuration
     * 
     * @param providerName The provider name
     * @param modelName The model name
     * @param config The configuration
     * @returns A new UniversalLLMProvider instance
     */
    public static fromConfig(providerName: string, modelName: string, config: LLMConfig): UniversalLLMProvider {
        const provider = providerName.toLowerCase() as LLMProvider;
        
        if (!Object.values(LLMProvider).includes(provider)) {
            throw new Error(`Unsupported provider: ${providerName}`);
        }
        
        return new UniversalLLMProvider(provider, modelName, config);
    }

    /**
     * Get the available models for a provider
     * 
     * @param provider The LLM provider
     * @returns Array of available model names
     */
    public static getAvailableModels(provider: LLMProvider): string[] {
        switch (provider) {
            case LLMProvider.OpenAI:
                return ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'];
            case LLMProvider.Deepseek:
                return ['deepseek-chat', 'deepseek-coder'];
            case LLMProvider.Qwen:
                return ['qwen-turbo', 'qwen-plus', 'qwen-max'];
            case LLMProvider.Anthropic:
                return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
            case LLMProvider.Gemini:
                return ['gemini-pro', 'gemini-pro-vision'];
            case LLMProvider.Mistral:
                return ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'];
            default:
                return [];
        }
    }
}