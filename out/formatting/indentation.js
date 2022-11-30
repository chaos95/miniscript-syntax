"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiniscriptIndenter = exports.startsWithKeyword = void 0;
const format_1 = require("./format");
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
//# sourceMappingURL=indentation.js.map