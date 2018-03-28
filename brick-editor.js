// load node modules
var recast = require("recast");
var estraverse = require("estraverse");

// EVENT HANDLERS

function backspaceHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var position = getPosition();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    if (selection) {
        editor.setValue(deleteSelected(ast, selection));
    }
    else {
        if (cursorAtEndOfBlock(buffer, position)) {
            if (confirmDelete()) {
                editor.setValue(deleteBlock(ast, position));
            } else {
                // delete char
                editor.setValue(deleteChar(buffer, position));
                editor.setPosition(position);
            }
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
    var selection = getSelection;
    if (editor.getModel().getValueInRange(selection)) {
        return selection;
    }
    return null;
}

function highlight(startLine, startColumn, endLine, endColumn) {
    decorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(startLine, startColumn, endLine, endColumn),
            options: { isWholeLine: true, className: 'highlight' }
        }
    ]);
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
 * Find the immediately previous sibling to the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} positions - A lineNumber and column object.
 * @returns {node} 
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
            if ((node.type == "IfStatement" ||
                node.type == "ForStatement" ||
                node.type == "FunctionDeclaration" ||
                node.type == "WhileStatement" ||
                node.type == "VariableDeclaration" ||
                node.type == "ExpressionStatement") &&
                position.lineNumber == node.loc.end.line && position.column == node.loc.end.column) {
                highlight(node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column);
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
    var startPosition = { lineNumber: selectionPosition.startLineNumber, column: selectionPosition.startColumn };
    var endPosition = { lineNumber: selectionPosition.endLineNumber, column: selectionPosition.endColumn };
    var parentNode = findClosestParent(ast, startPosition);
    if (findClosestParent(ast, startPosition) == findClosestParent(ast, endPosition)) {
        // if selection is a block, delete the block using deleteBlock
        return deleteBlock(ast, parentNode.loc.end);
    } else {
        var positions = [startPosition, endPosition];
        parentNode = findClosestCommonParent(ast, positions);
        return deleteBlock(ast, parentNode.loc.end);
    }
    return buffer;
}

/**
 * Delete a node
 * @param {Position} position - The position of the cursor.
 * @returns {string} Text with block removed
 */
function deleteBlock(ast, position) {
    estraverse.replace(ast.program, {
        leave: function (node) {
            if (position.lineNumber == node.loc.end.line && position.column == node.loc.end.column) {
                this.remove();
            }
        }
    });

    return recast.print(ast).code;
}

/**
 * Delete a character
 * 
 */
function deleteChar(buffer, position) {
    var beginPosition = { lineNumber: position.lineNumber, column: position.column - 1 }
    console.log(position.column - 1);
    var firstPart = getBeforePosition(buffer, beginPosition);
    var lastPart = getAfterPosition(buffer, position);
    return [firstPart, lastPart].join('');
}

/**
 * Confirm delete
 */
function confirmDelete(position){
    setTimeout(function () {
        var response = confirm("Are you sure you wish to delete?");
        if (response) {
            editor.setValue(deleteBlock(position));
        }
    }, 100);
}

    }
    
    return prevSibling;
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
