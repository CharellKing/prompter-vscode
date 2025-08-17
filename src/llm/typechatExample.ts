import { LLMConfig, ChatResponseFormatter, createChatResponseFormatter, validateProviderConfig } from './llmSchema';

// Example usage with different providers
export async function exampleUsage() {
    // DeepSeek configuration
    const deepseekConfig: LLMConfig = {
        provider: 'deepseek',
        apiKey: 'your-deepseek-api-key',
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2000
    };

    // Qwen configuration
    const qwenConfig: LLMConfig = {
        provider: 'qwen',
        apiKey: 'your-qwen-api-key',
        model: 'qwen-turbo',
        temperature: 0.8
    };

    // Custom provider configuration
    const customConfig: LLMConfig = {
        provider: 'custom',
        apiKey: 'your-api-key',
        baseURL: 'https://your-custom-llm-api.com/v1',
        model: 'custom-model',
        headers: {
            'Custom-Header': 'value'
        }
    };

    // Validate configuration
    if (!validateProviderConfig(deepseekConfig)) {
        console.error('Invalid DeepSeek configuration');
        return;
    }

    // Create formatter
    const formatter = createChatResponseFormatter(deepseekConfig);

    try {
        // Format a new response using TypeChat
        const response = await formatter.formatResponse(
            "Explain the concept of machine learning in simple terms"
        );

        console.log('Formatted Response:', response);

        // Format an existing raw response
        const rawResponse = "Machine learning is a subset of artificial intelligence...";
        const formattedExisting = await formatter.formatResponse("", rawResponse);
        
        console.log('Formatted Existing Response:', formattedExisting);

    } catch (error) {
        console.error('Error formatting response:', error);
    }
}

// Example with different providers
export async function multiProviderExample() {
    const providers: LLMConfig[] = [
        {
            provider: 'deepseek',
            apiKey: process.env.DEEPSEEK_API_KEY || '',
            model: 'deepseek-chat'
        },
        {
            provider: 'qwen',
            apiKey: process.env.QWEN_API_KEY || '',
            model: 'qwen-turbo'
        }
    ];

    for (const config of providers) {
        if (validateProviderConfig(config)) {
            const formatter = createChatResponseFormatter(config);
            
            try {
                const response = await formatter.formatResponse(
                    "What is the capital of France?"
                );
                
                console.log(`${config.provider} response:`, response);
            } catch (error) {
                console.error(`Error with ${config.provider}:`, error);
            }
        }
    }
}