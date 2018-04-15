// global variables

// the Monaco editor instance
var editor = null; // eslint-disable-line no-unused-vars

// eslint-disable-next-line no-unused-vars
var editorState = {
    // whether the editor buffer is currently parsable
    parsable: null,
    // the last valid parse of the buffer
    parse: null,
    // the editor buffer at the last parsable point
    parsableText: "",
    // whether the cursor was a selection at the last parsable point
    hasSelected: null,
    // the position of the cursor/selection at the last parsable point
    cursor: null,
};
