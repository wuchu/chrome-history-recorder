## Context

NetworkListener 类使用 Chrome DevTools API 监听网络请求：

```typescript
// 当前代码（有问题）
startListening(): void {
  chrome.devtools.network.onRequestFinished.addListener(this.handleRequest.bind(this));
}

stopListening(): void {
  chrome.devtools.network.onRequestFinished.removeListener(this.handleRequest.bind(this));
}
```

`.bind(this)` 每次调用都创建新的函数引用，导致无法正确移除监听器。

## Goals / Non-Goals

**Goals:**
- 修复监听器引用问题，确保可以正确移除
- 确保 React StrictMode 下监听器正确清理
- 保持现有功能不变

**Non-Goals:**
- 不改变监听逻辑本身
- 不改变数据结构

## Decisions

### 决定: 缓存绑定函数引用

**方案对比**:
- A) 使用箭头函数属性 - 简单，自动绑定 this
- B) 在 constructor 中缓存 `.bind(this)` - 显式缓存
- C) 使用 `()=>this.handleRequest(...)` - 每次创建新函数，同样的问题

**选择**: 方案 B - 在类中添加私有属性缓存绑定函数

```typescript
private boundHandleRequest: (request: ChromeNetworkRequest) => Promise<void>;

constructor() {
  this.boundHandleRequest = this.handleRequest.bind(this);
}

startListening(): void {
  chrome.devtools.network.onRequestFinished.addListener(this.boundHandleRequest);
}

stopListening(): void {
  chrome.devtools.network.onRequestFinished.removeListener(this.boundHandleRequest);
}
```

## Risks / Trade-offs

### Risk: 类已有其他初始化逻辑
→ **Mitigation**: NetworkListener 类没有 constructor，直接添加 boundHandleRequest 属性初始化

### Risk: useNetworkListener hook 的 cleanup 未调用 stopListening
→ **Mitigation**: 检查 useEffect 的 cleanup 是否正确调用 stopListening