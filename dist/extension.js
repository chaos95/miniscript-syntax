/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MiniscriptFormatter = void 0;
const indentation_1 = __webpack_require__(3);
function trim(str) {
    let start = 0;
    let end = str.length;
    while (start < end && (str[start] === ' ' || str[start] === '\t'))
        ++start;
    while (end > start && (str[end - 1] === ' ' || str[end - 1] === '\t'))
        --end;
    return start > 0 || end < str.length ? str.substring(start, end) : str;
}
/**
 * Extracts strings from a code, and stores them in a separate array,
 * replacing their original occurrences in code with special markers,
 * that won't mess up code formatting later on
 * @param code code to strip strings from
 */
function extractStrings(code) {
    const strings = [];
    let parsedCode = '';
    let sectionStart = 0;
    let inString = false;
    const concludeGroup = (i) => {
        if (inString) {
            parsedCode += `"$${strings.length}"`;
            strings.push(code.substring(sectionStart, i));
            sectionStart = i;
        }
        else {
            parsedCode += code.substring(sectionStart, i);
            sectionStart = i;
        }
        inString = !inString;
    };
    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        if (char === '"') {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!inString) {
                concludeGroup(i);
            }
            else {
                const nextChar = code[i + 1];
                if (nextChar === '"') {
                    i += 2;
                }
                else {
                    i++;
                    concludeGroup(i);
                }
            }
        }
    }
    concludeGroup(code.length);
    return {
        strippedCode: parsedCode,
        strings: strings,
    };
}
/**
 * Breaks line into indentation, code and comment sections
 */
function breakLine(line) {
    const data = line.match(/^(\s*)(.*?)\s*(?:\/\/(.*?))?\s*$/);
    if (!data)
        return ['', line, ''];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return [data[1], data[2], data[3] ?? ''];
}
const bracketsMap = {
    ']': ['[', ']'],
    '}': ['{', '}'],
    ')': ['(', ')'],
};
/**
 * All symbols after this are valid identifiers in miniscript
 */
const unicodeThreshold = '\u009F'.codePointAt(0);
/**
 * Attempts to detect and strip parentheses from a function call statement
 */
function stripFunctionCallParentheses(line) {
    line = line.trimEnd();
    if (!line.endsWith(')'))
        return line;
    let level = 1;
    let callStart = -1;
    // find where parentheses are
    for (let i = line.length - 2; i >= 0; i--) {
        const char = line[i];
        if (char === ')')
            level++;
        else if (char === '(')
            level--;
        if (level === 0) {
            callStart = i;
            break;
        }
    }
    if (callStart < 0)
        return line;
    level = 0;
    let leftChar = '';
    let rightChar = '';
    // check is whole previous part of the line is just a chain
    for (let i = callStart - 1; i >= 0; i--) {
        const char = line[i];
        if (level > 0) {
            if (char === rightChar)
                level++;
            else if (char === leftChar)
                level--;
            continue;
        }
        if (char === '.' || MiniscriptFormatter.isValidIdentifierChar(char))
            continue;
        const map = bracketsMap[char];
        if (map === undefined)
            return line;
        [leftChar, rightChar] = map;
        level++;
    }
    if (level !== 0)
        return line;
    const chain = line.substring(0, callStart);
    const args = line.substring(callStart + 1, line.length - 1);
    return chain + ' ' + args;
}
function stripIfParentheses(line) {
    if (!(0, indentation_1.startsWithKeyword)(line, 'if'))
        return line;
    const rest = line.substring(2, line.length).trimStart();
    if (!rest.startsWith('('))
        return line;
    let counter = 1;
    for (let i = 1; i < rest.length; i++) {
        const char = rest[i];
        if (char === '(')
            counter++;
        if (char === ')')
            counter--;
        if (counter === 0) {
            const afterClosing = rest.substring(i + 1, rest.length).trimStart();
            if (!(0, indentation_1.startsWithKeyword)(afterClosing, 'then'))
                return line;
            return `if ${rest.substring(1, i)} ${afterClosing}`;
        }
    }
    return line;
}
/**
 * Combines separated lines back into one string
 */
function joinLines(lines) {
    return lines
        .map(line => {
        let mainBody = line.indentation + line.code;
        if (line.comment.length > 0) {
            // Space si only added before comment if we actually have a code in a line
            if (line.code.length > 0)
                mainBody += ' ';
            mainBody += '//' + line.comment;
        }
        return mainBody.trimEnd();
    })
        .join('\n');
}
/**
 * Does all the heavy lifting of actually formatting a code
 * @param code code to process (should have strings stripped off already)
 */
