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

## Migrating to v0.5.0

Users with pre-existing accessories will find themselves unable to run HAP
-NodeJS upon upgrading. This is due to the fact that the project was re-written
in [Typescript][link-typescript].

By default, the Typescript compiler is not set up to allow importing Javascript
files. This can easily be changed by setting the [`allowJs`][link-tsconfig-options]
option to `true` in your `tsconfig.json`.

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

## HomeKit Protocol

Hint: the Homekit Application Protocol (HAP) allows that you can pair a Homekit
device with one device. As soon as the Homekit device is paired, its not
possible to pair with another iOS device anymore.

## API

HAP-NodeJS provides a set of classes you can use to construct Accessories
programatically. For an example implementation, see [Lock_accessory.ts](src/accessories/Lock_accessory.ts).

The key classes intended for use by API consumers are:

- [Accessory](src/lib/Accessory.ts): Represents a HomeKit device that can be
published on your local network.

- [Bridge](src/lib/Bridge.ts): A kind of Accessory that can host other
Accessories "behind" it while only publishing a single device.

- [Service](src/lib/Service.ts): Represents a set of grouped values necessary
to provide a logical function. Most of the time, when you think of a
supported HomeKit device like "Thermostat" or "Door Lock", you're actually
thinking of a Service. Accessories can expose multiple services.

- [Characteristic](src/lib/Characteristic.ts): Represents a particular typed
variable assigned to a Service, for instance the `LockMechanism` Service
contains a `CurrentDoorState` Characteristic describing whether the door
is currently locked.

All known built-in Service and Characteristic types that HomeKit supports are
exposed as a separate subclass in [HomeKitTypes](src/lib/gen/HomeKit.ts).

See each of the corresponding classes for more explanation and notes.

## Notes

Special thanks to [Alex Skalozub][link-alex-skalozub], who reverse-engineered
the server side HAP. ~~You can find his research [here][link-homekit-research]
.~~ (Sadly, on Nov 4, Apple sent the [DMCA][link-apple-dmca] request to Github
to remove the research.)

[There](http://instagram.com/p/t4cPlcDksQ/) is a video demo running this project
on Intel Edison.

If you are interested in HAP over BTLE, you might want to check [this][link-hap-over-btle].

[link-eslint]: https://eslint.org/
[link-prettier]: https://prettier.io/
[link-typescript]: https://www.typescriptlang.org/
[link-tsconfig-options]: https://www.typescriptlang.org/docs/handbook/compiler-options.html
[link-semver]: http://semver.org/
[link-git-rewrite]: http://www.git-scm.com/book/en/v2/Git-Tools-Rewriting-History#Changing-Multiple-Commit-Messages
[link-conventional-changelog]: https://github.com/conventional-changelog/conventional-changelog
[link-responsible-disclosure]: http://en.wikipedia.org/wiki/Responsible_disclosure
[link-alex-skalozub]: https://twitter.com/pieceofsummer
[link-homekit-research]: https://gist.github.com/pieceofsummer/13272bf76ac1d6b58a30
[link-apple-dmca]: https://github.com/github/dmca/blob/master/2014/2014-11-04-Apple.md
[link-hap-over-btle]: https://gist.github.com/KhaosT/6ff09ba71d306d4c1079
