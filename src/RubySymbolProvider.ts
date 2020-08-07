import { DocumentSymbolProvider, TextDocument, CancellationToken, SymbolInformation, SymbolKind, Location, DocumentSymbol, Range, commands } from "vscode";
import { readFileSync } from "fs";
import { LanguagePlugin, DiagramNode, DiagramGenerator } from './DiagramGenerator'

const ATTR_REGEX = /(field|has_many|has_one|belongs_to) :([A-z]+)(.*)/g
const ATTR_PART_MATCH_REGEX = /(?<type>[A-z_]+) :(?<name>[A-z_]+)(?<remainder>.*)/g
const ATTR_REMAINDER_MATCH_REGEX = /:(?<key>[A-z_]+) => (?<value>[A-z0-9_:\.\[\]]+)/g

export class RubySymbolProvider implements DocumentSymbolProvider, LanguagePlugin {
    async provideDocumentSymbols(doc: TextDocument, token: CancellationToken) {
        const results: DocumentSymbol[] = []
        // const str = readFileSync(doc.fileName, { encoding: 'utf8' })

        return results
        return [
            // new DocumentSymbol('Name', 'Stuff', SymbolKind.Class, new Range(2,2,2,2), new Range(2,2,2,2))
        ];
    }

    async augmentRootNode(node: DiagramNode, doc: TextDocument, generator: DiagramGenerator) {
        const text = doc.getText(node.raw.location.range)
        // console.log(`trying to augment a node ${node.name}`, { node, doc, text })

        const attributes = text.match(ATTR_REGEX)
        for (let attr of attributes || []) {
            const details = this.parseAttribute(attr)
            if (details) {
                // console.log('augmenting an attribute', { node, ...details, attr })
                const { type, name, meta } = details
                switch (type) {
                    case 'field':
                        let n = meta.as ? meta.as.replace(':', '') : name
                        let schema = meta.type ? `${n} <${meta.type}>` : n
                        node.keys[n] = `${node.name} : ${schema}`
                        break

                    case 'has_many':
                    case 'has_one':
                    case 'belongs_to':
                        const connectionName = meta.class_name
                            ? this.parseClassName(meta.class_name)
                            : name
                        if (connectionName) {
                            generator.connections.push([node.name, connectionName, `${node.name} --> ${connectionName}: ${type}`])
                        }
                        
                        if (meta.class_name) {
                            const offset = doc.getText().indexOf(meta.class_name)
                            const position = doc.positionAt(offset + meta.class_name.length - 6)
                            // console.log('want to get', meta.class_name, { node, doc, offset, position, ...meta })
                            if (position) {
                                const connections = await commands.executeCommand('vscode.executeDefinitionProvider', doc.uri, position)
                                for (let conn of connections) {
                                    await generator.addFile(conn.uri)
                                }
                            } else {
                                console.log('could not recurse', meta.class_name)
                            }
                        }

                        break

                    default:
                        console.log('unknown type', details.type, { node, ...details, attr })
                }
            }
        }
    }

    parseAttribute(str: string): ExtraAttribute|null {
        const parts = ATTR_PART_MATCH_REGEX.exec(str)
        if (parts?.groups) {
            const { type, name, remainder } = parts.groups
            const attrs = remainder.match(ATTR_REMAINDER_MATCH_REGEX)
            const meta: any = {}
            if (attrs) {
                attrs.forEach(attr => {
                    ATTR_REMAINDER_MATCH_REGEX.lastIndex = 0
                    const individualAttribute = ATTR_REMAINDER_MATCH_REGEX.exec(attr)
                    if (individualAttribute && individualAttribute.groups) {
                        const { key, value } = individualAttribute.groups
                        meta[key] = value
                    } else {
                        console.log('failed to parse', `"${attr}"`, individualAttribute)
                    }
                })
            }
            return { type, name, meta }
        }
        return null
    }

    parseClassName(fullPath: string): string|undefined {
        const parts = fullPath.match(/(\w)+(::)*/g)
        return parts?.find(str => !str.endsWith('::'))
    }
}

interface ExtraAttribute {
    type: string
    name: string
    meta: { [key: string]: string }
}