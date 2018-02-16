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
        base: 'vs', // can also be vs-dark or hc-black
        inherit: true, // can also be false to completely replace the builtin rules
        // set comment color
        rules: [
            { token: 'comment.js', foreground: 'ff0066', fontStyle: 'bold' },
        ],
        // set editor background color
        colors: {
            'editor.background': '#EDF9FA',
    }
    });

    var editor = monaco.editor.create(document.getElementById("container"), {
        value: jsCode,
        language: "typescript",
        theme: "customTheme"

    });

    editor.addCommand(monaco.KeyCode.KEY_I && monaco.KeyCode.KEY_F, function () {

        addIfStatement();

    });

    editor.addCommand(monaco.KeyCode.KEY_W && monaco.KeyCode.KEY_H && monaco.KeyCode.KEY_I && monaco.KeyCode.KEY_L && monaco.KeyCode.KEY_E, function () {

        addWhileStatement();

    });

    editor.addCommand(monaco.KeyCode.KEY_F & monaco.KeyCode.KEY_U & monaco.KeyCode.KEY_N & monaco.KeyCode.KEY_C & monaco.KeyCode.KEY_T & monaco.KeyCode.KEY_I & monaco.KeyCode.KEY_O & monaco.KeyCode.KEY_N, function () {

        addFunctionStatement();

    });

    //adds an function statement at cursor position
    function addFunctionStatement(){
        var buffer = editor.getValue();
        var position = editor.getPosition();
        var firstPart = getBeforeCursor(buffer, position);
        var lastPart = getAfterCursor(buffer, position);
        var indent = getIndent();
        var functionBlock = [firstPart, "n nameOfFunction(parameter1, parameter2, parameter3) {\n", indent, "\t", "// place here the code to be executed \n", indent, "}", lastPart].join("");
        editor.setValue(functionBlock);
    }

    //adds an while statement at cursor position
    function addWhileStatement(){
        var buffer = editor.getValue();
        var position = editor.getPosition();
        var firstPart = getBeforeCursor(buffer, position);
        var lastPart = getAfterCursor(buffer, position);
        var indent = getIndent();
        var whileBlock = [firstPart, "e (i < 10) {\n", indent, "\t", "// place here the code to be executed \n", indent, "}", lastPart].join("");
        editor.setValue(whileBlock);
    }
    // adds an if statement at cursor position with correct indentation
    function addIfStatement() {
        var buffer = editor.getValue();
        var position = editor.getPosition();
        var firstPart = getBeforeCursor(buffer, position);
        var lastPart = getAfterCursor(buffer, position);
        var indent = getIndent();
        var ifBlock = [firstPart, "f (i == true) {\n", indent, "\t", "// do something \n", indent, "}", lastPart].join("");
        //var ifBlock = ifStatement.join("");
        editor.setValue(ifBlock);

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

    // add a tab for every four spaces before cursor position for correct indenting
    function getIndent() {
        var tabs = "";
        var position = editor.getPosition();
        for (var i = 0; i < position.column - 2; i=i+4) {
            tabs += "\t";
        }
        return tabs;
    }
}
