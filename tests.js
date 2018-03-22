/* global require */

var assert = require("assert");
var recast = require("recast");
var estraverse = require("estraverse");
var brickEditor = require("./brick-editor.js");

function assertEqual(actual, expected, msg) {
    assert(
        expected === actual,
        msg + "; expected " + expected + " but got " + actual
    );
}

function checkASTPosition(node, type, start_line, start_col, end_line, end_col) {
    /*if (type === "Program") {
        node = node.program;
    } else if (type === "BlockStatement") {
        // node is already usable
    } else {
        assert(false, "Unknown AST node type: " + node);
    }*/

    assertEqual(node.type, type, "Block type is wrong");
    assertEqual(node.loc.start.line, start_line, "Start line is wrong");
    assertEqual(node.loc.start.column, start_col, "Start line is wrong");
    assertEqual(node.loc.end.line, end_line, "End line is wrong");
    assertEqual(node.loc.end.column, end_col, "End column is wrong");
}

function testClosestParentNearBraces() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = null;
    var parent_node = null;

    // after function definition
    position = {"lineNumber": 3, "column": 1};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // before function definition
    position = {"lineNumber": 1, "column": 0};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);

    // before function open brace
    position = {"lineNumber": 1, "column": 16};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // after function open brace
    position = {"lineNumber": 1, "column": 17};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // before function close brace
    position = {"lineNumber": 3, "column": 0};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentMultipleLines() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = null;
    var parent_node = null;

    // before first line
    position = {"lineNumber": 2, "column": 4};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);

    // after last line
    position = {"lineNumber": 4, "column": 19};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);

    // before second line
    position = {"lineNumber": 3, "column": 4};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);

    // after second line
    position = {"lineNumber": 3, "column": 19};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);

    // in variable
    position = {"lineNumber": 3, "column": 7};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);

    // in function call
    position = {"lineNumber": 3, "column": 17};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 5, 1);
}

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
    var parent_node = null;

    // in while keyword
    position = {"lineNumber": 5, "column": 7};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 22, 1);

    // in while condition
    position = {"lineNumber": 5, "column": 12};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 22, 1);

    // in while block
    position = {"lineNumber": 6, "column": 17};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 5, 17, 18, 5);

    // in if keyword
    position = {"lineNumber": 9, "column": 9};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 5, 17, 18, 5);

    // in if condition
    position = {"lineNumber": 9, "column": 16};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 5, 17, 18, 5);

    // in if true block
    position = {"lineNumber": 12, "column": 25};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 9, 24, 13, 9);

    // in if false block
    position = {"lineNumber": 14, "column": 3};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 13, 15, 17, 9);
}

testClosestParentNearBraces();
testClosestParentMultipleLines();
testClosestParentNested();
