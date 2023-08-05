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
			.flatMap(cmd => {
				let output = childProcess.execSync(`sh -c "${cmd} 2>&1"`, { cwd: dir }).toString().trim();
				output = cmd.startsWith('npm') || cmd.endsWith('--help') ? '...' : output; // npm commands and `--help` are formatted inconsistently and aren't v relevant
				output = output.split(process.cwd()).join('<<cwd>>'); // cwd varies by machine
				output = output.replace(/durationSeconds: .*/g, 'durationSeconds: ???'); // migrations durations vary by a few milliseconds
				output = output.replace(/\d{4}.\d{2}.\d{2}T\d{2}.\d{2}.\d{2}/g, '<<timestamp>>'); // the river of time flows only in one direction
				return [`\`${cmd}\` output:`, output];
			})
			.join('\n\n');

		expect(stdout).toMatchSnapshot();
	});
});
