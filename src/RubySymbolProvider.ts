import { DocumentSymbolProvider, TextDocument, CancellationToken, SymbolInformation, SymbolKind, Location, DocumentSymbol, Range } from "vscode";
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
                console.log('augmenting an attribute', { node, ...details, attr })
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
                        if (meta.class_name) {
                            const parts = meta.class_name.match(/(\w)+(::)*/g)
                            const className = parts?.find(str => !str.endsWith('::'))
                            if (className) { generator.connections.push([node.name, className, `${node.name} --> ${className}: ${type}`]) }
                        }
                        break

                    default:
                        console.log('unknown type', details.type)
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
}

interface ExtraAttribute {
    type: string
    name: string
    meta: { [key: string]: string }
}