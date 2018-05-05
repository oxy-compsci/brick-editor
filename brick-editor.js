/* global require, module, editor, editorState, blockDict, monaco */

var BLOCK_DELETE_TYPES = [
    "IfStatement", 
    "ForStatement",
    "FunctionDeclaration",
    "WhileStatement",
    "ExpressionStatement",
    "ReturnStatement",
    "VariableDeclaration",
];

// NODE IMPORTS

var recast = require("recast");
var estraverse = require("estraverse");
var decorations = null;
var condDecorations = null;
var highlighted = false;
var highlightedParen = false;

/*********************************************
 *
 * SECTION: HIGH-LEVEL EVENTS
 *
 *********************************************/

/**
 * Handler for any text on a cursor.
 *
 * @returns {undefined}
 */
function onPointInsert() {
    console.log("on point insert"); // eslint-disable-line no-console
    // if editor is unparsable
    if (!attemptParse(editor.getValue())) {
        // if cursor is where editor became unparsable
        var cursor = getCursor();
        var buffer = editor.getValue();
        if (cursor.lineNumber == editorState.cursor.lineNumber) {
            // if cursor was inside parentheses
            if (editorState.openParenthesis && editorState.closeParenthesis) {
                // add one column position to editorState.parentheses because character was added but not accounted for
                if (!highlightedParen) {
                    editorState.parentheses[1].column += 1;
                    highlightParen(editorState.parentheses);
                }
                // if outside of parentheses currently
                if (positionFromStart(buffer, cursor) - 1 <= editorState.openParenthesis || positionFromEnd(buffer, cursor) <= editorState.closeParenthesis) {
                    editor.trigger("", "undo");
                } else {
                    editorState.parentheses[1].column = editorState.parentheses[1].column + 1;
                }
            }
        } else {
            editor.trigger("", "undo");
        }
    }
    updateEditorState();
}

/**
 * Handler for backspace on a cursor.
 *
 * @returns {undefined}
 */
