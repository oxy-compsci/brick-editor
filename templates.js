// initialize dictionary
var blockDict = [ // eslint-disable-line no-unused-vars
    {
        "blockName": "IF",
        "code": "if (i == true) {\n\t// do something \n}",
        "buttonColor": "#ff3399", // fuschia
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "if statement"
    },
    {
        "blockName": "IF-ELSE",
        "code": "if (i == true) {\n\t// do something \n} else {\n\t// do something \n}",
        "buttonColor": "#b8860b", // darkgoldenrod
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "if-else statement"
    },
    {
        "blockName": "FOR",
        "code": "for (var i = 0; i < value; i++){\n\t // do something \n}",
        "buttonColor": "#00bfff", // deepskyblue
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "for loop"
    },
    {
        "blockName": "WHILE",
        "code": "while (i < 10) {\n\t// do something \n}",
        "buttonColor": "#32cd32", // lime green
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "while loop"
    },
    {
        "blockName": "VARIABLE",
        "code": "var variableName = value;",
        "buttonColor": "#9932cc", // darkorchid
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "variable"
    },
    {
        "blockName": "FUNCTION",
        "code": "function name(parameters) {\n\t // do something \n\t return value;\n}",
        "buttonColor": "#ff7f50", // coral
        "kind": "monaco.languages.CompletionItemKind.Function",
        "documentation": "function"
    },
];
