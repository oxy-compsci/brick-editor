/* global require, module, editor, blockDict, monaco*/

// NODE IMPORTS

var recast = require("recast");
var estraverse = require("estraverse");
var decorations = null;

// USER INTERFACE CODE

/**
 * Add the HTML blocks to the button container
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
        block.appendChild(document.createTextNode(blockDict[i].blockName));
        block.setAttribute("style", "background-color:" + blockDict[i].buttonColor);
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
 * Called when backspace key is pressed
 * @returns {undefined}
 */
function backspaceHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var cursor = getCursor();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    if (selection) {
        selectionBranch(ast, selection);
    } else if (cursorAtEndOfBlock(ast, cursor)) {
        blockBranch(ast, cursor);
    } else {
        charBackspaceBranch(buffer, cursor);
    }
}

/**
 * Called when delete key is pressed
 * @returns {undefined}
 */
function deleteHandler() {
    // if has selected, delete selected
    var selection = hasSelected();
    var cursor = getCursor();
    var buffer = editor.getValue();
    var ast = recast.parse(buffer);
    if (selection) {
        selectionBranch(ast, selection);
    } else if (cursorAtStartOfBlock(ast, cursor)) {
            blockBranch(ast, cursor);
    } else {
        charDeleteBranch(buffer, cursor);
    }
}

/**
 * Handle button clicks
 *
 * @param {number} i - Index of code in dictionary
 * @returns {undefined}
 */
function buttonHandler(i) { // eslint-disable-line no-unused-vars
    var template = blockDict[i].code;
    var ast = recast.parse(editor.getValue());
    var cursor = getCursor();

    // add block to buffer string and update editor
    var new_text = addBlock(template, ast, cursor);
    ast = recast.parse(new_text);
    editor.setValue(recast.print(ast).code);

    // update cursor position
    setCursor(cursor);
}

/**
 * Highlights and deletes selection
 *
 * The setTimeout() function is necessary to allow highlighting before confirm dialog popup
 *
 * @param {AST} ast - The root of the ast to search through.
 * @param {Location} selection - An object with start/end lineNumber and start/end column properties.
 * @returns {undefined}
 */
function selectionBranch(ast, selection) {
    var node = deleteSelected(ast, selection);
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

/**
 * Deletes a block
 *
 * The setTimeout() function is necessary to allow highlighting before confirm dialog popup
 *
 * @param {AST} ast - The root of the ast to search through.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function blockBranch(ast, cursor) {
    var node = findClosestDeletableBlock(ast, cursor);
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

/**
 * Backspace a character
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function charBackspaceBranch(buffer, cursor) {
    editor.setValue(backspaceChar(buffer, cursor));
    cursor.column = cursor.column - 1; // FIXME
    setCursor(cursor);
}

/**
 * Delete a character
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function charDeleteBranch(buffer, cursor) {
    editor.setValue(deleteChar(buffer, cursor));
    setCursor(cursor);
}



// EDITOR INTERFACE CODE

/**
 * Make a Cursor object.
 *
 * @param {int} line - The line number.
 * @param {int} col - The column number.
 * @returns {Cursor} - The Cursor object.
 */
function makeCursor(line, col) {
    return { "lineNumber": line, "column": col };
}

/**
 * Get the cursor in the editor.
 *
 * Note monaco line number starts at 0, while recast line number starts at 1.
 * The result of this function, and all functions here, follow the recast
 * numbering.
 *
 * @returns {Cursor} - The line and column of the cursor in the editor.
 */
function getCursor() {
    var cursor = editor.getPosition();
    cursor.column = cursor.column - 1;
    return cursor;
}

/**
 * Get the cursor in the editor.
 *
 * Note monaco line number starts at 0, while recast line number starts at 1.
 * The input of this function follows the recast numbering.
 *
 * @param {Cursor} cursor - The line and column of the cursor.
 * @returns {undefined}
 */
function setCursor(cursor) {
    cursor.column = cursor.column + 1;
    editor.setPosition(cursor);
}

/**
 * Get the positions of the selection in the editor
 * (Offsets the start and end columns by 1 to account for differences in column numbering between Recast and Monaco)
 *
 * @returns {Location} An object with start/end lineNumber and start/end column properties
 */
function getSelection() {
    var selectionPosition = editor.getSelection();
    selectionPosition.startColumn--;
    selectionPosition.endColumn--;
    return selectionPosition;
}

/**
 * Returns position of selection if selection exists
 * @returns {Location} An object with start/end lineNumber and start/end column properties
 */
function hasSelected() {
    var selection = getSelection();
    if (editor.getModel().getValueInRange(selection)) {
        return selection;
    } else {
        return null;
    }
}

/**
 * Highlights editor text based on start/end lineNumbers and start/end columns
 * @param {int} startLine - LineNumber where range will start
 * @param {int} startColumn - Column where range will start
 * @param {int} endLine - LineNumber where range will end
 * @param {int} endColumn - Column where range will end
 * @returns {undefined}
 */
function highlight(startLine, startColumn, endLine, endColumn) {
    decorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(startLine, startColumn, endLine, endColumn),
            options: { isWholeLine: false, className: "highlight" }
        }
    ]);
}

