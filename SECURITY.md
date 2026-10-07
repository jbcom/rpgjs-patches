# Security Policy

## Reporting a vulnerability

Please report security problems privately through
[GitHub Security Advisories](https://github.com/jbcom/rpgjs-patches/security/advisories/new)
rather than opening a public issue.

We aim to acknowledge reports within a few days. Warranted fixes are prepared privately and
reporters are credited in the advisory unless they request anonymity.

## Supported versions

The latest `0.x` release receives security fixes. Older pre-1.0 releases receive backports only
when a coordinated disclosure requires one. CanvasEngine compatibility is documented separately
in [the compatibility audit](docs/COMPATIBILITY.md).

## Scope

Package supply-chain issues, unexpected install/build code execution, and vulnerabilities in
the patch runtime are in scope. The package has no runtime dependencies. CanvasEngine, Pixi,
and the application that supplies the component factories have their own security boundaries;
report defects in those projects to their maintainers.
