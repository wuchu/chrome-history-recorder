## ADDED Requirements

### Requirement: 自定义配置文件路径
CLI 必须 (SHALL) 支持指定配置文件路径。

#### Scenario: 使用自定义配置文件
- **WHEN** 用户运行 `ai-classify start -c ./my-config.json`
- **THEN** 系统 必须 (SHALL) 从指定路径加载配置
- **AND** 配置路径 必须 (SHALL) 支持相对路径和绝对路径

#### Scenario: 使用默认配置文件
- **WHEN** 用户运行命令且未指定 `-c`
- **THEN** 系统 必须 (SHALL) 查找当前目录的 `.ai-classify.json`
- **AND** 如文件不存在，必须 (SHALL) 使用默认配置

### Requirement: 纯参数启动模式
CLI 必须 (SHALL) 支持不依赖配置文件直接启动。

#### Scenario: 通过参数指定所有配置
- **WHEN** 用户运行 `ai-classify start -i ./input -o ./output --ollama http://localhost:11434`
- **THEN** 系统 必须 (SHALL) 使用 CLI 参数作为配置
- **AND** 必须 (SHALL) 不要求配置文件存在

#### Scenario: 参数覆盖配置文件
- **WHEN** 同时使用配置文件和 CLI 参数
- **THEN** CLI 参数 必须 (SHALL) 覆盖配置文件的同名选项
- **AND** 配置文件的其他选项 必须 (SHALL) 保持有效

### Requirement: 全局选项支持
CLI 必须 (SHALL) 提供全局选项供所有子命令使用。

#### Scenario: 全局选项可用性
- **WHEN** 用户在任意子命令前添加全局选项
- **THEN** 全局选项 必须 (SHALL) 对该子命令生效
- **AND** 必须支持以下全局选项：
  - `-c, --config <file>` - 配置文件路径
  - `-i, --input <dir>` - 输入目录
  - `-o, --output <dir>` - 输出目录
  - `--ollama-endpoint <url>` - Ollama API 地址
  - `--ollama-vision-model <model>` - 视觉模型
  - `--ollama-text-model <model>` - 文本模型
  - `--ollama-prompt <text>` - 自定义分类提示词
  - `--ollama-max-concurrency <number>` - 最大并发请求数

### Requirement: 自定义分类提示词
CLI 应当 (SHOULD) 支持自定义分类提示词。

#### Scenario: 使用自定义提示词
- **WHEN** 用户运行 `ai-classify start --ollama-prompt "按文件类型分类：文档、图片、代码"`
- **THEN** 系统 应当 (SHOULD) 使用自定义提示词进行分类
- **AND** 提示词 应当 (SHOULD) 替换默认的分类提示

#### Scenario: 默认提示词行为
- **WHEN** 用户未指定 `--ollama-prompt` 参数
- **THEN** 系统 必须 (SHALL) 使用内置默认提示词
- **AND** 保持与现有分类行为一致

### Requirement: 最大并发请求数配置
CLI 应当 (SHOULD) 支持配置最大并发请求数。

#### Scenario: 通过 CLI 设置并发数
- **WHEN** 用户运行 `ai-classify start --ollama-max-concurrency 5`
- **THEN** 系统 应当 (SHOULD) 使用指定的并发数处理文件
- **AND** 该值 应当 (SHOULD) 覆盖配置文件中的 `concurrency` 设置

#### Scenario: 并发数优先级
- **WHEN** 同时存在配置文件并发设置和 CLI 参数
- **THEN** CLI 参数 `--ollama-max-concurrency` 必须 (SHALL) 优先于配置文件
- **AND** 默认值 应当 (SHOULD) 为 3

#### Scenario: 并发数验证
- **WHEN** 用户提供的并发数小于 1 或大于 20
- **THEN** 系统 应当 (SHOULD) 发出警告或限制在合理范围内