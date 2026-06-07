## 1. 环境配置

- [x] 1.1 安装 cross-env 依赖到根目录 package.json
- [x] 1.2 安装 chalk 依赖用于彩色控制台输出
- [x] 1.3 添加 dev:no-browser 脚本到根目录 package.json

## 2. WXT 配置更新

- [x] 2.1 修改 wxt.config.ts，根据 NO_BROWSER 环境变量禁用 webExt
- [x] 2.2 使用独立脚本输出提示（替代 hooks）

## 3. 提示模块实现

- [x] 3.1 创建 scripts/print-instructions.mjs 输出调试提示
- [x] 3.2 实现路径动态获取和格式化
- [x] 3.3 实现中英文多语言提示内容
- [x] 3.4 使用 chalk 实现彩色格式化输出

## 4. 测试验证

- [x] 4.1 测试 pnpm dev:no-browser 不打开浏览器
- [x] 4.2 测试控制台提示显示正确
- [x] 4.3 测试热更新功能正常（WXT 默认支持）
- [x] 4.4 测试中文环境显示中文提示（LANG=zh）
- [x] 4.5 测试英文环境显示英文提示（默认）