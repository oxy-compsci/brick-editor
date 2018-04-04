/* global require */

var assert = require("assert");
var recast = require("recast");
var brickEditor = require("./brick-editor.js");

/**
 * Assert that two values are equal, and print a message otherwise.
 *
 * @param {any} actual - the actual value of a test
 * @param {any} expected - the expected value of a test
 * @param {string} msg - the error message to print
 * @returns {undefined}
 */
function assertEqual(actual, expected, msg) {
    assert(
        expected === actual,
        msg + "; expected " + expected + " but got " + actual
    );
}

/**
 * Check that an AST node is what we expect it to be
 *
 * @param {AST} node - the AST node to check
 * @param {string} type - the expected type of the AST node
 * @param {int} start_line - the expected start line of the AST node
 * @param {int} start_col - the expected start column of the AST node
 * @param {int} end_line - the expected end line of the AST node
 * @param {int} end_col - the expected end column of the AST node
 * @returns {undefined}
 */
function checkASTPosition(node, type, start_line, start_col, end_line, end_col) {
    // check if node is supposed to be null
    if (node == null) {
        assertEqual(node, type);
    } else {
        assertEqual(node.type, type, "Block type is wrong");
        assertEqual(node.loc.start.line, start_line, "Start line is wrong");
        assertEqual(node.loc.start.column, start_col, "Start line is wrong");
        assertEqual(node.loc.end.line, end_line, "End line is wrong");
        assertEqual(node.loc.end.column, end_col, "End column is wrong");
    } 
}

/**
 * Test findClosestParent on block statements with a single line.
 *
 * @returns {undefined}
 */
function testClosestParentNearBraces() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = null;
    var parentNode = null;

    // after function definition
    position = {"lineNumber": 3, "column": 1};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "Program", 1, 0, 3, 1);

    // before function definition
    position = {"lineNumber": 1, "column": 0};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "Program", 1, 0, 3, 1);

    // before function open brace
    position = {"lineNumber": 1, "column": 16};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 3, 1);

    // after function open brace
    position = {"lineNumber": 1, "column": 17};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 3, 1);

    // before function close brace
    position = {"lineNumber": 3, "column": 0};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 3, 1);
}

/**
 * Test findClosestParent on block statements with multiple lines.
 *
 * @returns {undefined}
 */
function testClosestParentMultipleLines() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = null;
    var parentNode = null;

    // before first line
    position = {"lineNumber": 2, "column": 4};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // after last line
    position = {"lineNumber": 4, "column": 19};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // before second line
    position = {"lineNumber": 3, "column": 4};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // after second line
    position = {"lineNumber": 3, "column": 19};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // in variable
    position = {"lineNumber": 3, "column": 7};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // in function call
    position = {"lineNumber": 3, "column": 17};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);
}

/**
 * Test findClosestParent on nested block statements.
 *
 * @returns {undefined}
 */
function testClosestParentNested() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(1);",
        "    console.log(1);",
        "    while (True) {",
        "        console.log(2);",
        "        console.log(2);",
        "        console.log(2);",
        "        if (s === null) {",
        "            console.log(3);",
        "            console.log(3);",
        "            console.log(3);",
        "        } else {",
        "            console.log(4);",
        "            console.log(4);",
        "            console.log(4);",
        "        }",
        "    }",
        "    console.log(5);",
        "    console.log(5);",
        "    console.log(5);",
        "}",
    ].join("\n"));
    var position = null;
    var parentNode = null;

    // in while keyword
    position = {"lineNumber": 5, "column": 7};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 22, 1);

    // in while condition
    position = {"lineNumber": 5, "column": 12};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 22, 1);

    // in while block
    position = {"lineNumber": 6, "column": 17};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if keyword
    position = {"lineNumber": 9, "column": 9};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if condition
    position = {"lineNumber": 9, "column": 16};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if true block
    position = {"lineNumber": 12, "column": 25};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 9, 24, 13, 9);

    // in if false block
    position = {"lineNumber": 14, "column": 3};
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 13, 15, 17, 9);

    ast = recast.parse([
        "function Person(age) {",
        "    if (age) {",
        "        this.age = age;",
        "    }",
        "}"
    ].join("\n"));
    position = { "lineNumber": 3, "column": 23 };
    parentNode = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parentNode, "BlockStatement", 2, 13, 4, 5);
}

