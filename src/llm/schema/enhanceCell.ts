export interface EnhanceCellChatResponse {
    response: string; // the request's reponse, ${languageId} content
}

export const enhanceCellChatResponseSchema = `
    export interface EnhanceCellChatResponse {
        response: string; // the request's response content, it should be {contentType}.
    }
`