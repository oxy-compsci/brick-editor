/* global require, module, editor, blockDict */

// load node modules
var recast = require("recast");
var estraverse = require("estraverse");
var decorations = null;

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

function backspaceHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var position = getPosition();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    var node = null;
    if (selection) {
        node = deleteSelected(ast, selection);
        highlight(node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column);
        setTimeout(function () {
            var response = confirm("Are you sure you wish to delete?");
            if (response) {
                editor.setValue(deleteBlock(ast, node));
            } else {
                unhighlight();
            }
        }, 100);
    }
    else {
        if (cursorAtEndOfBlock(ast, position)) {
            node = findClosestDeletableBlock(ast, position);
            highlight(node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column);
            setTimeout(function () {
                var response = confirm("Are you sure you wish to delete?");
                if (response) {
                    editor.setValue(deleteBlock(ast, node));
                } else {
                    unhighlight();
                }
            }, 100);
        } else {
            // delete char 
            editor.setValue(backspaceChar(buffer, position));
            position.column = position.column - 1;
            setPosition(position);
        }
    }
}

function deleteHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var position = getPosition();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    var node = null;
    if (selection) {
        node = deleteSelected(ast, selection);
        highlight(node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column);
        setTimeout(function () {
            var response = confirm("Are you sure you wish to delete?");
            if (response) {
                editor.setValue(deleteBlock(ast, node));
            } else {
                unhighlight();
            }
        }, 100);
    }
    else {
        if (cursorAtBegOfBlock(ast, position)) {
            node = findClosestDeletableBlock(ast, position);
            highlight(node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column);
            setTimeout(function () {
                var response = confirm("Are you sure you wish to delete?");
                if (response) {
                    editor.setValue(deleteBlock(ast, node));
                } else {
                    unhighlight();
                }
            }, 100);
        } else {
            // delete char 
            editor.setValue(deleteChar(buffer, position));
            setPosition(position);
        }
    }
}

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


function getSelection() {
    var selectionPosition = editor.getSelection();
    selectionPosition.startColumn--;
    selectionPosition.endColumn--;
    return selectionPosition;
}

function hasSelected() {
    var selection = getSelection();
    if (editor.getModel().getValueInRange(selection)) {
        return selection;
    }
    return null;
}

function highlight(startLine, startColumn, endLine, endColumn) {
    decorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(startLine, startColumn, endLine, endColumn),
            options: { isWholeLine: false, className: 'highlight' }
        }
    ]);
}

function unhighlight() {
    decorations = editor.deltaDecorations(decorations, []);
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
 * Find the closest parent node that is able to be deleted.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {[Location]} positions - List of lineNumber and column objects.
 * @returns {node} 
 */
function findClosestCommonDeletableBlock(ast, positions) {
    var deleteNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            for (var i = 0; i < positions.length; i++) {
                if (node.loc.start.line > positions[i]["lineNumber"]) {
                    this.break();
                }
                if (node.loc.start.line <= positions[i]["lineNumber"] && node.loc.end.line >= positions[i]["lineNumber"]) {
                    if ((node.type === "IfStatement" ||
                        node.type === "ForStatement" ||
                        node.type === "FunctionDeclaration" ||
                        node.type === "WhileStatement" ||
                        node.type === "ExpressionStatement" ||
                        node.type === "ReturnStatement" ||
                        node.type === "VariableDeclaration")) {
                        if (node.loc.start.line == positions[i]["lineNumber"]) {
                            if (node.loc.start.column <= positions[i]["column"]) {
                                numNodesCommonParent++;
                            }
                        } else if (node.loc.end.line == positions[i]["lineNumber"]) {
                            if (node.loc.end.column >= positions[i]["column"]) {
                                numNodesCommonParent++;
                            }
                        } else {
                            numNodesCommonParent++;
                        }
                    }
                }
            }
            if (numNodesCommonParent == positions.length) {
                deleteNode = node;
            }
        }
    })
    // if no parentNode found, then position is after last character and parentNode = "Program"
    if (deleteNode == null) {
        deleteNode = ast.program;
    }
    return deleteNode;
}

/**
 * Find the closest deletable block that contains the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} position - A lineNumber and column object.
 * @returns {node} 
 */
function findClosestDeletableBlock(ast, position) {
    return findClosestCommonDeletableBlock(ast, [position]);
}

/**
 * Find the immediate previous sibling to the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} position - A lineNumber and column object.
 * @returns {node} - The AST node of the sibling.
 */
function findPreviousSibling(ast, position) {
    var parentNode = findClosestParent(ast, position);
    var prevSibling = null;
    for (var i = 0; i < parentNode.body.length; i++) {
        var node = parentNode.body[i];
        if (node.loc.end.line < position.lineNumber) {
            prevSibling = node;
        } else if (node.loc.end.line == position.lineNumber) {
            if (node.loc.end.column <= position.column) {
                prevSibling = node;
            }
        } else if (node.loc.start.line > position.lineNumber) {
            break;
        }
    }
    return prevSibling;
}

/**
 * Find whether cursor is at end of block
 * @param {string} buffer - Text in the editor.
 * @param {position}
 * @returns {boolean}
 */
