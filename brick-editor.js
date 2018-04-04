/* global require, module, editor, blockDict */

// load node modules
var recast = require("recast");
var estraverse = require("estraverse");

// USER INTERFACE CODE

/**
 * Adds the HTML blocks to the button container
 *
 * @returns {undefined}
 */
function addBlocksHTML() { // eslint-disable-line no-unused-vars
    for (var i = 0; i < blockDict.length; i++) {
        var HTMLfunction = "buttonHandler('" + i + "')";

        // creates button and sets all attributes
        var block = document.createElement("button");
        block.setAttribute("type", "button");
        block.setAttribute("class", "addBlockButton");
        block.appendChild(document.createTextNode(blockDict[i]["blockName"]));
        block.setAttribute("style", "background-color:" + blockDict[i]["buttonColor"]);
        block.setAttribute("onclick", HTMLfunction);

        // adds the new button inside the buttonContainer class at end
        var buttonContainer = document.getElementById("buttonContainer");
        buttonContainer.appendChild(block);

        // adds a break element to make a column of blocks
        buttonContainer.appendChild(document.createElement("br"));
    }
}

// EVENT HANDLERS

/**
 * Handles button clicks
 *
 * @param {number} i - Index of code in dictionary
 * @returns {undefined}
 */
function buttonHandler(i) { // eslint-disable-line no-unused-vars
    var template = blockDict[i]["code"];
    var ast = recast.parse(editor.getValue());
    var position = getPosition();

    // add block to buffer string and update editor
    var new_text = addBlock(template, ast, position);
    ast = recast.parse(new_text);
    editor.setValue(recast.print(ast).code);
   
    // update cursor position
    // FIXME calculate new position
    setPosition(position);
}

// EDITOR INTERFACE CODE

/**
 * Get the cursor position in the editor.
 *
 * Note monaco line number starts at 0, while recast line number starts at 1.
 * The result of this function, and all functions here, follow the recast
 * numbering.
 *
 * @returns {Location} The line and column number of the cursor
 */
function getPosition() {
    var position = editor.getPosition();
    position.column = position.column - 1;
    return position;
}

/**
 * Get the cursor position in the editor.
 *
 * Note monaco line number starts at 0, while recast line number starts at 1.
 * The input of this function follows the recast numbering.
 *
 * @param {Location} position - A LineNumber and Column object.
 * @returns {undefined}
 */
function setPosition(position) {
    position.column = position.column + 1;
    editor.setPosition(position);
}

// TEXT EDITING CODE

/**
 * Find the closest shared parent between multiple positions.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {[Location]} positions - List of LineNumber and Column objects.
 * @returns {node} parentNode
 */
function findClosestCommonParent(ast, positions) {
    var parentNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            for (var i = 0; i < positions.length; i++) {
                if (node.loc.start.line > positions[i]["lineNumber"]) {
                    this.break();
                }
                if (node.loc.start.line <= positions[i]["lineNumber"] && node.loc.end.line >= positions[i]["lineNumber"]) {
                    if ((node.type === "BlockStatement" || node.type === "Program")) {
                        if (node.loc.start.line == positions[i]["lineNumber"]) {
                            if (node.loc.start.column <= positions[i]["column"]) {
                                numNodesCommonParent++;
                            }
                        } else if (node.loc.end.line == positions[i]["lineNumber"]) {
                            if (node.loc.end.column > positions[i]["column"]) {
                                numNodesCommonParent++;
                            }
                        } else {
                            numNodesCommonParent++;
                        }
                    }
                } 
            }
            if (numNodesCommonParent == positions.length) {
                parentNode = node;
            }
        }
    });
    // if no parentNode found, then position is after last character and parentNode = "Program"
    if (parentNode == null) {
        parentNode = ast.program;
    }
    return parentNode;
}

/**
 * Find the closest parent node that contains the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} position - A LineNumber and Column object.
 * @returns {node} - The AST node of the parent.
 */
function findClosestParent(ast, position) {
    return findClosestCommonParent(ast, [position]);
}

/**
 * Find the immediately previous sibling to the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} position - A lineNumber and column object.
 * @returns {node} - The AST node of the sibling.
 */
function findPreviousSibling(ast, position) {
    var parentNode = findClosestParent(ast, position);
    var prevSibling = null;
    // loop through index
    for (var i = 0; i < parentNode.body.length; i++) {
        // make node the ith node in the body
        var node = parentNode.body[i];
        // if the node is before the cursor ==> prevSibling
        if (node.loc.end.line < position.lineNumber) {
            prevSibling = node;
            // if node is same line as cursor
        } else if (node.loc.end.line == position.lineNumber) {
            // check if node ends before or at cursor
            if (node.loc.end.column <= position.column) {
                prevSibling = node;
            }
            // if node starts on line after cursor ==> break
        } else if (node.loc.start.line > position.lineNumber) {
            break;
        }
    }
    
    return prevSibling;
}

/**
 * Adds a block based on button keyword
 *
 * @param {string} template - A string of block of text to add.
 * @param {AST} ast - Parsed text from the editor.
 * @param {Position} position - A lineNumber and column object.
 * @returns {buffer} Updated text string
 */
function addBlock(template, ast, position) {
    // findPreviousSibling location
    var prevSibling = findPreviousSibling(ast, position);
    var parentNode = null;
    if (prevSibling) {
        var pos = { lineNumber: prevSibling.loc.start.line, column: prevSibling.loc.start.column };
        parentNode = findClosestParent(ast, pos);
    } else {
        parentNode = findClosestParent(ast, position);
    }
    // parse template
    var parsedTemplate = recast.parse(template);
    // parentNode should be pointer, so just append
    var index = parentNode.body.indexOf(prevSibling);
    parentNode.body.splice(index + 1, 0, parsedTemplate.program.body[0]);
    // return buffer
    return recast.print(ast).code;
}

// Attempt to export the module for testing purposes. If we get a
// ReferenceError on "module", assume we're running a browser and ignore it.
// Re-throw all other errors.
try {
    module.exports = {
        "findClosestCommonParent": findClosestCommonParent,
        "findClosestParent": findClosestParent,
        "findPreviousSibling": findPreviousSibling,
    };
} catch (error) {
    if (!(error instanceof ReferenceError)) {
        throw error;
    }
    var undefinedReference = error.message.split(" ")[0];
    if (undefinedReference !== "module") {
        throw error;
    }
}
