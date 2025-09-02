import * as vscode from 'vscode';
import { EnhanceCellChatResponse, enhanceCellChatResponseSchema, executeCellPrompt, PromptCellChatResponse } from '../llm';
import { WrapChatResponse } from '../llm/run';
import format from 'string-format';



/**
 * Register command to enhance cell content
 */
export function registerEnhanceCellCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.enhanceCell', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active notebook editor found');
            return;
        }

        // Get the currently selected cell or specified cell
        let targetCell: vscode.NotebookCell;
        if (typeof cellIndex === 'number') {
            targetCell = editor.notebook.cellAt(cellIndex);
        } else {
            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('No cell selected');
                return;
            }
            targetCell = editor.notebook.cellAt(selection.start);
        }

        const currentContent = targetCell.document.getText().trim();
        if (!currentContent) {
            vscode.window.showWarningMessage('Cell is empty, nothing to enhance');
            return;
        }

        // Generate different enhancement prompts based on cell type
        let enhancePrompt: string;
        const languageId = targetCell.document.languageId;
        let contentType = "plain text"

        if (targetCell.kind === vscode.NotebookCellKind.Code) {
            // For code type cells, add language identification
            if (targetCell.document.languageId === 'prompt') {
                enhancePrompt = `I need your help to improve the following prompt content. Please optimize according to these requirements:

1. Content Clarity
   - Make expressions clearer and more specific
   - Eliminate any vague or ambiguous statements
   - Ensure each point is clear and easy to understand

2. Structure Optimization
   - Improve overall structure and logical flow
   - Add appropriate sections and hierarchy
   - Ensure natural transitions between sections

3. Detail Enhancement
   - Add necessary contextual information
   - Include relevant examples or explanations
   - Maintain original intent and style

Original prompt content:
${currentContent}

Please provide an optimized version of the prompt content based on the above requirements and only show the optimized prompt content.`;
                contentType = "plain text"
            } else {
                enhancePrompt = `Please help me improve the following ${languageId} code by adding necessary comments, optimizing code structure, and supplementing missing functionality to make it more complete and standardized:\n\n\`\`\`${languageId}\n${currentContent}\n\`\`\``;
                contentType = `${languageId} code`
            }
        } else {
            enhancePrompt = `Please help me improve the following markdown content by enhancing its structure, adding details, and optimizing expressions to make it more complete and professional:\n\n${currentContent}`;
            contentType = "markdown"
        }

        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Enhancing cell content...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Calling LLM...' });
                
                const formattedSchema = format(enhanceCellChatResponseSchema, {contentType: contentType});
                // Call LLM service
                const response: WrapChatResponse<EnhanceCellChatResponse> = await executeCellPrompt({
                    Prompt: enhancePrompt,
                    Schema: formattedSchema,
                    TypeName: "EnhanceCellChatResponse",
                });
                
                progress.report({ increment: 50, message: 'Processing response...' });
                
                // Get enhanced content
                let enhancedContent = response.data.response;
                
                progress.report({ increment: 80, message: 'Updating cell...' });
                
                // Update cell content
                const edit = new vscode.WorkspaceEdit();
                const cellData = new vscode.NotebookCellData(
                    targetCell.kind,
                    enhancedContent,
                    targetCell.document.languageId
                );
                
                // Preserve original metadata
                cellData.metadata = { ...targetCell.metadata };
                                
                const nbEdit = vscode.NotebookEdit.replaceCells(
                    new vscode.NotebookRange(targetCell.index, targetCell.index + 1),
                    [cellData]
                );
                edit.set(editor.notebook.uri, [nbEdit]);
                
                await vscode.workspace.applyEdit(edit);
                
                progress.report({ increment: 100, message: 'Complete!' });
                
                vscode.window.showInformationMessage('Cell content enhanced successfully!');
            });
        } catch (error) {
            console.error('Error enhancing cell:', error);
            vscode.window.showErrorMessage(`Failed to enhance cell: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    context.subscriptions.push(command);
    return command;
}