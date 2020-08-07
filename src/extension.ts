// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, window, languages, Uri, SymbolKind, SymbolInformation, ExtensionContext } from 'vscode';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path'
import { RubySymbolProvider } from './RubySymbolProvider';
import { DiagramGenerator } from './DiagramGenerator';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "erd-generator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const root = process.cwd()
	const mmdCliPath = join(__dirname, '..', 'node_modules/.bin/mmdc')
	const inputMermaidFilePath = join(__dirname, '..', 'test.mmd')
	const outputSvgPath = join(__dirname, '..', 'output.svg')

	const generateMermaidFromExistingFile = () => {
		const generate = spawn(`${mmdCliPath} -i ${inputMermaidFilePath} -o ${outputSvgPath}`, { shell: true })
		generate.on('close', async code => {
		  if (code !== 0) {
			window.showInformationMessage(`failed to save SVG ${code}. In ${root}, ${__dirname}`)
		  } else {
			window.showInformationMessage(`Saved! ${outputSvgPath}`)
			// vscode.commands.executeCommand('vscode.open', outputSvgPath)
			spawn(`open ${outputSvgPath}`, { shell: true })
			// TODO Prettify/format the SVG for readability
			// TODO Open the newly created SVG in a new tab
		  }
		});

		generate.stdout.on('data', (v) => console.log(v));
	}

	const generate = async (augmentElements: boolean) => {
		const { activeTextEditor } = window
		// TODO Parse the language for the current file
		
		const dg = new DiagramGenerator({
			augmentElements,
			languagePlugins: {
				ruby: new RubySymbolProvider()
			}
		})

		await dg.generate(activeTextEditor)
		let mermaidFileSyntax = dg.render()

		// Generate the diagram
		writeFileSync(inputMermaidFilePath, mermaidFileSyntax)
		generateMermaidFromExistingFile()
	}

	context.subscriptions.push(
		commands.registerCommand('erd-generator.generate', async () => generate(false)),
		commands.registerCommand('erd-generator.generate-deep', async () => generate(true)),
		commands.registerCommand('erd-generator.regenerate', async () => generateMermaidFromExistingFile())
	)

	context.subscriptions.push(
		
	)



	languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'ruby' }, new RubySymbolProvider())
}

// this method is called when your extension is deactivated
export function deactivate() {}
