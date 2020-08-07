
import { commands, window, languages, Uri, SymbolKind, SymbolInformation, ExtensionContext, TextEditor, TextDocument } from 'vscode';

export class DiagramGenerator {
    constructor(
        public config?: DiagramGeneratorConfig
    ) {}
    
    cache: { [fileName: string]: boolean } = {}
    nodes: DiagramNodeLookup = {}
    connections: [string, string, string?][] = []
    document?: TextDocument

	async generate(editor: TextEditor) {
        const { document } = editor
        this.document = document // TODO This will cause race conditions with multiple files. Lazy hack, refactor
        await this.addFile(document.uri)
    }

    async addFile(uri: Uri) {
        if (this.cache[uri.path]) { return }
        this.cache[uri.path] = true // Mark that we are already traversing this path to avoid infinite recursion
        const symbols: any[] = await commands.executeCommand("vscode.executeDocumentSymbolProvider", uri) as any
		for (let symbol of symbols) {
			await this.generateRootNodeFromSymbol(symbol)
        }
    }

	private async generateRootNodeFromSymbol(symbol: SymbolInformation): Promise<DiagramNode|null> {
        let node: DiagramNode|null = null
		switch(symbol.kind) {
            case SymbolKind.Module:
                if (symbol.children) {
                    const usefulChildren = symbol.children.filter((child: SymbolInformation) => {
                        return [SymbolKind.Module, SymbolKind.Class, SymbolKind.Interface].indexOf(child.kind) === -1
                    })

                    if (usefulChildren.length === 0) {
                        for (let child of symbol.children) {
                            await this.generateRootNodeFromSymbol(child)
                        }
                    } else {
                        node = this.nodes[symbol.name] = {
                            name: symbol.name,
                            line: `class ${symbol.name}`,
                            keys: {},
                            raw: symbol,
                        }
                        await this.generateElementNodesFromSymbols(node, symbol.children)
                    }
                }
                // prefix = prefix ? `${prefix}::${symbol.name}` : symbol.name
                // symbol.children.forEach(child => {
                // 	const childResult = this.generateFromUnknownRoot(child, prefix)
                // 	if (childResult) { result += childResult }
                // })
                break

			case SymbolKind.Class:
                node = this.nodes[symbol.name] = {
                    name: symbol.name,
                    line: `class ${symbol.name}`,
                    keys: {},
                    raw: symbol
                }
                await this.generateElementNodesFromSymbols(node, symbol.children)
                break

            case SymbolKind.Interface:
                node = this.nodes[symbol.name] = {
                    name: symbol.name,
                    line: `class ${symbol.name}\n<<Interface>> ${symbol.name}`,
                    keys: {},
                    raw: symbol
                }
                await this.generateElementNodesFromSymbols(node, symbol.children)
                break

			default:
                console.log('unknown node kind', symbol.kind, symbol)
        }
        
        if (this.document && node) {
            const plugin = this.config?.languagePlugins[this.document.languageId]
            if (plugin) {
                await plugin.augmentRootNode(node, this.document, this)
            }
            // console.log('trying to further parse a node with a language plugin', node)
        }

        return node
    }
    
    private async generateElementNodesFromSymbols(parent: DiagramNode, children: SymbolInformation[]) {
        for (let child of children) {
            switch(child.kind) {
                case SymbolKind.Class:
                    const subclass = await this.generateRootNodeFromSymbol(child)
                    if (subclass) {
                        this.connections.push([parent.name, subclass.name])
                    }
                    break

                case SymbolKind.Method:
                    parent.keys[child.name] = `${parent.name} : ${child.name}()`
                    break

                case SymbolKind.Constructor:
                    parent.keys[child.name] = `${parent.name} : ${child.name}() ${parent.name}`
                    break

                case SymbolKind.Constant:
                    parent.keys[child.name] = `${parent.name} : static ${child.name}`
                    break

                case SymbolKind.Variable:
                case SymbolKind.Property:
                case SymbolKind.String:
                    parent.keys[child.name] = `${parent.name} : ${child.name}`
                    break

                // TODO Array of items? Relation

                default:
                    console.log('unknown element kind', child.kind, child)
            }
        }
    }

	render(): string {
        console.log(this.nodes)
		let diagram = 'classDiagram\n'

		Object.entries(this.nodes).forEach(([name, node]) => {
            diagram += node.line + '\n'
            Object.entries(node.keys).forEach(([name, line]) => {
                diagram += line + '\n'
            })
            diagram += '\n'
        })
        
        this.connections.forEach(([parent, child, renderer]) => {
            if (renderer) {}
            diagram += renderer ? `${renderer}\n` : `${child} <.. ${parent}\n`
        })

		return diagram
	}
}

export interface DiagramNode {
	name: string
	line: string
	raw: SymbolInformation
	keys: { [key: string]: string }
}

interface DiagramGeneratorConfig {
    languagePlugins: { [extension: string]: LanguagePlugin }
}

export interface LanguagePlugin {
    augmentRootNode(node: DiagramNode, document: TextDocument, generator: DiagramGenerator): Promise<any> 
}

type DiagramNodeLookup = { [key: string]: DiagramNode }
// type DiagramElementNodeLookup = { [key: string]: DiagramElement }
// type DiagramConnectionLookup = { [key: string]: string }