function processCode(code) {
    code = code
        .replace(/\r\n/g, '\n')
        .replace(/;\s*?\n?/g, '\n')
        .trim();
    const lines = code.split('\n').map(line => {
        let comment;
        // Ignore original indentation
        [, line, comment] = breakLine(line);
        line = line
            // Collapse tabs, double/triple/etc spaces into single space
            .replace(/\s+/g, ' ')
            // No space around dots
            .replace(/\s*(\.)\s*/g, '$1')
            // No space after opening brackets
            .replace(/([[({])\s*/g, '$1')
            // No space before closing brackets
            .replace(/\s*([\])}])/g, '$1')
            // Space after closing bracket before number, string or identifier
            .replace(/([)}\]])\s*([^()[\]{}])/g, '$1 $2')
            // Space after comma and :
            .replace(/\s*([,:])\s*/g, '$1 ')
            // Space around operators except for minus
            .replace(/\s*([<>=!]=|[+*/%^<>=])\s*/g, ' $1 ')
            // Minus followed by unary minus
            .replace(/--/g, '- -')
            // Unary minus
            .replace(/\s+-(\S)/g, ' -$1')
            // Two cases of a regular minus
            .replace(/\s*-(?:\s+|$)/g, ' - ')
            .replace(/(\S)-(\S)/g, '$1 - $2')
            // No space inside scientific notation
            .replace(/(^|[^_0-9A-Za-z\u00A0-\uFFFF])(\.?\d+\.?\d*)\s*e\s*([+-]?)\s*(\d+)/g, '$1$2e$3$4')
            // No trailing commas
            .replace(/([^,\s]),\s*([\]}])/g, '$1$2')
            // No empty function parenthesis
            .replace(/function\s*\(\s*\)/, 'function');
        line = stripFunctionCallParentheses(line);
        line = stripIfParentheses(line);
        // Comments must always have space after // except for the case of triple ///
        if (comment.startsWith('/') && !comment.match('^/s'))
            comment = '/ ' + comment.substring(1, comment.length);
        else if (comment.length > 0 && !comment.match(/^\s/))
            comment = ' ' + comment;
        comment = comment.trimEnd();
        return {
            indentation: '',
            code: line.trim(),
            comment,
            commentGroupingOffset: 0,
        };
    });
    indentation_1.MiniscriptIndenter.processIndentation(lines);
    return joinLines(lines);
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class MiniscriptFormatter {
    /**
     * checks if a given character is a valid miniscript identifier
     */
    static isValidIdentifierChar(char) {
        if (char === undefined)
            return false;
        if (/[_a-zA-Z0-9]/.test(char))
            return true;
        return char.codePointAt(0) > unicodeThreshold;
    }
    /**
     * Formats the given miniscript code
     */
    static formatCode(code) {
        // eslint-disable-next-line prefer-const
        let { strippedCode, strings } = extractStrings(code);
        strippedCode = processCode(strippedCode);
        return strippedCode.replace(/"\$\d+"/g, group => {
            const num = group.substring(2, group.length - 1);
            return strings[Number(num)];
        });
    }
}
exports.MiniscriptFormatter = MiniscriptFormatter;


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MiniscriptIndenter = exports.startsWithKeyword = void 0;
const format_1 = __webpack_require__(2);
/**
 * Checks is line starts with a specified keyword (aka so the end of a line is
 * actually a keyword, and not just an identifier that starts with a keyword in
 * its name)
 */
function startsWithKeyword(code, keyword) {
    return code.startsWith(keyword) && !format_1.MiniscriptFormatter.isValidIdentifierChar(code[keyword.length]);
}
exports.startsWithKeyword = startsWithKeyword;
/**
 * Checks is line ends with a specified keyword (aka so the end of a line is
 * actually a keyword, and not just an identifier that ends with a keyword in
 * its name)
 */
function endsWithKeyword(code, keyword) {
    return code.endsWith(keyword) && !format_1.MiniscriptFormatter.isValidIdentifierChar(code[code.length - keyword.length - 1]);
}
const matchingClosingBracket = {
    '{': '}',
    '[': ']',
    '(': ')',
};
const matchingOpeningBracket = {
    '}': '{',
    ']': '[',
    ')': '(',
};
/**
 * applies block indentation to a `[from; to)` range of lines
 * @param lines lines to apply indentation to
 * @param from from index (inclusive)
 * @param to to index (exclusive)
 */
