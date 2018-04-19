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
 * Check if two arrays are the same.
 *
 * @param {[any]} actual - The first array.
 * @param {[any]} expected - The second array.
 * @returns {boolean} - true if the arrays are equal
 */
function assertArraysEqual(actual, expected) {
    assert(
        actual.length === expected.length,
        "Arrays have different lengths; expected " + expected.length + " but got " + actual.length
    );
    for (var i = 0; i < actual.length; i++) {
        assert(
            actual[i] === expected[i],
            [
                "Arrays are different at index " + i + "; expected:",
                expected[i],
                "but got:",
                actual[i],
            ].join("\n"),
        );
    }
}

/**
 * Test splitAtCursors.
 *
 * @returns {undefined}
 */
function testSplitAtCursors() {
    var text = [
        "1234567890",
        "1234567890",
        "",
        "1234567890",
        "1234567890",
    ].join("\n");
    var cursors = null;
    var sections = null;
    var expected = null;


    // edge cases

    cursors = [brickEditor.makeCursor(1, 0)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = ["", text];
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(5, 10)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [text, ""];
    assertArraysEqual(sections, expected);

    // non-empty lines

    cursors = [brickEditor.makeCursor(1, 5)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "12345",
        ].join("\n"), [
            "67890",
            "1234567890",
            "",
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(5, 9)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
            "",
            "1234567890",
            "123456789",
        ].join("\n"), [
            "0",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    // line boundaries

    cursors = [brickEditor.makeCursor(2, 10)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
        ].join("\n"), [
            "",
            "",
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(3, 0)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
            "",
        ].join("\n"), [
            "",
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(4, 0)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
            "",
            "",
        ].join("\n"), [
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    // out of line bounds

    cursors = [brickEditor.makeCursor(2, 11)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
            "",
        ].join("\n"), [
            "",
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(1, 16)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "12345",
        ].join("\n"), [
            "67890",
            "",
            "1234567890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(2, 17)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "1234567890",
            "1234567890",
            "",
            "12345",
        ].join("\n"), [
            "67890",
            "1234567890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);

    // out of string bounds

    cursors = [brickEditor.makeCursor(5, 11)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [text, ""];
    assertArraysEqual(sections, expected);

    cursors = [brickEditor.makeCursor(10, 10)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [text, ""];
    assertArraysEqual(sections, expected);

    // multiple cursors

    cursors = [brickEditor.makeCursor(1, 0), brickEditor.makeCursor(5, 10)];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = ["", text, ""];
    assertArraysEqual(sections, expected);

    cursors = [
        brickEditor.makeCursor(1, 5),
        brickEditor.makeCursor(2, 5),
        brickEditor.makeCursor(4, 5),
        brickEditor.makeCursor(5, 5)
    ];
    sections = brickEditor.splitAtCursors(text, cursors);
    expected = [
        [
            "12345"
        ].join("\n"), [
            "67890",
            "12345",
        ].join("\n"), [
            "67890",
            "",
            "12345",
        ].join("\n"), [
            "67890",
            "12345",
        ].join("\n"), [
            "67890",
        ].join("\n"),
    ]
    assertArraysEqual(sections, expected);
}

/**
 * Test isBetweenCursors.
 *
 * @returns {undefined}
 */
function testIsBetweenCursors() {
    // between two lines
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 5),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 9),
    ))
    // edge cases
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 9),
    ))
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(1, 1),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 9),
    ))
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(9, 9),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 9),
    ))
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(9, 8),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 9),
    ))
    // before start and after end (multi-line)
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(1, 5),
        brickEditor.makeCursor(9, 9),
    ))
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(9, 9),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(9, 5),
    ))
    // same line
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 5),
        brickEditor.makeCursor(5, 0),
        brickEditor.makeCursor(5, 9),
    ))
    // before start and after end (same line)
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 0),
        brickEditor.makeCursor(5, 2),
        brickEditor.makeCursor(5, 7),
    ))
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 9),
        brickEditor.makeCursor(5, 2),
        brickEditor.makeCursor(5, 7),
    ))
    // at start line
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 5),
        brickEditor.makeCursor(5, 0),
        brickEditor.makeCursor(9, 9),
    ))
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 0),
        brickEditor.makeCursor(5, 2),
        brickEditor.makeCursor(9, 9),
    ))
    // at end line
    assert(brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 5),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(5, 9),
    ))
    assert(!brickEditor.isBetweenCursors(
        brickEditor.makeCursor(5, 9),
        brickEditor.makeCursor(1, 0),
        brickEditor.makeCursor(5, 7),
    ))
}

/**
 * Test spansProtectedPunctuation.
 *
 * @returns {undefined}
 */
