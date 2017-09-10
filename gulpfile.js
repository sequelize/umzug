const gulp = require('gulp');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');
const path = require('path');
const babel = require('gulp-babel');
const args = require('yargs').argv;

gulp.task('default', ['test']);

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!lib/**', '!node_modules/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('test', ['lint', 'test:unit', 'test:integration']);

gulp.task('test:unit', function () {
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

gulp.task('build', function () {
  return gulp.src('src/**')
    .pipe(babel())
    .pipe(gulp.dest('lib'));
});

/**
 * integration tests run under the condition of a typical npm dependency,
 * so without any runtime transpiler, precompiled instead
 */
gulp.task('test:integration', ['build'], function () {
  return gulp
    .src(path.resolve(__dirname, 'test/integration', 'index.js'), {read: false})
    .pipe(mocha({
      reporter: 'spec',
      ignoreLeaks: true,
      timeout: 1000,
      grep: args.grep,
    }));
});