function indentBlock(lines, from, to) {
    for (let i = from; i < to && i < lines.length; i++) {
        const line = lines[i];
        line.indentation = MiniscriptIndenter.config.blockIndent + line.indentation;
    }
}
/**
 * applies multiline indentation to a `[from; to)` range of lines
 * @param lines lines to apply indentation to
 * @param from from index (inclusive)
 * @param to to index (exclusive)
 */
function indentMultiline(lines, from, to) {
    for (let i = from; i < to; i++) {
        const line = lines[i];
        line.indentation += MiniscriptIndenter.config.multilineIndent;
    }
}
/**
 * Applies indentation to an `if` block
 * <br>
 * This method does NOT handle single-line `if`s, those should be handled separately
 * @param lines lines to indent
 * @param index starting index
 * @return index of the next unindented line
 */
function processIfBlock(lines, index) {
    index++; // consume first line
    let endStatement;
    do {
        const nextLine = processCodeBody(lines, index, 'else', 'end');
        indentBlock(lines, index, nextLine);
        index = nextLine;
        endStatement = lines[index++];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } while (endStatement && startsWithKeyword(endStatement.code, 'else'));
    return index;
}
/**
 * Applies indentation to a simple `while`/`for`/`function` block
 * @param _blockType type of the block
 * @param lines lines to indent
 * @param index starting index
 * @return index of the next unindented line
 */
function processSimpleBlock(_blockType, lines, index) {
    index++; // consume first line
    const nextLine = processCodeBody(lines, index, 'end');
    indentBlock(lines, index, nextLine);
    index = nextLine;
    index++; // We don't care about ending line, but we still consume it by moving index to the right
    return index;
}
// We don't care about brackets validity. Any opening bracket can be closed with any closing bracket for what we care
/**
 * Calculates balance of brackets in a line
 * <br>
 * Note that we don't care about brackets validity. Any opening bracket can be
 * closed with any closing bracket for what we care. Reason for this decision
 * is that this will never be an issue in a syntactically correct code, and
 * caring too much about invalid code would only lead to an extra work and
 * possibly even lower performance
 * <br>
 * The way this method works, is that when opening bracket is encountered, it
 * increments open counter, but when closing bracket is encountered, it will
 * decrement open counter, but if that counter is at 0, it will instead
 * increment closing counter.
 * Examples:
 * - `[[]]` will have a balance of `{open: 0, closed: 0}`, because 2 brackets
 * were opened and later closed
 * - `]][[` will have a balance of `{open: 2, closed: 2}`, because closing
 * brackets appears before opening ones
 * - `[(})` will also have 0 balance, because we don't check for validity
 */
function getBracketsBalance(line) {
    let open = 0;
    let closed = 0;
    for (const char of line) {
        if (matchingOpeningBracket[char]) {
            if (open > 0)
                open--;
            else
                closed++;
        }
        else if (matchingClosingBracket[char]) {
            open++;
        }
    }
    return { open, closed };
}
/**
 * Checks if line is incomplete, aka when it ends with an operator, or comma or
 * any opening bracket
 */
function isIncomplete(code) {
    return endsWithOperation(code) || isIncompleteNonOperationLine(code);
}
/**
 * Checks if line ends with an operation
 */
function endsWithOperation(line) {
    return Boolean(line.match(/([<>=!]=|[+\-*/%^<>=])$/));
}
/**
 * Checks if line ends with a bracket, comma or :
 */
