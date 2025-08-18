// Export from llmProvider
export { UniversalLLMProvider, LLMProvider, Message, LLMResponse } from './llmProvider';
export { LLMConfig as BasicLLMConfig } from './llmProvider';

// Export from llmSchema
export { 
    ChatResponse,
    LLMConfig,
    ChatResponseFormatter,
    createChatResponseFormatter,
    validateProviderConfig,
    PROVIDER_CONFIGS
} from './llmSchema';

// Export from typechatIntegration
export {
    LLMTypeChatIntegration,
    llmTypeChatIntegration,
    setupCommonProviders,
    validateChatResponse
} from './typechatIntegration';

// Import types for factory
import { LLMConfig, ChatResponseFormatter, createChatResponseFormatter } from './llmSchema';

// Type aliases for compatibility with cellExecutor.ts
export type SupportedLLMProviders = 'openai' | 'deepseek' | 'qwen' | 'anthropic' | 'custom';
export type ThirdPartyLLMConfig = LLMConfig;

// Factory class for TypeChat adapters
export class TypeChatAdapterFactory {
    static create(config: ThirdPartyLLMConfig): ChatResponseFormatter {
        return createChatResponseFormatter(config);
    }
}
