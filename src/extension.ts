// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, window, languages, Uri, SymbolKind, SymbolInformation, ExtensionContext } from 'vscode';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path'
import { RubySymbolProvider } from './RubySymbolProvider';

interface DiagramNode {
	name: string
	line: string
	raw: SymbolInformation
	keys: { [name: string]: SymbolInformation }
	connections: DiagramConnectionLookup
}

type DiagramNodeLookup = { [key: string]: DiagramNode }
type DiagramConnectionLookup = { [key: string]: string }

class DiagramGenerator {
	// languageHandler = {
	// 	'ruby': 
	// }
	
	constructor() {}

	async generate(path: Uri): Promise<string> {
		const nodes: DiagramNodeLookup = {}
		let diagram = 'classDiagram\n'
		const symbols: any[] = await commands.executeCommand("vscode.executeDocumentSymbolProvider", path) as any
		// const types = await commands.executeCommand('vscode.executeTypeDefinitionProvider', path, )
		symbols.forEach(async symbol => {
			// const node = await this.generateRootNodeFromSymbol(symbol)
			// if (node !== null) { nodes[node.name] = node }
			const d = this.generateFromUnknownRoot(symbol)
			if (d) { diagram += d }
		})

		return this.render(nodes)
	}

	render(nodes: DiagramNodeLookup): string {
		let diagram = 'classDiagram\n'

		Object.entries(nodes).forEach(([name, node]) => {
			diagram += node.line + '\n'
		})

		return diagram
	}

	private generateRootNodeFromSymbol(symbol: SymbolInformation): DiagramNode|null {
		switch(symbol.kind) {
			case SymbolKind.Class: return { name: symbol.name, line: `class ${symbol.name}`, keys: {}, connections: {}, raw: symbol }
			default: return null
		}
	}

	private generateFromUnknownRoot(symbol: SymbolInformation, prefix?: string): string {
		switch(symbol.kind) {
			case SymbolKind.Module:
				let result = ''
				if (symbol.children) {
					prefix = prefix ? `${prefix}::${symbol.name}` : symbol.name
					symbol.children.forEach(child => {
						const childResult = this.generateFromUnknownRoot(child, prefix)
						if (childResult) { result += childResult }
					})
				}
				return result

			case SymbolKind.Class: return this.generateClass(symbol)
			case SymbolKind.Interface: return this.generateInterface(symbol)

			default:
				console.log('unknown symbol kind', symbol.kind, symbol)
				return ''
		}
	}

	generateClass(symbol: SymbolInformation): string {
		let c = `class ${symbol.name}\n`
		c += this.generateChildElements(symbol)
		return c
	}

	generateInterface(symbol: SymbolInformation): string {
		let c = `class ${symbol.name}\n`
		c += `<<Interface>> ${symbol.name}\n`
		c += this.generateChildElements(symbol)
		return c
	}

	generateChildElements(parent: SymbolInformation): string {
		let c = ''
		if (parent.children) {
			parent.children.forEach(child => {
				const el = this.generateElement(parent.name, child)
				if (el) { c += el }
			})
			c += '\n'
		}
		return c
	}

	private generateElement(parent: string, symbol: SymbolInformation) {
		switch(symbol.kind) {
			case SymbolKind.Class:
				let result = this.generateClass(symbol)
				result += `${symbol.name} <.. ${parent}\n`
				return result
			case SymbolKind.Method: return `${parent} : ${symbol.name}()\n`
			case SymbolKind.Constructor: return `${parent} : ${symbol.name}() ${parent}\n`
			case SymbolKind.Constant: return `${parent} : ${symbol.name}\n`
			case SymbolKind.Variable: return `${parent} : ${symbol.name}\n`
			case SymbolKind.Property: return `${parent} : ${symbol.name}\n`
			default:
				console.log('unknown element kind', symbol.kind, symbol)
				return ''
		}
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "erd-generator" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = commands.registerCommand('erd-generator.generate', async () => {
		const { activeTextEditor } = window
		const { path } = activeTextEditor?.document.uri || { path: '' }
		console.log(activeTextEditor?.document.uri)
		// const l = await vscode.languages.getLanguages()

		// TODO Parse the language for the current file
		
		const dg = new DiagramGenerator()
		let mermaidFileSyntax = await dg.generate(activeTextEditor?.document.uri)
		console.log(mermaidFileSyntax)

		// Generate the diagram
		const root = process.cwd()
		const mmdCliPath = join(__dirname, '..', 'node_modules/.bin/mmdc')
		const inputMermaidFilePath = join(__dirname, '..', 'test.mmd')
		const outputSvgPath = join(__dirname, '..', 'output.svg')

		writeFileSync(inputMermaidFilePath, mermaidFileSyntax)
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
	});

	languages.registerDocumentSymbolProvider({ scheme: 'file', language: 'ruby' }, new RubySymbolProvider())

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
