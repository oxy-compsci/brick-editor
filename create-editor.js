// global variable for the editor
var editor = null;

// create monaco editor
require.config({
    paths: {
        'vs': '../node_modules/monaco-editor/min/vs'
    }
});
require(['vs/editor/editor.main'], function () {
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

    editor.addCommand(monaco.KeyCode.Backspace, backspaceHandler);
    editor.addCommand(monaco.KeyCode.Delete, deleteHandler);
});
