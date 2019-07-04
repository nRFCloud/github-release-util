#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const mime = require('mime-types');
const archiver = require('archiver');
const inquirer = require('inquirer');
const Octokit = require('@octokit/rest');

type FileDetails = {
	name: string;
	fullPath: string;
	headers: {'Content-Type': string, 'Content-Length': number};
	buffer: any;
};

type Config = {
	confirmed: boolean,
	isBeta: boolean,
	targetTag: string,
	gitHubToken: string,
	releaseMessage: string,
	releaseName: string,
	owner: string,
	repo: string,
	buildDir: string,
	shouldUploadBuildAssets: boolean,
};

enum LogType {
	info,
	log,
	error,
	debug,
}

const log = (msg: any, type: LogType = LogType.log): void => {
	const colors = {
		[LogType.info]: 'gray',
		[LogType.log]: 'cyan',
		[LogType.error]: 'red',
		[LogType.debug]: 'yellow',
	};

	console.log(chalk[colors[type]](msg));
}

(async () => {
 	const config: Config = await askQuestions();

	if (!config.confirmed) {
		process.exit();
	}

	doRelease(config);
})();

const doRelease = async ({
	targetTag,
	gitHubToken,
	isBeta,
	releaseMessage,
	releaseName,
	owner,
	repo,
	buildDir,
	shouldUploadBuildAssets,
}: Config): Promise<void> => {
	try {
		const client = new Octokit({
			auth: gitHubToken,
		});

		log(`\n\nCreating release...`);
		const release = await client.repos.createRelease({
				owner,
				repo,
				name: releaseName,
				body: releaseMessage,
				tag_name: targetTag,
				prerelease: isBeta,
			});
		log('DONE!\n\n', LogType.info);

		if (shouldUploadBuildAssets) {
			log(`Zipping...`);
			const file: FileDetails = await zipFile(buildDir, targetTag, isBeta);
			log('DONE!', LogType.info);

			log('Uploading...');
			await client.repos.uploadReleaseAsset({
				url: release.data.upload_url,
				headers: file.headers,
				file: file.buffer,
				name: file.name,
			});
			log(`DONE! \n\n`, LogType.info);

			const { doDelete } = await inquirer.prompt([{
				name: 'doDelete',
				message: `Delete build assets "${file.name}"?`,
				default: true,
				type: 'confirm',
			}]);
			
			if (doDelete === true) {
				const fileToDelete = `${process.cwd()}${path.sep}${file.name}`;

				log('\n\nDeleting...');
				fs.unlinkSync(fileToDelete);
				log('DONE! \n\n', LogType.info);
			}
		}
	} catch (err) {
		log(`Error with release: "${err}"`, LogType.error);
	} finally {
		process.exit();
	}
}

async function zipFile(dirName: string, tag: string, isBeta: boolean): Promise<FileDetails> {
	const filename = `${tag}_${isBeta ? 'beta' : 'prod'}_build-assets.zip`;
	const cwd = `${process.cwd()}${path.sep}`;
	const buildDir = `${cwd}${dirName}`;
	const dirNotFoundError = `Build directory "${buildDir}" not found.`;
	let dirStats;

	try {
		dirStats = fs.statSync(buildDir);
	} catch (err) {
		throw new Error(dirNotFoundError);
	}

	if (!dirStats.isDirectory()) {
		throw new Error(dirNotFoundError);
	}

	return new Promise<FileDetails>((resolve, reject) => {
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
			} as FileDetails);
		});

		archive.on('error', err => {
			reject(err);
		});

		archive.pipe(output);
		archive.glob(`cdn/**/*`);
		archive.finalize();
	});
}

async function askQuestions(): Promise<Config> {
	const runCmd = (cmd: string): Promise<string> =>
		new Promise((resolve, reject) => {
			require('child_process').exec(cmd, (err, stdout: string) => {
				if (err) reject(`Command "${cmd}" failed. Error: "${err}"`);
				resolve(stdout);
			});
		})

	const tags = await runCmd(`git tag`);
	const fiveMostRecentTags = tags ? tags.split('\n').slice(-5).reverse() : null;
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
		when: (): boolean => !!fiveMostRecentTags
	}, {
		name: 'prevTag',
		message: 'What is the previous tag? (choose one)',
		type: 'list',
		choices: answers => fiveMostRecentTags && fiveMostRecentTags.filter(tag => tag !== answers.targetTag),
		when: (): boolean => !!fiveMostRecentTags,
	}, {
		name: 'releaseName',
		message: 'Release name',
		type: 'input',
		default: ({ targetTag }) => targetTag,
	}, {
		name: 'customReleaseMessage',
		message: 'Release message',
		type: 'input',
		when: ({prevTag, targetTag}) => !targetTag || !prevTag,
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
		when: ({shouldUploadBuildAssets}) => !!shouldUploadBuildAssets,
	},{
		name: 'gitHubToken',
		message: 'GitHub token',
		type: 'input',
		default: process.env.GITHUB_TOKEN || '',
	}, {
		name: 'owner',
		message: 'Repo owner (organization name/username)',
		type: 'input',
		default: process.env.GITHUB_OWNER || '',
	}, {
		name: 'repo',
		message: 'Repo name',
		type: 'input',
		default: process.env.GITHUB_REPO || '',
	}, {
		name: 'confirmed',
		type: 'confirm',
		default: false,
		message: async ({
			gitHubToken,
			targetTag,
			prevTag,
			releaseName,
			isBeta,
			customReleaseMessage,
			owner,
			repo,
			shouldUploadBuildAssets,
			buildDir
		}) => {
			releaseMessage = prevTag && targetTag 
				? await runCmd(`git log --pretty=format:"%ad - %h - %s" --date=short ${prevTag}..${targetTag}`)
				: customReleaseMessage;

			return `
You are about to create a release on GitHub:

Tag: ${targetTag}
Prerelease: ${isBeta ? 'Yes' : 'No'}
Release Name: ${releaseName}
Release Message:
${releaseMessage}

Upload Build Assets: ${shouldUploadBuildAssets ? 'Yes' : 'No'}
${shouldUploadBuildAssets ? `Build Dir: ${buildDir}` : ''}

Owner: ${owner}
Repo: ${repo}
Token: ${gitHubToken}

Are you sure?`;
		},
	}]);

	answers.releaseMessage = releaseMessage;
	return answers;
}
