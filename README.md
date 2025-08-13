# Prompter VSCode Extension

A powerful VSCode extension for creating and running interactive code notebooks, similar to Jupyter notebooks but integrated directly into your VSCode environment.

## Features

- 📝 **Multi-language Support**: Write and execute code in JavaScript, Python, TypeScript, Bash, and PowerShell
- ⚡ **Interactive Execution**: Run individual cells or all cells with keyboard shortcuts
- 📊 **Real-time Output**: See execution results immediately below each code cell
- 🎨 **Syntax Highlighting**: Full syntax highlighting for supported languages
- 📁 **File Format**: Save your notebooks as `.ppnb` files
- 🔧 **Easy Integration**: Seamlessly works with your existing VSCode setup

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
3. A new `.ppnb` file will be created with a sample code cell

### Running Code

- **Run Current Cell**: `Ctrl+Enter`
- **Run All Cells**: `Ctrl+Shift+Enter`
- **Right-click Menu**: Use the context menu to run cells

### Supported Languages

- **JavaScript**: Node.js execution
- **Python**: Python interpreter
- **TypeScript**: ts-node execution
- **Bash**: Shell script execution
- **PowerShell**: PowerShell script execution

### File Structure

Prompter notebooks are saved as JSON files with the `.ppnb` extension. Each cell contains:
- Code content
- Language identifier
- Cell type (code or markdown)
- Metadata

## Example

Check out the included `example.ppnb` file to see the extension in action with sample code in different languages.

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

To run code in different languages, you need the respective interpreters/runtimes installed:

- **Node.js** for JavaScript
- **Python** for Python code
- **ts-node** for TypeScript (install with `npm install -g ts-node`)
- **Bash** for shell scripts (available on most Unix systems)
- **PowerShell** for PowerShell scripts (pre-installed on Windows)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Add more language support (Go, Rust, Java, etc.)
- [ ] Implement variable sharing between cells
- [ ] Add plot/chart visualization support
- [ ] Implement cell execution history
- [ ] Add export functionality (HTML, PDF)
- [ ] Implement collaborative editing features