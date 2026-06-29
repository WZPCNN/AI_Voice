# Changesets

## 简介

Changesets 用于管理 monorepo 中各包的版本和变更日志。

## 使用方式

### 1. 添加 changeset

在开发过程中,当你做了需要记录的变更后,运行:

```bash
pnpm changeset
```

这会提示你:
- 选择受影响的包
- 选择版本升级类型(major/minor/patch)
- 编写变更摘要

生成的 changeset 文件会保存在 `.changeset/` 目录下,应随代码一起提交。

### 2. 消费 changesets

当准备发布时,运行:

```bash
pnpm changeset version
```

这会:
- 消费所有未处理的 changeset 文件
- 更新对应包的 `package.json` 版本号
- 更新 `CHANGELOG.md`

### 3. 发布

```bash
pnpm changeset publish
```

## 配置说明

- `access: "restricted"` — 包为私有,不公开发布
- `baseBranch: "main"` — 主分支
- `updateInternalDependencies: "patch"` — 内部依赖变更触发 patch 版本更新
- `ignore` — 忽略的包(不参与版本管理)
