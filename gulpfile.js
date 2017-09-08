'use strict';

const gulp = require('gulp');
const jshint = require('gulp-jshint');
const eslint = require('gulp-eslint');
const mocha = require('gulp-mocha');
const path = require('path');
const args = require('yargs').argv;

gulp.task('default', ['lint', 'test'], function () {
});

gulp.task('lintold', function () {
    return gulp
        .src([
            path.resolve(__dirname, 'gulpfile.js'),
            path.resolve(__dirname, 'bin', 'sequelize'),
            path.resolve(__dirname, 'src', '**', '*.js'),
            '!' + path.resolve(__dirname, 'src', 'assets', '**', '*.js'),
            path.resolve(__dirname, 'test', '**', '*.js'),
            '!' + path.resolve(__dirname, 'test', 'support', 'tmp', '**', '*')
        ])
        .pipe(jshint())
        .pipe(jshint.reporter(require('jshint-stylish')))
        .pipe(jshint.reporter(require('gulp-jshint-instafail')));
});

gulp.task('lint', () => {
    // ESLint ignores files with "node_modules" paths.
    // So, it's best to have gulp ignore the directory as well.
    // Also, Be sure to return the stream from the task;
    // Otherwise, the task may end before the stream has finished.
    return gulp.src(['**/*.js', '!lib/**', '!node_modules/**'])
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
        .pipe(eslint())
        // eslint.format() outputs the lint results to the console.
        // Alternatively use eslint.formatEach() (see Docs).
        .pipe(eslint.format())
        // To have the process exit with an error code (1) on
        // lint error, return the stream and pipe to failAfterError last.
        .pipe(eslint.failAfterError());
});

gulp.task('test', function () {
    return gulp
        .src(path.resolve(__dirname, 'test', '**', 'index.js'), {read: false})
        .pipe(mocha({
            reporter: 'spec',
            ignoreLeaks: true,
            timeout: 1000,
            grep: args.grep
        }));
});
