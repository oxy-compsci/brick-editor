# Brick Editor

An editor to help beginners transition from block-based languages.

## What problem does this project solve?

Currently there are two primary ways for young programmers to write code: text editor and block editor. Ultimately, we want young programmers to use text editors, but due to their high learning curve, most K-5 programmers start with block editors. The problem with block editors is that they still don’t make it easy to transition to text editing. The skills of editing blocks seem very independent of writing text base code. The other issue with block based editors is that kids quickly see them as “not really coding”l or for kids that are younger. 

## What is the vision?

The vision is to create an add-on to a text editor that acts as training wheels for young coders. The add-on would make it really hard for students to enter invalid states, especially states that require multiple fixes. Additionally, the add-on would make smart decisions about what the student would enter. The easiest way to think of it is a cross between snippets and blocks, right inside the editor. 


## Running

1. Install [`node.js`](https://nodejs.org/en/download/).

2. Clone this repository and go into that folder:

		git clone https://github.com/oxy-compsci/brick-editor.git
		cd brick-editor

3. Install the necessary `npm` modules:

		npm install .

4. Start the server:

		npm run simpleserver

5. Go to [http://localhost:8888]().
