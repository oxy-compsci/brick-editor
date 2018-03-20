/* global require */

var assert = require("assert");
var recast = require("recast");
var brickEditor = require("./brick-editor.js");

function assertEqual(actual, expected, msg) {
    assert(
        expected === actual,
        message = msg + "; expected " + expected + " but got " + actual
    );
}

function checkASTPosition(node, type, start_line, start_col, end_line, end_col) {
    if (type === "Program") {
        node = node.program;
    } else if (type === "BlockStatement") {
        node = node;
    } else {
        assert(false, "Unknown AST node type: " + node);
    }
    assertEqual(node.type, type, "Block type is wrong");
    assertEqual(node.loc.start.line, start_line, "Start line is wrong");
    assertEqual(node.loc.start.column, start_col, "Start line is wrong");
    assertEqual(node.loc.end.line, end_line, "End line is wrong");
    assertEqual(node.loc.end.column, end_col, "End column is wrong");
}

function testClosestParentAfterFunctionDefinition() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {"line": 3, "column": 1};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);
}

function testClosestParentBeforeFunctionDefinition() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {"line": 0, "column": 0};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);
}

function testClosestParentBeforeFunctionOpenBrace() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {"line": 0, "column": 0};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "Program", 1, 0, 3, 1);
}

function testClosestParentAfterFunctionOpenBrace() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {"line": 0, "column": 0};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentBeforeFunctionCloseBrace() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {"line": 0, "column": 0};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentBeforeFirstLine() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 2, "column": 4};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentAfterLastLine() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 4, "column": 19};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentBeforeMultipleLines() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 3, "column": 4};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentAfterMultipleLines() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 3, "column": 19};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentInVariable() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 3, "column": 7};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

function testClosestParentInFunctionCall() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(1);",
        "    console.log(2);",
        "    console.log(3);",
        "}",
    ].join("\n"));
    var position = {"line": 3, "column": 17};
    var parent_node = brickEditor.findClosestParent(ast, position);
    checkASTPosition(parent_node, "BlockStatement", 1, 16, 3, 1);
}

testClosestParentAfterFunctionDefinition();
testClosestParentBeforeFunctionDefinition();
testClosestParentBeforeFunctionOpenBrace();
testClosestParentAfterFunctionOpenBrace();
testClosestParentBeforeFunctionCloseBrace();
testClosestParentBeforeFirstLine();
testClosestParentAfterLastLine();
testClosestParentBeforeMultipleLines();
testClosestParentAfterMultipleLines();
testClosestParentInVariable();
testClosestParentInFunctionCall();
