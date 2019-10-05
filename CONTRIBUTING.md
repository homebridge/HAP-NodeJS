# Contributing

## Guidelines

- **Coding Standard:** Linting errors are checked by [ESLint][link-eslint] and
  stylistic issues are handled by [Prettier][link-prettier]. Keeping a
  consistent style throughout the codebase keeps the cognitive load low for all
  contributors and keeps the code style homogeneous.

- **Node 4 LTS:** `hap-nodejs` has a minimum Node version
  requirement of 4.0.0. Pull requests must not require a Node version greater
  than that unless the feature is enabled/backported via
  [TypeScript][link-typescript].

- **Add tests:** All pull requests should include unit tests to ensure the
  change works as expected and to prevent regressions.

- **Document any change in behaviour:** Make sure any documentation is kept
  up-to-date.

- **Consider our release cycle:** We try to follow [SemVer v2][link-semver].
  Randomly breaking public APIs is not an option.

- **One pull request per feature:** If you want to do more than one thing, send
  multiple pull requests.

- **Send coherent history:** Make sure each individual commit in your pull
  request is meaningful. If you had to make multiple intermediate commits while
  developing, please [rebase or squash them][link-git-rewrite] before
  submitting.

## Running tests

In order to contribute, you'll need to checkout the source from GitHub and
install dependencies using Yarn:

``` bash
git clone https://github.com/KhaosT/hap-nodejs.git
cd hap-nodejs
yarn
yarn test
```

## Reporting a security vulnerability

We want to ensure that `hap-nodejs` is secure for everyone. If
you've discovered a security vulnerability, we appreciate your help in
disclosing it to us in a [responsible manner][link-responsible-disclosure].

Publicly disclosing a vulnerability can put the entire community at risk. If
you've discovered a security concern, please email us at khaos.tian@gmail.com
with [SECURITY] in the subject line. We'll work with you to make sure that we
understand the scope of the issue, and that we fully address your concern. We
consider correspondence sent to this email address our highest priority, and
work to address any issues that arise as quickly as possible.

After a security vulnerability has been corrected, a security hotfix release
will be deployed as soon as possible.

**Happy coding**!

[link-eslint]: https://eslint.org/
[link-prettier]: https://prettier.io/
[link-semver]: http://semver.org/
[link-git-rewrite]: http://www.git-scm.com/book/en/v2/Git-Tools-Rewriting-History#Changing-Multiple-Commit-Messages
[link-conventional-changelog]: https://github.com/conventional-changelog/conventional-changelog
[link-responsible-disclosure]: http://en.wikipedia.org/wiki/Responsible_disclosure
