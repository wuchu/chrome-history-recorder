## Context

当前有两个包使用不同的模块系统：

| Package | type | module | moduleResolution | Import Style |
|---------|------|--------|-----------------|-------------|
| `vfs-service` | "module" | NodeNext | NodeNext | 必须带 `.js` 后缀 |
| `extension` | "module" | ESNext | Bundler | 不带后缀 |

这造成了不必要的复杂性。既然已经是 TypeScript 项目，我们应该让编译器处理模块解析，而不是在源码里写文件后缀。

## Goals / Non-Goals

**Goals:**
- 统一整个项目的导入风格：都不带后缀
- vfs-service 使用更标准的模块系统，不需要 `.js` 后缀
- 保持所有功能正常工作
- 保持测试正常通过

**Non-Goals:**
- 不改变运行时行为
- 不修改业务逻辑
- 不改变 extension 的构建方式

## Decisions

### 选择的方案：Node16 (CommonJS-style ESM)

**不设置 package.json 的 `type` 字段**（这样默认是 CommonJS）
- `module: Node16`
- `moduleResolution: Node16`
- 导入不需要后缀

**为什么选择 Node16：**
1. ✅ 导入不需要写 `.js` 后缀
2. ✅ TypeScript 自动处理
3. ✅ Node.js 16+ 完全支持
4. ✅ 与现有代码兼容（只是改变编译方式）
5. ✅ Vitest 测试支持良好

**备选方案对比：**

| 方案 | Pros | Cons |
|------|------|------|
| Node16 (推荐) | 不需要后缀，兼容性好 | 输出是 CommonJS（通常没问题） |
| CommonJS | 简单，不需要后缀 | 不是 ESM |
| ESNext+Bundler | 现代，但需要构建工具 | vfs-service 是独立服务，不需要 bundler |

### 具体修改

**vfs-service/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",        // 原来是 NodeNext
    "moduleResolution": "Node16", // 原来是 NodeNext
    ...
  }
}
```

**vfs-service/package.json:**
- 移除 `"type": "module"`（这样默认是 CommonJS）

**所有 .ts/.tsx 文件：**
- 移除所有导入中的 `.js` 后缀

## Risks / Tradeoffs

**风险1：输出变为 CommonJS**
- 缓解：不影响运行，Node.js 完美支持 CommonJS

**风险2：某些导入路径可能需要调整**
- 缓解：先运行 TypeScript 编译检查，确保没有问题
