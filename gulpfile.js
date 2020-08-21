"use strict";

import awspublish from "gulp-awspublish";
import autoprefixer from "autoprefixer";
import buffer from "vinyl-buffer";
import babelify from "babelify";
import browserify from "browserify";
import browserSync from "browser-sync";
import cssnano from "cssnano";
import dotenv from "dotenv";
import del from "del";
import environments from "gulp-environments";
// import ts from "gulp-typescript";
import gulp from "gulp";
import imagemin from "gulp-imagemin";
import plumber from "gulp-plumber";
import postcss from "gulp-postcss";
import postcssImport from "postcss-import";
import postcssNested from "postcss-nested";
import postcssProperties from "postcss-custom-properties";
import rename from "gulp-rename";
import rev from "gulp-rev";
import revFormat from "gulp-rev-format";
import tailwindcss from "tailwindcss";
import terser from "gulp-terser"; // successor to uglify-js
import source from "vinyl-source-stream";
import svgSprite from "gulp-svg-sprite";
import sourcemaps from "gulp-sourcemaps";
import stylelint from "gulp-stylelint";
import purgecss from "@fullhuman/postcss-purgecss";
import purgecssFromJs from "purgecss-from-js";
import webp from "gulp-webp";

dotenv.config();

let production = environments.production;
let development = environments.development;
let config = {
  paths: {
    templates: "./templates",
    src: "./static",
    dest: "./web/static",
  },
  vendor: {
    paths: [
      "lazysizes",
      "lazysizes/plugins/object-fit/ls.object-fit",
      "lazysizes/plugins/unveilhooks/ls.unveilhooks",
      "scrollmagic",
      "scrollmagic/scrollmagic/uncompressed/plugins/debug.addIndicators",
      "scrollmagic/scrollmagic/uncompressed/plugins/animation.gsap",
      "smooth-scrollbar",
      "gsap",
      "gsap/ScrollToPlugin",
    ],
  },
  revisions: {
    extensions: "js,css,gif,jpg,png,gif,svg,ico,webp",
  },
};

function styles() {
  let plugins = [
    postcssImport({
      root: `${config.paths.src}/css *`,
    }),
    postcssNested(),
    postcssProperties(),
    tailwindcss("./tailwind.config.cjs"),
    autoprefixer(),
  ];

  // Only minify and purge when building for production
  if (production()) {
    plugins = plugins.concat([
      purgecss({
        content: [
          `${config.paths.src}/js/**/*.js`,
          `${config.paths.templates}/**/*.twig`,
          `${config.paths.templates}/**/*.html`,
        ],
        defaultExtractor: (content) => {
          return content.match(/[\w-/:]+(?<!:)/g) || [];
        },
        whitelist: ["lazyload", "lazyloading", "lazyloaded"],
      }),
      cssnano(),
    ]);
  }

  return gulp
    .src(`${config.paths.src}/css/styles.css`)
    .pipe(plumber())
    .pipe(
      stylelint({
        reporters: [{ formatter: "string", console: true }],
      })
    )
    .pipe(buffer()) // sourcemap plugin does not support stream
    .pipe(development(sourcemaps.init())) // sourcemaps on dev only
    .pipe(rename("styles.css"))
    .pipe(postcss(plugins))
    .pipe(development(sourcemaps.write(".")))
    .pipe(gulp.dest(`${config.paths.dest}/css/`));
}

function scripts() {
  return browserify({
    entries: `${config.paths.src}/js/app.js`,
    bundleExternal: false,
    external: config.vendor.paths,
    transform: [
      babelify.configure({
        presets: ["@babel/preset-env"],
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-proposal-class-properties", {}],
        ],
      }),
    ],
  })
    .bundle()
    .pipe(source("scripts.js"))
    .pipe(buffer()) // sourcemap plugin does not support stream
    .pipe(development(sourcemaps.init({ loadMaps: true })))
    .pipe(production(terser())) // uglify replacement
    .pipe(development(sourcemaps.write(".")))
    .pipe(gulp.dest(`${config.paths.dest}/js/`));
}

function vendor() {
  return browserify({
    require: config.vendor.paths,
  })
    .bundle()
    .pipe(source("vendor.js"))
    .pipe(buffer()) // sourcemap plugin does not support stream
    .pipe(development(sourcemaps.init({ loadMaps: true })))
    .pipe(terser()) // uglify replacement
    .pipe(development(sourcemaps.write(".")))
    .pipe(gulp.dest(`${config.paths.dest}/js/`));
}

function images() {
  return gulp
    .src([`${config.paths.src}/images/**/*.{jpg,jpeg,png,gif,svg,ico}`])
    .pipe(plumber())
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ quality: 75, progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
        }),
      ])
    )
    .pipe(gulp.dest(`${config.paths.dest}/images/`))
    .pipe(webp())
    .pipe(gulp.dest(`${config.paths.dest}/images/`));
}

function fonts() {
  return gulp
    .src([`${config.paths.src}/fonts/**/*`], {
      base: `${config.paths.src}`,
    })
    .pipe(gulp.dest(`${config.paths.dest}`));
}

function revision() {
  return gulp
    .src([`${config.paths.dest}/**/*.{${config.revisions.extensions}}`])
    .pipe(plumber())
    .pipe(rev())
    .pipe(
      revFormat({
        prefix: ".",
      })
    )
    .pipe(gulp.dest(`${config.paths.dest}`))
    .pipe(rev.manifest())
    .pipe(gulp.dest(`${config.paths.dest}`));
}

function publish() {
  let publisher = awspublish.create({
    region: process.env.DIGITAL_OCEAN_SPACES_REGION,
    params: {
      Bucket: process.env.DIGITAL_OCEAN_SPACES_BUCKET,
      ACL: "public",
    },
    accessKeyId: process.env.DIGITAL_OCEAN_SPACES_KEY,
    secretAccessKey: process.env.DIGITAL_OCEAN_SPACES_SECRET,
    endpoint: process.env.DIGITAL_OCEAN_SPACES_ENDPOINT,
  });
  let headers = {
    "Cache-Control": "max-age=315360000, no-transform, public",
  };
  return gulp
    .src(`${config.paths.dest}/**/*`)
    .pipe(
      rename((path) => {
        path.dirname = "/static/" + path.dirname;
      })
    )
    .pipe(publisher.publish(headers))
    .pipe(awspublish.reporter());
}

function server() {
  browserSync.init({
    proxy: "[[name]].local:8888/",
    open: false, // don't open on load
  });
}

function reload(done) {
  browserSync.reload();
  done(); // needed to prevent reload only working once
}

function clean() {
  return del([`${config.paths.dest}`]);
}

function watch() {
  gulp.watch(
    [`${config.paths.src}/css/**/*.css`, `./tailwind.config.cjs`],
    gulp.series(styles, reload)
  );
  gulp.watch(`${config.paths.src}/js/**/*.js`, gulp.series(scripts, reload));
  gulp.watch(`${config.paths.src}/images/**/*`, gulp.series(images, reload));
  gulp.watch(`${config.paths.src}/fonts/**/*`, gulp.series(fonts, reload));
  gulp.watch(`${config.paths.templates}/**/*.{html,twig}`, reload);
  gulp.watch(`./gulpfile.js`, reload);
}

let run = gulp.series(
  vendor,
  gulp.parallel(scripts, styles, fonts, images),
  gulp.parallel(server, watch)
);

let build = gulp.series(
  clean,
  vendor,
  gulp.parallel(scripts, styles, fonts, images),
  revision
);

let deploy = gulp.series(build, publish);

export { run as default, build, deploy };
