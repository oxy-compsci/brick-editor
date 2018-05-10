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
var decorations = [];
var highlightedPreDelete = null; // [startCursor, endCursor] or null
var highlightedEditable = false;

/**************************************
 *
 * SECTION: HIGH-LEVEL EVENTS
 *
 **************************************/

/**
 * Handle any typing at the cursor.
 *
 * This function is called after the buffer has changed.
 *
 * @returns {undefined}
 */
function onCursorType() {
    console.log("onCursorType");
    var index = findCursorEditableRegionIndex(editorState.cursor);
    // if the new character is not in an editable region, revert it
    if (index === null) {
        revertAction();
    } else {
        // check parsability changes due to the new character
        var ast = attemptParse(editor.getValue());
        if (editorState.parsable) {
            if (!ast) {
                setSingleLineEditableRegion(1);
            }
        } else {
            if (ast) {
                makeAllEditable();
            } else {
                var editableRegion = editorState.editableRegions[0];
                // update the editable region if the new character is on the end line
                var lineDiff = editor.getValue().split("\n").length - editorState.text.split("\n").length;
                if (lineDiff) {
                    var line = getLine(editor.getValue(), editableRegion[1].lineNumber + lineDiff - 1);
                    var columnDiff = line.length - editableRegion[1].column;
                    adjustEditableRegion(0, 0, 0, lineDiff, columnDiff);
                } else if (editorState.cursor.lineNumber === editableRegion[1].lineNumber) {
                    adjustEditableRegion(0, 0, 0, 0, 1);
                }
            }
        }
    }
    updateEditorState();
}

/**
 * Handle backspace at the cursor.
 *
 * This function is called BEFORE the buffer is changed.
 *
 * @returns {undefined}
 */
function onCursorBackspace() {
    console.log("onCursorBackspace");
    var index = findCursorEditableRegionIndex(editorState.cursor);
    // The backspace should not happen if:
    // * The cursor not in an editable region
    // * It is in an editable region, but would remove the starting parenthesis
    if (!cursorInEditableRegion(editorState.cursor)) {
        flash();
    } else if (editorState.inParenthesis && getCursor().column === editorState.editableRegions[index][0].column) {
        flash();
    } else {
        // otherwise, it's in an editable region
        // if the buffer is currently parsable, try to be clever about backspacing over entire blocks
        // otherwise, just let backspace work as usual
        if (editorState.parsable) {
            doCursorBackspace();
            if (!attemptParse(editor.getValue())) {
                setSingleLineEditableRegion(-1);
            }
        } else {
            backspaceCharacter(editor.getValue(), getCursor());
            if (attemptParse(editor.getValue())) {
                makeAllEditable();
            } else {
                // update the editable region
                var editableRegion = editorState.editableRegions[index];
                // if the new character is on the same line as the end of the region
                // increment the column number to account for the new character
                if (editableRegion[0].lineNumber === editableRegion[1].lineNumber) {
                    adjustEditableRegion(index, 0, 0, 0, -1);
                }
            }
        }
    }
    updateEditorState();
}

/**
 * Handle delete at the cursor.
 *
 * This function is called BEFORE the buffer is changed.
 *
 * @returns {undefined}
 */
function onCursorDelete() {
    console.log("onCursorDelete");
    var index = findCursorEditableRegionIndex(editorState.cursor);
    // The delete should not happen if:
    // * The cursor not in an editable region
    // * It is in an editable region, but would remove the ending parenthesis
    if (!cursorInEditableRegion(editorState.cursor)) {
        flash();
    } else if (editorState.inParenthesis && getCursor().column === editorState.editableRegions[index][1].column) {
        flash();
    } else {
        // otherwise, it's in an editable region
        // if the buffer is currently parsable, try to be clever about backspacing over entire blocks
        // otherwise, just let backspace work as usual
        if (editorState.parsable) {
            doCursorDelete();
            if (!attemptParse(editor.getValue())) {
                setSingleLineEditableRegion(-1);
            }
        } else {
            deleteCharacter(editor.getValue(), getCursor());
            if (attemptParse(editor.getValue())) {
                makeAllEditable();
            } else {
                // update the editable region
                var editableRegion = editorState.editableRegions[index];
                // if the new character is on the same line as the end of the region
                // increment the column number to account for the new character
                if (editableRegion[0].lineNumber === editableRegion[1].lineNumber) {
                    adjustEditableRegion(index, 0, 0, 0, -1);
                }
            }
        }
    }
    updateEditorState();
}

