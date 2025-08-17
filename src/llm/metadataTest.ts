// Test file to demonstrate the metadata tracking functionality
import { LLMConfig, createChatResponseFormatter } from './llmSchema';

// Example of how the metadata will be recorded in prompt cell execution
export interface PromptExecutionMetadata {
    model: string;
    provider: string;
    startTime: string;
    endTime: string;
    duration: number;
    temperature?: number;
    maxTokens?: number;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

// Example usage showing how metadata is captured
export async function demonstrateMetadataTracking() {
    const config: LLMConfig = {
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 1000
    };

    const startTime = new Date();
    
    // Simulate LLM call
    const formatter = createChatResponseFormatter(config);
    
    try {
        const response = await formatter.formatResponse("Test prompt");
        const endTime = new Date();
        
        // This is the metadata structure that will be stored in output.metadata
        const executionMetadata: PromptExecutionMetadata = {
            model: config.model,
            provider: config.provider,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: endTime.getTime() - startTime.getTime(),
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            usage: response.usage
        };

        console.log('Execution Metadata:', executionMetadata);
        
        return {
            response,
            executionMetadata
        };
    } catch (error) {
        const endTime = new Date();
        
        const executionMetadata: PromptExecutionMetadata = {
            model: config.model,
            provider: config.provider,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: endTime.getTime() - startTime.getTime(),
            temperature: config.temperature,
            maxTokens: config.maxTokens
        };

        console.error('Error with metadata:', executionMetadata);
        throw error;
    }
}