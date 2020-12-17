const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const Octokit = require('@octokit/rest');

import { zipFile, FileDetails } from './zip';
import { log, LogType } from './utils';

export type Config = {
	targetTag: string,
	gitHubToken: string,
	owner: string,
	repo: string,
	buildDir: string,
	cli: boolean,
	confirmed: boolean,
	isBeta?: boolean,
	releaseName?: string,
	shouldUploadBuildAssets?: boolean,
	releaseMessage?: string,
	prevTag?: string,
	showToken?: boolean,
	branch?: string,
	[key: string]: any,
};

export const doRelease = async (config: Config): Promise<void> => {
	const {
		prevTag,
		targetTag,
		gitHubToken,
		isBeta,
		releaseMessage,
		releaseName,
		owner,
		repo,
		buildDir,
		shouldUploadBuildAssets,
		cli,
	} = config;

	let exitCode = 0;

	try {
		if (!(gitHubToken && owner && repo && targetTag)) {
			throw new Error(`Token, owner, repo, and tag are required.`);
		}

		const client = new Octokit({
			auth: gitHubToken,
		});

		log(`\n\nConfig:`)
		log(
			Object
				.keys(config)
				.map(key => {
					const val: string = key === 'gitHubToken' && config.showToken !== true ? '<secret>' : config[key];
					return `${key}: ${val}`
				})
				.join('\n'),
			LogType.info
		);

		log(`\n\nCreating release...`);
		const release = await client.repos.createRelease({
				owner,
				repo,
				name: releaseName,
				body: releaseMessage,
				tag_name: targetTag,
				prerelease: isBeta,
				target_commitish: 'master'
			});
		log('DONE!', LogType.info);

		if (shouldUploadBuildAssets) {
			log(`\n\nZipping...`);
			const file: FileDetails = await zipFile(buildDir, targetTag, isBeta!);
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
				: { doDelete: true};
			
			if (doDelete === true) {
				const fileToDelete = `${process.cwd()}${path.sep}${file.name}`;

				log('\n\nDeleting...');
				fs.unlinkSync(fileToDelete);
				log('DONE!', LogType.info);
			}
		}
	} catch (err) {
		exitCode = 1;
		log(`Error with release: "${err}"`, LogType.error);
	} finally {
		log('\n\n');
		process.exit(exitCode);
	}
}
