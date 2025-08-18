# Prompter - LLM Prompt Management for VSCode

<p align="center">
  <img src="images/128x128.png" alt="Prompter Icon" width="200">
</p>

Prompter is a powerful VSCode extension that brings Jupyter-like notebook functionality to LLM prompt engineering. Create, manage, and execute prompts against various LLM providers directly within your VSCode environment.

## Features

- 🤖 **Multi-LLM Support**: Connect to OpenAI, Anthropic, Deepseek, Qwen, Gemini, and Mistral
- 📝 **Interactive Prompt Cells**: Create and manage prompt cells in a notebook interface
- 💻 **Code Cell Integration**: Mix prompts with executable code cells for complete workflows
- 📊 **Prompt History**: Track and review prompt history
- 🔄 **Run Cells**: Execute individual cells or run all cells in sequence
- 📁 **Notebook Format**: Save your prompt notebooks as `.ppnb` files
- 🎨 **Syntax Highlighting**: Dedicated syntax highlighting for prompt content
- ⚙️ **Configurable Settings**: Customize LLM providers, models, and parameters

## Installation

1. Clone this repository
2. Open the project in VSCode
3. Run `npm install` to install dependencies
4. Press `F5` to launch a new Extension Development Host window
5. In the new window, you can test the extension

## Usage

### Creating a New Notebook

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Search for "Create New Prompter Notebook"
3. A new `.ppnb` file will be created with a sample prompt cell

### Working with Cells

- **Add Prompt Cell**: Click the "Prompt" button in the notebook toolbar
- **Add Code Cell**: Click the "Code" button in the notebook toolbar
- **Add Markdown Cell**: Click the "Markdown" button in the notebook toolbar
- **Run Current Cell**: `Ctrl+Enter`
- **Run All Cells**: `Ctrl+Shift+Enter`

### Configuring LLM Providers

1. Click the settings gear icon in the notebook toolbar
2. Select your preferred LLM provider (OpenAI, Anthropic, etc.)
3. Enter your API key for the selected provider
4. Configure additional parameters like temperature and max tokens

### Supported LLM Providers

- **OpenAI**: GPT-3.5, GPT-4, etc.
- **Anthropic**: Claude models
- **Deepseek**: Deepseek models
- **Qwen**: Qwen models
- **Gemini**: Google Gemini models
- **Mistral**: Mistral AI models

### Prompt History

Access your prompt history by clicking the history icon on any prompt cell. This allows you to review previous prompts and iterations of your prompts.

## Example Workflows

- **Prompt Engineering**: Iterate on prompts to get the best prompt from LLMs
- **Code Generation**: Generate code with LLMs and test it in code cells
- **Documentation**: Create documentation with LLM assistance
- **Data Analysis**: Combine prompt cells with code cells for interactive data analysis
- **Learning**: Use as a learning tool to understand LLM capabilities and limitations

## Development

### Building

```bash
npm run compile
```

### Watching for Changes

```bash
npm run watch
```

### Package Extension

```bash
vsce package
```

## Requirements

- VSCode 1.74.0 or higher
- Node.js and npm
- API keys for your preferred LLM providers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Add support for more LLM providers
- [ ] Implement prompt templates and variables
- [ ] Add visualization tools for token usage and costs
- [ ] Enable sharing of prompt notebooks
- [ ] Implement collaborative prompt engineering features
- [ ] Add export functionality (HTML, PDF)