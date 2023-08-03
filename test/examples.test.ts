import fs = require('fs');
import path = require('path');
import childProcess = require('child_process');
import stripAnsi from 'strip-ansi';

const examplesDir = path.join(__dirname, '../examples');
const examples = fs.readdirSync(examplesDir).filter(ex => /^\d/.exec(ex));

examples.forEach(ex => {
	test(`example ${ex}`, async () => {
		const dir = path.join(examplesDir, ex);
		const readme = fs.readFileSync(path.join(dir, 'README.md')).toString();
		const bash = readme.split('```bash')[1].split('```')[0].trim();

		/** get rid of any untracked files, including newly-created migrations and the sqlite db file, so that each run is from scratch and has the same output (give or take timings etc.) */
		const cleanup = () => {
			childProcess.execSync('git clean migrations seeders db.sqlite -fx', { cwd: dir, stdio: 'inherit' });
		};

		cleanup();

		const stdout = bash
			.split('\n')
			.map(line => line.split('#')[0].trim())
			.filter(Boolean)
			.flatMap(cmd => {
				const output = childProcess.execSync(cmd, { cwd: dir }).toString().trim();
				return [`\`${cmd}\` output:`, output];
			})
			.map(s => stripAnsi(s))
			.join('\n\n')
			.replace(/\d{4}.\d{2}.\d{2}T\d{2}.\d{2}.\d{2}/g, '<<timestamp>>')
			.replace(/durationSeconds: .*/g, 'durationSeconds: ???')
			.replace(/\d+kB (.*)/g, '???kB $1')
			.replace(/\[\d+ms] - ncc/g, '[????ms] - ncc')
			.replace(/up to date, audited \d+ packages in \w+s/g, 'up to date, audited ??? packages in ???ms');

		cleanup();

		expect(stdout).toMatchSnapshot();
	});
});
