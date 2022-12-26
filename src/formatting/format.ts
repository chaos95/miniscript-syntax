import { isIncomplete, matchingClosingBracket, MiniscriptIndenter, startsWithKeyword } from './indentation';

interface ExtractStringsResponse {
  strippedCode: string;
  strings: string[];
}

interface ExtractCommentsResponse {
  strippedCode: string;
  strings: string[];
}

/**
 * Extracts strings from a code, and stores them in a separate array,
 * replacing their original occurrences in code with special markers,
 * that won't mess up code formatting later on
 * @param code code to strip strings from
 */
function extractStrings(code: string): ExtractStringsResponse {
  const strings: string[] = [];
  let parsedCode = '';
  let sectionStart = 0;
  let inString = false;
  const concludeGroup = (i: number) => {
    if (inString) {
      parsedCode += `"$${strings.length}"`;
      strings.push(code.substring(sectionStart, i));
      sectionStart = i;
    } else {
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
      } else {
        const nextChar = code[i + 1];
        i++;
        if (nextChar !== '"') concludeGroup(i);
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
 * Extracts comments a code, and stores them in a separate array,
 * replacing their original occurrences in code with special markers,
 * that won't mess up code formatting later on
 * @param code code to strip strings from
 */
function extractComments(code: string): ExtractCommentsResponse {
  const lines = code.replace(/\r\n/g, '\n').split(/\n/);
  const stripped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(.*?\/\/\s?)(.*)$/);
    if (!match) continue;
    const comment = match[2].trimEnd();
    if (comment.length === 0 && !match[1].trimStart().startsWith('//')) continue;
    lines[i] = `${match[1]}$${stripped.length}`;
    stripped.push(comment);
  }
  return {
    strings: stripped,
    strippedCode: lines.join('\n'),
  };
}

/**
 * Breaks line into indentation, code and comment sections
 */
function breakLine(line: string): [string, string, string] {
  const data = line.match(/^(\s*)(.*?)\s*(?:\/\/(.*?))?\s*$/);
  if (!data) return ['', line, ''];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [data[1], data[2], data[3] ?? ''];
}

const bracketsMap: Record<string, readonly [string, string] | undefined> = {
  ']': ['[', ']'],
  '}': ['{', '}'],
  ')': ['(', ')'],
};

/**
 * All symbols after this are valid identifiers in miniscript
 */
const unicodeThreshold = '\u009F'.codePointAt(0) as number;

/**
 * Attempts to detect and strip parentheses from a function call statement
 */
function stripFunctionCallParentheses(line: string): string {
  line = line.trimEnd();
  if (!line.endsWith(')')) return line;
  let level = 1;
  let callStart = -1;

  // find where parentheses are
  for (let i = line.length - 2; i >= 0; i--) {
    const char = line[i];
    if (char === ')') level++;
    else if (char === '(') level--;
    if (level === 0) {
      callStart = i;
      break;
    }
  }
  if (callStart < 0) return line;

  level = 0;
  let leftChar = '';
  let rightChar = '';
  // check is whole previous part of the line is just a chain
  for (let i = callStart - 1; i >= 0; i--) {
    const char = line[i];
    if (level > 0) {
      if (char === rightChar) level++;
      else if (char === leftChar) level--;
      continue;
    }
    if (char === '.' || MiniscriptFormatter.isValidIdentifierChar(char)) continue;
    const map = bracketsMap[char];
    if (map === undefined) return line;
    [leftChar, rightChar] = map;
    level++;
  }
  if (level !== 0) return line;
  const chain = line.substring(0, callStart);
  const args = line.substring(callStart + 1, line.length - 1);
  return chain + ' ' + args;
}

function stripIfParentheses(line: string): string {
  if (!startsWithKeyword(line, 'if')) return line;
  const rest = line.substring(2, line.length).trimStart();
  if (!rest.startsWith('(')) return line;
  let counter = 1;
  for (let i = 1; i < rest.length; i++) {
    const char = rest[i];
    if (char === '(') counter++;
    if (char === ')') counter--;
    if (counter === 0) {
      const afterClosing = rest.substring(i + 1, rest.length).trimStart();
      if (!startsWithKeyword(afterClosing, 'then')) return line;
      return `if ${rest.substring(1, i)} ${afterClosing}`;
    }
  }
  return line;
}

function formatColons(code: string): string {
  const bracketsStack: string[] = [];
  if (!code.includes(':')) return code;
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (char === ':' && bracketsStack[bracketsStack.length - 1] === '{') {
      const before = code.substring(0, i + 1).replace(/\s*:$/, ':');
      const after = code.substring(i + 1, code.length);
      if (!after.startsWith('\n')) code = before + ' ' + after.trimStart();
      else code = before + after;
    } else if (matchingClosingBracket[char]) {
      bracketsStack.push(char);
    } else if (char === matchingClosingBracket[bracketsStack[bracketsStack.length - 1]]) {
      bracketsStack.pop();
    }
  }
  return code;
}

