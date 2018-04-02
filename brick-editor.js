// load node modules
var recast = require("recast");
var estraverse = require("estraverse");
var decorations = null;

// EVENT HANDLERS

function backspaceHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var position = getPosition();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    var parentNode = null;
    var prevSibling = null;
    if (selection) {
        var nodes = deleteSelected(ast, selection);
        parentNode = nodes[0];
        prevSibling = nodes[1];
        console.log(selection);
        console.log('parentNode', parentNode, parentNode.loc);
        console.log('prevSib', prevSibling, prevSibling.loc);
        highlight(prevSibling.loc.start.line, prevSibling.loc.start.column, prevSibling.loc.end.line, prevSibling.loc.end.column);
        setTimeout(function () {
            var response = confirm("Are you sure you wish to delete?");
            if (response) {
                editor.setValue(deleteBlock(ast, parentNode, prevSibling));
            } else {
                unhighlight();
            }
        }, 100);
    }
    else {
        if (cursorAtEndOfBlock(ast, position)) {
            parentNode = findClosestParent(ast, position);
            prevSibling = findPreviousSibling(ast, position);
            highlight(prevSibling.loc.start.line, prevSibling.loc.start.column, prevSibling.loc.end.line, prevSibling.loc.end.column);
            setTimeout(function () {
                var response = confirm("Are you sure you wish to delete?");
                if (response) {
                    editor.setValue(deleteBlock(ast, parentNode, prevSibling));
                } else {
                    unhighlight();
                }
            }, 100);
        } else {
            console.log('delete char');
            // delete char 
            editor.setValue(deleteChar(buffer, position));
            setPosition(position);
        }
    }
}

function deleteHandler() {

}

// EDITOR INTERFACE CODE

function getPosition() {
    var position = editor.getPosition();
    position.column = position.column - 1;
    return position;
}

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

function confirmDelete() {
    setTimeout(function () {
        var response = confirm("Are you sure you wish to delete?");
        if (response) {
            return true;
        }
        return false;
    }, 100);
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
    })
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
 * @param {Location} position - A lineNumber and column object.
 * @returns {node} 
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
    var parentNode = null;
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
                        node.type === "WhileStatement")) {
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
                parentNode = node;
            }
        }
    })
    // if no parentNode found, then position is after last character and parentNode = "Program"
    if (parentNode == null) {
        parentNode = ast.program;
    }
    return parentNode;
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
 * @param {Location} positions - A lineNumber and column object.
 * @returns {node} 
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
    var parentNode = null;
    var prevSibling = null;
    if (findClosestDeletableBlock(ast, startPosition) === findClosestDeletableBlock(ast, endPosition)) {
        prevSibling = findClosestDeletableBlock(ast, startPosition);
        parentNode = findClosestParent(ast, startPosition);
    } else {
        prevSibling = findClosestCommonDeletableBlock(ast, [startPosition, endPosition]);
        parentNode = findClosestCommonParent(ast, [{ "lineNumber": prevSibling.loc.start.line, "column": prevSibling.loc.start.column }, { "lineNumber": prevSibling.loc.end.line, "column": prevSibling.loc.end.column }]);
    }
    return [parentNode, prevSibling]; 
}

/**
 * Delete a node
 * @param {ast} AST - The parsed text.
 * @param {node} parentNode - The parent node to delete from.
 * @param {node} prevSibling - The sibling node to reference from.
 * @returns {string} Text with block removed
 */
function deleteBlock(ast, parentNode, prevSibling) {
    if (prevSibling) {
        var index = parentNode.body.indexOf(prevSibling);
        parentNode.body.splice(index, 1);
        parentNode.body.splice(index, 0, " ");
    } else {
        parentNode.body.splice(0, 1);
        parentNode.body.splice(0, 0, " ");
    }
    return recast.print(ast).code;
}

/**
 * Delete a character
 * 
 */
function deleteChar(buffer, position) {
    var beginPosition = { lineNumber: position.lineNumber, column: position.column }
    console.log(position.column - 1);
    var firstPart = getBeforePosition(buffer, beginPosition);
    var lastPart = getAfterPosition(buffer, position);
    return [firstPart, lastPart].join('');
}


/**
 * Handles button clicks
 * @param {number} i - Index of code in dictionary
 */
function buttonHandler(i) {
    var template = blockDict[i]["code"];
    var ast = recast.parse(editor.getValue());
    var position = getPosition();

    // add block to buffer string and update editor
    var new_text = addBlock(template, ast, position);
    var ast = recast.parse(new_text);
    editor.setValue(recast.print(ast).code);
   
    // update cursor position
    setPosition(position);
}

/**
 * Adds a block based on button keyword
 * @param {string} template - A string of block of text to add.
 * @param {ast} AST - Parsed text from the editor.
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
    index = parentNode.body.indexOf(prevSibling);
    parentNode.body.splice(index + 1, 0, parsedTemplate.program.body[0]);
    // return buffer
    return recast.print(ast).code;
}

/**
 * Adds the HTML blocks to the button container
 */
function addBlocksHTML() {
    for (var i = 0; i < blockDict.length; i++) {
        var HTMLfunction = 'buttonHandler(\'' + i + '\')';

        // creates button and sets all attributes
        var block = document.createElement("button");
        block.setAttribute("type", "button");
        block.setAttribute("class", "addBlockButton");
        block.appendChild(document.createTextNode(blockDict[i]['blockName']));
        block.setAttribute("style", "background-color:" + blockDict[i]['buttonColor']);
        block.setAttribute("onclick", HTMLfunction);

        // adds the new button inside the buttonContainer class at end
        var buttonContainer = document.getElementById("buttonContainer");
        buttonContainer.appendChild(block);

        // adds a break element to make a column of blocks
        buttonContainer.appendChild(document.createElement("br"));
    }
}

// attempt to export the module for testing purposes
// if this fails, we're running a browser, so we just ignore the error
try {
    module.exports = { 
        findClosestCommonParent,
        findClosestParent,
        findPreviousSibling,
        getIndent, 
        indentCode, 
        getBeforePosition, 
        getAfterPosition
    }; 
} catch (referenceError) {
}
