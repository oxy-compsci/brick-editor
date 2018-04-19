/* global require, module, editor, editorState, blockDict, monaco */

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
 *
 * @returns {undefined}
 */
function backspaceHandler() { // eslint-disable-line no-unused-vars
    if (getSelected()) {
        onRangeDelete();
    } else {
        onPointBackspace();
    }
}

/**
 * Called when delete key is pressed
 *
 * @returns {undefined}
 */
function deleteHandler() { // eslint-disable-line no-unused-vars
    if (getSelected()) {
        onRangeDelete();
    } else {
        onPointDelete();
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
    var ast = attemptParse(editor.getValue());
    var cursor = getCursor();

    // add block to buffer string and update editor
    var new_text = addBlock(template, ast, cursor);
    ast = attemptParse(new_text);
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
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function charBackspaceBranch(buffer, cursor) {
    editor.setValue(backspaceChar(buffer, cursor));
    cursor.column = cursor.column - 1;
    setCursor(cursor);
}

/**
 * Delete a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function charDeleteBranch(buffer, cursor) {
    editor.setValue(deleteChar(buffer, cursor));
    setCursor(cursor);
}

// EDITING HANDLERS

/**
 * Handler for any text on a cursor.
 *
 * @returns {undefined}
 */
function onPointInsert() {
    console.log("on point insert"); // eslint-disable-line no-console
    updateEditorState();
}

/**
 * Handler for backspace on a cursor.
 *
 * @returns {undefined}
 */
function onPointBackspace() {
    console.log("on point backspace"); // eslint-disable-line no-console
    if (attemptParse(editor.getValue())) {
        var cursor = getCursor();
        var buffer = editor.getValue();
        var ast = attemptParse(buffer);
        if (cursorAtEndOfBlock(ast, cursor)) {
            blockBranch(ast, cursor);
        } else {
            charBackspaceBranch(buffer, cursor);
        }
    }
    updateEditorState();
}

/**
 * Handler for delete on a cursor.
 *
 * @returns {undefined}
 */
function onPointDelete() {
    console.log("on point delete"); // eslint-disable-line no-console
    if (attemptParse(editor.getValue())) {
        var cursor = getCursor();
        var buffer = editor.getValue();
        var ast = attemptParse(buffer);
        if (cursorAtStartOfBlock(ast, cursor)) {
            blockBranch(ast, cursor);
        } else {
            charDeleteBranch(buffer, cursor);
        }
    }
    updateEditorState();
}

/**
 * Handler for any text on a selection.
 *
 * @returns {undefined}
 */
function onRangeReplace() {
    console.log("on range replace"); // eslint-disable-line no-console
    updateEditorState();
}

/**
 * Handler for any deletion of a selection.
 *
 * @returns {undefined}
 */
function onRangeDelete() {
    console.log("on range delete"); // eslint-disable-line no-console
    if (attemptParse(editor.getValue())) {
        var selection = getSelected();
        var ast = attemptParse(editor.getValue());
        selectionBranch(ast, selection);
    }
    updateEditorState();
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
    if (line < 1) {
        throw "line must be a positive integer, but got " + col;
    }
    if (col < 0) {
        throw "col must be a non-negative integer, but got " + col;
    }
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
 * Returns position of selection if selection exists.
 *
 * @returns {[Cursor]} - A list of two Cursors defining the selection.
 */
function getSelected() {
    var selectionObject = editor.getSelection();
    var selection = [
        makeCursor(selectionObject.startLineNumber, selectionObject.startColumn - 1),
        makeCursor(selectionObject.endLineNumber, selectionObject.endColumn - 1),
    ];
    if (selection[0].lineNumber !== selection[1].lineNumber
        || selection[0].column !== selection[1].column) {
        return selection;
    } else {
        return null;
    }
}

/**
 * Highlights editor text based on start/end lineNumbers and start/end columns
 *
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
 *
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
 *
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
 *
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
 *
 * @param {AST} ast - The root of the ast to delete from.
 * @param {[Cursor]} selection - List of start and end Cursors.
 * @returns {string} buffer
 */
function deleteSelected(ast, selection) {
    var node = null;
    if (findClosestDeletableBlock(ast, selection[0]) === findClosestDeletableBlock(ast, selection[1])) {
        node = findClosestDeletableBlock(ast, selection[0]);
    } else {
        node = findClosestCommonDeletableBlock(ast, selection);
    }
    return node;
}

/**
 * Delete a node
 *
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
    var beginCursor = makeCursor(cursor.lineNumber, cursor.column - 1);
    var sections = splitAtCursors(buffer, [beginCursor, cursor]);
    return [sections[0], sections[2]].join("");
}

/**
 * Delete a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {string} Updated buffer text
 */
function deleteChar(buffer, cursor) {
    var endCursor = makeCursor(cursor.lineNumber, cursor.column + 1);
    var sections = splitAtCursors(buffer, [cursor, endCursor]);
    return [sections[0], sections[2]].join("");
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
    var parsedTemplate = attemptParse(template);
    // parentNode should be pointer, so just append
    var index = parentNode.body.indexOf(prevSibling);
    parentNode.body.splice(index + 1, 0, parsedTemplate.program.body[0]);
    // update editor state
    updateEditorState();
    // return buffer
    return recast.print(ast).code;
}

// BUFFER MANIPULATION FUNCTIONS

/**
 * Split a string into sections delimited by Cursors.
 * 
 * @param {string} buffer - A string of text from the editor.
 * @param {[Cursor]} cursors - Non-empty list of cursors.
 * @returns {[string]} - List of sections of the original string.
 */
function splitAtCursors(buffer, cursors) {
    var positions = [];
    var cursors_index = 0;
    // augment positions with a fake cursor at the start
    positions.push(0);
    // deal with cursors before the start of the string
    while (cursors[cursors_index].lineNumber < 1) {
        positions.push(0);
        cursors_index++;
    }
    // convert all cursors to character positions
    var lines = buffer.split("\n");
    var line_num = 0;
    var num_characters = 0;
    for (; cursors_index < cursors.length; cursors_index++) {
        var cursor = cursors[cursors_index];
        // add non-cursor lines to the current section
        while (line_num < lines.length && line_num + 1 < cursor.lineNumber) {
            num_characters += lines[line_num].length + 1;
            line_num++;
        }
        // add the cursor position to the list
        if (num_characters + cursor.column < buffer.length) {
            positions.push(num_characters + cursor.column);
        } else {
            positions.push(buffer.length);
        }
    }
    // augment positions with a fake cursor at the end
    positions.push(buffer.length);
    // loop over them to get sections
    var sections = [];
    for (var i = 0; i < positions.length - 1; i++) {
        sections.push(buffer.substring(positions[i], positions[i + 1]));
    }
    return sections;
}

/**
 * Callback function whenever the cursor moves.
 *
 * @param {Event} e - the cursor movement event.
 * @returns {undefined}
 */
function onDidChangeCursorSelection(e) { // eslint-disable-line no-unused-vars

    /*
    console.log("ondidchangecursorselection");
    console.log("    source:", e.source);
    console.log("    reason:", e.reason);
    var selection = e.selection;
    console.log("    [" +
        selection.startLineNumber
        + ":" + 
        selection.startColumn
        + ", " + 
        selection.endLineNumber
        + ":" + 
        selection.endColumn
        + "]"
    );
    */

    if (e.source === "mouse") {
        updateEditorState();
    } else if (e.source === "keyboard") {
        if (e.reason === 4) { // pasted
            if (editorState.hasSelected) {
                onRangeReplace();
            } else {
                onPointInsert();
            }
        } else if (e.reason === 3) { // arrow key movement
            updateEditorState();
        } else if (e.reason === 0) { // cut or type
            if (!editorState.hasSelected) { // typed at cursor
                onPointInsert();
            } else {
                var sections = splitAtCursors(editorState.parsableText, editorState.cursor);
                if (editor.getValue().length > sections[0].length + sections[2].length) {
                    onRangeReplace(); // typed over range
                } else {
                    onRangeDelete(); // cut
                }
            }
        }
    }
}

/**
 * Attempt to parse JavaScript code.
 *
 * @param {string} text - The text to parse.
 * @returns {AST} - The parsed AST, or null if unparsable.
 */
function attemptParse(text) {
    try {
        console.log("parse succeeded!"); // eslint-disable-line no-console
        return recast.parse(text);
    } catch (e) {
        console.log("parse failed!"); // eslint-disable-line no-console
        return null;
    }
}

/**
 * Update the editor state.
 *
 * @returns {undefined}
 */
function updateEditorState() {
    var buffer = editor.getValue();
    var ast = attemptParse(buffer);
    if (ast) {
        editorState.parsable = true;
        editorState.parse = ast;
        editorState.parsableText = buffer;
        var selected = getSelected();
        if (selected) {
            editorState.hasSelected = true;
            editorState.cursor = selected;
            editorState.sections = splitAtCursors(buffer, selected);
            console.log(editorState.cursor[0], editorState.cursor[1]); // eslint-disable-line no-console
        } else {
            editorState.hasSelected = false;
            editorState.cursor = getCursor();
            editorState.sections = splitAtCursors(buffer, [editorState.cursor]);
            console.log(editorState.cursor); // eslint-disable-line no-console
        }
    } else {
        editorState.parsable = false;
    }
}

// Attempt to export the module for testing purposes. If we get a
// ReferenceError on "module", assume we're running a browser and ignore it.
// Re-throw all other errors.
try {
    module.exports = {
        "makeCursor": makeCursor,
        "splitAtCursors": splitAtCursors,
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