/**
 * Handle any typing on a selection.
 *
 * This function is called after the buffer has changed.
 *
 * @returns {undefined}
 */
function onSelectionType() {
    console.log("onSelectionType()");
    var selection = editorState.cursor;
    // if the selection character is not in an editable region, revert it
    if (!selectionInEditableRegion(selection[0], selection[1])) {
        revertAction();
    } else {
        // check parsability changes due to the new character
        var ast = attemptParse(editor.getValue());
        if (editorState.parsable) {
            if (!ast) {
                setMultiLineEditableRegion();
            }
        } else {
            if (ast) {
                makeAllEditable();
            } else {
                // update the editable region
                var editableRegion = editorState.editableRegions[0];
                var lineDiff = editor.getValue().split("\n").length - editorState.text.split("\n").length;
                if (lineDiff) {
                    var line = getLine(editor.getValue(), editableRegion[1].lineNumber + lineDiff - 1);
                    var columnDiff = line.length - editableRegion[1].column;
                    adjustEditableRegion(0, 0, 0, lineDiff, columnDiff);
                } else if (editorState.cursor.lineNumber === editableRegion[1].lineNumber) {
                    adjustEditableRegion(0, 0, 0, 0, 1);
                }
                console.log(editorState.editableRegions[0][1]);
            }
        }
    }
    updateEditorState();
}

/**
 * Handle backspace and delete on a selection.
 *
 * This function is called BEFORE the buffer is changed.
 *
 * @returns {undefined}
 */
function onSelectionDelete() {
    console.log("onSelectionDelete");
    updateEditorState();
}

/**
 * Handle cutting on a selection.
 *
 * This function is called after the buffer has changed.
 *
 * @returns {undefined}
 */
function onSelectionCut() {
    console.log("onSelectionCut");
    updateEditorState();
}

/**
 * Handle pasting at the cursor.
 *
 * This function is called after the buffer has changed.
 *
 * @returns {undefined}
 */
function onCursorPaste() {
    console.log("onCursorPaste");
    updateEditorState();
}

/**
 * Handle pasting over a selection.
 *
 * This function is called after the buffer has changed.
 *
 * @returns {undefined}
 */
function onSelectionPaste() {
    console.log("onSelectionPaste");
    updateEditorState();
}

/**
 * Handle code being dragged by the mouse.
 *
 * This function is called FIXME the buffer has changed.
 *
 * @returns {undefined}
 */
function onMouseDrag() {}

/**************************************
 *
 * SECTION: EDITOR STATE
 *
 **************************************/

/**
 * Update the editor state.
 *
 * @returns {undefined}
 */
function updateEditorState() {
    var buffer = editor.getValue();
    var ast = attemptParse(buffer);
    var cursor = getCursor();

    // general editor state
    editorState.text = buffer;
    var selected = getSelection();
    if (selected) {
        editorState.hasSelected = true;
        editorState.cursor = selected;
        editorState.sections = splitAtCursors(buffer, selected);
    } else {
        editorState.hasSelected = false;
        editorState.cursor = getCursor();
        editorState.sections = splitAtCursors(buffer, [editorState.cursor]);
    }
    // one time initialization of editableRegions and related state
    if (editorState.editableRegions.length === 0) {
        makeAllEditable();
        editorState.inParenthesis = false;
    } else if (highlightedEditable) {
        unhighlight();
        for (var i = 0; i < editorState.editableRegions.length; i++) {
            var editableRegion = editorState.editableRegions[i];
            highlightEditable(editableRegion[0], editableRegion[1]);
        }
    }

    if (ast) {
        if (highlightedEditable) {
            unhighlight();
        }
        editorState.parsable = true;
        editorState.parse = ast;
        editorState.parsableText = buffer;
        document.getElementById("parseButton").disabled = true;
        makeAllEditable();
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
    } else {
        editorState.parsable = false;
        document.getElementById("parseButton").disabled = false;
    }
}

