var editor;
var position;

// initialize dictionary
var blockDict = [
    {
        'blockName': 'IF',
        'code': 'if (i == true) {\n\t// do something \n}',
        'buttonColor': '#ff3399', // fuschia
    },
    {
        'blockName': 'IF-ELSE',
        'code': 'if (i == true) {\n\t// do something \n} else {\n\t// do something \n}',
        'buttonColor': '#b8860b', // darkgoldenrod
    },
    {
        'blockName': 'FOR',
        'code': 'for (var i = 0; i < value; i++){\n\t // do something \n}',
        'buttonColor': '#00bfff', // deepskyblue
    },
    {
        'blockName': 'WHILE',
        'code': 'while (i < 10) {\n\t// do something \n}',
        'buttonColor': '#32cd32' // lime green
    },
    {
        'blockName': 'VARIABLE',
        'code': 'var variableName = value;',
        'buttonColor': '#9932cc' // darkorchid
    },
    {
        'blockName': 'FUNCTION',
        'code': 'function name(parameters) {\n\t // do something \n\t return value;\n}',
        'buttonColor': '#ff7f50' // coral
    },
];

function load_quine() {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200 && editor !== undefined) {
            editor.setValue(this.responseText);
        }
    };
    xhttp.open("GET", "brick-editor.js", true);
    xhttp.send();
}

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
    load_quine();

    editor.onMouseLeave(function (e) {
        position = editor.getPosition();
    });
}

// add a tab for every four spaces before cursor position for correct indenting

function getIndent(position) {
    var tabs = "";
    for (var i = 0; i < position.column - 2; i = i + 4) {
        tabs += "\t";
    }
    return tabs;
}

function indentCode(code, tabs) {
    var codeArray = code.split("\n");
    for (var i = 1; i < codeArray.length; i++) {
        codeArray[i] = tabs.concat(codeArray[i]);
    }
    return codeArray.join("\n");
}

// function to handle button clicks
function buttonHandler(i) {
    var template = blockDict[i]["code"];
    var buffer = editor.getValue();
    var position = editor.getPosition();

    // add block to buffer string and update editor
    var new_text = addBlock(template, buffer, position);
    var ast = esprima.parseScript(new_text, {range: true, tokens: true, comment: true});
    ast = escodegen.attachComments(ast, ast.comments, ast.tokens);
    editor.setValue(escodegen.generate(ast, { comment: true }));
   
    // update cursor position
    editor.setPosition(position);
}

// adds a block based on word
function addBlock(template, buffer, position) {
    var firstPart = getBeforePosition(buffer, position);
    var lastPart = getAfterPosition(buffer, position);
    var tabs = getIndent(position);

    return [firstPart, indentCode(template, tabs), lastPart].join("");
}

// adds all the blocks to the button container
function addBlocksHTML() {
    for (var i = 0; i < blockDict.length; i++) {
        var HTMLfunction = 'buttonHandler(\'' + i + '\')';

        // creates button and sets all attributes
        var block = document.createElement("button");
        block.setAttribute("type", "button");
        block.setAttribute("class", "addButton");
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

// returns a string containing characters before cursor position
function getBeforePosition(buffer, position) {
    var splitBuffer = buffer.split("\n");
    var firstPart = splitBuffer.slice(0, position.lineNumber - 1);
    var sameLine = splitBuffer.slice(position.lineNumber - 1, position.lineNumber).join('');
    sameLine = sameLine.split('');
    if (position.column > 0){
        position.column = position.column - 1;
    }
    sameLine = sameLine.slice(0, position.column).join('');
    firstPart.push(sameLine);
    var firstPart1 = firstPart.join('\n');

    return firstPart1;
}

// returns a string containing characters after cursor position
function getAfterPosition(buffer, position) {
    var splitBuffer = buffer.split("\n");                                                       // split string into array of lines
    var lastPart = splitBuffer.slice(position.lineNumber);                                      // select only the lines after the cursor
    var sameLine = splitBuffer.slice(position.lineNumber - 1, position.lineNumber).join('');    // select the cursors line
    sameLine = sameLine.split('');                                                              // select only the characters after the cursor in the line
    sameLine = sameLine.slice(position.column - 1).join('');
    lastPart.unshift(sameLine);                                                                 // add those characters to the beginning of the array
    var lastPart1 = lastPart.join('\n');                                                        // join all the array elements into a string

    return lastPart1;                                                                           // return the string
}
