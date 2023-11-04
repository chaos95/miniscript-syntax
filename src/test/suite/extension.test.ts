import * as assert from 'assert';
import * as fc from 'fast-check';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { MiniscriptFormatter } from '../../formatting/format';
import { MiniscriptIndenter } from '../../formatting/indentation';
// import * as myExtension from '../../extension';

suite('Miniscript formatting Test Suite', () => {
  void vscode.window.showInformationMessage('Start all tests.');

  function assertFormat(ctx: fc.ContextValue, code: string, expectedResult: string): void {
    ctx.log(`Original code: ${code}`);
    assert.strictEqual(MiniscriptFormatter.formatCode(code), expectedResult);
  }

  const whitespaces = [' ', '\t'];
  const ops = ['+', '- ', '*', '/', '%', '^', '>', '<', '=', '==', '!=', '<=', '>=', '*=', '/=', '+=', '-=', '^='];
  const whiteOrEmptyArb = fc.stringOf(fc.constantFrom(...whitespaces), { minLength: 0 });
  const whiteArb = fc.stringOf(fc.constantFrom(...whitespaces), { minLength: 1 });
  const opsArb = fc.constantFrom(...ops);
  const identifierRegex = /^(?!\s)[_A-Za-z\u00A0-\uFFFF]((?!\s)[_0-9A-Za-z\u00A0-\uFFFF])*$/; // We do not support whitespaces in names
  const identifierArb = fc.unicodeString({ minLength: 1 }).filter(str => identifierRegex.test(str));
  const blockIndent = MiniscriptIndenter.config.blockIndent;
  const multilineIndent = MiniscriptIndenter.config.multilineIndent;
  const expressionElementArb = fc.oneof(
    identifierArb,
    fc.double().map(e => e.toString()),
    fc.integer().map(e => e.toString()),
    fc.lorem().map(e => `"${e}"`),
  );

  test('Should add spaces around operators', () => {
    fc.assert(
      fc.property(expressionElementArb, expressionElementArb, opsArb, fc.context(), (a, b, op, ctx) => {
        assertFormat(ctx, `${a}${op}${b};`, `${a} ${op.trim()} ${b}`);
      }),
    );

    fc.assert(
      fc.property(fc.array(opsArb, { minLength: 2 }), fc.context(), (ops, ctx) => {
        const ogString = 'a' + ops.join('b') + 'c';
        const targetString = 'a ' + ops.map(e => e.trim()).join(' b ') + ' c';
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should collapse tabs, double/triple/etc spaces into single space', () => {
    fc.assert(
      fc.property(fc.array(whiteOrEmptyArb), fc.context(), (spaces, ctx) => {
        const ogString = 'a' + spaces.join('+b');
        const targetString = 'a' + spaces.map(() => '').join(' + b');
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should remove spaces around dots', () => {
    fc.assert(
      fc.property(fc.array(whiteOrEmptyArb), fc.context(), (spaces, ctx) => {
        const ogString = 'a' + spaces.join(' .b');
        const targetString = 'a' + spaces.map(() => '').join('.b');
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should remove spaces before and after brackets', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(['[', ']'], ['(', ')'], ['{', '}']),
        whiteOrEmptyArb,
        whiteOrEmptyArb,
        whiteOrEmptyArb,
        fc.context(),
        (brackets, before, after, space, ctx) => {
          const ogString = brackets[0] + before + 'a - b' + after + brackets[1] + space + '* c';
          const targetString = brackets[0] + 'a - b' + brackets[1] + ' * c';
          assertFormat(ctx, ogString, targetString);
        },
      ),
    );
  });

  test('Should remove trailing commas', () => {
    assert.strictEqual(MiniscriptFormatter.formatCode(`a=[1,2,3,]`), `a = [1, 2, 3]`);
    assert.strictEqual(MiniscriptFormatter.formatCode(`a={"1":1,"2":2,"3":3,}`), `a = {"1": 1, "2": 2, "3": 3}`);
  });

  test('Should handle minus', () => {
    fc.assert(
      fc.property(expressionElementArb, expressionElementArb, fc.context(), (a, b, ctx) => {
        assertFormat(ctx, `${a}-${b}`, `${a} - ${b}`);
        if (!b.startsWith('-')) {
          assertFormat(ctx, `${a} -${b}`, `${a} -${b}`);
          assertFormat(ctx, `[-${b}`, `[-${b}`);
          assertFormat(ctx, `(-${b}`, `(-${b}`);
          assertFormat(ctx, `{-${b}`, `{-${b}`);
          assertFormat(ctx, `:-${b}`, `:-${b}`);
        }
        assertFormat(ctx, `${a}- ${b}`, `${a} - ${b}`);
        assertFormat(ctx, `${a} - ${b}`, `${a} - ${b}`);
        assertFormat(ctx, `${a} -\n${b}`, `${a} -\n${multilineIndent}${b}`);
        assertFormat(ctx, `${a}-\n${b}`, `${a} -\n${multilineIndent}${b}`);
        assertFormat(ctx, `${a}- \n${b}`, `${a} -\n${multilineIndent}${b}`);
        assertFormat(ctx, `${a} - \n${b}`, `${a} -\n${multilineIndent}${b}`);
      }),
    );
  });

  test('Should remove empty function parenthesis', () => {
    assert.strictEqual(MiniscriptFormatter.formatCode(`function()\nend function`), `function\nend function`);
  });

  test('Should remove redundant brackets from if', () => {
    assert.strictEqual(MiniscriptFormatter.formatCode(`if(a==b) then c;`), `if a == b then c`);
    assert.strictEqual(MiniscriptFormatter.formatCode(`if(a==b) then\nend if`), `if a == b then\nend if`);
  });

  test('Should ensure space after colons in objects', () => {
    fc.assert(
      fc.property(
        expressionElementArb,
        whiteOrEmptyArb,
        expressionElementArb,
        whiteOrEmptyArb,
        fc.context(),
        (key, before, value, after, ctx) => {
          const ogString = '{' + key + before + ':' + after + value + '}';
          const targetString = '{' + key + ': ' + value + '}';
          assertFormat(ctx, ogString, targetString);
        },
      ),
    );
  });

  test('Should not change spaces around colons outside of objects', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(['[', ']'], ['', '']),
        expressionElementArb,
        whiteOrEmptyArb,
        expressionElementArb,
        whiteOrEmptyArb,
        fc.context(),
        (brackets, key, before, value, after, ctx) => {
          const ogString = brackets[0] + key + before + ':' + after + value + brackets[1];
          const targetString =
            brackets[0] +
            key +
            (before.length > 0 ? ' ' : '') +
            ':' +
            (after.length > 0 ? ' ' : '') +
            value +
            brackets[1];
          assertFormat(ctx, ogString, targetString);
        },
      ),
    );
  });

  test('Should ensure space before and after comment', () => {
    fc.assert(
      fc.property(whiteOrEmptyArb, whiteArb, fc.context(), (before, after, ctx) => {
        const ogString = 'func' + before + '//' + after + 'comment';
        const targetString = `func //${after}comment`;
        assertFormat(ctx, ogString, targetString);
      }),
    );

    fc.assert(
      fc.property(whiteOrEmptyArb, fc.context(), (before, ctx) => {
        const ogString = 'func' + before + '//comment';
        const targetString = `func // comment`;
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should ensure space after closing bracket before number, string or identifier', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(']', ')', '}'),
        whiteOrEmptyArb,
        expressionElementArb,
        fc.context(),
        (bracket, space, value, ctx) => {
          const ogString = bracket + space + value.toString();
          const targetString = bracket + ' ' + value.toString();
          assertFormat(ctx, ogString, targetString);
        },
      ),
    );
    fc.assert(
      fc.property(
        fc.constantFrom(']', ')', '}'),
        fc.constantFrom(...'()[]{}.'.split('')),
        fc.context(),
        (bracket, value, ctx) => {
          const ogString = bracket + value.toString();
          const targetString = bracket + value.toString();
          assertFormat(ctx, ogString, targetString);
        },
      ),
    );
  });

  test('Should strip empty comments', () => {
    fc.assert(
      fc.property(whiteOrEmptyArb, fc.context(), (comment, ctx) => {
        const ogString = 'func //' + comment;
        const targetString = `func`;
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should ignore semicolons in comments', () => {
    const ogString = 'a = // 5;5;8';
    const targetString = 'a = // 5;5;8';
    assert.strictEqual(MiniscriptFormatter.formatCode(ogString), targetString);
  });

  test('Should strip brackets from function call statements', () => {
    fc.assert(
      fc.property(fc.array(identifierArb), fc.context(), (args, ctx) => {
        const ogString = `func(${args.join(', ')})`;
        const targetString = (`func ` + args.join(', ')).trimEnd();
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  test('Should not strip brackets from function call expression in multiline context', () => {
    fc.assert(
      fc.property(fc.array(identifierArb), fc.context(), (args, ctx) => {
        const ogString = `a +\nfunc(${args.join(', ')})`;
        const targetString = `a +\n${multilineIndent}func(${args.join(', ')})`;
        assertFormat(ctx, ogString, targetString);
      }),
    );
  });

  suite('Indentation', () => {
    const blockArb = fc.constantFrom(
      ['if a then', 'end if'],
      ['while a', 'end while'],
      ['for a in b', 'end for'],
      ['a = function', 'end function'],
    );
    test('Should remove indentation from dangling lines', () => {
      fc.assert(
        fc.property(whiteOrEmptyArb, fc.context(), (indent, ctx) => {
          const ogString = indent + 'code';
          const targetString = 'code';
          assertFormat(ctx, ogString, targetString);
        }),
      );
    });

    test('Should add indentation in blocks', () => {
      fc.assert(
        fc.property(blockArb, fc.context(), (block, ctx) => {
          assertFormat(ctx, `${block[0]}\nbody\n${block[1]}`, `${block[0]}\n${blockIndent}body\n${block[1]}`);
        }),
      );
    });

    test('Should add indentation in nested blocks', () => {
      fc.assert(
        fc.property(fc.array(blockArb, { minLength: 2 }), fc.context(), (blocks, ctx) => {
          let ogString = '';
          let targetString = '';
          for (let i = 0; i < blocks.length; i++) {
            ogString += blocks[i][0] + '\n';
            targetString += blockIndent.repeat(i) + blocks[i][0] + '\n';
          }

          ogString += 'body\n';
          targetString += blockIndent.repeat(blocks.length) + 'body\n';

          for (let i = blocks.length - 1; i >= 0; i--) {
            ogString += blocks[i][1] + '\n';
            targetString += blockIndent.repeat(i) + blocks[i][1] + '\n';
          }
          ogString = ogString.trim();
          targetString = targetString.trim();

          assertFormat(ctx, ogString, targetString);
        }),
      );
    });

    test('Should add indentation in multiline operations', () => {
      fc.assert(
        fc.property(opsArb, fc.context(), (op, ctx) => {
          assertFormat(ctx, `a ${op}\nb`, `a ${op.trim()}\n${multilineIndent}b`);
        }),
      );
      fc.assert(
        fc.property(fc.array(fc.tuple(opsArb, identifierArb), { minLength: 2 }), fc.context(), (ops, ctx) => {
          const ogString =
            'a' +
            ops
              .map(e => e[0] + '\n' + e[1])
              .join('')
              .trim();
          const targetString =
            'a ' +
            ops
              .map(e => e[0].trim() + '\n' + multilineIndent + e[1])
              .join(' ')
              .trim();
          assertFormat(ctx, ogString, targetString);
        }),
      );
    });

    test('Corner case 1', () => {
      const ogString =
        `printAlign "dieFace[1] - dieFace[6]", [dieFace[1], dieFace[2], dieFace[3],\n` +
        `dieFace[4], dieFace[5], dieFace[6]].join`;
      const targetString =
        `printAlign "dieFace[1] - dieFace[6]", [dieFace[1], dieFace[2], dieFace[3],\n` +
        `${multilineIndent}dieFace[4], dieFace[5], dieFace[6]].join`;
      assert.strictEqual(MiniscriptFormatter.formatCode(ogString), targetString);
    });

    test('Corner case 2', () => {
      const ogString = 'a(\n' + '1 +\n' + '2 +\n' + '2 +\n' + '2 +\n' + '2 +\n' + '3)';
      const targetString =
        'a(\n' +
        multilineIndent +
        '1 +\n' +
        multilineIndent +
        multilineIndent +
        '2 +\n' +
        multilineIndent +
        multilineIndent +
        '2 +\n' +
        multilineIndent +
        multilineIndent +
        '2 +\n' +
        multilineIndent +
        multilineIndent +
        '2 +\n' +
        multilineIndent +
        multilineIndent +
        '3)';
      assert.strictEqual(MiniscriptFormatter.formatCode(ogString), targetString);
    });

    test('Should process complex case', () => {
      const ogString = `
if someCondition then someLineExpression
if someCondition2 then a([
1,2,
3,
4,
])
if someThrirdCondition then
(
longExpressionThatReturnsAnArray +
anotherLongExpressionThatReturnsAnArray +
[
someLongExpression1,
someLongExpression +
someLongExpression2 -
someLongExpression3,
someOtherLongExpression,
]
)[0]()/
someLongDivisor
else if idkCondition
doStuff
doStuff2
end if

a = function(doStuffA)
while c
    doA
            doB
                        doC
for rice in a_bag
    cook(
            tea,
                            sugar,
red_pepper,
)
end for
                                        end while
                                
finishCooking();
end function

a = function()
    doStuffA
    a = {
    1:2,
    "2": veryLonCall() +
    anotherVeryLongCall(),
    }
    doStuffB(1,2,3)
    doStuffC((1+5),2,3)
    doStuffD 1, 2, 3
    doStuffE(1,2)3
    return a
end function

// This is useless, and may be an error later down the line, but we should still handle it
function
doStuff
end function
      `.trim();
      const targetString = `
if someCondition then someLineExpression
if someCondition2 then a([
  1, 2,
  3,
  4,
])
if someThrirdCondition then
    (
      longExpressionThatReturnsAnArray +
        anotherLongExpressionThatReturnsAnArray +
        [
          someLongExpression1,
          someLongExpression +
            someLongExpression2 -
            someLongExpression3,
          someOtherLongExpression,
        ]
    )[0]() /
      someLongDivisor
else if idkCondition
    doStuff
    doStuff2
end if

a = function(doStuffA)
    while c
        doA
        doB
        doC
        for rice in a_bag
            cook(
              tea,
              sugar,
              red_pepper,
            )
        end for
    end while

    finishCooking
end function

a = function
    doStuffA
    a = {
      1: 2,
      "2": veryLonCall() +
        anotherVeryLongCall(),
    }
    doStuffB 1, 2, 3
    doStuffC (1 + 5), 2, 3
    doStuffD 1, 2, 3
    doStuffE(1, 2) 3
    return a
end function

// This is useless, and may be an error later down the line, but we should still handle it
function
    doStuff
end function
      `.trim();
      assert.strictEqual(MiniscriptFormatter.formatCode(ogString), targetString);
    });
  });

  test('Sample test', () => {
    assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    assert.strictEqual(-1, [1, 2, 3].indexOf(0));
  });
});
