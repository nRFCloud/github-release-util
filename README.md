# @nrfcloud/github-release-util
Utility script to automate gitHub release workflow and uploading of build assets (optional). 

- [Usage](#usage)
  - [Interactive Mode](#interactive-mode)
  - [CLI mode](#cli-mode)
- [Configuration](#configuration)
- [Contributing](#contributing)
  - [Development workflow](#development-workflow)
  - [Testing](#testing)
  - [Submitting a PR (or issue)](#submitting-a-pr-or-issue)
- [Gotchas](#gotchas)

## Usage

### Interactive Mode
To use with your project install (`npm i -D @nrfcloud/github-release-util`) and add the following to your `package.json`. Afterwards, you can run `npm run release` to automatically create a new release on GitHub.
```
{
    "scripts": {
        "release": "github-release-util"
    }
}
```

### CLI mode
By default this script walks the user through the decisions to create a release. It also has an option to send in all the options at once (no prompt). The following is an example of the available options. You can get this output by running `npx github-release-util --cli --help`.

```
Usage: index.ts [options]

Options:
  -o, --owner <owner>                     owner (default to .env file)
  -r, --repo <repo>                       repo (default to .env file)
  -k, --git-hub-token <gitHubToken>       gitHub token (default to .env file)
  -n, --release-name <releaseName>        release name (default to tag)
  -m, --release-message <releaseMessage>  release message
  -t, --target-tag <targetTag>            release tag
  -p, --prev-tag <prevTag>                previous tag (for commit message purposes, only used if release message is not defined)
  -b, --is-beta                           Is beta release
  -c, --should-upload-build-assets        compress and upload build assets
  -d, --build-dir <buildDir>              build dir
  -l, --cli                               cli
  -v, --show-token                        show token (shows token in output, defaults to false.)
  -h, --help                              output usage information

# without build assets
npx github-release-util --cli -t "<tag>"

# with build assets
npx github-release-util --cli -t "<tag>" -c -d "<build dir>"

# this can also be called without the alias by using the following:
npx @nrfcloud/github-release-util --cli -t "<tag>" -c -d "<build dir>"
```

## Configuration
This script automatically looks for a `.env` file at the project root. The repo includes a `.env.sample` file. To use with your project, run `cp node_modules/@nrfcloud/github-release-util/.env.sample ./.env`. The file includes the following config variables:

```
GITHUB_REPO=
GITHUB_OWNER=
GITHUB_TOKEN=
```

In interactive mode, you will be prompted for these if the values don't exist in the `.env` file.

In CLI mode, the script will fall back to the values in the `.env` file if not passed in explicitly. 

Get a GitHub token by [following these steps](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line).

## Contributing

### Development workflow
```bash
# make changes to your files and commit
git commit -am "<feat|fix|refactor|deps|style|chore>: <commit message>"

# run tests
npm run test

# build
npm run build

# test interactive mode
node ./dist/index.js

# test cli mode
node dist/index.js --cli --owner <repo owner> --repo <repo name> --build-dir <build dir> --target-tag <new tag> --prev-tag <prev tag> [--should-upload-build-assets]
```
### Testing
Tests are done with `ts-jest` and contained in the `test` dir.
```bash
npm run test
```

### Submitting a PR (or issue)

Submit a PR or an issue [via github](https://github.com/nRFCloud/github-release-util)

## Gotchas
The release must be linked to a tag. And the tag for which you're deploying must have been created before you run this script.

