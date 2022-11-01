# MiniScript-Syntax README

MiniScript is a simple, elegant language for embedding or learning to program. It is the language of the [Mini Micro](https://miniscript.org/MiniMicro/index.html) and is also available as a [3rd party scripting language for Unity](https://assetstore.unity.com/packages/tools/integration/miniscript-87926).

This repository contains an extension for Microsoft's VS Code (<https://code.visualstudio.com/>) to provide syntax highlighting and language support for MiniScript. The tmLanguage syntax definition may or may not work in other editors too; you are most welcome to use it for developing extensions for those!

## Features

Provides basic syntax highlighting for VS Code.

![Example Screenshot of MiniScript Highlighting](images/screenshot.png "Example Screenshot of MiniScript Highlighting")

## Installation

The easiest way to get the extension is to search 'miniscript' in VS Code's extension tab, or install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=chaos95.miniscript). If you would like to do local development on the extension, or if you prefer not to install from the marketplace, you can do a local install from this git repository instead.

### Install from git repository
To get your extension running in VS Code, checkout the entire miniscript-syntax folder under your local extensions folder:

- Windows: %USERPROFILE%\.vscode\extensions
- macOS/Linux: $HOME/.vscode/extensions

To check it's working, try opening "Example1.ms" from the examples folder.

## Contributing
If you would like to contribute ideas, code, bug reports etc, please do. I am pretty busy with 4 kids and a full-time job, and maintaining this extension in my (very limited) spare time, but I will endeavour to respond to any issues/PRs as quickly as possible.
### Reporting bugs, requesting features, etc
Bug/issue reports and feature requests are welcome! Please take a look at the [issues](https://github.com/chaos95/miniscript-syntax/) on the github repository and feel free to add your input if someone else has already reported the same thing, or create a new issue if you can't find one already!

### Pull requests
Pull requests are also very welcome! At some point we will hopefully have a more in-depth contributor guide as well.

### Want more info?

The source repository for this highlighter is here:
<https://github.com/chaos95/miniscript-syntax>

The MiniScript Discord server is quite active and you will find some lovely helpful people there: <https://discord.gg/3dvH5FRN>

The MiniScript Unity forum thread is here:
<https://forum.unity.com/threads/miniscript-lightweight-scripting-language-for-your-game.373853/>

A big thank you to Colin MacLeod for creating the first version of this extension, and for MIT licensing it so I could continue to maintain it in his stead: <https://bitbucket.org/colinmac/miniscript-syntax>
