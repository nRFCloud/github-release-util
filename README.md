# github-release-util
Utility script to automate gitHub release workflow and uploading of build assets (optional). 

## Usage

### Interactive Mode
To use with your project install (`npm i -D github-release-util`) and add the following to your `package.json`. Afterwards, you can run `npm run release` to automatically create a new release on GitHub.
```
{
    "scripts": {
        "release": "gru"
    }
}
```

### CLI mode
By default this script walks the user through the decisions to create a release. It also has an option to send in all the options at once (no prompt). The following is an example of the available options. You can get this output by running `npx gru --cli --help`.

```sh
Usage: index.ts [options]

Options:
  -o, --owner <owner>                     Owner
  -r, --repo <repo>                       Repo
  -k, --git-hub-token <gitHubToken>       GitHub Token
  -n, --release-name <releaseName>        Release Name
  -m, --release-message <releaseMessage>  Release Message
  -t, --target-tag <targetTag>            Release Tag
  -p, --prev-tag <prevTag>                Previous Tag (for commit message purposes, only used if release message is not defined)
  -b, --is-beta                           Is beta release
  -c, --should-upload-build-assets        Compress and upload build assets
  -d, --build-dir <buildDir>              Build dir
  -l, --cli                               Cli
  -h, --help                              output usage information

# without build assets
npx gru --cli -t "<tag>"

# with build assets
npx gru --cli -t "<tag>" -c -d "<build dir>"

# this can also be called without the alias by using the following:
npx @nrfcloud/github-release-util --cli -t "<tag>" -c -d "<build dir>"
```

## Configuration
This script automatically looks for a `.env` file at the project root. The repo includes a `.env.sample` file. To use with your project, run `cp node_modules/github-release-util/.env.sample ./.env`. The file includes the following config variables:

```
GITHUB_REPO=
GITHUB_OWNER=
GITHUB_TOKEN=
```

In interactive mode, you will always be prompted for these, the values from the `.env` file will be set as the defaults if the file exists.

In CLI mode, the script will fall back to these defaults if arguments aren't passed in explicitly. 

Get a GitHub token by [following these steps](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line).

## Gotchas
The release must be linked to a tag. And the tag for which you're deploying must have been created before you run this script.