/**
 * Combines separated lines back into one string
 */
function joinLines(lines: MiniscriptCodeLine[]) {
  return lines
    .map(line => {
      let mainBody = line.indentation + line.code;
      if (line.comment.length > 0) {
        // Space is only added before comment if we actually have a code in a line
        if (line.code.length > 0) mainBody += ' ';
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
function processCode(code: string) {
  code = code
    .replace(/\r\n/g, '\n')
    .replace(/;[^\S\n]*?\/\//g, ' //')
    .replace(/;[^\S\n]*\n?/g, '\n')
    .trim();
  const lines: MiniscriptCodeLine[] = [];
  const rawLines = code.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    let comment: string;
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
      // Space after closing bracket before non-bracket or dot
      .replace(/([)}\]])\s*([^.()[\]{}])/g, '$1 $2')
      // Space after comma and :
      .replace(/\s*([,])\s*/g, '$1 ')
      // Space around operators except for minus
      .replace(/\s*([<>=!]=|[+*/%^<>=])\s*/g, ' $1 ')
      // Minus followed by unary minus
      .replace(/--/g, '- -')
      // Unary minus
      .replace(/\s+-(\S)/g, ' -$1')
      // Two cases of a regular minus
      .replace(/\s*-(?:\s+|$)/g, ' - ')
      .replace(/([^\s[({:])-(\S)/g, '$1 - $2')
      // No space inside scientific notation
      .replace(/(^|[^_0-9A-Za-z\u00A0-\uFFFF])(\.?\d+\.?\d*)\s*e\s*([+-]?)\s*(\d+)/g, '$1$2e$3$4')
      // No trailing commas
      .replace(/([^,\s]),\s*([\]}])/g, '$1$2')
      // No empty function parenthesis
      .replace(/function\s*\(\s*\)/, 'function');

    if (i === 0 || !isIncomplete(lines[i - 1].code)) line = stripFunctionCallParentheses(line);
    line = stripIfParentheses(line);

    // Comments must always have space after // except for the case of triple ///
    if (comment.startsWith('/') && !comment.match('^/s')) comment = '/ ' + comment.substring(1, comment.length);
    else if (comment.length > 0 && !comment.match(/^\s/)) comment = ' ' + comment;

    comment = comment.trimEnd();

    lines[i] = {
      indentation: '',
      code: line.trim(),
      comment,
      commentGroupingOffset: 0,
    } as MiniscriptCodeLine;
  }

  MiniscriptIndenter.processIndentation(lines);

  code = joinLines(lines);
  code = formatColons(code);
  return code;
}

export interface MiniscriptCodeLine {
  indentation: string;
  code: string;
  comment: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class MiniscriptFormatter {
  /**
   * checks if a given character is a valid miniscript identifier
   */
  static isValidIdentifierChar(char: string | undefined): boolean {
    if (char === undefined) return false;
    if (/[_a-zA-Z0-9]/.test(char)) return true;
    return (char.codePointAt(0) as number) > unicodeThreshold;
  }

  /**
   * Formats the given miniscript code
   */
  static formatCode(code: string) {
    // // eslint-disable-next-line no-debugger
    // debugger;
    const { strippedCode: stringsStrippedCode, strings } = extractStrings(code);
    // eslint-disable-next-line prefer-const
    let { strippedCode, strings: comments } = extractComments(stringsStrippedCode);
    strippedCode = processCode(strippedCode);
    return strippedCode
      .replace(/\/\/\s\$\d+/g, group => {
        const num = group.substring(4, group.length);
        return ('//' + group[2] + comments[Number(num)]).trimEnd();
      })
      .replace(/"\$\d+"/g, group => {
        const num = group.substring(2, group.length - 1);
        return strings[Number(num)];
      });
  }
}
