const gulp = require('gulp');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');
const path = require('path');
const args = require('yargs').argv;

gulp.task('default', ['lint', 'test']);

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!lib/**', '!node_modules/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('test', function () {
  return gulp
    .src(path.resolve(__dirname, 'test', 'index.js'), {read: false})
    .pipe(mocha({
      reporter: 'spec',
      ignoreLeaks: true,
      timeout: 1000,
      require: 'babel-register',
      grep: args.grep,
    }));
});
