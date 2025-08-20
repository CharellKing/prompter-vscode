
import { error, PromptSection, success, TypeChatLanguageModel } from "typechat";

// Model factory registry to store different model creation functions by organization
type ModelFactory = (apiKey: string, model: string, endPoint?: string, org?: string) => TypeChatLanguageModel;
const modelFactories: Record<string, ModelFactory> = {};

// Register a model factory for a specific organization
export function registerModelFactory(org: string, factory: ModelFactory): void {
    modelFactories[org] = factory;
}

function isTransientHttpError(code: number): boolean {
    switch (code) {
        case 429: // TooManyRequests
        case 500: // InternalServerError
        case 502: // BadGateway
        case 503: // ServiceUnavailable
        case 504: // GatewayTimeout
            return true;
    }
    return false;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default model factory
export function createGeneralLanguageModel(apiKey: string, modelName: string, endPoint: string, org: string, defaultParams: {}): TypeChatLanguageModel {
    const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Organization": org
    };
    const model: TypeChatLanguageModel = {
        complete
    };

    async function complete(prompt: string | PromptSection[]) {
        let retryCount = 0;
        const retryMaxAttempts = model.retryMaxAttempts ?? 3;
        const retryPauseMs = model.retryPauseMs ?? 1000;
        const messages = typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;
        while (true) {
            const options = {
                method: "POST",
                body: JSON.stringify({
                    ...defaultParams,
                    messages,
                    model: modelName,
                    stream: false,
                }),
                headers: {
                    ...headers
                }
            }
            const response = await fetch(endPoint, options);
            if (response.ok) {
                const json = await response.json() as { choices: { message: PromptSection }[] };
                if (typeof json.choices[0].message.content === "string") {
                    return success(json.choices[0].message.content ?? "");
                } else {
                    return error(`REST API unexpected response format: ${JSON.stringify(json.choices[0].message.content)}`);
                }
            }
            if (!isTransientHttpError(response.status) || retryCount >= retryMaxAttempts) {
                return error(`REST API error ${response.status}: ${response.statusText}`);
            }
            await sleep(retryPauseMs);
            retryCount++;
        }
    }
    return model;
}

// Create a model based on the registered factory for the given organization
export function createModel(org: string, model: string, endPoint: string, apiKey: string, defaultParams?: {}): TypeChatLanguageModel {
    // If a factory is registered for this organization, use it
    if (org && modelFactories[org]) {
        return modelFactories[org](apiKey, model, endPoint, org);
    }
    
    // Otherwise fall back to the general model
    return createGeneralLanguageModel(apiKey, model, endPoint, org, defaultParams || {});
}
