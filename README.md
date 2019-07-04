# github-release-util
Utility script to automate gitHub release workflow and uploading of build assets (optional). 

## Usage
To use with your project install (`npm i -D github-release-util`) and add the following to your `package.json`:
```
{
    "scripts": {
        "release": "./node_modules/github-release-util/dist/index.js"
    }
}
```

Then you can run `npm run release` to automatically create a new release on GitHub.

To run directly from the command line:
```
npx gh-release
```

## Configuration
This script automatically looks for a `.env` file at the project root. The repo includes a `.env.sample` file. To use with your project, run `cp node_modules/github-release-util/.env.sample .env`. The file includes the following config vars:

```
GITHUB_REPO=
GITHUB_OWNER=
GITHUB_TOKEN=
```

You will always be prompted for these, the values from the `.env` file will be set as the defaults if the file exists.

## Gotchas
The release must be linked to a tag. And the tag for which you're deploying must have been created before you run this script.