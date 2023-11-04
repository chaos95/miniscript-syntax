// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MiniscriptFormatter } from './formatting/format';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('miniscript', {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const code = document.getText();
        // console.log(code);
        const formatted = MiniscriptFormatter.formatCode(code);
        // console.log(formatted);
        if (formatted === code) return [];
        return [
          vscode.TextEdit.replace(
            new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end),
            formatted,
          ),
        ];
      },
    }),
  );

  console.log('Formatting for Miniscript is activated!');
}

// This method is called when your extension is deactivated
// export function deactivate() {}
