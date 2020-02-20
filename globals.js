// global variables

// the Monaco editor instance
var editor = null; // eslint-disable-line no-unused-vars

// eslint-disable-next-line no-unused-vars
var editorState = {

    currState = null,
    prevState = null,
    parsableState = null;

    // if the editable regions are bounded by parenthesis
    inParenthesis: false,

    // save positions of parentheses in relation to beginning and end of buffer
    openParenthesis: null,
    closeParenthesis: null,
    // save cursors of parentheses
    parentheses: null,

};
