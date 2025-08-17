export interface ChatResponse {
    format: "plaintext" | "markdown" | 'json' | 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'cpp' | 'c' | 'go' | 'rust' | 'php' | 'ruby' | 'swift' | 'kotlin' | 'scala' | 'html' | 'css' | 'json' | 'xml' | 'yaml' | 'markdown' | 'bash' | 'powershell' | 'sql' | 'csv';
    content: string;
}