function testSpansProtectedPunctuation() {
    var buffer = [
        "function normal(arg1, arg2) {",
        "    if ( spaced ) {",
        "        console.log('whatever');",
        "    } else if (  second_condition  )   {",
        "    } else {",
        "    }",
        "    while ( (nested) ) {",
        "        for (init; test; update) {",
        "        }",
        "    }",
        "    var empty = function () {};",
        "}",
    ].join("\n");
    var ast = recast.parse(buffer);
    var protectedCursors = {
        1: [15, 26, 28],
        2: [7, 16, 18],
        4: [4, 14, 35, 39],
        5: [4, 11],
        6: [4],
        7: [10, 21, 23],
        8: [12, 31, 33],
        9: [8],
        10: [4],
        11: [25, 26, 28, 29],
        12: [0],
    };
    for (var line = 1; line < 13; line++) {
        for (var col = 0; col < 40; col++) {
            var selectionStart = brickEditor.makeCursor(line, col);
            var selectionEnd = brickEditor.makeCursor(line, col + 1);
            var actual = brickEditor.spansProtectedPunctuation(buffer, ast, [selectionStart, selectionEnd]);
            var expected = (protectedCursors[line] !== undefined && protectedCursors[line].includes(col));
            var message = "Protected punctuation test at line " + line + " col " + col + " expected " + expected + " but got " + actual;
            assert(actual === expected, message);
        }
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
    position = brickEditor.makeCursor(3, 1);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "Program", 1, 0, 3, 1);

    // before function definition
    position = brickEditor.makeCursor(1, 0);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "Program", 1, 0, 3, 1);

    // before function open brace
    position = brickEditor.makeCursor(1, 16);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 3, 1);

    // after function open brace
    position = brickEditor.makeCursor(1, 17);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 3, 1);

    // before function close brace
    position = brickEditor.makeCursor(3, 0);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
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
    position = brickEditor.makeCursor(2, 4);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // after last line
    position = brickEditor.makeCursor(4, 19);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // before second line
    position = brickEditor.makeCursor(3, 4);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // after second line
    position = brickEditor.makeCursor(3, 19);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // in variable
    position = brickEditor.makeCursor(3, 7);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 5, 1);

    // in function call
    position = brickEditor.makeCursor(3, 17);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
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
    position = brickEditor.makeCursor(5, 7);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 22, 1);

    // in while condition
    position = brickEditor.makeCursor(5, 12);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 16, 22, 1);

    // in while block
    position = brickEditor.makeCursor(6, 17);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if keyword
    position = brickEditor.makeCursor(9, 9);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if condition
    position = brickEditor.makeCursor(9, 16);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 5, 17, 18, 5);

    // in if true block
    position = brickEditor.makeCursor(12, 25);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 9, 24, 13, 9);

    // in if false block
    position = brickEditor.makeCursor(14, 3);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 13, 15, 17, 9);

    ast = recast.parse([
        "function Person(age) {",
        "    if (age) {",
        "        this.age = age;",
        "    }",
        "}"
    ].join("\n"));
    position = brickEditor.makeCursor(3, 23);
    parentNode = brickEditor.findClosestParent(ast, position, ["BlockStatement", "Program"]);
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
    position = brickEditor.makeCursor(1, 18);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // before var a = 3
    position = brickEditor.makeCursor(2, 4);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after var a = 3
    position = brickEditor.makeCursor(2, 14);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "VariableDeclaration", 2, 4, 2, 14);

    // before print(5)
    position = brickEditor.makeCursor(4, 4);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after print(5)
    position = brickEditor.makeCursor(4, 17);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "ExpressionStatement", 4, 8, 4, 17);

    // in empty line in else statement
    position = brickEditor.makeCursor(6, 12);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, null);

    // after closing curly brace of else statement
    position = brickEditor.makeCursor(7, 5);
    prevSibling = brickEditor.findPreviousSibling(ast, position);
    checkASTPosition(prevSibling, "IfStatement", 3, 4, 7, 5);

    // after closing curly brace of function
    position = brickEditor.makeCursor(9, 1);
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
        "function test(a) {",
        "    var a = 3;",
        "    if (a == 3) {",
        "        print(5);",
        "    } else {",
        "        while (true) {",
        "            print(3);",
        "            break;",
        "        }",
        "    }",
        "    return a;",
        "}"].join("\n"));
    var position1 = null;
    var position2 = null;
    var parentNode = null;

    // before function declaration and after closing curly brace
    position1 = brickEditor.makeCursor(1, 0);
    position2 = brickEditor.makeCursor(12, 1);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "Program", 1, 0, 12, 1);

    // before function opening curly brace and before function closing curly brace 
    position1 = brickEditor.makeCursor(1, 17);
    position2 = brickEditor.makeCursor(12, 0);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // before var a and before print(3) 
    position1 = brickEditor.makeCursor(2, 4);
    position2 = brickEditor.makeCursor(7, 12);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // in print(3) and after break;
    position1 = brickEditor.makeCursor(7, 15);
    position2 = brickEditor.makeCursor(8, 18);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 6, 21, 9, 9);

    // before if opening curly brace and before print(5) 
    position1 = brickEditor.makeCursor(3, 16);
    position2 = brickEditor.makeCursor(4, 8);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 3, 16, 5, 5);

    // before print(5) and in while statement 
    position1 = brickEditor.makeCursor(4, 0);
    position2 = brickEditor.makeCursor(6, 11);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // after return a and after print(5) 
    position1 = brickEditor.makeCursor(11, 13);
    position2 = brickEditor.makeCursor(4, 17);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "BlockStatement", 1, 17, 12, 1);

    // before function opening curly brace and after function closing curly brace
    position1 = brickEditor.makeCursor(1, 17);
    position2 = brickEditor.makeCursor(12, 1);
    parentNode = brickEditor.findClosestCommonParent(ast, [position1, position2], ["BlockStatement", "Program"]);
    checkASTPosition(parentNode, "Program", 1, 0, 12, 1);
}