function cursorAtEndOfBlock(ast, position) {
    var endOfBlock = false;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            if ((node.type === "IfStatement" ||
                node.type === "ForStatement" ||
                node.type === "FunctionDeclaration" ||
                node.type === "WhileStatement" ||
                node.type === "VariableDeclaration" ||
                node.type === "ExpressionStatement" ||
                node.type === "ReturnStatement") &&
                position.lineNumber == node.loc.end.line && position.column == node.loc.end.column) {
                endOfBlock = true;
            }
        }
    });
    return endOfBlock;
}

/**
 * Find whether cursor is at beginning of block
 * @param {string} buffer - Text in the editor.
 * @param {position}
 * @returns {boolean}
 */
function cursorAtBegOfBlock(ast, position) {
    var begOfBlock = false;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            if ((node.type === "IfStatement" ||
                node.type === "ForStatement" ||
                node.type === "FunctionDeclaration" ||
                node.type === "WhileStatement" ||
                node.type === "VariableDeclaration" ||
                node.type === "ExpressionStatement" ||
                node.type === "ReturnStatement") &&
                position.lineNumber == node.loc.start.line && position.column == node.loc.start.column) {
                begOfBlock = true;
            }
        }
    });
    return begOfBlock;
}

// DELETING FUNCTIONS

/**
 * Delete selected text
 * @param {ast} AST - The parsed text to delete from.
 * @param {[Position]} selectionPosition - Start line and column, end line and column of selection
 * @returns {string} buffer
 */
function deleteSelected(ast, selectionPosition) {
    var startPosition = { "lineNumber": selectionPosition.startLineNumber, "column": selectionPosition.startColumn };
    var endPosition = { "lineNumber": selectionPosition.endLineNumber, "column": selectionPosition.endColumn };
    var node = null;
    if (findClosestDeletableBlock(ast, startPosition) === findClosestDeletableBlock(ast, endPosition)) {
        node = findClosestDeletableBlock(ast, startPosition);
    } else {
        node = findClosestCommonDeletableBlock(ast, [startPosition, endPosition]);
    }
    return node; 
}

/**
 * Delete a node
 * @param {ast} AST - The parsed text.
 * @param {node} parentNode - The parent node to delete from.
 * @param {node} prevSibling - The sibling node to reference from.
 * @returns {string} Text with block removed
 */
function deleteBlock(ast, node) {
    estraverse.replace(ast.program, {
        leave: function (currentNode) {
            if (currentNode === node) {
                this.remove();
            }
        }
    });
    return recast.print(ast).code;
}

/**
 * Backspace a character
 * 
 */
function backspaceChar(buffer, position) {
    var beginPosition = { lineNumber: position.lineNumber, column: position.column - 1 }
    var firstPart = getBeforePosition(buffer, beginPosition);
    var lastPart = getAfterPosition(buffer, position);
    return [firstPart, lastPart].join('');
}

/**
 * Delete a character
 * 
 */
function deleteChar(buffer, position) {
    var endPosition = { lineNumber: position.lineNumber, column: position.column + 1 }
    var firstPart = getBeforePosition(buffer, position);
    var lastPart = getAfterPosition(buffer, endPosition);
    return [firstPart, lastPart].join('');
}
  
// ADDING FUNCTIONS

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

// BUFFER MANIPULATION FUNCTIONS
  
/** 
 * Returns a string containing characters before cursor position 
 * @param {string} buffer - A string of text from the editor. 
 * @param {Position} position - A lineNumber and column object. 
 * @returns {string} A string of text before cursor position. 
 */
function getBeforePosition(buffer, position) {
    var splitBuffer = buffer.split("\n");
    var firstPart = splitBuffer.slice(0, position.lineNumber - 1);
    var sameLine = splitBuffer.slice(position.lineNumber - 1, position.lineNumber).join('');
    sameLine = sameLine.split('');
    sameLine = sameLine.slice(0, position.column).join('');
    firstPart.push(sameLine);

    return firstPart.join('\n');
} 

/** 
 * Returns a string containing characters after cursor position 
 * 
 * @param {string} buffer - A string of text from the editor. 
 * @param {Position} position - A lineNumber and column object. 
 * @returns {string} A string of text after cursor position. 
 */
function getAfterPosition(buffer, position) {
    var splitBuffer = buffer.split("\n");
    var lastPart = splitBuffer.slice(position.lineNumber);
    var sameLine = splitBuffer.slice(position.lineNumber - 1, position.lineNumber).join('');
    sameLine = sameLine.split('');
    sameLine = sameLine.slice(position.column).join('');
    lastPart.unshift(sameLine);

    return lastPart.join('\n');
}

// Attempt to export the module for testing purposes. If we get a
// ReferenceError on "module", assume we're running a browser and ignore it.
// Re-throw all other errors.
try {
    module.exports = {
        "findClosestCommonParent": findClosestCommonParent,
        "findClosestParent": findClosestParent,
        "findPreviousSibling": findPreviousSibling,
        "findClosestCommonDeletableBlock": findClosestCommonDeletableBlock,
        "findClosestDeletableBlock": findClosestDeletableBlock
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
