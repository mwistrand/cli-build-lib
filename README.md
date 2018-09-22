# @dojo/cli-build-lib

[![Build Status](https://travis-ci.org/dojo/cli-build.svg?branch=master)](https://travis-ci.org/dojo/cli-build-lib)
[![Build status](https://ci.appveyor.com/api/projects/status/31du0respjt6p98i/branch/master?svg=true)](https://ci.appveyor.com/project/Dojo/cli-build-lib/branch/master)
[![codecov](https://codecov.io/gh/dojo/cli-build-lib/branch/master/graph/badge.svg)](https://codecov.io/gh/dojo/cli-build-lib)
[![npm version](https://badge.fury.io/js/%40dojo%2Fcli-build-lib.svg)](https://badge.fury.io/js/%40dojo%2Fcli-build-lib)

The official CLI command for building Dojo libraries.

- [Usage](#usage)
- [Features](#features)
  - [Building](#building)
  - [Serving](#serving-an-example-page)
  - [Watching](#watching)
  - [Eject](#eject)
- [How do I contribute?](#how-do-i-contribute)
  - [Installation](#installation)
  - [Testing](#testing)
- [Licensing information](#licensing-information)

## Usage

To use `@dojo/cli-build-lib` in a single project, install the package:

```bash
npm install @dojo/cli-build-lib
```

## Features

By default, libraries are built using an evergreen configuration, meaning that the build process:

* Prefers `.mjs` modules over `.js` modules
* Uses `{ target: 'es6', module: 'esnext' }` Typescript compiler options

### Building

There are three modes available to build Dojo library projects: `dist`, `dev` and `test`. The mode required can be passed using the `--mode` flag:

```bash
dojo build --mode dist
```

The built lbrary files are written to the `output/{mode selected}` directory. The output mirrors the `src` directory, so if the library contains the file `src/hello-world/index.ts`, the transpiled file will be output to `output/{mode}/hello-world/index.(m)js`.

Note: `dist` is the default mode and so can be run without any arguments, `dojo build`.

#### Dist Mode

The `dist` mode creates a production ready build.

#### Dev mode

The `dev` mode creates a build that has been optimized for debugging and development.

#### Test mode

The `test` mode creates bundles that can be used to run the unit and functional tests.

### Serving An Example Page

A web server can be started with the `--serve` (`-s`) flag. By default, the build is served on port 9999, but this can be changed with the `--port` (`-p`) flag:

```bash
# build once and then serve on port 3000
dojo build -s -p 3000
```

### Watching

Building with the `--watch` option observes the file system for changes, and recompiles to the appropriate `output/{dist|dev|test}` directory, depending on the current `--mode`.

```bash
dojo build -w # start a file watch
dojo build -s -w # watch and serve
```

### Legacy

To build for legacy environments use the `--legacy` or `-l` flag, which will use the project's local tsconfig to determine the TypeScript format and target CSS builds to legacy browsers.

### Eject

The `@dojo/cli-build-lib` functionality can be ejected with the `dojo eject` command. Ejecting produces the following files under the `config/build-lib` directory:

- `build-options.json`: the build-specific config options removed from the `.dojorc`.
- `dojo-build-lib.js`: the shell script used to run the ejected build.
- `lib.js`: the library build functionality.

As already noted, the dojorc's `build-lib` options are moved to `config/build-lib/build-options.json` after ejecting. Further, a simple shell script is provided at `config/build-lib/dojo-build-lib.js`, and if possible, a symlink is created at the project root as `dojo-build-lib`. **Note**: eject must be run with administrative permissions on windows for the symlink to be created successfully.

You can run a build with:

```bash
./dojo-build-lib --mode={dev|dist|test} --legacy --watch --serve
```

## How do I contribute?

We appreciate your interest! Please see the [Dojo 2 Meta Repository](https://github.com/dojo/meta#readme) for the Contributing Guidelines. This repository uses [prettier](https://prettier.io/) for code style and is configured with a pre-commit hook to automatically fix formatting issues on staged `.ts` files before performing the commit.

### Installation

To start working with this package, clone the repository and run `npm install`.

In order to build the project run `grunt dev` or `grunt dist`.

### Scripts

#### test

Cleans output and builds the source before running all unit and functional tests.

#### prettier

Runs [prettier](https://prettier.io/) on all `.ts` files in the `src` and `tests` directories, this will fix any detected code style violations.

### Testing

Test cases MUST be written using [Intern](https://theintern.github.io) using the BDD test interface and Assert assertion interface.

90% branch coverage MUST be provided for all code submitted to this repository, as reported by istanbul’s combined coverage results for all supported platforms.

The command is tested by running via the Dojo CLI and asserting the build output against known fixtures. To do this, a test artifact needs to be built and installed into the `test-app`:

```
npm test
```

Once the test artifact has been installed, if there have been no changes to the command code `grunt test` can be used to repeat the tests.
## Licensing information

© 2018 [JS Foundation](https://js.foundation/). [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