/**
 * Make the entire buffer editable.
 *
 * @returns {undefined}
 */
function makeAllEditable() {
    editorState.editableRegions = [ [
        makeCursor(1, 0),
        getLastCursor(editor.getValue()),
    ] ];
}

/**
 * Sets the editable region to a single line.
 *
 * Because this function could be called from different editing events, the
 * adjustment parameter allows the calling event to adjust the ending column
 * (ie. -1 if the event was a backspace or a delete, +1 if it was an insert).
 *
 * @param {int} adjustment - amount to move the end column
 * @returns {undefined}
 */
function setSingleLineEditableRegion(adjustment) {
    // if cursor is in condition or for
    //   limit to for
    // else
    //   limit to entire line
    var startCursor = null;
    var endCursor = null;
    var parens = getSurroundingProtectedParen(editorState.parsableText, editorState.parse, editorState.cursor);
    if (parens === null) {
        startCursor = getCursor();
        endCursor = getCursor();
        startCursor.column = 0;
        endCursor.column = getLine(editor.getValue(), startCursor.lineNumber - 1).length;
        editorState.inParenthesis = false;
    } else {
        startCursor = parens[0];
        endCursor = parens[1];
        startCursor.column += 1;
        endCursor.column -= 1;
        endCursor.column += adjustment;
        editorState.inParenthesis = true;
    }
    editorState.editableRegions = [ [startCursor, endCursor] ];
    highlightEditable(startCursor, endCursor);
}

function setMultiLineEditableRegion() {
    // find the closest common parent
    var parentNode = findClosestCommonParent(editorState.parse, editorState.cursor, ["BlockStatement", "Program"]);
    // find the smallest span of siblings that contain both cursors
    var body = parentNode.body;
    // find start location
    var startCursor = null;
    for (var i = 0; i < body.length; i++) {
        var nodeCursors = getNodeLoc(body[i]);
        if (isBefore(editorState.cursor[0], nodeCursors[0])) {
            if (i === 0) {
                startCursor = makeCursor(1, 0);
            } else {
                startCursor = makeCursor(getNodeLoc(body[i - 1])[1].lineNumber + 1, 0);
            }
            break
        } else if (isBefore(editorState.cursor[0], nodeCursors[1])) {
            startCursor = makeCursor(nodeCursors[0].lineNumber, 0);
            break;
        }
    }
    // find end location
    var endCursor = null;
    for (var i = body.length - 1; i >= 0; i--) {
        var nodeCursors = getNodeLoc(body[i]);
        if (isBefore(editorState.cursor[1], nodeCursors[0])) {
            if (i === 0) {
                endCursor = makeCursor(1, Infinity);
            } else {
                endCursor = makeCursor(getNodeLoc(body[i - 1])[1].lineNumber, Infinity);
            }
            break
        } else if (isBefore(editorState.cursor[1], nodeCursors[1])) {
            endCursor = makeCursor(nodeCursors[1].lineNumber, Infinity);
            break;
        }
    }
    // map to post-edit cursors
    endCursor.lineNumber -= editorState.text.split("\n").length - editor.getValue().split("\n").length ;
    endCursor.column = getLine(editor.getValue(), endCursor.lineNumber - 1).length;

    editorState.editableRegions = [ [startCursor, endCursor] ];
    highlightEditable(startCursor, endCursor);
    console.log(editorState.editableRegions[0]);
}

/**
 * Adjusts an editable region.
 *
 * @param {int} index - the index of the editable region
 * @param {int} startLine - amount to move the start line
 * @param {int} startColumn - amount to move the start column
 * @param {int} endLine - amount to move the end line
 * @param {int} endColumn - amount to move the end column
 * @returns {undefined}
 */
