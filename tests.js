/* global require */

var assert = require("assert");
var recast = require("recast");
var brickEditor = require("./brick-editor.js");

function assertEqual(actual, expected, msg) {
    assert(
        expected === actual,
        msg + "; expected " + expected + " but got " + actual
    );
}

function checkASTPosition(node, type, start_line, start_col, end_line, end_col) {
    if (type === "Program") {
        node = node.program;
    } else if (type === "BlockStatement") {
        // node is already usable
    } else {
        assert(false, "Unknown AST node type: " + node);
    }
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
    position = {"line": 3, "column": 1};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);

    // before function definition
    position = {"line": 0, "column": 0};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);

    // before function open brace
    position = {"line": 0, "column": 0};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);

    // after function open brace
    position = {"line": 0, "column": 0};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // before function close brace
    position = {"line": 0, "column": 0};
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
    position = {"line": 2, "column": 4};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // after last line
    position = {"line": 4, "column": 19};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // before second line
    position = {"line": 3, "column": 4};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // after second line
    position = {"line": 3, "column": 19};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // in variable
    position = {"line": 3, "column": 7};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);

    // in function call
    position = {"line": 3, "column": 17};
    parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

testClosestParentNearBraces();
testClosestParentMultipleLines();