function isIncompleteNonOperationLine(line) {
    return Boolean(line.match(/[:,[({]$/));
}
/**
 * Checks if previous line ends with operation
 * @param lines list of lines
 * @param index index of a current line
 */
function previousLineEndsWithOperation(lines, index) {
    return index !== 0 && endsWithOperation(lines[index - 1].code);
}
/**
 * Processes indentation on nested multiline code structures, like operation
 * chains or multiline arrays/objects
 * @param openers amount of opening brackets that start this multiline block
 * @param lines list of code lines
 * @param index index of a first line in a block
 * @return index of the next unindented line
 */
function processMultiline(openers, lines, index) {
    index++; // consume first line
    let excessiveClosingBrackets = 0;
    while (index < lines.length) {
        const line = lines[index];
        const code = line.code;
        const { open, closed } = getBracketsBalance(code);
        openers -= closed;
        // When encountering "complete" line, just terminate immediately with infinite excess closers, we have nothing to do here
        if (!isIncomplete(code)) {
            if (openers < 0)
                excessiveClosingBrackets = -openers;
            return { index: index + 1, excessiveClosingBrackets };
        }
        let skipLine = false;
        // New bracket block is getting opened here
        if (open > 0) {
            skipLine = true;
            const { index: nextLine, excessiveClosingBrackets: excess } = processMultiline(open, lines, index);
            indentMultiline(lines, index, nextLine);
            // Operations give an extra 'multiline' indentation level
            if (previousLineEndsWithOperation(lines, index))
                indentMultiline(lines, index, nextLine);
            index = nextLine;
            if (openers < 0)
                openers = 0;
            openers -= excess;
        }
        if (openers <= 0) {
            excessiveClosingBrackets = -openers;
            if (!skipLine) {
                // Closing lines that start with only brackets have no extra indentation
                // Example:
                // a = [1,
                //   2]
                //
                // vs
                //
                // a = [1,
                // ]
                if (!code.match(/^([[\]{}()]+\s*)*/))
                    indentMultiline(lines, index, index + 1);
            }
            return { index, excessiveClosingBrackets };
        }
        // Skip line means that new group was opened, and our original index is long gone now
        if (skipLine)
            continue;
        // Operations give an extra 'multiline' indentation level
        indentMultiline(lines, index, index + 1);
        if (previousLineEndsWithOperation(lines, index))
            indentMultiline(lines, index, index + 1);
        index++;
    }
    // End of code has been reached
    return { index, excessiveClosingBrackets };
}
/**
 * List of keywords that identify the start of a block.
 * <br>
 * `function` and `if` are handled separately
 */
const blockKeywords = ['for', 'while'];
/**
 * Processes indentation on plain code block, like function bodies or
 * top-level code
 * @param lines lines to indent
 * @param index starting index
 * @param breakOn list of keywords, which will cause processing to break when
 * encountered at a start of a line
 * @return index of the next unindented line
 */
function processCodeBody(lines, index, ...breakOn) {
    while (index < lines.length) {
        const line = lines[index];
        const code = line.code;
        // Breakers go first
        for (const breaker of breakOn)
            if (startsWithKeyword(code, breaker))
                return index; // Move 1 step back, so outer handler can consume breaking line
        // if blocks have a single-line variant, and also require special treatment for `else`
        if (startsWithKeyword(code, 'if') && endsWithKeyword(code, 'then')) {
            index = processIfBlock(lines, index);
            continue;
        }
        // While and for can be handled in the same way
        let blockFound = false;
        for (const blockKeyword of blockKeywords) {
            if (startsWithKeyword(code, blockKeyword)) {
                index = processSimpleBlock(blockKeyword, lines, index);
                blockFound = true;
            }
        }
        if (blockFound)
            continue;
        // Functions can be handled the same as `while` and `for`, but we must detect them differently because they
        // (usually) are assignment statements
        if (code.match(/(\s|^)function([(\s]|$)/)) {
            index = processSimpleBlock('function', lines, index);
            continue;
        }
        if (isIncompleteNonOperationLine(line.code)) {
            const { open } = getBracketsBalance(line.code);
            const { index: nextLine } = processMultiline(open, lines, index);
            if (previousLineEndsWithOperation(lines, index))
                indentMultiline(lines, index, nextLine);
            index = nextLine;
            continue;
        }
        if (previousLineEndsWithOperation(lines, index))
            indentMultiline(lines, index, index + 1);
        index++;
    }
    return index;
}
/**
 * Class for handling indentation in miniscript code
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class MiniscriptIndenter {
    /**
     * Processes indentation on given code lines
     * @param lines lines to indent
     */
    static processIndentation(lines) {
        processCodeBody(lines, 0);
    }
}
exports.MiniscriptIndenter = MiniscriptIndenter;
MiniscriptIndenter.config = {
    /**
     * Used to indent bodies of `if`/`for`/`while`/`function` blocks
     */
    blockIndent: '    ',
    /**
     * Used to indent lines in a multiline structures, like operation
     * chains or multiline arrays or objects
     */
    multilineIndent: '  ',
};


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __webpack_require__(1);
const format_1 = __webpack_require__(2);
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('miniscript', {
        provideDocumentFormattingEdits(document) {
            const code = document.getText();
            console.log(code);
            const formatted = format_1.MiniscriptFormatter.formatCode(code);
            console.log(formatted);
            if (formatted === code)
                return [];
            return [
                vscode.TextEdit.replace(new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end), formatted),
            ];
        },
    }));
    console.log('Formatting for Miniscript is activated!');
}
exports.activate = activate;
// This method is called when your extension is deactivated
// export function deactivate() {}

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map