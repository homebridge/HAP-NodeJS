# Migration

## `0.5`

Users with pre-existing accessories will find themselves unable to run
HAP-NodeJS upon upgrading. This is due to the fact that the project was
re-written in [Typescript][link-typescript].

By default, the Typescript compiler is not set up to allow importing Javascript
files. This can easily be changed by setting the [`allowJs`][link-tsconfig-options]
option to `true` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "allowJs": true,
    ...
  },
}
```

This will enable importing Javascript source files in the project. To optionally
enable type-checking for Javascript, the [`checkJs`][link-tsconfig-options]
option can also be enabled:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    ...
  },
}
```

Once all compiler options are set up, the project can be built by running
`yarn build`. The Typescript compiler can also watch the source files and
recompile upon changes by running `yarn build --watch`.

[link-typescript]: https://www.typescriptlang.org/
[link-tsconfig-options]: https://www.typescriptlang.org/docs/handbook/compiler-options.html