function onPointBackspace() {
    console.log("on point backspace"); // eslint-disable-line no-console
    var buffer = editor.getValue();
    var cursor = getCursor();
    if (attemptParse(buffer)) {
        var oneBack = makeCursor(cursor.lineNumber, cursor.column - 1);
        var ast = attemptParse(buffer);
        if (cursorAtEndOfBlock(ast, cursor, BLOCK_DELETE_TYPES)) {
            var node = findClosestDeletableBlock(ast, cursor);
            var nodeCursors = getNodeLoc(node);
            var startCursor = nodeCursors[0];
            var endCursor = nodeCursors[1];
            if (highlighted) {
                setValue(deleteBlock(ast, node));
                unhighlight();
            } else {
                highlight(startCursor.lineNumber, startCursor.column, endCursor.lineNumber, endCursor.column);
            }
        } else if (spansProtectedPunctuation(buffer, ast, [oneBack, cursor])) {
            // ignore the backspace if it's something important
            // flash editor screen 
            flash(); 
        } else {
            charBackspaceBranch(buffer, cursor);
        }
    } else if (cursor.lineNumber == editorState.cursor.lineNumber) { // if unparsable but on same line
        // if cursor was inside () at last parsable state
        if (editorState.openParenthesis && editorState.closeParenthesis) {
            if (positionFromStart(buffer, cursor) - 1 == editorState.openParenthesis) {
                // ignore backspace if directly to the right of (
                flash();
            } else if (positionFromStart(buffer, cursor) <= editorState.openParenthesis || positionFromEnd(buffer, cursor) <= editorState.closeParenthesis) {
                // ignore backspace if to the right of ) or to the left of (
                flash();
            } else {
                // update highlighting range
                editorState.parentheses[1].column = editorState.parentheses[1].column - 1;
                charBackspaceBranch(buffer, cursor);
            }
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
    var buffer = editor.getValue();
    var cursor = getCursor();
    if (attemptParse(buffer)) {
        if (highlightedParen) {
            unhighlightParen();
        }
        var oneAhead = makeCursor(cursor.lineNumber, cursor.column + 1);
        var ast = attemptParse(buffer);
        if (cursorAtStartOfBlock(ast, cursor, BLOCK_DELETE_TYPES)) {
            var node = findClosestDeletableBlock(ast, cursor);
            var nodeCursors = getNodeLoc(node);
            var startCursor = nodeCursors[0];
            var endCursor = nodeCursors[1];
            if (highlighted) {
                setValue(deleteBlock(ast, node));
                unhighlight();
            } else {
                highlight(startCursor.lineNumber, startCursor.column, endCursor.lineNumber, endCursor.column);
            }
        } else if (spansProtectedPunctuation(buffer, ast, [cursor, oneAhead])) {
            // ignore the delete if it's something important
            // flash editor screen 
            flash(); 
        } else {
            charDeleteBranch(buffer, cursor);
        }
    } else if (cursor.lineNumber == editorState.cursor.lineNumber) { // if unparsable but on same line
        // if inside parentheses when became unparsable 
        if (editorState.openParenthesis && editorState.closeParenthesis) {
            if (positionFromEnd(buffer, cursor) - 1 == editorState.closeParenthesis) { // if directly to left of ) 
                // ignore delete if parenthesis
                flash();
            } else if (positionFromStart(buffer, cursor) <= editorState.openParenthesis || positionFromEnd(buffer, cursor) <= editorState.closeParenthesis) { // if left of ( or right of )
                // ignore delete if left or right of conditional
                flash();
            } else {
                // update highlighting range
                editorState.parentheses[1].column = editorState.parentheses[1].column - 1;
                charDeleteBranch(buffer, cursor);
            }
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
    var buffer = editor.getValue();
    var ast = attemptParse(buffer);
    var selection = getSelected();
    if (ast && selection) {
        var node = deleteSelected(ast, selection);
        var nodeCursors = getNodeLoc(node);
        var startCursor = nodeCursors[0];
        var endCursor = nodeCursors[1];
        if (highlighted) {
            setValue(deleteBlock(ast, node));
            unhighlight();
        } else {
            highlight(startCursor.lineNumber, startCursor.column, endCursor.lineNumber, endCursor.column);
        } 
    }
    updateEditorState();
}

/*********************************************
 *
 * SECTION: EDITOR STATE
 *
 *********************************************/

/**
 * Update the editor state.
 *
 * @returns {undefined}
 */
function updateEditorState() {
    var buffer = editor.getValue();
    var ast = attemptParse(buffer);
    var cursor = getCursor();
    if (ast) {
        if (highlightedParen) {
            unhighlightParen();
        }
        editorState.parsable = true;
        editorState.parse = ast;
        editorState.parsableText = buffer;
        document.getElementById("parseButton").disabled = true;
        // save positions of parentheses
        var parentheses = getSurroundingProtectedParen(buffer, ast, cursor);
        editorState.parentheses = parentheses;
        if (parentheses) {
            editorState.openParenthesis = positionFromStart(buffer, parentheses[0]);
            editorState.closeParenthesis = positionFromEnd(buffer, parentheses[1]);
        } else {
            editorState.openParenthesis = null;
            editorState.closeParenthesis = null;
        }
        var selected = getSelected();
        if (selected) {
            editorState.hasSelected = true;
            editorState.cursor = selected;
            editorState.sections = splitAtCursors(buffer, selected);
        } else {
            editorState.hasSelected = false;
            editorState.cursor = getCursor();
            editorState.sections = splitAtCursors(buffer, [editorState.cursor]);
        }
    } else { 
        editorState.parsable = false;
        // if on same line
        if (cursor.lineNumber == editorState.cursor.lineNumber) {
            if (editorState.parentheses) {
                if (highlightedParen) {
                    unhighlightParen();
                }
                highlightParen(editorState.parentheses);
            }
        }
        document.getElementById("parseButton").disabled = false;
    }
}

/*********************************************
 *
 * SECTION: HIGH-LEVEL ACTIONS
 *
 *********************************************/

/** 
 * Resets the buffer value to the last correct parsed state
 *
 * @returns {undefined}
 */
function resetToParsed() { // eslint-disable-line no-unused-vars
    setValue(editorState.parsableText);
} 

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
        node = findClosestCommonDeletableBlock(ast, selection, BLOCK_DELETE_TYPES);
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

/*********************************************
 *
 * SECTION: HIGH-LEVEL UI
 *
 *********************************************/

/** 
 * Flashes the editor background for 100 ms 
 * 
 * @returns {undefined} 
 */
function flash() {
    monaco.editor.setTheme("flash");
    setTimeout(function () { monaco.editor.setTheme("normal"); }, 100);
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
            range: new monaco.Range(startLine, startColumn, endLine, endColumn + 1),
            options: { isWholeLine: false, className: "highlight" }
        }
    ]);
    highlighted = true;
}

/**
 * Removes all decorations and highlighting from the editor
 *
 * @returns {undefined}
 */
function unhighlight() {
    decorations = editor.deltaDecorations(decorations, []);
    highlighted = false;
}

/**
 * Highlights from opening parenthesis to closed parenthesis, inclusive
 *
 * @param {ObjectArray} parenthesesRange - Array containing start cursor and end cursor
 * @returns {undefined}
 */
function highlightParen(parenthesesRange) {
    var startLine = parenthesesRange[0].lineNumber;
    var startColumn = parenthesesRange[0].column;
    var endLine = parenthesesRange[1].lineNumber;
    var endColumn = parenthesesRange[1].column;
    condDecorations = editor.deltaDecorations([], [
        {
            range: new monaco.Range(startLine, startColumn + 1, endLine, endColumn),
            options: { isWholeLine: false, className: "conditionalHighlight" }
        }
    ]);
    highlightedParen = true;
}

/**
 * Unhighlights range from opening to closed parentheses
 *
 * @returns {undefined}
 */
function unhighlightParen() {
    condDecorations = editor.deltaDecorations(condDecorations, []);
    highlightedParen = false;
}

/*********************************************
 *
 * SECTION: LOW-LEVEL EVENTS
 *
 *********************************************/

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
    if (highlighted) {
        unhighlight();
    }
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

/*********************************************
 *
 * SECTION: LOW-LEVEL ACTIONS
 *
 *********************************************/

/**
 * Backspace a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function charBackspaceBranch(buffer, cursor) {
    setValue(backspaceChar(buffer, cursor));
    if (cursor.column === 0) {
        cursor.lineNumber -= 1;
        cursor.column = Infinity;
    } else {
        cursor.column = cursor.column - 1;
    }
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
    setValue(deleteChar(buffer, cursor));
    setCursor(cursor);
}

/*********************************************
 *
 * SECTION: BUTTONS
 *
 *********************************************/

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
    setValue(recast.print(ast).code);

    // update cursor position
    setCursor(cursor);
}

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
        parentNode = findClosestParent(ast, pos, ["BlockStatement", "Program"]);
    } else {
        parentNode = findClosestParent(ast, cursor, ["BlockStatement", "Program"]);
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

/*********************************************
 *
 * SECTION: PARSING
 *
 *********************************************/

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
 * Get the start and end Cursors of a AST Node
 *
 * @param {AST} node - The node whose position we want.
 * @returns {[Cursor]} - A list of two cursors.
 */
function getNodeLoc(node) {
    var startCursor = makeCursor(
        node.loc.start.line,
        node.loc.start.column
    );
    var endCursor = makeCursor(
        node.loc.end.line,
        node.loc.end.column
    );
    return [startCursor, endCursor];
}

/**
 * Find the closest shared parent between multiple cursors.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {[Cursor]} cursors - A list of Cursor objects.
 * @param {[string]} nodeTypes - The types of node to find.
 * @returns {AST} - The parent node.
 */
function findClosestCommonParent(ast, cursors, nodeTypes) {
    var parentNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            var nodeCursors = getNodeLoc(node);
            var startCursor = nodeCursors[0];
            var endCursor = nodeCursors[1];
            for (var i = 0; i < cursors.length; i++) {
                if (startCursor.lineNumber > cursors[i].lineNumber) {
                    this.break();
                }
                if (startCursor.lineNumber <= cursors[i].lineNumber && endCursor.lineNumber >= cursors[i].lineNumber) {
                    if (nodeTypes.includes(node.type)) {
                        if (startCursor.lineNumber === cursors[i].lineNumber) {
                            if (startCursor.column <= cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else if (endCursor.lineNumber === cursors[i].lineNumber) {
                            if (endCursor.column > cursors[i].column) {
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
 * @param {[string]} nodeTypes - The types of node to find.
 * @returns {AST} - The AST node of the parent.
 */
function findClosestParent(ast, cursor, nodeTypes) {
    return findClosestCommonParent(ast, [cursor], nodeTypes);
}

/**
 * Find the closest parent node that is able to be deleted.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {[Cursor]} cursors - A list of cursors.
 * @param {[string]} nodeTypes - The types of node to delete.
 * @returns {AST} - The AST node of the sibling.
 */
function findClosestCommonDeletableBlock(ast, cursors, nodeTypes) {
    var deleteNode = null;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var numNodesCommonParent = 0;
            var nodeCursors = getNodeLoc(node);
            var startCursor = nodeCursors[0];
            var endCursor = nodeCursors[1];
            for (var i = 0; i < cursors.length; i++) {
                if (startCursor.lineNumber > cursors[i].lineNumber) {
                    this.break();
                }
                if (startCursor.lineNumber <= cursors[i].lineNumber && endCursor.lineNumber >= cursors[i].lineNumber) {
                    if (nodeTypes.includes(node.type)) {
                        if (startCursor.lineNumber === cursors[i].lineNumber) {
                            if (startCursor.column <= cursors[i].column) {
                                numNodesCommonParent++;
                            }
                        } else if (endCursor.lineNumber === cursors[i].lineNumber) {
                            if (endCursor.column >= cursors[i].column) {
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
    return findClosestCommonDeletableBlock(ast, [cursor], BLOCK_DELETE_TYPES);
}

/**
 * Find the immediate previous sibling to the position.
 *
 * @param {AST} ast - The root of the AST to search through.
 * @param {Cursor} cursor - A lineNumber and column object.
 * @returns {node} - The AST node of the sibling.
 */
function findPreviousSibling(ast, cursor) {
    var parentNode = findClosestParent(ast, cursor, ["BlockStatement", "Program"]);
    var prevSibling = null;
    // loop through index
    for (var i = 0; i < parentNode.body.length; i++) {
        // make node the ith node in the body
        var node = parentNode.body[i];
        var nodeCursors = getNodeLoc(node);
        var startCursor = nodeCursors[0];
        var endCursor = nodeCursors[1];
        // if the node is before the cursor ==> prevSibling
        if (endCursor.lineNumber < cursor.lineNumber) {
            prevSibling = node;
            // if node is same line as cursor
        } else if (endCursor.lineNumber === cursor.lineNumber) {
            // check if node ends before or at cursor
            if (endCursor.column <= cursor.column) {
                prevSibling = node;
            }
            // if node starts on line after cursor ==> break
        } else if (startCursor.lineNumber > cursor.lineNumber) {
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
 * @param {[string]} nodeTypes - The AST nodes to detect.
 * @returns {boolean} - Is cursor at end of block?
 */
function cursorAtEndOfBlock(ast, cursor, nodeTypes) {
    var endOfBlock = false;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var nodeCursors = getNodeLoc(node);
            var endCursor = nodeCursors[1];
            if (nodeTypes.includes(node.type) &&
                cursor.lineNumber === endCursor.lineNumber && cursor.column === endCursor.column) {
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
 * @param {[string]} nodeTypes - The AST nodes to detect.
 * @returns {boolean} Is cursor at beginning of block?
 */
function cursorAtStartOfBlock(ast, cursor, nodeTypes) {
    var begOfBlock = false;
    estraverse.traverse(ast.program, {
        enter: function (node) {
            var nodeCursors = getNodeLoc(node);
            var startCursor = nodeCursors[0];
            if (nodeTypes.includes(node.type) &&
                cursor.lineNumber === startCursor.lineNumber && cursor.column === startCursor.column) {
                begOfBlock = true;
            }
        }
    });
    return begOfBlock;
}

/*********************************************
 *
 * SECTION: TEXT EDITING
 *
 *********************************************/

/**
 * Test if a cursor is between two others, exclusive.
 *
 * Note that this function deliberately breaks the rules of standard indexes -
 * inclusive of the starting index and exclusive of the ending index. This is
 * because text editing cursors do not work this way. If a pair of parentheses
 * are at indexes 5 and 15, a cursor at index 5 would be *within* that range
 * despite being *before* the starting parenthesis. The hope is to force
 * callers of this function to think through their cursor indices.
 *
 * @param {Cursor} cursor - the cursor to test.
 * @param {Cursor} startCursor - the cursor marking the beginning of a region.
 * @param {Cursor} endCursor - the cursor marking the end of a region.
 * @returns {boolean} - True if the cursor is between the other two.
 */
function isBetweenCursors(cursor, startCursor, endCursor) {
    var afterStart = (
        (cursor.lineNumber > startCursor.lineNumber) || (
            (cursor.lineNumber === startCursor.lineNumber) &&
            (cursor.column > startCursor.column)));
    var beforeEnd = (
        (cursor.lineNumber < endCursor.lineNumber) || (
            (cursor.lineNumber === endCursor.lineNumber) &&
            (cursor.column < endCursor.column)));
    return afterStart && beforeEnd;
}

/**
 * Check if a selection spans a protected punctuation.
 *
 * Protected punctuation are defined as:
 * * the parenthesis around function parameters
 * * the parenthesis around if and while conditions
 * * the parenthesis around for init-test-update statements
 * * the braces around all block statements
 *
 * @param {string} buffer - The buffer in which text is selected.
 * @param {AST} ast - The parse tree for that buffer.
 * @param {[Cursor]} selection - A list of two Cursors defining the selection.
 * @returns {boolean} - Whether the selection spans a protected punctuation.
 */
function spansProtectedPunctuation(buffer, ast, selection) {
    var cursor = null;
    var matchingPair = null;
    // 1. if the start is in a paren and the end is not
    cursor = selection[0];
    matchingPair = getSurroundingProtectedParen(buffer, ast, cursor);
    if (matchingPair && !isBetweenCursors(selection[1], matchingPair[0], matchingPair[1])) {
        return true;
    }
    // 2. if the start is in a brace and the end is not
    matchingPair = getSurroundingProtectedBrace(buffer, ast, cursor);
    if (matchingPair && !isBetweenCursors(selection[1], matchingPair[0], matchingPair[1])) {
        return true;
    }
    // 3. if the end is in a paren and the start is not
    cursor = selection[1];
    matchingPair = getSurroundingProtectedParen(buffer, ast, cursor);
    if (matchingPair && !isBetweenCursors(selection[0], matchingPair[0], matchingPair[1])) {
        return true;
    }
    // 4. if the end is in a brace and the start is not
    matchingPair = getSurroundingProtectedBrace(buffer, ast, cursor);
    if (matchingPair && !isBetweenCursors(selection[0], matchingPair[0], matchingPair[1])) {
        return true;
    }
    return false;
}

/**
 * Get the cursors for *outside* of protected parentheses that contain the cursor.
 *
 * Eg. If the string is "(hello)", this function would returns cursors at
 * columns 0 and 7.
 *
 * @param {string} buffer - The buffer in which text is selected.
 * @param {AST} ast - The parse tree for that buffer.
 * @param {Cursor} cursor - A Cursor around which to search for protected parentheses.
 * @returns {[Cursor]} - The outer Cursors for the parentheses.
 */
function getSurroundingProtectedParen(buffer, ast, cursor) {
    // check if cursor is in relevant node types
    var nodeTypes = [
        "FunctionDeclaration",
        "FunctionExpression",
        "IfStatement",
        "WhileStatement",
        "WhileStatement",
        "ForStatement",
    ];
    var closestParent = findClosestParent(ast, cursor, nodeTypes);
    if (!nodeTypes.includes(closestParent.type)) {
        return null;
    }
    var line = null;
    var found = null;
    var col = null;
    // start at the beginning and move forwards to the first open parenthesis
    var startCursor = closestParent.loc.start;
    found = false;
    line = buffer.split("\n")[startCursor.line - 1];
    for (col = startCursor.column; col <= line.length; col++) {
        if (line.charAt(col) === "(") {
            startCursor = makeCursor(startCursor.line, col);
            found = true;
            break;
        }
    }
    if (!found) {
        return null;
    }
    // start at the brace and move backwards to the first close parenthesis
    var endCursor = null;
    if (closestParent.type === "IfStatement") {
        endCursor = closestParent.consequent.loc.start;
    } else {
        endCursor = closestParent.body.loc.start;
    }
    found = false;
    line = buffer.split("\n")[endCursor.line - 1];
    for (col = endCursor.column; col >= 0; col--) {
        if (line.charAt(col) === ")") {
            endCursor = makeCursor(endCursor.line, col + 1);
            found = true;
            break;
        }
    }
    if (!found) {
        return null;
    }
    // return the parenthesis cursors if they contain the cursor
    if (isBetweenCursors(cursor, startCursor, endCursor)) {
        return [startCursor, endCursor];
    } else {
        return null;
    }
}

/**
 * Get the cursors for *outside* of protected braces that contain the cursor.
 *
 * @param {string} buffer - The buffer in which text is selected.
 * @param {AST} ast - The parse tree for that buffer.
 * @param {Cursor} cursor - A Cursor around which to search for protected braces.
 * @returns {[Cursor]} - The outer Cursors for the braces.
 */
function getSurroundingProtectedBrace(buffer, ast, cursor) {
    // check if cursor is in relevant node types
    var nodeTypes = ["BlockStatement"];
    var closestParent = findClosestParent(ast, cursor, nodeTypes);
    if (closestParent.type !== "BlockStatement") {
        return null;
    }
    // convert to Cursor object
    var startCursor = closestParent.loc.start;
    startCursor = makeCursor(startCursor.line, startCursor.column);
    var endCursor = closestParent.loc.end;
    endCursor = makeCursor(endCursor.line, endCursor.column);
    if (isBetweenCursors(cursor, startCursor, endCursor)) {
        return [startCursor, endCursor];
    } else {
        return null;
    }
}

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
 * Gets the character position of cursor from beginning of buffer
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A cursor position.
 * @returns {string} Position of cursor from beginning of buffer
 */
function positionFromStart(buffer, cursor) {
    var splitBuffer = buffer.split("\n");
    var firstPart = splitBuffer.slice(0, cursor.lineNumber - 1);
    var sameLine = splitBuffer.slice(cursor.lineNumber - 1, cursor.lineNumber).join("");
    sameLine = sameLine.split("");
    sameLine = sameLine.slice(0, cursor.column).join("");
    firstPart.push(sameLine);

    return firstPart.join("").length;
}

/**
 * Gets the character position of cursor from end of buffer
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - A cursor position.
 * @returns {string} Position of cursor from end of buffer
 */
function positionFromEnd(buffer, cursor) {
    var splitBuffer = buffer.split("\n");        
    var lastPart = splitBuffer.slice(cursor.lineNumber); 
    var sameLine = splitBuffer.slice(cursor.lineNumber - 1, cursor.lineNumber).join(""); 
    sameLine = sameLine.split("");               
    sameLine = sameLine.slice(cursor.column).join("");
    lastPart.unshift(sameLine);                                

    return lastPart.join("").length;
}

/*********************************************
 *
 * SECTION: CLASSES
 *
 *********************************************/

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
    return { "lineNumber": line, "column": col };
}

/*********************************************
 *
 * SECTION: EDITOR WRAPPER
 *
 *********************************************/

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
 * Set value of editor using executeEdits to preserve undo stack
 *
 * @param {string} newBuffer - String replacing oldBuffer.
 * @returns {undefined}
*/
function setValue(newBuffer) {
    // get range of editor model 
    var range = editor.getModel().getFullModelRange();
    // call execute edits on the editor 
    editor.executeEdits(editor.getValue(), [{ identifier: "insert", range: range, text: newBuffer }]);
}

/*********************************************
 *
 * SECTION: EXPORTS
 *
 *********************************************/

// Attempt to export the module for testing purposes. If we get a
// ReferenceError on "module", assume we're running a browser and ignore it.
// Re-throw all other errors.
try {
    module.exports = {
        // constants
        "BLOCK_DELETE_TYPES": BLOCK_DELETE_TYPES,
        // utility
        "makeCursor": makeCursor,
        // text editing
        "splitAtCursors": splitAtCursors,
        "isBetweenCursors": isBetweenCursors,
        "positionFromEnd": positionFromEnd,
        "positionFromStart": positionFromStart,
        // AST
        "findClosestCommonParent": findClosestCommonParent,
        "findClosestParent": findClosestParent,
        "findPreviousSibling": findPreviousSibling,
        "findClosestCommonDeletableBlock": findClosestCommonDeletableBlock,
        "findClosestDeletableBlock": findClosestDeletableBlock,
        // syntax
        "spansProtectedPunctuation": spansProtectedPunctuation,
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
