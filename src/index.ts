#!/usr/bin/env node
require('dotenv').config();

const inquirer = require('inquirer');
const program = require('commander');


import {
	log,
	runCmd,
	LogType,
	getTagBasedMessage,
	generatePrettyReleaseMessage,
} from './utils';

import { doRelease, Config } from './release';

const defaultBranch = 'master';

(async () => {
	let config: Config;

	if (
		process.argv && 
		process.argv[2] && (
			process.argv[2].toLowerCase().trim() === '--cli' || 
			process.argv[2].toLowerCase().trim() === '-l'
		)
	) {
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
			.option('-a, --branch', `target branch (defaults to "${defaultBranch}")`)
			.parse(process.argv);

		config = program.opts();
		config.confirmed = true;

		if (!config.releaseName) config.releaseName = config.targetTag;
		if (!config.gitHubToken) config.gitHubToken = process.env.GITHUB_TOKEN || '';
		if (!config.owner) config.owner = process.env.GITHUB_OWNER || '';
		if (!config.repo) config.repo = process.env.GITHUB_REPO || '';
		if (!config.branch) config.branch = defaultBranch;

		if (!config.releaseMessage) {
			const commits = await getTagBasedMessage(config.prevTag || 'master', config.targetTag);
			const repoUrl = `https://github.com/${config.owner}/${config.repo}`;
			config.releaseMessage = generatePrettyReleaseMessage(
				commits,
				repoUrl,
				config.targetTag,
				config.prevTag
			);
		}
	}else {
		 config = await askQuestions();
	}

	if (!config.confirmed) {
		process.exit();
	}

	doRelease(config);
})();

async function askQuestions(): Promise<Config> {
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
		name: 'branch',
		message: 'Branch name',
		type: 'input',
		default: defaultBranch,
	}, {
		name: 'targetTag',
		message: 'Which tag is this release for? (choose one)',
		type: 'list',
		choices: fiveMostRecentTags,
		when: (): boolean => !!fiveMostRecentTags
	}, {
		name: 'prevTag',
		message: 'What is the previous tag? (choose one)',
		type: 'list',
		choices: (answers: Partial<Config>) => fiveMostRecentTags && fiveMostRecentTags.filter(tag => tag !== answers.targetTag),
		when: (): boolean => !!fiveMostRecentTags,
	}, {
		name: 'releaseName',
		message: 'Release name',
		type: 'input',
		default: ({ targetTag }: Partial<Config>) => targetTag,
	}, {
		name: 'customReleaseMessage',
		message: 'Release message',
		type: 'input',
		when: ({prevTag, targetTag}: Partial<Config>) => !targetTag || !prevTag,
	}, {
		name: 'shouldUploadBuildAssets',
		message: 'Compress and upload build assets?',
		type: 'confirm',
		default: false,
	},  {
		name: 'buildDir',
		message: 'Assets directory',
		type: 'input',
		default: 'cdn',
		when: ({shouldUploadBuildAssets}: Partial<Config>) => !!shouldUploadBuildAssets,
	},{
		name: 'showToken',
		message: 'Show sensitive details in output?',
		type: 'confirm',
		default: false,
	},{
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
		message: async (answers: Partial<Config>) => {
			const {
				gitHubToken,
				targetTag,
				prevTag,
				releaseName,
				isBeta,
				branch,
				customReleaseMessage,
				owner,
				repo,
				shouldUploadBuildAssets,
				buildDir,
				showToken,
			} = answers;

			releaseMessage = prevTag && targetTag 
				? await getTagBasedMessage(prevTag, targetTag)
				: customReleaseMessage;

			if (!gitHubToken) answers.gitHubToken = process.env.GITHUB_TOKEN;
			if (!owner) answers.owner = process.env.GITHUB_OWNER;
			if (!repo) answers.repo = process.env.GITHUB_REPO;

			return `
You are about to create a release on GitHub:

Tag: ${targetTag}
Prerelease/Is Beta: ${isBeta ? 'Yes' : 'No'}
Branch: ${branch}
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