/**
 * Test findClosestDeletableBlock.
 *
 * @returns {undefined}
 */
function testFindClosestDeletableBlock() {
    var ast = recast.parse([
        "function test(a) {",
        "    var a = 3;",
        "    if (a == 3) {",
        "        print(5);",
        "    } else {",
        "        var b = 3;",
        "    }",
        "    for (var i = 0; i < 10; i++) {",
        "        while (true) {",
        "            // do something",
        "        }",
        "    }",
        "    return a;",
        "}"].join("\n"));
    var position = null;
    var deletableBlock = null;

    // after function closing curly brace
    position = brickEditor.makeCursor(14, 1);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 14, 1);

    // after function opening curly brace
    position = brickEditor.makeCursor(1, 18);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 14, 1);

    // before if statement
    position = brickEditor.makeCursor(3, 4);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "IfStatement", 3, 4, 7, 5);

    // in else statement
    position = brickEditor.makeCursor(5, 7);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "IfStatement", 3, 4, 7, 5);

    // in for statement, after var i = 0;
    position = brickEditor.makeCursor(8, 19);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "VariableDeclaration", 8, 9, 8, 18);

    // in return a
    position = brickEditor.makeCursor(13, 7);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "ReturnStatement", 13, 4, 13, 13);

    // after var b = 3
    position = brickEditor.makeCursor(6, 17);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "VariableDeclaration", 6, 8, 6, 18);

    // before var a = 3;
    position = brickEditor.makeCursor(2, 4);
    deletableBlock = brickEditor.findClosestDeletableBlock(ast, position);
    checkASTPosition(deletableBlock, "VariableDeclaration", 2, 4, 2, 14);
    
}

/**
 * Test findClosestCommonDeletableBlock.
 *
 * @returns {undefined}
 */
function testFindClosestCommonDeletableBlock() {
    var ast = recast.parse([
        "function test(a) {",
        "    var a = 3;",
        "    if (a == 3) {",
        "        print(5);",
        "    } else {",
        "        while (true) {",
        "            print(3);",
        "            break;",
        "        }",
        "    }",
        "    return a;",
        "}"].join("\n"));
    var position1 = null;
    var position2 = null;
    var deletableBlock = null;

    // before function declaration and after return a;
    position1 = brickEditor.makeCursor(1, 0);
    position2 = brickEditor.makeCursor(11, 13);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 12, 1);

    // after function opening curly brace and before function closing curly brace
    position1 = brickEditor.makeCursor(1, 18);
    position2 = brickEditor.makeCursor(12, 0);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 12, 1);

    // before var a and before print(3)
    position1 = brickEditor.makeCursor(2, 4);
    position2 = brickEditor.makeCursor(7, 12);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 12, 1);

    // in print(3) and after break;
    position1 = brickEditor.makeCursor(7, 15);
    position2 = brickEditor.makeCursor(8, 18);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "WhileStatement", 6, 8, 9, 9);

    // before if opening curly brace and before print(5)
    position1 = brickEditor.makeCursor(3, 16);
    position2 = brickEditor.makeCursor(4, 8);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "IfStatement", 3, 4, 10, 5);

    // before print(5) and in while statement
    position1 = brickEditor.makeCursor(4, 0);
    position2 = brickEditor.makeCursor(6, 11);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "IfStatement", 3, 4, 10, 5);

    // after return a and after print(5)
    position1 = brickEditor.makeCursor(11, 13);
    position2 = brickEditor.makeCursor(4, 17);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "FunctionDeclaration", 1, 0, 12, 1);

    // before return a; and in return a;
    position1 = brickEditor.makeCursor(11, 4);
    position2 = brickEditor.makeCursor(11, 10);
    deletableBlock = brickEditor.findClosestCommonDeletableBlock(ast, [position1, position2], brickEditor.BLOCK_DELETE_TYPES);
    checkASTPosition(deletableBlock, "ReturnStatement", 11, 4, 11, 13);
}

testSplitAtCursors();
testIsBetweenCursors();
testClosestParentNearBraces();
testClosestParentMultipleLines();
testClosestParentNested();
testFindPreviousSibling();
testFindClosestCommonParent();
testFindClosestDeletableBlock();
testFindClosestCommonDeletableBlock();
testSpansProtectedPunctuation();