/**
 * Removes all decorations and highlighting from the editor
 * @returns {undefined}
 */
function unhighlight() {
    decorations = editor.deltaDecorations(decorations, []);
}

// TEXT EDITING CODE

/**
 * Find the closest shared parent between multiple cursors.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {[Cursor]} cursors - A list of Cursor objects.
 * @returns {AST} - The parent node.
 */
function findClosestCommonParent(ast, cursors) {
    var parentNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            for (var i = 0; i < cursors.length; i++) {
                if (node.loc.start.line > cursors[i].lineNumber) {
                    this.break();
                }
                if (node.loc.start.line <= cursors[i].lineNumber && node.loc.end.line >= cursors[i].lineNumber) {
                    if ((node.type === "BlockStatement" || node.type === "Program")) {
                        if (node.loc.start.line === cursors[i].lineNumber) {
                            if (node.loc.start.column <= cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else if (node.loc.end.line === cursors[i].lineNumber) {
                            if (node.loc.end.column > cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else {
                            numNodesCommonParent++;
                        }
                    }
                }
            }
            if (numNodesCommonParent === cursors.length) {
                parentNode = node;
            }
        }
    });
    // if no parentNode found, then cursor is after last character and parentNode = "Program"
    if (parentNode === null) {
        parentNode = ast.program;
    }
    return parentNode;
}

/**
 * Find the closest parent node that contains the cursor.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {Cursor} cursor - The line and column of the cursor.
 * @returns {AST} - The AST node of the parent.
 */
function findClosestParent(ast, cursor) {
    return findClosestCommonParent(ast, [cursor]);
}

/**
 * Find the closest parent node that is able to be deleted.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {[Cursor]} cursors - A list of cursors.
 * @returns {AST} - The AST node of the sibling.
 */
function findClosestCommonDeletableBlock(ast, cursors) {
    var deleteNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            for (var i = 0; i < cursors.length; i++) {
                if (node.loc.start.line > cursors[i].lineNumber) {
                    this.break();
                }
                if (node.loc.start.line <= cursors[i].lineNumber && node.loc.end.line >= cursors[i].lineNumber) {
                    if ((node.type === "IfStatement" ||
                        node.type === "ForStatement" ||
                        node.type === "FunctionDeclaration" ||
                        node.type === "WhileStatement" ||
                        node.type === "ExpressionStatement" ||
                        node.type === "ReturnStatement" ||
                        node.type === "VariableDeclaration")) {
                        if (node.loc.start.line === cursors[i].lineNumber) {
                            if (node.loc.start.column <= cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else if (node.loc.end.line === cursors[i].lineNumber) {
                            if (node.loc.end.column >= cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else {
                            numNodesCommonParent++;
                        }
                    }
                }
            }
            if (numNodesCommonParent === cursors.length) {
                deleteNode = node;
            }
        }
    });
    // if no parentNode found, then position is after last character and parentNode = "Program"
    if (deleteNode === null) {
        deleteNode = ast.program;
    }
    return deleteNode;
}

/**
 * Find the closest deletable block that contains the position.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {node} - deletable node
 */
function findClosestDeletableBlock(ast, cursor) {
    return findClosestCommonDeletableBlock(ast, [cursor]);
}

/**
 * Find the immediate previous sibling to the position.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {node} - The AST node of the sibling.
 */
function findPreviousSibling(ast, cursor) {
    var parentNode = findClosestParent(ast, cursor);
    var prevSibling = null;
    // loop through index
    for (var i = 0; i < parentNode.body.length; i++) {
        // make node the ith node in the body
        var node = parentNode.body[i];
        // if the node is before the cursor ==> prevSibling
        if (node.loc.end.line < cursor.lineNumber) {
            prevSibling = node;
            // if node is same line as cursor
        } else if (node.loc.end.line === cursor.lineNumber) {
            // check if node ends before or at cursor
            if (node.loc.end.column <= cursor.column) {
                prevSibling = node;
            }
            // if node starts on line after cursor ==> break
        } else if (node.loc.start.line > cursor.lineNumber) {
            break;
        }
    }
    return prevSibling;
}

/**
 * Find whether cursor is at end of block
 * @param {AST} ast - The root of the ast to search through.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {boolean} Is cursor at end of block?
 */
function cursorAtEndOfBlock(ast, cursor) {
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
                cursor.lineNumber === node.loc.end.line && cursor.column === node.loc.end.column) {
                endOfBlock = true;
            }
        }
    });
    return endOfBlock;
}

