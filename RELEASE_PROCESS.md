# Release Process

This document describes the automated release process for Intercept Wave VSCode extension.

## Overview

The release process is semi-automated using GitHub Actions:

1. **Manual**: Update version and changelog
2. **Automatic**: CI creates draft release with changelog
3. **Manual**: Review and publish the draft release
4. **Automatic**: Extension is published to VS Code Marketplace

## Step-by-Step Release Guide

### 1. Prepare the Release

#### Update Version Number

Edit `package.json`:

```json
{
    "version": "1.0.6"
}
```

#### Update CHANGELOG.md

Move changes from `[Unreleased]` to a new version section:

```markdown
## [Unreleased]

### Added

### Improved

### Fixed

## [1.0.6] - 2025-01-XX

### Added

- ✨ New feature description
- 🎯 Another feature

### Improved

- 🚀 Performance improvements

### Fixed

- 🐛 Bug fixes
```

**Important**: Keep the `[Unreleased]` section at the top with empty subsections for future changes!

#### Commit and Push

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.0.6"
git push origin main
```

### 2. Automated Draft Creation

Once you push to `main`, GitHub Actions will automatically:

1. ✅ Run tests on multiple platforms
2. ✅ Build the extension
3. ✅ Extract changelog content from `[1.0.6]` section
4. ✅ Create a draft release with:
    - Version: `v1.0.6` (from package.json)
    - Title: `v1.0.6`
    - Body: Content from `[1.0.6]` section in CHANGELOG.md

**Workflow**: `.github/workflows/build.yml`

### 3. Review the Draft Release

1. Go to [GitHub Releases](https://github.com/zhongmiao-org/intercept-wave-vscode/releases)
2. Find the draft release `v1.0.6`
3. Review the release notes (automatically extracted from CHANGELOG)
4. Edit if needed
5. ✅ Click **"Publish release"**

### 4. Automated Publishing

When you publish the release, GitHub Actions will automatically:

1. ✅ Compile the extension
2. ✅ Publish to VS Code Marketplace
3. ✅ Attach `.vsix` file to the release

**Workflow**: `.github/workflows/release.yml`

**Required Secret**: `VSCE_PAT` (VS Code Marketplace Personal Access Token)

## CHANGELOG Format

The CI workflow expects this format:

```markdown
## [Unreleased]

### Added

### Improved

### Fixed

## [X.Y.Z] - YYYY-MM-DD

### Added

- Feature 1
- Feature 2

### Improved

- Improvement 1

### Fixed

- Bug fix 1
```

**Key Points**:

- Always keep `[Unreleased]` at the top
- Use `## [X.Y.Z] - YYYY-MM-DD` format for versions
- Include date for released versions
- Subsections: `Added`, `Improved`, `Fixed` (or `Changed`, `Deprecated`, `Removed`, `Security`)

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backwards compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, backwards compatible

## Troubleshooting

### Draft Release Not Created

**Issue**: No draft release after pushing to main

**Solution**:

- Check GitHub Actions tab for errors
- Ensure you pushed to `main` branch
- Verify `package.json` has updated version

### Changelog Not Extracted

**Issue**: Draft release has default notes instead of changelog

**Solution**:

- Check CHANGELOG.md format matches expected pattern
- Ensure version header uses `## [X.Y.Z]` format
- Version in CHANGELOG should match package.json

### Publication Failed

**Issue**: Release published but not on VS Code Marketplace

**Solution**:

- Check GitHub Actions logs for errors
- Verify `VSCE_PAT` secret is valid
- Ensure publisher name in package.json is correct (`Ark65`)

### Multiple Draft Releases

**Issue**: Old draft releases accumulating

**Solution**:

- Old drafts are automatically deleted before creating new ones
- You can manually delete old drafts from GitHub Releases page

## Manual Release (Emergency)

If automated release fails, you can publish manually:

```bash
# Install vsce
npm install -g @vscode/vsce

# Compile
npm run compile

# Package
vsce package

# Publish
vsce publish --pat YOUR_PAT_TOKEN
```

## Post-Release Checklist

After publishing a release:

- [ ] Verify extension appears on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Ark65.intercept-wave)
- [ ] Test installation: `code --install-extension Ark65.intercept-wave`
- [ ] Update any external documentation
- [ ] Announce release (if applicable)
- [ ] Start working on next version (add items to `[Unreleased]` section)

## CI Workflows Summary

### Build Workflow (`.github/workflows/build.yml`)

- **Trigger**: Push to `main` or Pull Request
- **Actions**:
    - Build and test
    - Create draft release (main only)
- **Outputs**:
    - Build artifacts
    - Draft release with changelog

### Test Workflow (`.github/workflows/test.yml`)

- **Trigger**: Push to `main`/`ark/*` or Pull Request
- **Actions**:
    - Run tests on multiple platforms
    - Generate coverage reports
    - Post coverage comments on PRs
- **Outputs**:
    - Test results
    - Coverage reports to Codecov

### Release Workflow (`.github/workflows/release.yml`)

- **Trigger**: Release published (not draft)
- **Actions**:
    - Compile extension
    - Publish to VS Code Marketplace
    - Attach .vsix to release
- **Outputs**:
    - Published extension
    - Release assets

## Tips

- **Keep CHANGELOG updated**: Add changes to `[Unreleased]` as you develop
- **Test before release**: Ensure all tests pass before bumping version
- **Review draft carefully**: CI extracts automatically but human review is important
- **Version consistency**: Keep package.json and CHANGELOG.md versions in sync

## Examples

### Example 1: Minor Release

```bash
# 1. Update files
vim package.json  # Change "version": "1.0.5" → "1.1.0"
vim CHANGELOG.md  # Move unreleased to [1.1.0] section

# 2. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.1.0"
git push origin main

# 3. Wait for CI to create draft
# 4. Go to GitHub Releases and publish the draft
```

### Example 2: Patch Release

```bash
# 1. Update files
vim package.json  # Change "version": "1.0.5" → "1.0.6"
vim CHANGELOG.md  # Move unreleased to [1.0.6] section

# 2. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.0.6"
git push origin main

# 3. Automated draft creation and review
# 4. Publish via GitHub UI
```

---

**Need Help?** Open an [issue](https://github.com/zhongmiao-org/intercept-wave-vscode/issues) if you encounter problems with the release process.
