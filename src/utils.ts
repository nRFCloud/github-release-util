const chalk = require('chalk');

export enum LogType {
	info,
	log,
	error,
	debug,
}

export const runCmd = (cmd: string): Promise<string> =>
new Promise((resolve, reject) => {
  require('child_process').exec(cmd, (err, stdout: string) => {
    if (err) reject(`Command "${cmd}" failed. Error: "${err}"`);
    resolve(stdout);
  });
});

export const log = (msg: any, type: LogType = LogType.log): void => {
	const colors = {
		[LogType.info]: 'gray',
		[LogType.log]: 'cyan',
		[LogType.error]: 'red',
		[LogType.debug]: 'yellow',
	};

	console.log(chalk[colors[type]](msg));
}

export const getTagBasedMessage = async (prevTag: string, targetTag: string): Promise<string> => 
	await runCmd(`git log --pretty=format:"%ad - %h - %s" --date=short ${prevTag}..${targetTag}`);

export const generatePrettyReleaseMessage = (
	commits: string,
	repoUrl: string,
	targetTag: string,
	prevTag: string = 'origin/master',
): string => {
	const breakingChanges = []
	const features = [];
	const bugs = [];
	const other = [];
	const lines = commits.split('\n');

	lines.forEach(line => { 
		if (line.indexOf(':') === -1) return;
		// format is "YYYY-MM-DD - commit-hash - type: message"
		const [date, commitHash, message] = line.split(' - ');
		const [type, commitMessage] = message.split(':');
		let pointer;

		if (commitMessage.indexOf('BREAKING ') > -1) {
			pointer = breakingChanges;
		} else {
			switch(type.trim()) {
				case 'fix':
				case 'bug':
					pointer = bugs;
					break;
				case 'feat':
				case 'feature':
					pointer = features;
					break;
				default:
					pointer = other;
					break;
			}
		}
		pointer.push(`${commitMessage.trim()} (@${date.trim()} - [${commitHash.trim()}](${repoUrl}/commit/${commitHash.trim()}))`)
	});

	const makeList = (items: string[]) => `${items.length ? `* ${items.join('\n* ')}` : 'NONE'}`;

	return `
Changelog: [${prevTag}...${targetTag}](${repoUrl}/compare/${prevTag}...${targetTag})

## FEATURES
${makeList(features)}

## BUG FIXES
${makeList(bugs)}

## BREAKING CHANGES
${makeList(breakingChanges)}
`;
}
