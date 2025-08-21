import path from "path";
// import fs from "fs";
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';


import { createModel } from "./model";
import { PromptCellChatResponse } from "./schema";
import { createJsonTranslator } from "typechat";
import { createTypeScriptJsonValidator } from "typechat/ts";

import { OrgConfig } from "./model";


export interface WrapChatResponse<T> {
    data: T;
    org: string;
    model: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    temperature: number;
    maxTokens: number;
}


export async function executeCellPrompt(prompt: string): Promise<WrapChatResponse<PromptCellChatResponse>> {
    const startTime = new Date();
    const vscodeConfig = vscode.workspace.getConfiguration('prompter');
    const org = vscodeConfig.get<string>('llmProvider') || 'openai';
    const orgConfig = OrgConfig[org as keyof typeof OrgConfig] || {};
    const modelName = vscodeConfig.get<string>('llmModel') || 'gpt-3.5-turbo';
    const apiKey = vscodeConfig.get<string>(`${org}ApiKey`) || '';
    const endpoint = vscodeConfig.get<string>(`${org}Endpoint`) || orgConfig.endpoint;

    const defaultParams = {
        temperature: vscodeConfig.get<number>('temperature') || 0.7,
        maxTokens: vscodeConfig.get<number>('maxTokens') || 1000,
        // topP: 1.0
    };


    const model = createModel(org, modelName, endpoint, apiKey, defaultParams);
    
    // Define the schema content inline to avoid file reading issues
    const schemaContent = `
export interface PromptCellChatResponse {
    format: "plaintext" | "markdown"; // the best diplay method for response content.
    tags?: string[]; // Tags should have a range of [0, 3] elements. Each tag should be displayed using only one word, and the tags must have strong relevance and summarization capability in relation to the response. The most relevant tag should be placed first.
    response: string; // the request's reponse.
}
    `;
    
    const validator = createTypeScriptJsonValidator<PromptCellChatResponse>(schemaContent, "PromptCellChatResponse");

    const translator = createJsonTranslator(model, validator);
    const result = await translator.translate(prompt);
    
    if (!result.success) {
        throw new Error(`Failed to translate prompt: ${result.message}`);
    }
    
    const endTime = new Date();
    return {
        data: result.data,
        org: org,
        model: modelName,
        startTime: startTime,
        endTime: endTime,
        duration: endTime.getTime() - startTime.getTime(),
        temperature: defaultParams.temperature,
        maxTokens: defaultParams.maxTokens
    }
}

