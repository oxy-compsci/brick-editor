var editor;
var position;
var blockDict = {};

function start_brick_editor() {
    var jsCode = [
        '"use strict";',
        'function Person(age) {',
        '    if (age) {',
        '        this.age = age;',
        '    }',
        '}',
        '// comment',
        'Person.prototype.getAge = function () {',
        '    return this.age;',
        '};'
    ].join('\n');

    // defines a custom theme with varied color text
    monaco.editor.defineTheme('customTheme', {
        base: 'vs-dark', // can also be vs-dark or hc-black
        inherit: true, // can also be false to completely replace the builtin rules
        // set comment color
        rules: [
            { token: 'comment.js', foreground: 'ff0066', fontStyle: 'bold' },
        ],
        // set editor background color
        colors: {
            //'editor.background': '#EDF9FA',
            'editor.lineHighlightBackground': '#800060',
    }
    });

    editor = monaco.editor.create(document.getElementById("container"), {
        value: jsCode,
        language: "typescript",
        theme: "customTheme"

    });

    editor.onMouseLeave(function (e) {
        position = editor.getPosition();
    });

}

// add a tab for every four spaces before cursor position for correct indenting
var tabs;
function getIndent(position) {
    tabs = "";
    for (var i = 0; i < position.column - 2; i = i + 4) {
        tabs += "\t";
    }
    return tabs;
}

// adds a block based on word
function addBlock(word) {
    tabs = getIndent(position);
    var buffer = editor.getValue();
    var firstPart = getBeforeCursor(buffer, position);
    var lastPart = getAfterCursor(buffer, position);

    // initialize dictionary
    var blockDict = {
        'var': "var variableName = value;",
        'if': "if (i == true) {\n" + tabs + "\t" + "// do something \n" + tabs + "}",
        'if-else': "if (i == true) {\n" + tabs + "\t" + "// do something \n" + tabs + "} else {\n" + tabs + "\t" + "// do something \n" + tabs + "}",
        'for': "for (var i = 0; i < value; i++){\n" + tabs + "\t // do something \n" + tabs + "}",
        'while': "while (i < 10) {\n" + tabs + "\t" + "// do something \n" + tabs + "}",
        'function': "function name(parameters) {\n" + tabs + "\t // do something \n" + tabs + "\t return value;\n" + tabs + "}",
    };

    var block = [firstPart, blockDict[word], lastPart].join("");
    editor.setValue(block);
    editor.setPosition(position);
}


// returns a string containing characters before cursor position
function getBeforeCursor(buffer, position) {
    var splitBuffer = buffer.split("\n");
    var firstPart = splitBuffer.slice(0, position.lineNumber - 1);
    var sameLine = splitBuffer.slice(position.lineNumber - 1, position.lineNumber);
    sameLine = sameLine.slice(0, position.column);
    firstPart.push(sameLine);
    var firstPart1 = firstPart.join("\n");

    return firstPart1;
}

// returns a string containing characters after cursor position
function getAfterCursor(buffer, position) {
    var splitBuffer = buffer.split("\n");                                               // split string into array of lines
    var lastPart = splitBuffer.slice(position.lineNumber);                              // select only the lines after the cursor
    var sameLine = splitBuffer.slice(position.lineNumber, position.lineNumber + 1);     // select the cursors line
    sameLine = sameLine.slice(position.column);                                         // select only the characters after the cursor in the line
    lastPart.unshift(sameLine);                                                         // add those characters to the beginning of the array
    var lastPart1 = lastPart.join("\n");                                                // join all the array elements into a string

    return lastPart1;                                                                   // return the string
}
