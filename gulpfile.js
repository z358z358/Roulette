var gulp = require('gulp'),
sass = require('gulp-ruby-sass'),
autoprefixer = require('gulp-autoprefixer'),
minifycss = require('gulp-minify-css'),
jshint = require('gulp-jshint'),
uglify = require('gulp-uglify'),
imagemin = require('gulp-imagemin'),
rename = require('gulp-rename'),
concat = require('gulp-concat'),
notify = require('gulp-notify'),
cache = require('gulp-cache'),
livereload = require('gulp-livereload'),
del = require('del');

gulp.task('default', ['clean'], function() {
	gulp.start('styles', 'scripts');
});

// Scripts
gulp.task('scripts', function() {
	return gulp.src([
		'src/scripts/jquery-1.11.3.min.js',
		'src/scripts/vue.min.js',
		'src/scripts/lazyload.js',
		'src/scripts/*.js'])
	.pipe(concat('main.js'))
	.pipe(uglify())
	.pipe(gulp.dest('dist/scripts'))
	.pipe(notify({ message: 'Scripts task complete' }));
});

// Styles
gulp.task('styles', function() {
	return gulp.src('src/styles/*.css')
	.pipe(autoprefixer('last 2 version'))
	.pipe(minifycss())
	.pipe(concat('main.css'))
	.pipe(gulp.dest('dist/styles'))	
	.pipe(notify({ message: 'Styles task complete' }));
});

// Clean
gulp.task('clean', function(cb) {
	del(['dist/'], cb)
});

gulp.task('watch', function() {

  // 看守 .scss 檔
  gulp.watch('src/styles/*.css', ['styles']);

  // 看守 .js 檔
  gulp.watch('src/scripts/*.js', ['scripts']);
});