Releasing a New Version to npmjs.com (Monorepo Guide)
===


This guide details the standardized process for publishing new versions of the `public-api` and `state-driver` packages, which are located in the same GitHub repository. Following these steps is crucial to ensure that release tags for each package do not conflict.

### **Prerequisites**

Before you begin the release process, please ensure the following:

*   **You are on the `main` branch:** `git checkout main`
*   **You have the latest changes:** `git pull origin main`
*   **Your working directory is clean:** Run `git status` to ensure there are no uncommitted changes.
*   **You are logged into npm:** Run `npm login` if you are not already authenticated. You must have publishing permissions for the packages.

---

### **Understanding Semantic Versioning**

We use semantic versioning (`MAJOR.MINOR.PATCH`) to communicate the nature of changes.

*   `npm version patch`: For backward-compatible bug fixes (e.g., 1.2.0 -> 1.2.1).
*   `npm version minor`: For new, backward-compatible functionality (e.g., 1.2.0 -> 1.3.0).
*   `npm version major`: For breaking changes that are not backward-compatible (e.g., 1.2.0 -> 2.0.0).

---

### **Step-by-Step Release Process**

This process should be followed for each package you intend to release.

#### **1. Navigate to the Package Directory**

Choose the package you want to release and navigate into its directory.

For `public-api`:
```shell
cd public-api
```
For `state-driver`:
```shell
cd state-driver
```

#### **2. Install Dependencies and Build the Package**

Ensure all dependencies are current and create a fresh build before publishing.

```shell
npm install
npm run build
```

#### **3. Update the Version Number (without creating a Git tag)**

Use the `--no-git-tag-version` flag. This prevents `npm` from automatically creating a commit and a generic Git tag, allowing us to create a package-specific one later.

```shell
# Replace 'patch' with 'minor' or 'major' as appropriate
npm version minor --no-git-tag-version
```
This command will only update the version in your `package.json` and `package-lock.json` files.

#### **4. Commit the Version Change**

Now, manually create a commit for the version bump. This script will automatically get the new version from `package.json`.

For `public-api`:
```shell
git add package.json package-lock.json
VERSION=$(node -p "require('./package.json').version")
git commit -m "release: gbi-search-public-api v${VERSION}"
```

For `state-driver`:
```shell
git add package.json package-lock.json
VERSION=$(node -p "require('./package.json').version")
git commit -m "release: gbi-search-state-driver v${VERSION}"
```

#### **5. Create a Scoped and Annotated Git Tag**

Create a Git tag that is prefixed with the package name to avoid conflicts. The `-a` flag creates an annotated tag, which is best practice for releases.

For `public-api`:
```shell
git tag -a "gbi-search-public-api@${VERSION}" -m "release: gbi-search-public-api v${VERSION}"
```

For `state-driver`:
```shell
git tag -a "gbi-search-state-driver@${VERSION}" -m "release: gbi-search-state-driver v${VERSION}"
```

#### **6. Publish the Package to npm**

Publish the new version to the npm registry.

```shell
npm publish
```

#### **7. Push the Commit and Tag to the Remote Repository**

Push your commit and the single, newly created scoped tag to the remote repository.

```shell
# Push the commit
git push

# Push the specific tag
git push --tags
```

#### **8. Return to the Root Directory**

Navigate back to the root of the project to complete the process.

```shell
cd ..
```

---

### **Quick-Reference Scripts**

Here are the complete scripts for releasing each package.

#### **Publish `public-api`**
```shell
# 1. Navigate to directory
cd public-api

# 2. Install & Build
npm install
npm run build

# 3. Bump version (choose one)
npm version <patch|minor|major> --no-git-tag-version

# 4. Commit change
git add package.json package-lock.json
VERSION=$(node -p "require('./package.json').version")
git commit -m "release: gbi-search-public-api v${VERSION}"

# 5. Create scoped tag
git tag -a "gbi-search-public-api@${VERSION}" -m "release: gbi-search-public-api v${VERSION}"

# 6. Publish to npm
npm publish

# 7. Push to GitHub
git push
git push origin "gbi-search-public-api@${VERSION}"

# 8. Return to root
cd ..
```

#### **Publish `state-driver`**
```shell
# 1. Navigate to directory
cd state-driver

# 2. Install & Build
npm install
npm run build

# 3. Bump version (choose one)
npm version <patch|minor|major> --no-git-tag-version

# 4. Commit change
git add package.json package-lock.json
VERSION=$(node -p "require('./package.json').version")
git commit -m "release: gbi-search-state-driver v${VERSION}"

# 5. Create scoped tag
git tag -a "gbi-search-state-driver@${VERSION}" -m "release: gbi-search-state-driver v${VERSION}"

# 6. Publish to npm
npm publish

# 7. Push to GitHub
git push
git push origin "gbi-search-state-driver@${VERSION}"

# 8. Return to root
cd ..
```

---

### **How to Handle Release Candidates (RCs)**

For larger changes, use a release candidate to allow for testing.

1.  **Create the Initial RC:**
    Use the `premajor`, `preminor`, or `prepatch` command with the `--preid` flag.
    ```shell
    # Starts the 2.0.0 release cycle with 2.0.0-rc.0
    npm version premajor --preid=rc --no-git-tag-version
    ```

2.  **Increment an RC:**
    If you need to create a new RC (e.g., `2.0.0-rc.1`), use the `prerelease` command.
    ```shell
    npm version prerelease --no-git-tag-version
    ```

3.  **Commit and Tag the RC:**
    Follow the same commit and tagging steps as a normal release. The version number in the tag will correctly include the `-rc.x` suffix (e.g., `gbi-search-public-api@2.0.0-rc.0`).

4.  **Publish the RC with a Dist-Tag:**
    Publishing with a `next` tag prevents the RC from becoming the default `latest` version for users.
    ```shell
    npm publish --tag next
    ```
    Users can install it specifically with `npm install <package-name>@next`.

5.  **Finalizing the Release:**
    When the RC is stable, promote it to the stable version.
    ```shell
    # If the current version is 2.0.0-rc.1, this command moves it to 2.0.0
    npm version major --no-git-tag-version
    ```
    Then, follow the standard commit, tag, and publish steps. This time, **do not** use a `--tag` flag when publishing, so it becomes the new `latest`.