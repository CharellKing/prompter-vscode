export interface PromptCellChatResponse {
    format: "plaintext" | "markdown"; // the best diplay method for response content.
    tags?: string[]; // Tags should have a range of [0, 3] elements. Each tag should be displayed using only one word, and the tags must have strong relevance and summarization capability in relation to the response field.
    response: string; // the request's reponse.
}