function adjustEditableRegion(index, startLine, startColumn, endLine, endColumn) {
    var startCursor = editorState.editableRegions[index][0];
    var endCursor = editorState.editableRegions[index][1];
    startCursor.lineNumber += startLine;
    startCursor.column += startColumn;
    endCursor.lineNumber += endLine;
    endCursor.column += endColumn;
    highlightEditable(startCursor, endCursor);
}

/**
 * Find the index of the editable region that contains the cursor.
 *
 * @param {Cursor} cursor - the cursor location
 * @returns {int} - the index, or null
 */
function findCursorEditableRegionIndex(cursor) {
    for (var i = 0; i < editorState.editableRegions.length; i++) {
        var regionStart = copyCursor(editorState.editableRegions[i][0]);
        var regionEnd = copyCursor(editorState.editableRegions[i][1]);
        regionStart.column -= 1;
        regionEnd.column += 1;
        if (isBetweenCursors(cursor, regionStart, regionEnd)) {
            return i;
        }
    }
    return null;
}

/**
 * Find the editable region that contains the cursor.
 *
 * @param {Cursor} cursor - the cursor location
 * @returns {int} - the index, or null
 */
function findCursorEditableRegion(cursor) {
    var index = findCursorEditableRegionIndex(cursor);
    if (index === null) {
        return null;
    } else {
        return editorState.editableRegions[index];
    }
}

/**
 * Determine if the cursor is in any editable region.
 *
 * @param {Cursor} cursor - the cursor location
 * @returns {boolean} - true if the cursor is in an editable region
 */
function cursorInEditableRegion(cursor) {
    return findCursorEditableRegionIndex(cursor) !== null;
}

/**
 * Determine if the selection is in any editable region.
 *
 * @param {Cursor} startCursor - the start cursor location
 * @param {Cursor} endCursor - the end cursor location
 * @returns {boolean} - true if the cursor is in an editable region
 */
function selectionInEditableRegion(startCursor, endCursor) {
    var startIndex = findCursorEditableRegionIndex(startCursor);
    var endIndex = findCursorEditableRegionIndex(endCursor);
    return (startIndex !== null) && (startIndex == endIndex);

}

/**************************************
 *
 * SECTION: HIGH-LEVEL ACTIONS
 *
 **************************************/

/**
 * Revert the buffer value to the last parsable state
 *
 * @returns {undefined}
 */
function revertToParsed() { // eslint-disable-line no-unused-vars
    setValue(editorState.parsableText);
    unhighlight();
    makeAllEditable();
    updateEditorState();
}

/**
 * Revert to before the current action
 *
 * @returns {undefined}
 */
function revertAction() {
    setValue(editorState.text);
    if (editorState.hasSelected) {
        setSelection(editorState.cursor[0], editorState.cursor[1]);
    } else {
        setCursor(editorState.cursor);
    }
    flash();
}

/**
 * Handle an actual backspace.
 *
 * @returns {undefined}
 */
function doCursorBackspace() {
    var buffer = editor.getValue();
    var cursor = getCursor();
    var oneBack = makeCursor(cursor.lineNumber, cursor.column - 1);
    var ast = attemptParse(buffer);
    if (cursorAtEndOfBlock(ast, cursor, BLOCK_DELETE_TYPES)) {
        var node = findClosestDeletableBlock(ast, cursor);
        var cursors = getNodeLoc(node);
        highlightAndDelete(ast, cursors[0], cursors[1]);
    } else if (spansProtectedPunctuation(buffer, ast, [oneBack, cursor])) {
        // ignore the backspace if it will remove a syntax parenthesis or brace
        flash(); 
    } else {
        backspaceCharacter(buffer, cursor);
    }
}

/**
 * Handle an backspace deletion
 *
 * @returns {undefined}
 */
