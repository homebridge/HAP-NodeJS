# Contributing

## Guidelines

<!-- Add that once ESLint is set up
* **Coding Standard:** Linting errors are checked by [ESLint][link-eslint].  
    Keeping a consistent style throughout the codebase keeps the cognitive load low for all
    contributors and keeps the code style homogeneous.
-->

* **Node 10 LTS:** `HAP-NodeJS` has a minimum Node version requirement of 10.17.0.
    Pull requests MUST NOT require a Node version greater than that unless the feature is
    enabled/backported via [TypeScript][link-typescript].

* **Add tests:** All pull requests SHOULD include unit tests to ensure the change works as
    expected and to prevent regressions.
    Any pull request containing a bug fix SHOULD include a regression test for the given fix.

* **Document any change in behaviour:** Make sure any documentation is kept up-to-date 
    (JSDoc as well as possible documentation in the [Wiki][wiki]).

* **Consider our release cycle:** We try to follow [Semantic Versioning v2][link-semver].
    Randomly breaking public APIs is not an option.

* **Git workflow:** `HAP-NodeJS` has a beta phase for every `major` or `minor` release. Progress and
    version backlog for the current ongoing beta can be viewed on the [GitHub Projects][projects] page.
    Every commit on the `beta` branch is release in a new beta version on npm.    
    Any pull request containing `major` or `minor` changes MUST only use the `beta` branch as base branch.
    Only pull requests containing `patch` changes MAY use the `master` branch as base branch.

* **One pull request per feature:** If you want to do more than one thing, send multiple pull requests.
    Otherwise, your pull request could be rejected.

* **Send coherent history:** Make sure each individual commit in your pull request is meaningful.
    If you had to make multiple intermediate commits while developing,
    please [rebase or squash them][link-git-rewrite] before submitting.

## Running tests

In order to contribute, you'll need to checkout the source from GitHub and
install dependencies using npm:

```bash
git clone https://github.com/homebridge/HAP-NodeJS.git
cd HAP-NodeJS
npm install
npm test
```

## Reporting a security vulnerability

We want to ensure that `HAP-NodeJS` is secure for everyone. If you've discovered a security vulnerability,
we appreciate your help in disclosing it to us in a [responsible manner][link-responsible-disclosure].

Publicly disclosing a vulnerability can put the entire community at risk. If you've discovered a security concern,
please email us at mail@anderl-bauer.de with [SECURITY] in the subject line. We'll work with you to make sure we
understand the scope of the issue, and that we fully address your concern. We consider correspondence sent 
to this email address our highest priority, and work to address any issues that arise as quickly as possible.

After a security vulnerability has been corrected, a security hotfix release will be deployed as soon as possible.

**Happy coding**!

[link-eslint]: https://eslint.org/
[wiki]: https://github.com/homebridge/HAP-NodeJS/wiki
[link-semver]: http://semver.org/
[projects]: https://github.com/homebridge/HAP-NodeJS/projects
[link-git-rewrite]: http://www.git-scm.com/book/en/v2/Git-Tools-Rewriting-History#Changing-Multiple-Commit-Messages
[link-responsible-disclosure]: http://en.wikipedia.org/wiki/Responsible_disclosure
