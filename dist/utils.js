const chalk = require('chalk');
export var LogType;
(function (LogType) {
    LogType[LogType["info"] = 0] = "info";
    LogType[LogType["log"] = 1] = "log";
    LogType[LogType["error"] = 2] = "error";
    LogType[LogType["debug"] = 3] = "debug";
})(LogType || (LogType = {}));
export const runCmd = (cmd) => new Promise((resolve, reject) => {
    require('child_process').exec(cmd, (err, stdout) => {
        if (err)
            reject(`Command "${cmd}" failed. Error: "${err}"`);
        resolve(stdout);
    });
});
export const log = (msg, type = LogType.log) => {
    const colors = {
        [LogType.info]: 'gray',
        [LogType.log]: 'cyan',
        [LogType.error]: 'red',
        [LogType.debug]: 'yellow',
    };
    console.log(chalk[colors[type]](msg));
};
export const getTagBasedMessage = async (prevTag, targetTag) => await runCmd(`git log --pretty=format:"%ad - %h - %s" --date=short ${prevTag}..${targetTag}`);
export const generatePrettyReleaseMessage = (commits, repoUrl, targetTag, prevTag = 'origin/master') => {
    const breakingChanges = [];
    const features = [];
    const bugs = [];
    const other = [];
    const lines = commits.split('\n');
    lines.forEach(line => {
        if (line.indexOf(':') === -1)
            return;
        const [date, commitHash, message] = line.split(' - ');
        const [type, commitMessage] = message.split(':');
        let pointer;
        if (commitMessage.indexOf('BREAKING ') > -1) {
            pointer = breakingChanges;
        }
        else {
            switch (type.trim()) {
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
        pointer.push(`${commitMessage.trim()} (@${date.trim()} - [${commitHash.trim()}](${repoUrl}/commit/${commitHash.trim()}))`);
    });
    const makeList = (items) => `${items.length ? `* ${items.join('\n* ')}` : 'NONE'}`;
    return `
Changelog: [${prevTag}...${targetTag}](${repoUrl}/compare/${prevTag}...${targetTag})

## FEATURES
${makeList(features)}

## BUG FIXES
${makeList(bugs)}

## BREAKING CHANGES
${makeList(breakingChanges)}
`;
};