function doCursorDelete() {
    var buffer = editor.getValue();
    var cursor = getCursor();
    var oneAhead = makeCursor(cursor.lineNumber, cursor.column + 1);
    var ast = attemptParse(buffer);
    if (cursorAtStartOfBlock(ast, cursor, BLOCK_DELETE_TYPES)) {
        var node = findClosestDeletableBlock(ast, cursor);
        var cursors = getNodeLoc(node);
        highlightAndDelete(ast, cursors[0], cursors[1]);
    } else if (spansProtectedPunctuation(buffer, ast, [cursor, oneAhead])) {
        // ignore the delete if it will remove a syntax parenthesis or brace
        flash(); 
    } else {
        deleteCharacter(buffer, cursor);
    }
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

/**************************************
 *
 * SECTION: HIGH-LEVEL UI
 *
 **************************************/

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
 * @param {Cursor} startCursor - The start of the range
 * @param {Cursor} endCursor - The end of the range
 * @returns {undefined}
 */
function highlightPreDelete(startCursor, endCursor) {
    highlight(startCursor, endCursor, "predelete-highlight");
    highlightedPreDelete = [startCursor, endCursor];
}

/**
 * Highlights from opening parenthesis to closed parenthesis, inclusive
 *
 * @param {Cursor} startCursor - The start of the range
 * @param {Cursor} endCursor - The end of the range
 * @returns {undefined}
 */
function highlightEditable(startCursor, endCursor) {
    highlight(startCursor, endCursor, "editable-highlight");
    highlightedEditable = true;
}

/**
 * Highlights editor text based on start/end lineNumbers and start/end columns
 *
 * @param {Cursor} startCursor - The start of the range
 * @param {Cursor} endCursor - The end of the range
 * @param {string} cssClass - The CSS to use for highlighting
 * @returns {undefined}
 */
function highlight(startCursor, endCursor, cssClass) {
    var startLine = startCursor.lineNumber;
    var startColumn = startCursor.column;
    var endLine = endCursor.lineNumber;
    var endColumn = endCursor.column;
    decorations = editor.deltaDecorations(decorations, [{
        range: new monaco.Range(startLine, startColumn + 1, endLine, endColumn + 1),
        options: { isWholeLine: false, className: cssClass },
    }]);
}

/**
 * Removes all decorations and highlighting from the editor
 *
 * @returns {undefined}
 */
function unhighlight() {
    decorations = editor.deltaDecorations(decorations, []);
    highlightedPreDelete = null;
    highlightedEditable = false;
}

/**************************************
 *
 * SECTION: MID-LEVEL ACTIONS
 *
 **************************************/

/**
 * Highlight a block or delete it if already highlighted
 *
 * @param {AST} ast - The root of the ast
 * @param {AST} node - The node to delete
 * @returns {undefined}
 */
function highlightAndDelete(ast, startCursor, endCursor) {
    if (highlightedPreDelete) {
        // FIXME cursor is off due to auto-reformatting
        var sections = splitAtCursors(editor.getValue(), [startCursor, endCursor]);
        setValue(sections[0] + sections[2]);
        setCursor(startCursor);
        unhighlight();
    } else {
        highlightPreDelete(startCursor, endCursor);
    }
}

/**************************************
 *
 * SECTION: LOW-LEVEL EVENTS
 *
 **************************************/

/**
 * Called when backspace key is pressed
 *
 * @returns {undefined}
 */
function backspaceHandler() { // eslint-disable-line no-unused-vars
    if (!editorState.hasSelected) {
        onCursorBackspace();
    } else {
        onSelectionDelete();
    }
}

/**
 * Called when delete key is pressed
 *
 * @returns {undefined}
 */
function deleteHandler() { // eslint-disable-line no-unused-vars
    if (!editorState.hasSelected) {
        onCursorDelete();
    } else {
        onSelectionDelete();
    }
}

/**
 * Callback function whenever the cursor moves.
 *
 * @param {Event} e - the cursor movement event.
 * @returns {undefined}
 */
function onDidChangeCursorSelection(e) { // eslint-disable-line no-unused-vars
    if (highlightedPreDelete) {
        unhighlight();
    }
    if (e.source === "mouse") {
        // FIXME dragging selected text
        updateEditorState();
    } else if (e.source === "keyboard") {
        if (e.reason === 4) { // pasted
            if (editorState.hasSelected) {
                onSelectionPaste();
            } else {
                onCursorPaste();
            }
        } else if (e.reason === 3) { // arrow key movement
            updateEditorState();
        } else if (e.reason === 0) { // cut or type
            if (!editorState.hasSelected) { // typed at cursor
                onCursorType();
            } else {
                var sections = splitAtCursors(editorState.text, editorState.cursor);
                if (editor.getValue().length > sections[0].length + sections[2].length) {
                    onSelectionType();
                } else {
                    onSelectionCut();
                }
            }
        }
    }
}

/**************************************
 *
 * SECTION: LOW-LEVEL ACTIONS
 *
 **************************************/

/**
 * Backspace a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function backspaceCharacter(buffer, cursor) {
    var beginCursor = makeCursor(cursor.lineNumber, cursor.column - 1);
    var sections = splitAtCursors(buffer, [beginCursor, cursor]);
    setValue([sections[0], sections[2]].join(""));
    if (cursor.column === 0) {
        cursor.lineNumber -= 1;
        cursor.column = Infinity;
    } else {
        cursor.column = cursor.column - 1;
    }
    cursor.column = getLine(buffer, cursor.lineNumber - 1).length;
    setCursor(cursor);
}

/**
 * Delete a character
 *
 * @param {string} buffer - A string of text from the editor.
 * @param {Cursor} cursor - The line and column of the cursor
 * @returns {undefined}
 */
function deleteCharacter(buffer, cursor) {
    var endCursor = makeCursor(cursor.lineNumber, cursor.column + 1);
    var sections = splitAtCursors(buffer, [cursor, endCursor]);
    setValue([sections[0], sections[2]].join(""));
    setCursor(cursor);
}

/**************************************
 *
 * SECTION: BUTTONS
 *
 **************************************/

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
    var newText = addBlock(template, ast, cursor);
    ast = attemptParse(newText);
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

/**************************************
 *
 * SECTION: PARSING
 *
 **************************************/

/**
 * Attempt to parse JavaScript code.
 *
 * @param {string} text - The text to parse.
 * @returns {AST} - The parsed AST, or null if unparsable.
 */
function attemptParse(text) {
    try {
        return recast.parse(text);
    } catch (e) {
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

/**************************************
 *
 * SECTION: TEXT EDITING
 *
 **************************************/

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
    // start at the beginning and move forwards to the first open parenthesis
    var startCursor = getNodeLoc(closestParent)[0];
    found = false;
    line = buffer.split("\n")[startCursor.lineNumber - 1];
    for (; startCursor.column <= line.length; startCursor.column++) {
        if (line.charAt(startCursor.column) === "(") {
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
        endCursor = getNodeLoc(closestParent.consequent)[0];
    } else {
        endCursor = getNodeLoc(closestParent.body)[0];
    }
    found = false;
    line = buffer.split("\n")[endCursor.lineNumber - 1];
    //for (col = endCursor.column; col >= 0; col--) {
    for (; endCursor.column >= 0; endCursor.column--) {
        if (line.charAt(endCursor.column - 1) === ")") {
            found = true;
            break;
        }
    }
    if (!found) {
        return null;
    }
    // return the parenthesis cursors if they contain the cursor
    if (isBetweenCursors(cursor, startCursor, endCursor)) {
        return [copyCursor(startCursor), copyCursor(endCursor)];
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
    var nodeCursor = getNodeLoc(closestParent);
    var startCursor = nodeCursor[0];
    var endCursor = nodeCursor[1];
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
    var cursorsIndex = 0;
    // augment positions with a fake cursor at the start
    positions.push(0);
    // deal with cursors before the start of the string
    while (cursors[cursorsIndex].lineNumber < 1) {
        positions.push(0);
        cursorsIndex++;
    }
    // convert all cursors to character positions
    var lines = buffer.split("\n");
    var lineNum = 0;
    var numCharacters = 0;
    for (; cursorsIndex < cursors.length; cursorsIndex++) {
        var cursor = cursors[cursorsIndex];
        // add non-cursor lines to the current section
        while (lineNum < lines.length && lineNum + 1 < cursor.lineNumber) {
            numCharacters += lines[lineNum].length + 1;
            lineNum++;
        }
        // add the cursor position to the list
        if (numCharacters + cursor.column < buffer.length) {
            positions.push(numCharacters + cursor.column);
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

/**
 * Get a cursor at the last position of a string.
 *
 * @param {string} text - the string
 * @returns {Cursor} - the cursor
 */
function getLastCursor(text) {
    var lines = text.split("\n");
    var numLines = lines.length;
    return makeCursor(numLines, lines[numLines - 1].length);
}

/**
 * Get a specific line from a string.
 *
 * @param {string} text - the string
 * @param {int} lineIndex - the line index
 * @returns {string} - the line
 */
function getLine(text, lineIndex) {
    var lines = text.split("\n");
    if (lineIndex < 0) {
        lineIndex = lines.length + lineIndex;
    }
    return lines[lineIndex];
}

/**************************************
 *
 * SECTION: CLASSES
 *
 **************************************/

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

/**
 * Copy a Cursor object.
 *
 * @param {Cursor} cursor - The Cursor object.
 * @returns {Cursor} - The cloned Cursor object.
 */
function copyCursor(cursor) {
    return makeCursor(cursor.lineNumber, cursor.column);
}

/**
 * Test if a cursor is between two others, exclusive.
 *
 * Note that this function deliberately breaks the rules of standard indexes
 * (ie. it is NOT inclusive of the starting index and exclusive of the ending
 * index. This is because text editing cursors do not work this way. If a pair
 * of parentheses are at indexes 5 and 15, a cursor at index 5 would be
 * *within* that range despite being *before* the starting parenthesis. The
 * hope is to force callers of this function to think through their cursor
 * indices.
 *
 * @param {Cursor} cursor - the cursor to test.
 * @param {Cursor} startCursor - the cursor marking the beginning of a region.
 * @param {Cursor} endCursor - the cursor marking the end of a region.
 * @returns {boolean} - True if the cursor is between the other two.
 */
function isBetweenCursors(cursor, startCursor, endCursor) {
    return isAfter(cursor, startCursor) && isBefore(cursor, endCursor);
}

function isBefore(cursor1, cursor2) {
    return (cursor1.lineNumber < cursor2.lineNumber) || (
        (cursor1.lineNumber === cursor2.lineNumber) &&
        (cursor1.column < cursor2.column));
}

function isAfter(cursor1, cursor2) {
    return (cursor1.lineNumber > cursor2.lineNumber) || (
        (cursor1.lineNumber === cursor2.lineNumber) &&
        (cursor1.column > cursor2.column));
}

/**************************************
 *
 * SECTION: EDITOR WRAPPER
 *
 **************************************/

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
    return makeCursor(cursor.lineNumber, cursor.column - 1);
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
function getSelection() {
    var selection = editor.getSelection();
    selection = [
        makeCursor(selection.startLineNumber, selection.startColumn - 1),
        makeCursor(selection.endLineNumber, selection.endColumn - 1),
    ];
    if (selection[0].lineNumber !== selection[1].lineNumber
        || selection[0].column !== selection[1].column) {
        return selection;
    } else {
        return null;
    }
}

/**
 * Set the selection in the editor
 *
 * @param {Cursor} startCursor - the start of the selection
 * @param {Cursor} endCursor - the end of the selection
 * @returns {undefined}
 */
function setSelection(startCursor, endCursor) {
    editor.setSelection({
        "startLineNumber":startCursor.lineNumber,
        "startColumn":startCursor.column + 1,
        "endLineNumber":endCursor.lineNumber,
        "endColumn":endCursor.column + 1,
    });
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

/**************************************
 *
 * SECTION: EXPORTS
 *
 **************************************/

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
