// load node modules
var recast = require("recast");
var estraverse = require("estraverse");

// EVENT HANDLERS



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

// TEXT EDITING CODE

/**
 * Find the closest shared parent between multiple positions.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {[Location]} positions - List of LineNumber and Column objects.
 * @returns {node}
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
                        } else if (node.loc.end.column >= positions[i]["lineNumber"]) {
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
    return parentNode;
}


/**
 * Find the closest parent node that contains the position.
 *
 * @param {AST} ast - the root of the AST to search through.
 * @param {Location} position - A LineNumber and Column object.
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
    return null;
}

// DELETING FUNCTIONS

/**
 * Delete selected text
 * @param {selectionPosition} - Start line and column, end line and column of selection
 * @returns
 */
function deleteSelected(selectionPosition) {
    var startPosition = { lineNumber: selectionPosition.startLineNumber, column: selectionPosition.startColumn };
    var endPosition = { lineNumber: selectionPosition.endLineNumber, column: selectionPosition.endColumn };
    var parentNode = findClosestParent(startPosition);
    if (findClosestParent(startPosition) == findClosestParent(endPosition)) {
        confirmDelete(startPosition);
    } else {
        var positions = [startPosition, endPosition];
        parentNode = findClosestCommonParent(positions);
        confirmDelete
    }
}

/**
 * Delete a node
 * @param {Position} position - The position of the cursor.
 * @returns {string} Text with block removed
 */
function deleteBlock(position) {
    var ast = recast.parse(buffer);
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
function deleteChar(position) {
    var buffer = editor.getValue();
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

/**
 * Calculates number of necessary tabs from cursor position for correct indenting
 * @param {Position} position - A lineNumber and column object.
 * @returns {string} String of tabs
 */
function getIndent(position) {
    var tabs = "";
    for (var i = 0; i < position.column - 2; i = i + 4) {
        tabs += "\t";
    }
    return tabs;
}

/**
 * Indents block of code
 * @param {string} code - The text to be formatted.
 * @param {string} tabs - The calculated number of tabs.
 * @returns {string} 
 */
function indentCode(code, tabs) {
    var codeArray = code.split("\n");
    for (var i = 1; i < codeArray.length; i++) {
        codeArray[i] = tabs.concat(codeArray[i]);
    }
    return codeArray.join("\n");
}

/**
 * Handles button clicks
 * @param {number} i - Index of code in dictionary
 */
function buttonHandler(i) {
    var template = blockDict[i]["code"];
    var buffer = editor.getValue();
    var position = getPosition();

    // add block to buffer string and update editor
    var new_text = addBlock(template, buffer, position);
    var ast = recast.parse(new_text);
    editor.setValue(recast.print(ast).code);
   
    // update cursor position
    setPosition(position);
}

/**
 * Adds a block based on button keyword
 * @param {string} template - A string of block of text to add.
 * @param {string} buffer - A string of text from the editor.
 * @param {Position} position - A lineNumber and column object.
 * @returns {string} Updated text string
 */
function addBlock(template, buffer, position) {
    var firstPart = getBeforePosition(buffer, position);
    var lastPart = getAfterPosition(buffer, position);
    var tabs = getIndent(position);

    return [firstPart, indentCode(template, tabs), lastPart].join("");
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
