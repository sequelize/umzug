import fs = require('fs');
import path = require('path');
import childProcess = require('child_process');
import stripAnsi from 'strip-ansi';

const examplesDir = path.join(__dirname, '../examples');
const examples = fs.readdirSync(examplesDir).filter(ex => /^\d/.exec(ex));

/** get rid of any untracked files, including newly-created migrations and the sqlite db file, so that each run is from scratch and has the same output (give or take timings etc.) */
const cleanup = (cwd: string) => {
	childProcess.execSync('git checkout migrations && git clean migrations seeders db.sqlite -fx', {
		cwd,
		stdio: 'inherit',
	});
};

examples.forEach(ex => {
	test(`example ${ex}`, async () => {
		const dir = path.join(examplesDir, ex);
		const readmeFile = fs.readdirSync(dir).find(f => f.toLowerCase() === 'readme.md');
		const readme = fs.readFileSync(path.join(dir, readmeFile!)).toString();
		const bash = readme.split('```bash')[1].split('```')[0].trim();

		cleanup(dir);

		const stdout = bash
			.split('\n')
			.map(line => line.split('#')[0].trim())
			.filter(Boolean)
			.map(cmd => cmd.replace('--fix', '"--fix"'))
			.flatMap(cmd => {
				const output = childProcess.execSync(cmd, { cwd: dir }).toString().trim();
				return [`\`${cmd}\` output:`, cmd === 'npm install' || cmd.includes('--help') ? '...' : output];
			})
			.map(s => stripAnsi(s))
			.join('\n\n')
			.split(process.cwd())
			.join('<<cwd>>')
			.replace(/\d{4}.\d{2}.\d{2}T\d{2}.\d{2}.\d{2}/g, '<<timestamp>>')
			.replace(/durationSeconds: .*/g, 'durationSeconds: ???')
			.replace(/\d+kB (.*)/g, '???kB $1')
			.replace(/\[\d+ms] - ncc/g, '[????ms] - ncc');

		expect(stdout).toMatchSnapshot();
	});
});
