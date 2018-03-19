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

function testClosestParentAfterFunctionDefinition() {
    var ast = recast.parse([
        "function log(s) {",
        "    console.log(s);",
        "}",
    ].join("\n"));
    var position = {
        "line": 3,
        "column": 1
    }
    var parent_node = brickEditor.findClosestParent(ast, position);
    assertEqual(parent_node.program.type, "Program", "Block type is wrong");
    assertEqual(parent_node.program.loc.start.line, 1, "Start line is wrong");
    assertEqual(parent_node.program.loc.start.column, 0, "Start line is wrong");
    assertEqual(parent_node.program.loc.end.line, 3, "End line is wrong");
    assertEqual(parent_node.program.loc.end.column, 1, "End column is wrong");
}

testClosestParentAfterFunctionDefinition();
