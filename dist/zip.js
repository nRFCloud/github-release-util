const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const archiver = require('archiver');
export async function zipFile(dirName, tag, isBeta) {
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
