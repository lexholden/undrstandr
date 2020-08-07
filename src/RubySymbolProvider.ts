import { DocumentSymbolProvider, TextDocument, CancellationToken, SymbolInformation, SymbolKind, Location, DocumentSymbol, Range } from "vscode";
import { readFileSync } from "fs";

export class RubySymbolProvider implements DocumentSymbolProvider {
    async provideDocumentSymbols(doc: TextDocument, token: CancellationToken) {
        const results: DocumentSymbol[] = []
        const str = readFileSync(doc.fileName, { encoding: 'utf8' })
        console.log(str)
        

        return results
        return [
            // new DocumentSymbol('Jesus', 'Stuff', SymbolKind.Class, new Range(2,2,2,2), new Range(2,2,2,2))
        ];
    }
}