/**
 * Find whether cursor is at beginning of block
 * @param {AST} ast - The root of the ast to search through.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {boolean} Is cursor at beginning of block?
 */
function cursorAtStartOfBlock(ast, cursor) {
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
                cursor.lineNumber === node.loc.start.line && cursor.column === node.loc.start.column) {
                begOfBlock = true;
            }
        }
    });
    return begOfBlock;
}

// DELETING FUNCTIONS

/**
 * Delete selected text
 * @param {AST} ast - The root of the ast to delete from.
 * @param {[Location]} selectionPosition - Start line and column, end line and column of selection
 * @returns {string} buffer
 */
function deleteSelected(ast, selectionPosition) {
    var startCursor = makeCursor(selectionPosition.startLineNumber, selectionPosition.startColumn);
    var endCursor = makeCursor(selectionPosition.endLineNumber, selectionPosition.endColumn);
    var node = null;
    if (findClosestDeletableBlock(ast, startCursor) === findClosestDeletableBlock(ast, endCursor)) {
        node = findClosestDeletableBlock(ast, startCursor);
    } else {
        node = findClosestCommonDeletableBlock(ast, [startCursor, endCursor]);
    }
    return node;
}

/**
 * Delete a node
 * @param {AST} ast - The parsed text.
 * @param {node} node - The node to delete.
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
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {string} Updated buffer text
 */
function backspaceChar(buffer, cursor) {
    var beginPosition = { lineNumber: cursor.lineNumber, column: cursor.column - 1 };
    var firstPart = getBeforeCursor(buffer, beginPosition);
    var lastPart = getAfterCursor(buffer, cursor);
    return [firstPart, lastPart].join("");
}

/**
 * Delete a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {string} Updated buffer text
 */
function deleteChar(buffer, cursor) {
    var endPosition = { lineNumber: cursor.lineNumber, column: cursor.column + 1 };
    var firstPart = getBeforeCursor(buffer, cursor);
    var lastPart = getAfterCursor(buffer, endPosition);
    return [firstPart, lastPart].join("");
}

// ADDING FUNCTIONS

/**
 * Add a block based on button keyword
 *
 * @param {string} template - A string of block of text to add.
 * @param {AST} ast - Parsed text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor.
 * @returns {buffer} Updated text string
 */
function addBlock(template, ast, cursor) {
    var prevSibling = findPreviousSibling(ast, cursor);
    var parentNode = null;
    if (prevSibling) {
        var pos = makeCursor(prevSibling.loc.start.line, prevSibling.loc.start.column);
        parentNode = findClosestParent(ast, pos);
    } else {
        parentNode = findClosestParent(ast, cursor);
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
 * Return a string containing characters before cursor position
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {string} A string of text before cursor position.
 */
function getBeforeCursor(buffer, cursor) {
    var splitBuffer = buffer.split("\n");
    var firstPart = splitBuffer.slice(0, cursor.lineNumber - 1);
    var sameLine = splitBuffer.slice(cursor.lineNumber - 1, cursor.lineNumber).join("");
    sameLine = sameLine.split("");
    sameLine = sameLine.slice(0, cursor.column).join("");
    firstPart.push(sameLine);

    return firstPart.join("\n");
}

/**
 * Return a string containing characters after cursor position
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {string} A string of text after cursor cursor.
 */
function getAfterCursor(buffer, cursor) {
    var splitBuffer = buffer.split("\n");
    var lastPart = splitBuffer.slice(cursor.lineNumber);
    var sameLine = splitBuffer.slice(cursor.lineNumber - 1, cursor.lineNumber).join("");
    sameLine = sameLine.split("");
    sameLine = sameLine.slice(cursor.column).join("");
    lastPart.unshift(sameLine);

    return lastPart.join("\n");
}

// Attempt to export the module for testing purposes. If we get a
// ReferenceError on "module", assume we're running a browser and ignore it.
// Re-throw all other errors.
try {
    module.exports = {
        "makeCursor": makeCursor,
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
