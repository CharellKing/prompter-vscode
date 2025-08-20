export interface PromptCellChatResponse {
    format: "plaintext" | "markdown"; // the best diplay method for response content.
    tags?: string[]; // the maximum tags elements: 3, every tag is word for response category, the response's tags.
    response: string; // the request's reponse.
}