const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');

export type FileDetails = {
	name: string;
	fullPath: string;
	headers: {'Content-Type': string, 'Content-Length': number};
	buffer: any;
};

export async function zipFile(dirName: string, tag: string, isBeta: boolean): Promise<FileDetails> {
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

		archive.on('error', (err: Error) => {
			reject(err);
		});

		archive.pipe(output);
		archive.glob(`${dirName}/**/*`);
		archive.finalize();
	});
}