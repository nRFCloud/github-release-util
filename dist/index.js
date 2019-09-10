#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const mime = require('mime-types');
const archiver = require('archiver');
const inquirer = require('inquirer');
const Octokit = require('@octokit/rest');
const program = require('commander');
var LogType;
(function (LogType) {
    LogType[LogType["info"] = 0] = "info";
    LogType[LogType["log"] = 1] = "log";
    LogType[LogType["error"] = 2] = "error";
    LogType[LogType["debug"] = 3] = "debug";
})(LogType || (LogType = {}));
const log = (msg, type = LogType.log) => {
    const colors = {
        [LogType.info]: 'gray',
        [LogType.log]: 'cyan',
        [LogType.error]: 'red',
        [LogType.debug]: 'yellow',
    };
    console.log(chalk[colors[type]](msg));
};
const runCmd = (cmd) => new Promise((resolve, reject) => {
    require('child_process').exec(cmd, (err, stdout) => {
        if (err)
            reject(`Command "${cmd}" failed. Error: "${err}"`);
        resolve(stdout);
    });
});
const getTagBasedMessage = async (prevTag, targetTag) => await runCmd(`git log --pretty=format:"%ad - %h - %s" --date=short ${prevTag}..${targetTag}`);
(async () => {
    let config;
    if (process.argv &&
        process.argv[2] && (process.argv[2].toLowerCase().trim() === '--cli' ||
        process.argv[2].toLowerCase().trim() === '-l')) {
        program
            .option('-o, --owner <owner>', 'owner (default to .env file)')
            .option('-r, --repo <repo>', 'repo (default to .env file)')
            .option('-k, --git-hub-token <gitHubToken>', 'gitHub token (default to .env file)')
            .option('-n, --release-name <releaseName>', 'release name (default to tag)')
            .option('-m, --release-message <releaseMessage>', 'release message')
            .option('-t, --target-tag <targetTag>', 'release tag')
            .option('-p, --prev-tag <prevTag>', 'previous tag (for commit message purposes, only used if release message is not defined)')
            .option('-b, --is-beta', 'Is beta release')
            .option('-c, --should-upload-build-assets', 'compress and upload build assets')
            .option('-d, --build-dir <buildDir>', 'build dir')
            .option('-l, --cli', 'cli')
            .option('-v, --show-token', 'show token (shows token in output, defaults to false.)')
            .parse(process.argv);
        config = program.opts();
        config.confirmed = true;
        if (!config.releaseName)
            config.releaseName = config.targetTag;
        if (!config.gitHubToken)
            config.gitHubToken = process.env.GITHUB_TOKEN || '';
        if (!config.owner)
            config.owner = process.env.GITHUB_OWNER || '';
        if (!config.repo)
            config.repo = process.env.GITHUB_REPO || '';
        if (!config.releaseMessage && config.prevTag && config.targetTag) {
            config.releaseMessage = await getTagBasedMessage(config.prevTag, config.targetTag);
        }
    }
    else {
        config = await askQuestions();
    }
    if (!config.confirmed) {
        process.exit();
    }
    doRelease(config);
})();
async function doRelease(config) {
    const { prevTag, targetTag, gitHubToken, isBeta, releaseMessage, releaseName, owner, repo, buildDir, shouldUploadBuildAssets, cli, } = config;
    try {
        if (!(gitHubToken && owner && repo && targetTag)) {
            throw new Error(`Token, owner, repo, and tag are required.`);
        }
        const client = new Octokit({
            auth: gitHubToken,
        });
        log(`\n\nConfig:`);
        log(Object
            .keys(config)
            .map(key => {
            const val = config.showToken && key === 'gitHubToken' && !config.showToken ? '<secret>' : config[key];
            return `${key}: ${val}`;
        })
            .join('\n'), LogType.info);
        log(`\n\nCreating release...`);
        const release = await client.repos.createRelease({
            owner,
            repo,
            name: releaseName,
            body: releaseMessage,
            tag_name: targetTag,
            prerelease: isBeta,
        });
        log('DONE!', LogType.info);
        if (shouldUploadBuildAssets) {
            log(`\n\nZipping...`);
            const file = await zipFile(buildDir, targetTag, isBeta);
            log('DONE!', LogType.info);
            log('\n\nUploading...');
            await client.repos.uploadReleaseAsset({
                url: release.data.upload_url,
                headers: file.headers,
                file: file.buffer,
                name: file.name,
            });
            log(`DONE!`, LogType.info);
            const { doDelete } = cli === false
                ? await inquirer.prompt([{
                        name: 'doDelete',
                        message: `Delete build assets "${file.name}"?`,
                        default: true,
                        type: 'confirm',
                    }])
                : { doDelete: true };
            if (doDelete === true) {
                const fileToDelete = `${process.cwd()}${path.sep}${file.name}`;
                log('\n\nDeleting...');
                fs.unlinkSync(fileToDelete);
                log('DONE!', LogType.info);
            }
        }
    }
    catch (err) {
        log(`Error with release: "${err}"`, LogType.error);
    }
    finally {
        log('\n\n');
        process.exit();
    }
}
async function zipFile(dirName, tag, isBeta) {
    const filename = `${tag}_${isBeta ? 'beta' : 'prod'}_build-assets.zip`;
    const cwd = `${process.cwd()}${path.sep}`;
    const buildDir = `${cwd}${dirName}`;
    const dirNotFoundError = `Build directory "${buildDir}" not found.`;
    let dirStats;
    try {
        dirStats = fs.statSync(buildDir);
    }
    catch (err) {
        throw new Error(dirNotFoundError);
    }
    if (!dirStats.isDirectory()) {
        throw new Error(dirNotFoundError);
    }
    return new Promise((resolve, reject) => {
        const archive = archiver('zip');
        const output = fs.createWriteStream(`${cwd}${filename}`);
        output.on('close', () => {
            const fullPath = path.resolve(`.${path.sep}`, filename);
            const stats = fs.statSync(fullPath);
            if (!stats.isFile()) {
                reject(`Could not find file "${fullPath}"`);
            }
            const headers = {
                'Content-Type': mime.lookup(fullPath),
                'Content-Length': stats.size,
            };
            const buffer = fs.readFileSync(fullPath);
            resolve({
                name: filename,
                fullPath,
                headers,
                buffer,
            });
        });
        archive.on('error', err => {
            reject(err);
        });
        archive.pipe(output);
        archive.glob(`${dirName}/**/*`);
        archive.finalize();
    });
}
async function askQuestions() {
    const tags = await runCmd(`git tag`);
    const fiveMostRecentTags = tags
        ? tags
            .split('\n')
            .slice(-5)
            .reverse()
            .filter(tag => tag.length)
        : null;
    let releaseMessage = '';
    if (!fiveMostRecentTags) {
        log(`At least one tag required to create a release.`, LogType.error);
        process.exit(1);
    }
    const answers = await inquirer.prompt([{
            name: 'isBeta',
            message: 'Is this a pre-release?',
            type: 'confirm',
            default: false,
        }, {
            name: 'targetTag',
            message: 'Which tag is this release for? (choose one)',
            type: 'list',
            choices: fiveMostRecentTags,
            when: () => !!fiveMostRecentTags
        }, {
            name: 'prevTag',
            message: 'What is the previous tag? (choose one)',
            type: 'list',
            choices: answers => fiveMostRecentTags && fiveMostRecentTags.filter(tag => tag !== answers.targetTag),
            when: () => !!fiveMostRecentTags,
        }, {
            name: 'releaseName',
            message: 'Release name',
            type: 'input',
            default: ({ targetTag }) => targetTag,
        }, {
            name: 'customReleaseMessage',
            message: 'Release message',
            type: 'input',
            when: ({ prevTag, targetTag }) => !targetTag || !prevTag,
        }, {
            name: 'shouldUploadBuildAssets',
            message: 'Compress and upload build assets?',
            type: 'confirm',
            default: false,
        }, {
            name: 'buildDir',
            message: 'Assets directory',
            type: 'input',
            default: 'cdn',
            when: ({ shouldUploadBuildAssets }) => !!shouldUploadBuildAssets,
        }, {
            name: 'showToken',
            message: 'Show sensitive details in output?',
            type: 'confirm',
            default: false,
        }, {
            name: 'gitHubToken',
            message: 'GitHub token',
            type: 'input',
            when: () => !process.env.GITHUB_TOKEN
        }, {
            name: 'owner',
            message: 'Repo owner (organization name/username)',
            type: 'input',
            when: () => !process.env.GITHUB_OWNER,
        }, {
            name: 'repo',
            message: 'Repo name',
            type: 'input',
            when: () => !process.env.GITHUB_REPO,
        }, {
            name: 'confirmed',
            type: 'confirm',
            default: false,
            message: async (answers) => {
                const { gitHubToken, targetTag, prevTag, releaseName, isBeta, customReleaseMessage, owner, repo, shouldUploadBuildAssets, buildDir, showToken, } = answers;
                releaseMessage = prevTag && targetTag
                    ? await getTagBasedMessage(prevTag, targetTag)
                    : customReleaseMessage;
                if (!gitHubToken)
                    answers.gitHubToken = process.env.GITHUB_TOKEN;
                if (!owner)
                    answers.owner = process.env.GITHUB_OWNER;
                if (!repo)
                    answers.repo = process.env.GITHUB_REPO;
                return `
You are about to create a release on GitHub:

Tag: ${targetTag}
Prerelease: ${isBeta ? 'Yes' : 'No'}
Release Name: ${releaseName}
Release Message:
${releaseMessage}

Upload Build Assets: ${shouldUploadBuildAssets ? 'Yes' : 'No'}
${shouldUploadBuildAssets ? `Build Dir: ${buildDir}` : ''}

Owner: ${answers.owner}
Repo: ${answers.repo}
Token: ${showToken ? answers.gitHubToken : '<secret>'}

Are you sure?`;
            },
        }]);
    answers.cli = false;
    answers.releaseMessage = releaseMessage;
    return answers;
}