/**
 * Test findPreviousSibling.
 *
 * @returns {undefined}
 */
function testFindPreviousSibling() {
    var ast = recast.parse([
        "function test(a) {",
        "    var a = 3;",
        "    if (a == 3) {",
        "        print(5);",
        "    } else {",
        "            ",
        "    }",
        "    return a;",
        "}"].join("\n"));
    var position = null;
    var prevSibling = null;

    // after opening curly brace
    position = { "lineNumber": 1, "column": 18 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // before var a = 3
    position = { "lineNumber": 2, "column": 4 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after var a = 3
    position = { "lineNumber": 2, "column": 14 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "VariableDeclaration", 2, 4, 2, 14);

    // before print(5)
    position = { "lineNumber": 4, "column": 4 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after print(5)
    position = { "lineNumber": 4, "column": 17 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "ExpressionStatement", 4, 8, 4, 17);

    // in empty line in else statement
    position = { "lineNumber": 6, "column": 12 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after closing curly brace of else statement
    position = { "lineNumber": 7, "column": 5};
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "IfStatement", 3, 4, 7, 5);

    // after closing curly brace of function
    position = { "lineNumber": 9, "column": 1 };
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "FunctionDeclaration", 1, 0, 9, 1);
}

/**
 * Test findClosestCommonParent.
 *
 * @returns {undefined}
 */
function testFindClosestCommonParent() {
    var ast = recast.parse([
        'function test(a) {',
        '    var a = 3;',
        '    if (a == 3) {',
        '        print(5);',
        '    } else {',
        '        while (true) {',
        '            print(3);',
        '            break;',
        '        }',
        '    }',
        '    return a;',
        '}'].join('\n'));
    var position1 = null;
    var position2 = null;
    var parentNode = null;

    // before function declaration and after closing curly brace 
    position1 = { "lineNumber": 1, "column": 0 };
    position2 = { "lineNumber": 12, "column": 1 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "Program", 1, 0, 12, 1);

    // before function opening curly brace and before function closing curly brace 
    position1 = { "lineNumber": 1, "column": 17 };
    position2 = { "lineNumber": 12, "column": 0 }; 
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // before var a and before print(3) 
    position1 = { "lineNumber": 2, "column": 4 };
    position2 = { "lineNumber": 7, "column": 12 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // in print(3) and after break; 
    position1 = { "lineNumber": 7, "column": 15 };
    position2 = { "lineNumber": 8, "column": 18 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 6, 21, 9, 9);

    // before if opening curly brace and before print(5) 
    position1 = { "lineNumber": 3, "column": 16 };
    position2 = { "lineNumber": 4, "column": 8 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 3, 16, 5, 5);

    // before print(5) and in while statement 
    position1 = { "lineNumber": 4, "column": 0 };
    position2 = { "lineNumber": 6, "column": 11 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // after return a and after print(5) 
    position1 = { "lineNumber": 11, "column": 13 }; 
    position2 = { "lineNumber": 4, "column": 17 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // before function opening curly brace and after function closing curly brace 
    position1 = { "lineNumber": 1, "column": 17 };
    position2 = { "lineNumber": 12, "column": 1 };
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2]);
    checkASTPosition(parentNode, "Program", 1, 0, 12, 1);
} 

testClosestParentNearBraces();
testClosestParentMultipleLines();
testClosestParentNested();
testFindPreviousSibling();
testFindClosestCommonParent();
