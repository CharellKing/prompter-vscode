export const OrgConfig = {
    deepseek: {
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        defaultModel: 'deepseek-chat',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    qwen: {
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1//chat/completions',
        defaultModel: 'qwen-turbo',
        headers: {
            'Content-Type': 'application/json'
        }
    },
    openai: {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-3.5-turbo'
    },
    anthropic: {
        endpoint: 'https://api.anthropic.com/v1/chat/completions',
        defaultModel: 'anthropic-chat',
    },
    gemini: {
        endpoint: 'https://gemini.chat/api/v1/chat/completions',
        defaultModel: 'gemini-chat',
    }
};